import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import fs from 'node:fs/promises';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateFreshPresignedUrl } from './delivery.js';
import { parseCliArgs, loadConfig } from './config.js';
import { JobManager } from './job-manager.js';

const cliArgs = parseCliArgs(process.argv.slice(2));
const config = loadConfig(cliArgs, { requireMeetUrl: false, requireSecrets: false });
const app = express();
const port = Number(process.env.BOT_UI_PORT || cliArgs.port || 3030);
const envPath = path.resolve(process.cwd(), '.env');

// ─── S3 helpers for persistent config + job state ─────────────
const s3 = config.s3Bucket ? new S3Client({ region: config.awsRegion }) : null;

function getUserEmail(req) {
  // ALB Cognito integration sets this header for authenticated requests.
  return (req.headers['x-amzn-oidc-identity'] || 'local').replace(/[^a-zA-Z0-9@._-]/g, '_');
}

async function s3Get(key) {
  if (!s3 || !config.s3Bucket) return null;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_err) {
    return null;
  }
}

async function s3Put(key, data) {
  if (!s3 || !config.s3Bucket) return;
  await s3.send(new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json; charset=utf-8'
  }));
}

function userConfigKey(userEmail) {
  return `${config.s3Prefix}/user-config/${userEmail}.json`;
}
const JOBS_STATE_S3_KEY = `${config.s3Prefix}/state/jobs-state.json`;

const jobManager = new JobManager(config, { s3Get, s3Put, jobsStateKey: JOBS_STATE_S3_KEY });

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

app.use(express.json());

