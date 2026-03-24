import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import fs from 'node:fs/promises';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
  <title>Meet Fleet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:#0d0d0f;color:#eee;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#1c1c1e;border:1px solid #2a2a2d;border-radius:16px;padding:48px 40px;max-width:420px;width:90%;text-align:center}
    .logo{width:52px;height:52px;background:rgba(129,140,248,0.12);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px}
    h1{font-size:1.6rem;font-weight:700;margin-bottom:8px;letter-spacing:-0.02em}
    p{color:#888;font-size:0.9rem;line-height:1.6;margin-bottom:32px}
    .btn{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#111;font-size:0.95rem;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;border:none;cursor:pointer;transition:opacity .15s}
    .btn:hover{opacity:.88}
    .btn svg{flex-shrink:0}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect width="26" height="26" rx="7" fill="#818cf8" fill-opacity="0.12"/>
        <circle cx="13" cy="13" r="4.5" fill="#818cf8"/>
        <circle cx="5" cy="13" r="2.2" fill="#818cf8" opacity=".45"/>
        <circle cx="21" cy="13" r="2.2" fill="#818cf8" opacity=".45"/>
        <circle cx="13" cy="5" r="2.2" fill="#818cf8" opacity=".45"/>
        <circle cx="13" cy="21" r="2.2" fill="#818cf8" opacity=".45"/>
      </svg>
    </div>
    <h1>Meet Fleet</h1>
    <p>AI-powered meeting transcription and analysis.<br>Sign in with your Google account to continue.</p>
    <a class="btn" href="${loginUrl}">
      <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
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
  'enableScreenshotClassifier', 'screenshotClassifierModel', 'ktModel', 'meetingObjective'
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
    // Persist to .env for local dev, AND to S3 per user for production.
    await writeEnvValues(updates);
    const userKey = userConfigKey(getUserEmail(req));
    const userPrefs = Object.fromEntries(
      Object.keys(map)
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
    const result = await jobManager.generateSummary(req.params.id, req.params.type);
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
  const isMarkdown = summary.localPath.endsWith('.md');
  res.setHeader('Content-Type', isMarkdown ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
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
