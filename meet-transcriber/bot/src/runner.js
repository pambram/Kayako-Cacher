import fs from 'node:fs/promises';
import path from 'node:path';
import { startMeetSession } from './meet-session.js';
import { startCaptureLoop } from './capture.js';
import { analyzeBatch } from './analysis.js';
import { generateTldr, generateStoryArc, generateBulletPoints } from './summarize.js';
import { uploadArtifacts, notifyDelivery, uploadCheckpointArtifacts, sendLifecycleEmail } from './delivery.js';
import { loadExtensionPromptSet } from './extension-compat.js';

class RunAbortedError extends Error {
  constructor(message = 'Run aborted by user') {
    super(message);
    this.name = 'RunAbortedError';
  }
}

function formatTimeLabel(dateInput) {
  return new Date(dateInput).toLocaleTimeString();
}

async function initializeLiveCheckpointFiles(outputDir, meetUrl, runId) {
  await fs.mkdir(outputDir, { recursive: true });
  const runStamp = runId || new Date().toISOString().replace(/[:.]/g, '-');
  const liveTranscriptPath = path.join(outputDir, `meet-transcript-live-${runStamp}.txt`);
  const statePath = path.join(outputDir, `meet-transcript-state-${runStamp}.json`);
  const header = [
    'Google Meet AI Transcription (Live Checkpoint)',
    '===============================================',
    `Started: ${new Date().toISOString()}`,
    `Meet URL: ${meetUrl}`,
    ''
  ].join('\n');
  await fs.writeFile(liveTranscriptPath, `${header}\n`, 'utf8');
  await fs.writeFile(
    statePath,
    JSON.stringify({ startedAt: new Date().toISOString(), meetUrl, entries: [] }, null, 2),
    'utf8'
  );
  return { liveTranscriptPath, statePath };
}

async function appendLiveTranscriptEntry(filePath, entry) {
  const block = `\n[${entry.timestampLabel}]\n${entry.content}\n`;
  await fs.appendFile(filePath, block, 'utf8');
}

async function writeLiveState(statePath, entries, meetUrl) {
  await fs.writeFile(
    statePath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        meetUrl,
        entries
      },
      null,
      2
    ),
    'utf8'
  );
}

function buildTranscript(entries) {
  return entries
    .map((entry) => `[${entry.timestampLabel}]\n${entry.content}`)
    .join('\n\n');
}

function createOutputBundle({ meetUrl, transcript, tldr, storyArc, bulletPoints }) {
  const generated = new Date().toISOString();
  const transcriptDoc = [
    'Google Meet AI Transcription',
    '============================',
    `Generated: ${generated}`,
    `Meet URL: ${meetUrl}`,
    '',
    '=== TL;DR ===',
    tldr || '(not generated)',
    '',
    '=== Transcript ===',
    transcript
  ].join('\n');

  const storyArcDoc = [
    'Google Meet - Story Arc',
    '=======================',
    `Generated: ${generated}`,
    `Meet URL: ${meetUrl}`,
    '',
    storyArc || '(not generated)'
  ].join('\n');

  const bulletPointsDoc = [
    'Google Meet - Bullet Points',
    '===========================',
    `Generated: ${generated}`,
    `Meet URL: ${meetUrl}`,
    '',
    bulletPoints || '(not generated)'
  ].join('\n');

  return {
    transcriptDoc,
    storyArcDoc,
    bulletPointsDoc
  };
}

async function writeLocalOutputs(outputDir, docs) {
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const transcriptPath = path.join(outputDir, `meet-transcript-${stamp}.txt`);
  const arcPath = path.join(outputDir, `meet-story-arc-${stamp}.txt`);
  const bulletsPath = path.join(outputDir, `meet-bullet-points-${stamp}.txt`);

  await Promise.all([
    fs.writeFile(transcriptPath, docs.transcriptDoc, 'utf8'),
    fs.writeFile(arcPath, docs.storyArcDoc, 'utf8'),
    fs.writeFile(bulletsPath, docs.bulletPointsDoc, 'utf8')
  ]);

  return { transcriptPath, arcPath, bulletsPath };
}

function emit(hooks, event, payload = {}) {
  if (hooks?.onStatus) {
    hooks.onStatus(event, payload);
  }
}

function ensureNotAborted(signal) {
  if (signal?.aborted) {
    throw new RunAbortedError();
  }
}