// Landing page for unauthenticated visitors in production.
// The ALB adds x-amzn-oidc-identity for authenticated requests.
// When the ALB forwards unauthenticated requests (OnUnauthenticatedRequest: allow on the root rule),
// we serve a landing page instead of the app. Locally the header is absent but NODE_ENV != production.
app.get('/', (req, res, next) => {
  const authenticated = Boolean(req.headers['x-amzn-oidc-identity']);
  if (!authenticated && process.env.NODE_ENV === 'production') {
    // Link to a protected path so the ALB initiates the Cognito flow with its own state token.
    // Directly constructing a Cognito URL bypasses ALB's nonce, causing 401 on callback.
    const loginUrl = '/fleet';
    return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Witness.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-weight: 300;
      background: #0e0d0b;
      color: #f5f2eb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wrap {
      max-width: 440px;
      width: 90%;
      padding: 48px 40px;
      background: #1a1815;
      border: 1px solid rgba(245,242,235,0.08);
      border-top: 2px solid #d4820a;
    }
    .eyebrow {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #ef9f27;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-weight: 900;
      font-size: 2.6rem;
      letter-spacing: -0.01em;
      line-height: 1;
      margin-bottom: 1rem;
    }
    h1 span { color: #ef9f27; }
    .amber-bar {
      width: 2rem;
      height: 2px;
      background: #d4820a;
      margin: 1.25rem 0;
    }
    p {
      font-size: 0.9rem;
      color: rgba(245,242,235,0.55);
      line-height: 1.75;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #d4820a;
      color: #0e0d0b;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.78rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 12px 22px;
      border: none;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s;
      border-radius: 2px;
    }
    .btn:hover { background: #ef9f27; }
    .btn svg { flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">// Meeting Intelligence</p>
    <h1>Witness<span>.</span></h1>
    <div class="amber-bar"></div>
    <p>Eyes and ears in every call. Sign in with your Google account to access the fleet dashboard.</p>
    <a class="btn" href="${loginUrl}">
      <svg width="16" height="16" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
      Sign in with Google
    </a>
  </div>
</body>
</html>`);
  }
  next();
});

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

const CONFIG_KEYS = [
  'technicalMode', 'captureIntervalSec', 'batchSize', 'screenshotQuality',
  'maxMeetingMinutes', 'artifactUploadEndpoint', 'analysisModel', 'summaryModel',
  'tldrModel', 'arcModel', 'bulletsModel', 'guestName', 'forceGoogleSignIn',
  'enableMetaAnalysis', 'metaAnalysisInterval', 'metaAnalysisWindow',
  'enableScreenshotClassifier', 'screenshotClassifierModel', 'ktModel', 'meetingObjective',
  'customSummarizers', 'googleEmail'
];

app.get('/api/config', async (req, res) => {
  const base = jobManager.getBaseConfig();
  const defaults = Object.fromEntries(CONFIG_KEYS.map((k) => [k, base[k]]));
  // Layer user-specific S3 overrides on top of task-def defaults.
  const userKey = userConfigKey(getUserEmail(req));
  const userOverrides = await s3Get(userKey) || {};
  res.json({ config: { ...defaults, ...userOverrides } });
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
    if (value === undefined || value === null) continue;
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
      artifactUploadEndpoint: 'ARTIFACT_UPLOAD_ENDPOINT',
      analysisModel: 'ANALYSIS_MODEL',
      summaryModel: 'SUMMARY_MODEL',
      tldrModel: 'TLDR_MODEL',
      arcModel: 'ARC_MODEL',
      bulletsModel: 'BULLETS_MODEL',
      guestName: 'GUEST_NAME',
      forceGoogleSignIn: 'FORCE_GOOGLE_SIGNIN',
      enableMetaAnalysis: 'ENABLE_META_ANALYSIS',
      metaAnalysisInterval: 'META_ANALYSIS_INTERVAL',
      metaAnalysisWindow: 'META_ANALYSIS_WINDOW',
      enableScreenshotClassifier: 'ENABLE_SCREENSHOT_CLASSIFIER',
      screenshotClassifierModel: 'SCREENSHOT_CLASSIFIER_MODEL',
      ktModel: 'KT_MODEL',
      meetingObjective: 'MEETING_OBJECTIVE'
    };
    for (const [k, envKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates[envKey] = body[k];
      }
    }
    // customSummarizers is stored as JSON, not a simple env var.
    if (Array.isArray(body.customSummarizers)) {
      updates.CUSTOM_SUMMARIZERS = JSON.stringify(body.customSummarizers);
    }
    // Persist to .env for local dev, AND to S3 per user for production.
    await writeEnvValues(updates);
    const userKey = userConfigKey(getUserEmail(req));
    const userPrefs = Object.fromEntries(
      [...Object.keys(map), 'customSummarizers']
        .filter((k) => Object.prototype.hasOwnProperty.call(body, k))
        .map((k) => [k, body[k]])
    );
    await s3Put(userKey, userPrefs);
    const next = loadConfig({}, { requireMeetUrl: false });
    // Layer user prefs so in-memory config stays correct too.
    jobManager.setBaseConfig({ ...next, ...userPrefs });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    // Apply per-user saved config overrides so settings like guestName are
    // always respected, even if the ECS task was restarted since the last save.
    const userKey = userConfigKey(getUserEmail(req));
    const userOverrides = await s3Get(userKey).catch(() => ({})) || {};
    if (Object.keys(userOverrides).length) {
      const base = jobManager.getBaseConfig();
      jobManager.setBaseConfig({ ...base, ...userOverrides });
    }
    const job = jobManager.createJob(req.body || {});
    res.status(201).json({ job });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate a fresh presigned URL for a stored S3 key (never expires at access time).
app.get('/api/s3/presign', async (req, res) => {
  const { key } = req.query;
  if (!key) { res.status(400).json({ error: 'key required' }); return; }
  if (!config.s3Bucket) { res.status(503).json({ error: 'S3 not configured' }); return; }
  try {
    const url = await generateFreshPresignedUrl(config.s3Bucket, key, config.awsRegion);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/jobs/:id', (req, res) => {
  const { displayName, status } = req.body || {};
  if (displayName === undefined && status === undefined) {
    res.status(400).json({ error: 'displayName or status is required' });
    return;
  }
  const job = jobManager.getJobInternal(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (displayName !== undefined) {
    jobManager.renameJob(req.params.id, displayName);
  }
  if (status !== undefined) {
    const allowed = ['ended', 'completed', 'failed', 'cancelled'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    jobManager.overrideStatus(req.params.id, status);
  }
  res.json({ ok: true });
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  const cancelled = jobManager.cancelJob(req.params.id);
  if (!cancelled) {
    res.status(409).json({ ok: false, error: 'Job cannot be cancelled in current state' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/jobs/:id/gdocs-retry', async (req, res) => {
  try {
    const result = await jobManager.retryGoogleDoc(req.params.id);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/summaries/:type', async (req, res) => {
  try {
    const incremental = Boolean(req.query.incremental === 'true' || req.body?.incremental);
    const result = await jobManager.generateSummary(req.params.id, req.params.type, { incremental });
    res.json({ ok: true, summary: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/jobs/:id/summaries/:type', (req, res) => {
  const cancelled = jobManager.cancelSummary(req.params.id, req.params.type);
  if (!cancelled) {
    res.status(409).json({ ok: false, error: 'Summary not running or not found' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/jobs/:id/summaries/:type/file', async (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
  const summary = job.summaryArtifacts?.[req.params.type];
  if (!summary) { res.status(404).json({ error: 'Summary not generated yet' }); return; }

  const { fetchS3ObjectText } = await import('./delivery.js');
  let content = null;
  let filename = `${req.params.type}.txt`;
  let isMarkdown = false;

  // 1. Try local file.
  if (summary.localPath && await exists(summary.localPath)) {
    content = await fs.readFile(summary.localPath, 'utf8');
    filename = path.basename(summary.localPath);
    isMarkdown = filename.endsWith('.md');
  }
  // 2. Fall back to S3 key (server credentials, never expires).
  if (content === null && summary.s3Key && config.s3Bucket) {
    try {
      content = await fetchS3ObjectText(config.s3Bucket, summary.s3Key, config.awsRegion);
      filename = path.basename(summary.s3Key);
      isMarkdown = filename.endsWith('.md');
    } catch (err) {
      console.warn(`[summaries/file] S3 fallback failed for ${req.params.type}:`, err.message);
    }
  }

  if (content === null) { res.status(404).json({ error: 'Summary file not available locally or in S3' }); return; }

  res.setHeader('Content-Type', isMarkdown ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
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
