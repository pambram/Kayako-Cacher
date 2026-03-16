import path from 'node:path';
import fs from 'node:fs';
import { normalizeMeetUrlInput } from './meet-url.js';

const DEFAULTS = {
  meetUrl: '',
  googleEmail: '',
  googlePassword: '',
  anthropicApiKey: '',
  analysisModel: 'claude-haiku-4-5',
  summaryModel: 'claude-sonnet-4-6',
  tldrModel: 'claude-sonnet-4-6',
  arcModel: 'claude-sonnet-4-6',
  bulletsModel: 'claude-sonnet-4-6',
  captureIntervalSec: 10,
  batchSize: 6,
  screenshotQuality: 50,
  maxMeetingMinutes: 240,
  technicalMode: true,
  outputDir: path.resolve(process.cwd(), 'bot-output'),
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  s3Bucket: '',
  s3Prefix: 'meet-bot',
  snsTopicArn: '',
  headless: false,
  chromePath: '',
  guestName: 'Meet Bot',
  forceGoogleSignIn: false,
  joinWaitSec: 180,
  enableStealth: true,
  checkpointUploadEnabled: true,
  checkpointUploadMinutes: 5,
  strictPromptParity: true,
  allowPromptFallback: false,
  notifyEmail: 'pablo.ambram@trilogy.com',
  sesFromEmail: 'pablo.ambram@trilogy.com'
};

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAnthropicModel(model, fallbackModel, label) {
  if (!model) return fallbackModel;
  return model;
}

export function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

