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