async function resolvePromptParity(config) {
  try {
    const promptSet = await loadExtensionPromptSet();
    return { promptSet, source: 'extension background.js' };
  } catch (error) {
    if (config.strictPromptParity && !config.allowPromptFallback) {
      throw new Error(`Prompt parity enforcement failed: ${error.message}`);
    }
    return { promptSet: null, source: `fallback bot prompts (${error.message})` };
  }
}

export async function runMeetingBot(config, hooks = {}) {
  const abortSignal = hooks.abortSignal;
  const runId = hooks.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const checkpointPrefix = hooks.checkpointPrefix || `checkpoints/${runId}`;
  const finalPrefix = hooks.finalPrefix || `final/${runId}`;
  const summaryFlags = {
    enableTldr: config.enableTldr !== false,
    enableBullets: config.enableBullets !== false,
    enableStoryArc: config.enableStoryArc !== false
  };

  emit(hooks, 'initializing', { runId, summaryFlags });
  ensureNotAborted(abortSignal);

  const promptResolution = await resolvePromptParity(config);
  config.promptSet = promptResolution.promptSet;
  emit(hooks, 'prompt_source', { source: promptResolution.source });

  const entries = [];
  let previousContext = '';
  let session;
  let capture;
  let captureFatalError = null;
  let resolveCaptureFatal;
  const captureFatalPromise = new Promise((resolve) => {
    resolveCaptureFatal = resolve;
  });
  const checkpoint = await initializeLiveCheckpointFiles(config.outputDir, config.meetUrl, runId);
  emit(hooks, 'checkpoint_initialized', { checkpoint });

  let lastCheckpointUploadAt = 0;
  const checkpointIntervalMs = Math.max(1, config.checkpointUploadMinutes || 5) * 60 * 1000;
  let latestCheckpointUpload = null;

  let resolveAbort;
  const abortPromise = new Promise((resolve) => {
    resolveAbort = resolve;
  });
  const abortListener = () => resolveAbort('aborted');
  if (abortSignal) {
    abortSignal.addEventListener('abort', abortListener, { once: true });
  }

  const maybeUploadCheckpoint = async (force = false) => {
    ensureNotAborted(abortSignal);
    if (!config.s3Bucket || !config.checkpointUploadEnabled) return;
    const now = Date.now();
    if (!force && now - lastCheckpointUploadAt < checkpointIntervalMs) return;
    const upload = await uploadCheckpointArtifacts(checkpoint, config, {
      basePrefix: checkpointPrefix,
      fixedSuffix: 'latest'
    });
    lastCheckpointUploadAt = now;
    latestCheckpointUpload = upload;
    emit(hooks, 'checkpoint_uploaded', {
      force,
      files: upload.files,
      uploadedAt: new Date(now).toISOString()
    });
  };

  try {
    ensureNotAborted(abortSignal);
    emit(hooks, 'joining', { meetUrl: config.meetUrl });
    session = await startMeetSession(config);
    emit(hooks, 'joined', { meetUrl: config.meetUrl, ...(session.diagnostics || {}) });
    await sendLifecycleEmail(
      config,
      `Meet Bot joined: ${config.meetUrl}`,
      `Meet bot joined successfully.\n\nRun ID: ${runId}\nMeet URL: ${config.meetUrl}\nTime: ${new Date().toISOString()}`
    );

    capture = startCaptureLoop({
      page: session.page,
      config,
      onFatal: async (error) => {
        captureFatalError = error;
        emit(hooks, 'failed', { stage: 'capture', error: error.message });
        resolveCaptureFatal('capture-fatal');
      },
      onTick: async (tick) => {
        emit(hooks, 'capturing', { ...tick, batchSize: config.batchSize });
      },
      onBatch: async (batch) => {
        emit(hooks, 'batch_processing', { startedAtIso: batch.startedAtIso, endedAtIso: batch.endedAtIso });
        try {
          const analysis = await analyzeBatch(batch, previousContext, config);
          const timestampLabel = formatTimeLabel(batch.endedAtIso);
          const entry = {
            timestamp: batch.endedAtIso,
            timestampLabel,
            content: analysis.text
          };
          entries.push(entry);
          await appendLiveTranscriptEntry(checkpoint.liveTranscriptPath, entry);
          await writeLiveState(checkpoint.statePath, entries, config.meetUrl);
          previousContext = analysis.text;
          emit(hooks, 'batch_analyzed', { entriesCount: entries.length, batchEnd: batch.endedAtIso });
          await maybeUploadCheckpoint(false);
        } catch (error) {
          if (error instanceof RunAbortedError) {
            resolveCaptureFatal('aborted');
            return;
          }
          emit(hooks, 'analysis_error', { error: error.message });
        }
      }
    });

    const endReason = await Promise.race([
      session.waitForEnd(),
      captureFatalPromise,
      abortPromise
    ]);
    if (endReason === 'aborted') {
      emit(hooks, 'cancelled', { reason: 'user-request' });
    }
    emit(hooks, 'meeting_end_detected', { endReason });
    await capture.stop();
    emit(hooks, 'capture_stopped', {});
  } finally {
    if (abortSignal) {
      abortSignal.removeEventListener('abort', abortListener);
    }
    if (session) {
      await session.close().catch((error) => {
        emit(hooks, 'close_warning', { error: error.message });
      });
    }
  }

  if (!abortSignal?.aborted) {
    await maybeUploadCheckpoint(true);
  }

  if (captureFatalError) {
    emit(hooks, 'warning', { message: 'Capture fatal stop occurred; using partial transcript.' });
  }

  const transcript = buildTranscript(entries);
  emit(hooks, 'transcript_ready', { entriesCount: entries.length });

  if (abortSignal?.aborted) {
    const transcriptLink = latestCheckpointUpload?.files?.find((file) => file.name.includes('live'))?.url || '';
    await sendLifecycleEmail(
      config,
      `Meet Bot cancelled: ${config.meetUrl}`,
      `Meet bot was cancelled.\n\nRun ID: ${runId}\nEntries captured: ${entries.length}\nMeet URL: ${config.meetUrl}\nTranscript link: ${transcriptLink || 'not available'}\nTime: ${new Date().toISOString()}`
    );
    return {
      runId,
      cancelled: true,
      entriesCount: entries.length,
      checkpoint,
      latestCheckpointUpload,
      localPaths: null,
      finalUpload: { uploaded: false, files: [] },
      summaryFlags
    };
  }

  let tldr = '(skipped)';
  let storyArc = '(skipped)';
  let bulletPoints = '(skipped)';

  emit(hooks, 'summarizing', summaryFlags);
  if (summaryFlags.enableTldr) {
    tldr = await generateTldr(transcript, config);
  }
  if (summaryFlags.enableStoryArc) {
    storyArc = await generateStoryArc(entries, config, async (progress) => {
      emit(hooks, 'summary_progress', { type: 'storyArc', progress });
    });
  }
  if (summaryFlags.enableBullets) {
    bulletPoints = await generateBulletPoints(transcript, config);
  }

  const docs = createOutputBundle({
    meetUrl: config.meetUrl,
    transcript,
    tldr,
    storyArc,
    bulletPoints
  });

  const localPaths = await writeLocalOutputs(config.outputDir, docs);
  emit(hooks, 'local_output_written', { localPaths });

  const finalUpload = await uploadArtifacts(
    [
      { name: path.basename(localPaths.transcriptPath), content: docs.transcriptDoc },
      { name: path.basename(localPaths.arcPath), content: docs.storyArcDoc },
      { name: path.basename(localPaths.bulletsPath), content: docs.bulletPointsDoc }
    ],
    config,
    { basePrefix: finalPrefix }
  );
  if (finalUpload.uploaded) {
    await notifyDelivery(finalUpload, config);
    emit(hooks, 'final_upload_complete', { files: finalUpload.files });
  }
  const transcriptLink = finalUpload.files?.find((file) => file.name.includes('transcript'))?.url
    || latestCheckpointUpload?.files?.find((file) => file.name.includes('live'))?.url
    || '';
  await sendLifecycleEmail(
    config,
    `Meet Bot finished: ${config.meetUrl}`,
    `Meet bot finished.\n\nRun ID: ${runId}\nEntries: ${entries.length}\nMeet URL: ${config.meetUrl}\nTranscript link: ${transcriptLink || 'not available'}\nTime: ${new Date().toISOString()}`
  );

  const result = {
    runId,
    entriesCount: entries.length,
    checkpoint,
    latestCheckpointUpload,
    localPaths,
    finalUpload,
    summaryFlags
  };
  emit(hooks, 'completed', result);
  return result;
}