export function loadConfig(cliArgs = {}, options = {}) {
  const requireMeetUrl = options.requireMeetUrl !== false;
  const explicitChromePath = cliArgs['chrome-path'] || process.env.CHROME_BIN || '';
  const resolvedChromePath = explicitChromePath || detectChromePath();
  const rawMeetUrl = cliArgs['meet-url'] || process.env.MEET_URL || DEFAULTS.meetUrl;

  const config = {
    ...DEFAULTS,
    meetUrl: rawMeetUrl ? normalizeMeetUrlInput(rawMeetUrl) : '',
    googleEmail: cliArgs['google-email'] || process.env.GOOGLE_EMAIL || DEFAULTS.googleEmail,
    googlePassword: cliArgs['google-password'] || process.env.GOOGLE_PASSWORD || DEFAULTS.googlePassword,
    anthropicApiKey: cliArgs['anthropic-api-key'] || process.env.ANTHROPIC_API_KEY || DEFAULTS.anthropicApiKey,
    analysisModel: cliArgs['analysis-model'] || process.env.ANALYSIS_MODEL || DEFAULTS.analysisModel,
    summaryModel: cliArgs['summary-model'] || process.env.SUMMARY_MODEL || DEFAULTS.summaryModel,
    tldrModel: cliArgs['tldr-model'] || process.env.TLDR_MODEL || DEFAULTS.tldrModel,
    arcModel: cliArgs['arc-model'] || process.env.ARC_MODEL || DEFAULTS.arcModel,
    bulletsModel: cliArgs['bullets-model'] || process.env.BULLETS_MODEL || DEFAULTS.bulletsModel,
    captureIntervalSec: parseNumber(cliArgs['capture-interval'] || process.env.CAPTURE_INTERVAL, DEFAULTS.captureIntervalSec),
    batchSize: parseNumber(cliArgs['batch-size'] || process.env.BATCH_SIZE, DEFAULTS.batchSize),
    screenshotQuality: parseNumber(cliArgs['screenshot-quality'] || process.env.SCREENSHOT_QUALITY, DEFAULTS.screenshotQuality),
    maxMeetingMinutes: parseNumber(cliArgs['max-minutes'] || process.env.MAX_MEETING_MINUTES, DEFAULTS.maxMeetingMinutes),
    technicalMode: parseBoolean(cliArgs['technical-mode'] || process.env.TECHNICAL_MODE, DEFAULTS.technicalMode),
    outputDir: path.resolve(cliArgs['output-dir'] || process.env.OUTPUT_DIR || DEFAULTS.outputDir),
    awsRegion: cliArgs.region || process.env.AWS_REGION || DEFAULTS.awsRegion,
    s3Bucket: cliArgs['s3-bucket'] || process.env.S3_BUCKET || DEFAULTS.s3Bucket,
    s3Prefix: cliArgs['s3-prefix'] || process.env.S3_PREFIX || DEFAULTS.s3Prefix,
    snsTopicArn: cliArgs['sns-topic-arn'] || process.env.SNS_TOPIC_ARN || DEFAULTS.snsTopicArn,
    headless: parseBoolean(cliArgs.headless || process.env.HEADLESS, DEFAULTS.headless),
    chromePath: resolvedChromePath,
    guestName: cliArgs['guest-name'] || process.env.GUEST_NAME || DEFAULTS.guestName,
    forceGoogleSignIn: parseBoolean(
      cliArgs['force-google-signin'] || process.env.FORCE_GOOGLE_SIGNIN,
      DEFAULTS.forceGoogleSignIn
    ),
    joinWaitSec: parseNumber(cliArgs['join-wait-sec'] || process.env.JOIN_WAIT_SEC, DEFAULTS.joinWaitSec),
    enableStealth: parseBoolean(cliArgs.stealth || process.env.ENABLE_STEALTH, DEFAULTS.enableStealth),
    checkpointUploadEnabled: parseBoolean(
      cliArgs['checkpoint-upload-enabled'] || process.env.CHECKPOINT_UPLOAD_ENABLED,
      DEFAULTS.checkpointUploadEnabled
    ),
    checkpointUploadMinutes: parseNumber(
      cliArgs['checkpoint-upload-minutes'] || process.env.CHECKPOINT_UPLOAD_MINUTES,
      DEFAULTS.checkpointUploadMinutes
    ),
    strictPromptParity: parseBoolean(
      cliArgs['strict-prompt-parity'] || process.env.STRICT_PROMPT_PARITY,
      DEFAULTS.strictPromptParity
    ),
    allowPromptFallback: parseBoolean(
      cliArgs['allow-prompt-fallback'] || process.env.ALLOW_PROMPT_FALLBACK,
      DEFAULTS.allowPromptFallback
    ),
    notifyEmail: cliArgs['notify-email'] || process.env.NOTIFY_EMAIL || DEFAULTS.notifyEmail,
    sesFromEmail: cliArgs['ses-from-email'] || process.env.SES_FROM_EMAIL || DEFAULTS.sesFromEmail
  };

  // Keep these fixed in UI mode for parity and stability.
  config.enableStealth = true;
  config.strictPromptParity = true;
  config.allowPromptFallback = false;

  config.analysisModel = normalizeAnthropicModel(config.analysisModel, DEFAULTS.analysisModel, 'analysis');
  config.summaryModel = normalizeAnthropicModel(config.summaryModel, DEFAULTS.summaryModel, 'summary');
  config.tldrModel = normalizeAnthropicModel(config.tldrModel, DEFAULTS.tldrModel, 'tldr');
  config.arcModel = normalizeAnthropicModel(config.arcModel, DEFAULTS.arcModel, 'story arc');
  config.bulletsModel = normalizeAnthropicModel(config.bulletsModel, DEFAULTS.bulletsModel, 'bullet points');

  if (requireMeetUrl && !config.meetUrl) {
    throw new Error('Missing MEET_URL. Pass --meet-url or set MEET_URL.');
  }
  if (!config.anthropicApiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY.');
  }
  if (!config.chromePath) {
    throw new Error('Could not locate Chrome automatically. Set CHROME_BIN or pass --chrome-path.');
  }

  return config;
}

function detectChromePath() {
  const platform = process.platform;
  const candidates = platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ]
    : platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium'
        ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}
