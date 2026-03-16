import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import fs from 'node:fs/promises';
import { parseCliArgs, loadConfig } from './config.js';
import { JobManager } from './job-manager.js';

const cliArgs = parseCliArgs(process.argv.slice(2));
const config = loadConfig(cliArgs, { requireMeetUrl: false });
const app = express();
const port = Number(process.env.BOT_UI_PORT || cliArgs.port || 3030);
const jobManager = new JobManager(config);
const envPath = path.resolve(process.cwd(), '.env');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'ui')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/api/jobs', (_req, res) => {
  res.json({ jobs: jobManager.listJobs() });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ job });
});

app.get('/api/jobs/:id/live-transcript', async (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const candidates = [
    job.checkpoint?.liveTranscriptPath,
    path.resolve(config.outputDir, `meet-transcript-live-${job.id}.txt`),
    job.localPaths?.transcriptPath || null
  ].filter(Boolean);
  let filePath = null;
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      filePath = candidate;
      break;
    }
  }
  if (!filePath) {
    res.status(404).json({ error: 'Live transcript not available yet' });
    return;
  }
  if (!filePath) {
    res.status(404).json({ error: 'Live transcript not available yet' });
    return;
  }
  try {
    const content = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: `Failed to read transcript: ${error.message}` });
  }
});

app.get('/api/config', (_req, res) => {
  const current = jobManager.getBaseConfig();
  res.json({
    config: {
      technicalMode: current.technicalMode,
      captureIntervalSec: current.captureIntervalSec,
      batchSize: current.batchSize,
      screenshotQuality: current.screenshotQuality,
      maxMeetingMinutes: current.maxMeetingMinutes,
      analysisModel: current.analysisModel,
      summaryModel: current.summaryModel,
      tldrModel: current.tldrModel,
      arcModel: current.arcModel,
      bulletsModel: current.bulletsModel,
      guestName: current.guestName,
      forceGoogleSignIn: current.forceGoogleSignIn,
      joinWaitSec: current.joinWaitSec,
      enableStealth: current.enableStealth,
      checkpointUploadEnabled: current.checkpointUploadEnabled,
      checkpointUploadMinutes: current.checkpointUploadMinutes,
      strictPromptParity: current.strictPromptParity,
      allowPromptFallback: current.allowPromptFallback
    }
  });
});

function toEnvValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

async function writeEnvValues(updates) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch (_error) {
    content = '';
  }
  const lines = content ? content.split('\n') : [];
  const indexByKey = new Map();
  lines.forEach((line, idx) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m) indexByKey.set(m[1], idx);
  });

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') continue;
    const nextLine = `${key}=${toEnvValue(value)}`;
    if (indexByKey.has(key)) {
      lines[indexByKey.get(key)] = nextLine;
    } else {
      lines.push(nextLine);
    }
    process.env[key] = toEnvValue(value);
  }
  await fs.writeFile(envPath, `${lines.join('\n').replace(/\n+$/,'')}\n`, 'utf8');
}

app.put('/api/config', async (req, res) => {
  try {
    const body = req.body || {};
    const updates = {};
    const map = {
      technicalMode: 'TECHNICAL_MODE',
      captureIntervalSec: 'CAPTURE_INTERVAL',
      batchSize: 'BATCH_SIZE',
      screenshotQuality: 'SCREENSHOT_QUALITY',
      maxMeetingMinutes: 'MAX_MEETING_MINUTES',
      analysisModel: 'ANALYSIS_MODEL',
      summaryModel: 'SUMMARY_MODEL',
      tldrModel: 'TLDR_MODEL',
      arcModel: 'ARC_MODEL',
      bulletsModel: 'BULLETS_MODEL',
      guestName: 'GUEST_NAME',
      forceGoogleSignIn: 'FORCE_GOOGLE_SIGNIN',
      joinWaitSec: 'JOIN_WAIT_SEC',
      enableStealth: 'ENABLE_STEALTH',
      checkpointUploadEnabled: 'CHECKPOINT_UPLOAD_ENABLED',
      checkpointUploadMinutes: 'CHECKPOINT_UPLOAD_MINUTES',
      strictPromptParity: 'STRICT_PROMPT_PARITY',
      allowPromptFallback: 'ALLOW_PROMPT_FALLBACK'
    };
    for (const [k, envKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates[envKey] = body[k];
      }
    }
    await writeEnvValues(updates);
    const next = loadConfig({}, { requireMeetUrl: false });
    jobManager.setBaseConfig(next);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs', (req, res) => {
  try {
    const job = jobManager.createJob(req.body || {});
    res.status(201).json({ job });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  const cancelled = jobManager.cancelJob(req.params.id);
  if (!cancelled) {
    res.status(409).json({ ok: false, error: 'Job cannot be cancelled in current state' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/jobs/:id/summaries/:type', async (req, res) => {
  try {
    const result = await jobManager.generateSummary(req.params.id, req.params.type);
    res.json({ ok: true, summary: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/jobs/:id/summaries/:type/file', async (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const summary = job.summaryArtifacts?.[req.params.type];
  if (!summary?.localPath || !(await exists(summary.localPath))) {
    res.status(404).json({ error: 'Summary file not available' });
    return;
  }
  const content = await fs.readFile(summary.localPath, 'utf8');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(summary.localPath)}"`);
  res.send(content);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.resolve(process.cwd(), 'ui', 'index.html'));
});

app.listen(port, () => {
  console.log(`Bot scheduler UI running at http://localhost:${port}`);
});
