/**
 * Chrome profile S3 sync.
 *
 * Why: persistent Chrome profiles (cookies, history, prefs) reduce bot-detection
 * signals. On Fargate the filesystem is ephemeral, so we round-trip the profile
 * to S3 — download on container start, upload on graceful shutdown.
 *
 * Strategy: single shared profile (one tar.gz in S3). Single-task ECS service,
 * so no concurrent-task race risk. If we ever scale to multiple tasks, switch
 * to per-task profile keys.
 *
 * Best-effort only: any failure here is logged and ignored — never crashes the bot.
 */
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';

const PROFILE_TAR_FILENAME = 'chrome-profile.tar.gz';

function profileS3Key(prefix) {
  const clean = (prefix || '').replace(/\/+$/, '');
  return clean ? `${clean}/state/${PROFILE_TAR_FILENAME}` : `state/${PROFILE_TAR_FILENAME}`;
}

function localTarPath(outputDir) {
  return path.join(outputDir, PROFILE_TAR_FILENAME);
}

function localProfileDir(outputDir) {
  return path.join(outputDir, 'chrome-profile');
}

function spawnProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

/**
 * Download the saved Chrome profile from S3 and extract it to outputDir/chrome-profile.
 * Silently no-ops if the profile doesn't exist yet (first run) or on any error.
 */
export async function restoreChromeProfileFromS3(config) {
  if (!config?.s3Bucket || !config?.awsRegion) return false;
  const outputDir = config.outputDir;
  const tarPath = localTarPath(outputDir);
  const profileDir = localProfileDir(outputDir);

  // If profile already exists locally (e.g. dev machine with --user-data-dir),
  // don't overwrite it — only restore on truly empty containers.
  try {
    const stat = await fs.stat(profileDir);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(profileDir);
      if (entries.length > 0) {
        console.log(`[profileSync] Local Chrome profile already exists at ${profileDir} — skipping S3 restore.`);
        return false;
      }
    }
  } catch (_) { /* dir doesn't exist, safe to restore */ }

  const s3 = new S3Client({ region: config.awsRegion });
  const key = profileS3Key(config.s3Prefix);

  try {
    console.log(`[profileSync] Restoring Chrome profile from s3://${config.s3Bucket}/${key}...`);
    const response = await s3.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
    await fs.mkdir(outputDir, { recursive: true });

    const writeStream = createWriteStream(tarPath);
    await new Promise((resolve, reject) => {
      response.Body.pipe(writeStream);
      response.Body.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    await fs.mkdir(profileDir, { recursive: true });
    await spawnProcess('tar', ['-xzf', tarPath, '-C', profileDir]);
    await fs.unlink(tarPath).catch(() => {});

    const restored = await fs.readdir(profileDir);
    console.log(`[profileSync] Restored Chrome profile (${restored.length} top-level entries).`);
    return true;
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      console.log('[profileSync] No saved profile in S3 yet — starting fresh.');
    } else {
      console.warn(`[profileSync] Profile restore failed (non-fatal): ${err.message}`);
    }
    return false;
  }
}

/**
 * Tar+gzip the local Chrome profile and upload it to S3.
 * Best-effort: errors are logged but never thrown.
 */
export async function persistChromeProfileToS3(config) {
  if (!config?.s3Bucket || !config?.awsRegion) return false;
  const outputDir = config.outputDir;
  const profileDir = localProfileDir(outputDir);
  const tarPath = localTarPath(outputDir);

  try {
    const stat = await fs.stat(profileDir);
    if (!stat.isDirectory()) {
      console.log('[profileSync] No profile directory to persist.');
      return false;
    }
  } catch (_) {
    console.log('[profileSync] No profile directory to persist.');
    return false;
  }

  const s3 = new S3Client({ region: config.awsRegion });
  const key = profileS3Key(config.s3Prefix);

  try {
    console.log(`[profileSync] Packing Chrome profile to ${tarPath}...`);
    // -C profileDir → archive contents (so extraction restores into a clean dir).
    // Excludes Cache/Code Cache to keep tarball small (these regenerate quickly).
    await spawnProcess('tar', [
      '-czf', tarPath,
      '-C', profileDir,
      '--exclude=Default/Cache',
      '--exclude=Default/Code\\ Cache',
      '--exclude=Default/GPUCache',
      '--exclude=ShaderCache',
      '--exclude=GrShaderCache',
      '--exclude=GraphiteDawnCache',
      '.'
    ]);

    const tarStat = await fs.stat(tarPath);
    console.log(`[profileSync] Uploading profile (${(tarStat.size / 1024 / 1024).toFixed(1)} MB) to s3://${config.s3Bucket}/${key}...`);

    await s3.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: createReadStream(tarPath),
      ContentType: 'application/gzip'
    }));

    await fs.unlink(tarPath).catch(() => {});
    console.log('[profileSync] Profile uploaded to S3.');
    return true;
  } catch (err) {
    console.warn(`[profileSync] Profile upload failed (non-fatal): ${err.message}`);
    return false;
  }
}
