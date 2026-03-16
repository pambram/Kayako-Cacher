import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

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

await import('./server.js');
