import 'dotenv/config';
import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { restoreChromeProfileFromS3, persistChromeProfileToS3 } from './chrome-profile-sync.js';
import { loadConfig } from './config.js';

function listListeningPids(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: 'utf8' }).trim();
    if (!out) return [];
    return out.split('\n').map((line) => Number(line.trim())).filter((pid) => Number.isFinite(pid));
  } catch (_error) {
    return [];
  }
}

function getPidCommand(pid) {
  try {
    return execSync(`ps -p ${pid} -o command=`, { encoding: 'utf8' }).trim();
  } catch (_error) {
    return '';
  }
}

function getPidCwd(pid) {
  try {
    const out = execSync(`lsof -a -p ${pid} -d cwd -Fn`, { encoding: 'utf8' }).trim();
    const line = out.split('\n').find((item) => item.startsWith('n'));
    return line ? line.slice(1) : '';
  } catch (_error) {
    return '';
  }
}

function killPreviousBotServerIfAny(port) {
  const botRoot = path.resolve(process.cwd());
  const candidates = listListeningPids(port);

  for (const pid of candidates) {
    if (pid === process.pid) continue;
    const cmd = getPidCommand(pid);
    const cwd = getPidCwd(pid);
    const isBotServer =
      cwd.includes('meet-transcriber/bot') &&
      (cmd.includes('src/server.js') || cmd.includes('src/start-server.js'));
    if (!isBotServer) {
      continue;
    }
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopped previous meet bot server PID ${pid}`);
    } catch (error) {
      console.warn(`Could not stop previous server PID ${pid}: ${error.message}`);
    }
  }
}

const port = Number(process.env.BOT_UI_PORT || 3030);
killPreviousBotServerIfAny(port);

// Restore Chrome profile from S3 before the server starts.
// Best-effort: never blocks startup if it fails.
const bootstrapConfig = loadConfig({}, { requireMeetUrl: false, requireSecrets: false });
await restoreChromeProfileFromS3(bootstrapConfig).catch((err) => {
  console.warn(`[startup] Chrome profile restore skipped: ${err.message}`);
});

// Persist Chrome profile to S3 on graceful shutdown.
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] Received ${signal}, persisting Chrome profile to S3...`);
  try {
    await Promise.race([
      persistChromeProfileToS3(bootstrapConfig),
      new Promise((resolve) => setTimeout(resolve, 25000)) // hard cap so SIGTERM doesn't hang ECS task stop
    ]);
  } catch (err) {
    console.warn(`[shutdown] Profile persist failed: ${err.message}`);
  }
  console.log('[shutdown] Exiting.');
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

await import('./server.js');
