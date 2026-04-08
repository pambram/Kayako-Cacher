/**
 * runMeetingBotMediaApi — Meet Media API capture mode runner.
 *
 * Same lifecycle interface as runMeetingBot() in runner.js.
 * Emits identical events so job-manager.js requires no changes.
 *
 * Instead of a Puppeteer browser bot, this:
 *   1. Authenticates via OAuth2
 *   2. Connects to the meeting via the Meet Media API (WebRTC, no browser)
 *   3. Receives real-time audio + video streams
 *   4. Transcribes audio via Whisper/Deepgram
 *   5. Captures video frames periodically
 *   6. Feeds both into the existing analyzeBatch() pipeline
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { MediaApiSession } from './webrtc-client.js';
import { VideoCaptureLoop } from './video-capture.js';
import { AudioCaptureLoop } from './audio-capture.js';
import { analyzeBatch } from '../analysis.js';
import { classifyAndUploadKtScreenshot } from '../screenshot-classifier.js';
import {
  generateTldr, generateStoryArc, generateBulletPoints,
  generateTldrMapReduce, generateBulletPointsMapReduce, generateStoryArcMapReduce,
  generateMetaSummary, estimateTokenCount, MAX_SINGLE_SUMMARY_INPUT_TOKENS
} from '../summarize.js';
import { uploadArtifacts, notifyDelivery, uploadCheckpointArtifacts, sendLifecycleEmail, uploadSummaryToS3, syncManifestToS3 } from '../delivery.js';
import { loadExtensionPromptSet } from '../extension-compat.js';

class RunAbortedError extends Error {
  constructor(msg = 'Run aborted') { super(msg); this.name = 'RunAbortedError'; }
}

function formatTimeLabel(d) { return new Date(d).toLocaleTimeString(); }
function emit(hooks, event, payload = {}) { if (hooks?.onStatus) hooks.onStatus(event, payload); }
function ensureNotAborted(sig) { if (sig?.aborted) throw new RunAbortedError(); }

async function initCheckpoints(outputDir, meetUrl, runId) {
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = runId || new Date().toISOString().replace(/[:.]/g, '-');
  const liveTranscriptPath = path.join(outputDir, `meet-transcript-live-${stamp}.txt`);
  const statePath = path.join(outputDir, `meet-transcript-state-${stamp}.json`);
  const header = ['Google Meet AI Transcription (Live Checkpoint — Media API mode)', '===============================================', `Started: ${new Date().toISOString()}`, `Meet URL: ${meetUrl}`, ''].join('\n');
  await fs.writeFile(liveTranscriptPath, `${header}\n`, 'utf8');
  await fs.writeFile(statePath, JSON.stringify({ startedAt: new Date().toISOString(), meetUrl, entries: [] }, null, 2), 'utf8');
  return { liveTranscriptPath, statePath };
}

async function appendEntry(filePath, entry) {
  await fs.appendFile(filePath, `\n[${entry.timestampLabel}]\n${entry.content}\n`, 'utf8');
}

async function writeState(statePath, entries, meetUrl) {
  await fs.writeFile(statePath, JSON.stringify({ updatedAt: new Date().toISOString(), meetUrl, entries }, null, 2), 'utf8');
}

function buildTranscript(entries) {
  return entries.map((e) => `[${e.timestampLabel}]\n${e.content}`).join('\n\n');
}

export async function runMeetingBotMediaApi(config, hooks = {}) {
  const abortSignal = hooks.abortSignal;
  const runId = hooks.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const checkpointPrefix = hooks.checkpointPrefix || `checkpoints/${runId}`;
  const finalPrefix = hooks.finalPrefix || `final/${runId}`;

  emit(hooks, 'initializing', { runId, mode: 'media-api' });
  ensureNotAborted(abortSignal);

  // Load prompts for analysis parity with extension
  let promptSet = null;
  try {
    promptSet = await loadExtensionPromptSet();
    emit(hooks, 'prompt_source', { source: 'extension background.js' });
  } catch (err) {
    if (config.strictPromptParity && !config.allowPromptFallback) throw new Error(`Prompt parity failed: ${err.message}`);
    emit(hooks, 'prompt_source', { source: `fallback (${err.message})` });
  }
  config = { ...config, promptSet };

  const entries = [];
  let previousContext = '';
  let batchCounter = 0;
  let sessionEnded = false;
  const selectedScreenshotHistory = [];

  const checkpoint = await initCheckpoints(config.outputDir, config.meetUrl, runId);
  emit(hooks, 'checkpoint_initialized', { checkpoint });

  let lastCheckpointUploadAt = 0;
  const checkpointIntervalMs = Math.max(1, config.checkpointUploadMinutes || 5) * 60 * 1000;
  let latestCheckpointUpload = null;

  // Abort promise
  let resolveAbort;
  const abortPromise = new Promise((r) => { resolveAbort = r; });
  const abortListener = () => resolveAbort('aborted');
  if (abortSignal) abortSignal.addEventListener('abort', abortListener, { once: true });

  // Session-ended promise
  let resolveSessionEnd;
  const sessionEndPromise = new Promise((r) => { resolveSessionEnd = r; });

  const maybeUploadCheckpoint = async (force = false) => {
    if (!force) ensureNotAborted(abortSignal);
    if (!config.s3Bucket || !config.checkpointUploadEnabled) return;
    const now = Date.now();
    if (!force && now - lastCheckpointUploadAt < checkpointIntervalMs) return;
    const upload = await uploadCheckpointArtifacts(checkpoint, config, { basePrefix: checkpointPrefix, fixedSuffix: 'latest' });
    lastCheckpointUploadAt = now;
    latestCheckpointUpload = upload;
    emit(hooks, 'checkpoint_uploaded', { force, files: upload.files, uploadedAt: new Date(now).toISOString() });
  };

  const onBatch = async (batch) => {
    emit(hooks, 'batch_processing', { startedAtIso: batch.startedAtIso, endedAtIso: batch.endedAtIso });
    try {
      const analysis = await analyzeBatch(batch, previousContext, config);
      let finalContent = analysis.text;

      // KT screenshot classifier — identical to runner.js Puppeteer path
      if (config.enableScreenshotClassifier) {
        try {
          emit(hooks, 'screenshot_classifier_running', { batchNumber: entries.length + 1, screenshots: (batch.screenshots || []).length });
          const classifierResult = await classifyAndUploadKtScreenshot(batch, analysis.text, config, {
            batchNumber: entries.length + 1,
            runId,
            previousSelections: selectedScreenshotHistory
          });
          if (classifierResult.selected && classifierResult.imageUrl) {
            selectedScreenshotHistory.push({ batchNumber: entries.length + 1, reason: classifierResult.reason || '' });
            finalContent += `\n\n![Screenshot batch ${entries.length + 1}](${classifierResult.imageUrl})`;
            emit(hooks, 'screenshot_classifier_selected', { batchNumber: entries.length + 1, selectedIndex: classifierResult.selectedIndex, reason: classifierResult.reason, imageUrl: classifierResult.imageUrl });
          } else {
            emit(hooks, 'screenshot_classifier_skipped', { batchNumber: entries.length + 1, reason: classifierResult.reason || 'No screenshot selected' });
          }
        } catch (classifierError) {
          emit(hooks, 'screenshot_classifier_error', { batchNumber: entries.length + 1, error: classifierError.message });
        }
      }

      const entry = { timestamp: batch.endedAtIso, timestampLabel: formatTimeLabel(batch.endedAtIso), content: finalContent };
      entries.push(entry);
      batchCounter += 1;
      await appendEntry(checkpoint.liveTranscriptPath, entry);
      await writeState(checkpoint.statePath, entries, config.meetUrl);
      previousContext = analysis.text;
      emit(hooks, 'batch_analyzed', { entriesCount: entries.length, batchEnd: batch.endedAtIso });
      await maybeUploadCheckpoint(false);

      // Periodic meta-summary
      if (config.enableMetaAnalysis && batchCounter % (config.metaAnalysisInterval || 5) === 0 && entries.length > 0) {
        const windowMs = (config.metaAnalysisWindow || 5) * 60 * 1000;
        const recentEntries = entries.filter((e) => e.timestamp >= new Date(Date.now() - windowMs).toISOString());
        if (recentEntries.length > 0) {
          try {
            emit(hooks, 'meta_summary_running', { batch: batchCounter, window: config.metaAnalysisWindow || 5 });
            const metaSummary = await generateMetaSummary(recentEntries, config);
            emit(hooks, 'meta_summary', { batch: batchCounter, summary: metaSummary });
            await fs.appendFile(checkpoint.liveTranscriptPath, `\n--- Auto-Summary (batch ${batchCounter}) ---\n${metaSummary}\n`, 'utf8');
          } catch (err) {
            emit(hooks, 'meta_summary_error', { error: err.message });
          }
        }
      }
    } catch (err) {
      if (err instanceof RunAbortedError) return;
      const isHardQuota = err.message.includes('(400)') && err.message.toLowerCase().includes('usage limits');
      if (isHardQuota) {
        emit(hooks, 'analysis_quota_exceeded', { error: err.message });
        videoCapture?.stop();
        return;
      }
      // Fallback: save raw captions so no meeting content is lost
      const fallbackContent = batch.captions?.trim()
        ? `[LLM analysis failed: ${err.message}]\n\n${batch.captions}`
        : `[LLM analysis failed: ${err.message} — no captions captured for this window]`;
      const entry = {
        timestamp: batch.endedAtIso,
        timestampLabel: formatTimeLabel(batch.endedAtIso),
        content: fallbackContent
      };
      entries.push(entry);
      batchCounter += 1;
      await appendEntry(checkpoint.liveTranscriptPath, entry).catch(() => {});
      await writeState(checkpoint.statePath, entries, config.meetUrl).catch(() => {});
      emit(hooks, 'analysis_error', { error: err.message, fallback: true });
    }
  };

  // ── Video capture (frames arrive from browser canvas via exposeFunction) ──
  const videoCapture = new VideoCaptureLoop({
    captureIntervalSec: config.captureIntervalSec,
    screenshotQuality: config.screenshotQuality,
    batchSize: config.batchSize,
    onBatch,
    onTick: (tick) => emit(hooks, 'capturing', { ...tick, batchSize: config.batchSize })
  });

  // ── Audio capture (transcription feeds captions into video capture) ───────
  const audioCapture = new AudioCaptureLoop({
    onCaption: (text) => { videoCapture.addCaption(text); },
    transcriptionMode: config.transcriptionMode || 'none',
    openaiApiKey: config.openaiApiKey,
    deepgramApiKey: config.deepgramApiKey
  });

  // ── Media API session ────────────────────────────────────────────────────
  const session = new MediaApiSession({
    // Video frames captured inside the browser (canvas) → forwarded to video capture loop
    onVideoFrame: (base64jpeg) => { videoCapture.addBrowserFrame(base64jpeg); },
    // Audio WAV chunks captured inside the browser → forwarded to audio capture loop
    onAudioChunk: (base64wav) => { audioCapture.addBrowserAudioChunk(base64wav); },
    onParticipants: (data) => emit(hooks, 'participants_update', data),
    onSessionState: (state) => emit(hooks, 'media_api_session_state', { state }),
    onDisconnect: (reason) => {
      console.log(`[mediaRunner] Session disconnected: ${reason}`);
      emit(hooks, 'meeting_end_detected', { endReason: reason });
      sessionEnded = true;
      resolveSessionEnd(reason);
    }
  });

  try {
    emit(hooks, 'joining', { meetUrl: config.meetUrl, mode: 'media-api' });
    await session.connect(config.meetUrl, config);
    emit(hooks, 'joined', { meetUrl: config.meetUrl, mode: 'media-api' });

    await sendLifecycleEmail(config, `Meet Bot joined (Media API): ${config.meetUrl}`, `Meet bot joined via Media API.\n\nRun ID: ${runId}\nMeet URL: ${config.meetUrl}\nTime: ${new Date().toISOString()}`).catch(() => {});

    await audioCapture.start();
    videoCapture.start();

    emit(hooks, 'capturing', { screenshotCount: 0, consecutiveScreenshotFailures: 0, batchSize: config.batchSize });

    // Wait for session end or user abort
    const endReason = await Promise.race([sessionEndPromise, abortPromise]);
    emit(hooks, 'meeting_end_detected', { endReason });

  } finally {
    if (abortSignal) abortSignal.removeEventListener('abort', abortListener);
    await videoCapture.stop().catch(() => {});
    await audioCapture.stop().catch(() => {});
    session.disconnect();
    emit(hooks, 'capture_stopped', {});
  }

  await maybeUploadCheckpoint(true);

  const userEnded = abortSignal?.aborted;
  const transcript = buildTranscript(entries);
  emit(hooks, 'transcript_ready', { entriesCount: entries.length });

  if (userEnded) {
    await sendLifecycleEmail(config, `Meet Bot ended (Media API): ${config.meetUrl}`, `Meet bot session ended.\n\nRun ID: ${runId}\nEntries: ${entries.length}\nMeet URL: ${config.meetUrl}\nTime: ${new Date().toISOString()}`).catch(() => {});
    return { runId, cancelled: true, userEnded: true, entriesCount: entries.length, checkpoint, latestCheckpointUpload, localPaths: null, finalUpload: { uploaded: false, files: [] } };
  }

  // Generate end-of-session summaries (same as Puppeteer runner)
  const summaryFlags = { enableTldr: config.enableTldr !== false, enableBullets: config.enableBullets !== false, enableStoryArc: config.enableStoryArc !== false };
  let tldr = '(skipped)', storyArc = '(skipped)', bulletPoints = '(skipped)';
  emit(hooks, 'summarizing', summaryFlags);
  if (summaryFlags.enableTldr) {
    const tokens = estimateTokenCount(transcript);
    tldr = tokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS ? await generateTldrMapReduce(transcript, config) : await generateTldr(transcript, config);
  }
  if (summaryFlags.enableStoryArc) storyArc = await generateStoryArc(entries, config, (p) => emit(hooks, 'summary_progress', { type: 'storyArc', progress: p }));
  if (summaryFlags.enableBullets) {
    const tokens = estimateTokenCount(transcript);
    bulletPoints = tokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS ? await generateBulletPointsMapReduce(transcript, config) : await generateBulletPoints(transcript, config);
  }

  // Write local files
  const stamp = new Date().toISOString().slice(0, 10);
  await fs.mkdir(config.outputDir, { recursive: true });
  const transcriptDoc = [`Google Meet AI Transcription (Media API mode)`, '============================', `Generated: ${new Date().toISOString()}`, `Meet URL: ${config.meetUrl}`, '', '=== TL;DR ===', tldr, '', '=== Transcript ===', transcript].join('\n');
  const transcriptPath = path.join(config.outputDir, `meet-transcript-${stamp}.txt`);
  const arcPath = path.join(config.outputDir, `meet-story-arc-${stamp}.txt`);
  const bulletsPath = path.join(config.outputDir, `meet-bullet-points-${stamp}.txt`);
  await Promise.all([
    fs.writeFile(transcriptPath, transcriptDoc, 'utf8'),
    fs.writeFile(arcPath, storyArc, 'utf8'),
    fs.writeFile(bulletsPath, bulletPoints, 'utf8')
  ]);
  const localPaths = { transcriptPath, arcPath, bulletsPath };
  emit(hooks, 'local_output_written', { localPaths });

  const finalUpload = await uploadArtifacts([
    { name: path.basename(transcriptPath), content: transcriptDoc },
    { name: path.basename(arcPath), content: storyArc },
    { name: path.basename(bulletsPath), content: bulletPoints }
  ], config, { basePrefix: finalPrefix });
  if (finalUpload.uploaded) {
    await notifyDelivery(finalUpload, config);
    emit(hooks, 'final_upload_complete', { files: finalUpload.files });
  }

  await sendLifecycleEmail(config, `Meet Bot finished (Media API): ${config.meetUrl}`, `Meet bot finished.\n\nRun ID: ${runId}\nEntries: ${entries.length}\nMeet URL: ${config.meetUrl}\nTime: ${new Date().toISOString()}`).catch(() => {});

  const result = { runId, entriesCount: entries.length, checkpoint, latestCheckpointUpload, localPaths, finalUpload };
  emit(hooks, 'completed', result);
  return result;
}
