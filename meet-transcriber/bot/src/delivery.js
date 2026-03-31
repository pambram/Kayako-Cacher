import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs/promises';
import path from 'node:path';

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normalizeKey(prefix, name) {
  const cleanPrefix = (prefix || '').replace(/\/+$/, '');
  return cleanPrefix ? `${cleanPrefix}/${name}` : name;
}

function buildS3Client(config) {
  return new S3Client({ region: config.awsRegion });
}

export async function uploadArtifacts(artifacts, config, options = {}) {
  if (!config.s3Bucket) {
    console.log('Skipping S3 upload: S3_BUCKET not configured.');
    return { uploaded: false, files: [] };
  }

  const s3 = buildS3Client(config);
  const suffix = options.fixedSuffix || nowStamp();
  const prefix = options.basePrefix
    ? normalizeKey(config.s3Prefix, options.basePrefix)
    : config.s3Prefix;
  const uploaded = [];

  for (const artifact of artifacts) {
    const key = normalizeKey(prefix, `${suffix}/${artifact.name}`);
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: artifact.content,
        ContentType: artifact.contentType || 'text/plain; charset=utf-8'
      })
    );

    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }),
      { expiresIn: 7 * 24 * 60 * 60 }
    );

    uploaded.push({ key, url: presignedUrl, name: artifact.name });
  }

  return { uploaded: true, files: uploaded };
}

export async function uploadCheckpointArtifacts(checkpoint, config, options = {}) {
  if (!config.s3Bucket) {
    return { uploaded: false, files: [] };
  }
  const s3 = buildS3Client(config);
  const suffix = options.fixedSuffix || 'latest';
  const basePrefix = options.basePrefix
    ? normalizeKey(config.s3Prefix, options.basePrefix)
    : config.s3Prefix;

  const artifacts = [
    {
      localPath: checkpoint.liveTranscriptPath,
      contentType: 'text/plain; charset=utf-8'
    },
    {
      localPath: checkpoint.statePath,
      contentType: 'application/json; charset=utf-8'
    }
  ];
  const files = [];

  for (const artifact of artifacts) {
    const body = await fs.readFile(artifact.localPath);
    const fileName = path.basename(artifact.localPath);
    const key = normalizeKey(basePrefix, `${suffix}/${fileName}`);

    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: body,
        ContentType: artifact.contentType
      })
    );

    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }),
      { expiresIn: 7 * 24 * 60 * 60 }
    );

    files.push({ key, url: presignedUrl, name: fileName });
  }

  return { uploaded: true, files };
}

/**
 * Upload a single summary file to S3 at a deterministic path and return the S3 key.
 * Path: {prefix}/jobs/{jobId}/summaries/{type}.{ext}
 */
export async function uploadSummaryToS3(config, jobId, type, content, ext = 'txt') {
  if (!config.s3Bucket) return null;
  const s3 = buildS3Client(config);
  const key = normalizeKey(config.s3Prefix, `jobs/${jobId}/summaries/${type}.${ext}`);
  const contentType = ext === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8';
  await s3.send(new PutObjectCommand({ Bucket: config.s3Bucket, Key: key, Body: content, ContentType: contentType }));
  return key;
}

/**
 * Write/update the job manifest at {prefix}/jobs/{jobId}/manifest.json.
 * Contains meeting metadata and keys to all generated artifacts.
 */
export async function syncManifestToS3(config, job) {
  if (!config.s3Bucket) return;
  const s3 = buildS3Client(config);
  const key = normalizeKey(config.s3Prefix, `jobs/${job.id}/manifest.json`);

  const artifacts = {};
  // Transcript checkpoints
  for (const f of (job.latestCheckpointLinks || [])) {
    if (f.key) {
      const tag = f.name?.includes('state') ? 'checkpointState' : 'checkpointTranscript';
      artifacts[tag] = { key: f.key, name: f.name, uploadedAt: job.updatedAt };
    }
  }
  // Final upload artifacts
  for (const f of (job.finalLinks || [])) {
    if (f.key) artifacts[`final_${f.name}`] = { key: f.key, name: f.name };
  }
  // Summaries
  for (const [type, summary] of Object.entries(job.summaryArtifacts || {})) {
    if (summary?.s3Key) {
      artifacts[`summary_${type}`] = {
        key: summary.s3Key,
        generatedAt: summary.generatedAt,
        ext: summary.s3Key.endsWith('.md') ? 'md' : 'txt'
      };
    }
  }

  const manifest = {
    jobId: job.id,
    meetUrl: job.meetUrl,
    displayName: job.displayName || job.classifierConfig?.meetingObjective || null,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    updatedAt: job.updatedAt,
    classifierEnabled: Boolean(job.classifierConfig?.enabled),
    artifacts
  };

  await s3.send(new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json; charset=utf-8'
  }));
  return key;
}

/** Fetch an S3 object's text content directly using SDK credentials (never expires). */
export async function fetchS3ObjectText(bucket, key, region) {
  const s3 = new S3Client({ region: region || 'us-east-1' });
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Generate a fresh presigned URL for an existing S3 key (always valid for 7 days from now). */
export async function generateFreshPresignedUrl(bucket, key, region) {
  const s3 = new S3Client({ region: region || 'us-east-1' });
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 7 * 24 * 60 * 60 }
  );
}

export async function notifyDelivery(uploadResult, config) {
  if (!config.snsTopicArn) {
    console.log('Skipping SNS notification: SNS_TOPIC_ARN not configured.');
    return;
  }

  const sns = new SNSClient({ region: config.awsRegion });
  const lines = [
    'Google Meet bot completed.',
    '',
    ...uploadResult.files.map((file) => `${file.name}: ${file.url}`)
  ];
  const message = lines.join('\n');

  await sns.send(
    new PublishCommand({
      TopicArn: config.snsTopicArn,
      Subject: 'Meet Bot Transcript Ready',
      Message: message
    })
  );
}

export async function sendLifecycleEmail(config, subject, body) {
  if (!config.notifyEmail || !config.sesFromEmail) {
    return;
  }
  try {
    const ses = new SESClient({ region: config.awsRegion });
    await ses.send(
      new SendEmailCommand({
        Source: config.sesFromEmail,
        Destination: {
          ToAddresses: [config.notifyEmail]
        },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: {
              Data: body,
              Charset: 'UTF-8'
            }
          }
        }
      })
    );
  } catch (error) {
    console.warn('SES lifecycle email failed:', error.message);
  }
}
