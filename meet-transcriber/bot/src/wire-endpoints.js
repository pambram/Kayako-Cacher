import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
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

async function readEnvFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (_error) {
    return '';
  }
}

async function writeEnvValues(filePath, updates) {
  const content = await readEnvFile(filePath);
  const lines = content ? content.split('\n') : [];
  const indexByKey = new Map();
  lines.forEach((line, idx) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m) indexByKey.set(m[1], idx);
  });

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    const nextLine = `${key}=${String(value)}`;
    if (indexByKey.has(key)) {
      lines[indexByKey.get(key)] = nextLine;
    } else {
      lines.push(nextLine);
    }
  }
  await fs.writeFile(filePath, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
}

async function updateExtensionDefaultEndpoints(backgroundPath, endpointUrl) {
  const source = await fs.readFile(backgroundPath, 'utf8');
  let next = source;
  next = next.replace(/s3UploadEndpoint:\s*'[^']*'/, `s3UploadEndpoint: '${endpointUrl}'`);
  next = next.replace(/s3ScreenshotEndpoint:\s*'[^']*'/, `s3ScreenshotEndpoint: '${endpointUrl}'`);
  if (next !== source) {
    await fs.writeFile(backgroundPath, next, 'utf8');
  }
}

function loadStackOutputs(stackName, region) {
  const command = `aws cloudformation describe-stacks --stack-name "${stackName}" --region "${region}" --query "Stacks[0].Outputs" --output json`;
  const raw = execSync(command, { encoding: 'utf8' });
  const outputs = JSON.parse(raw);
  const map = {};
  (outputs || []).forEach((item) => {
    if (item?.OutputKey) map[item.OutputKey] = item.OutputValue;
  });
  return map;
}

async function readBackgroundDefaultUploadEndpoint(backgroundPath) {
  const source = await fs.readFile(backgroundPath, 'utf8');
  const match = source.match(/s3UploadEndpoint:\s*'([^']+)'/);
  return match?.[1] || '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stackName = args['stack-name'] || process.env.MEET_BOT_STACK || '';
  const region = args.region || process.env.AWS_REGION || 'us-east-1';

  const botDir = process.cwd();
  const repoRoot = path.resolve(botDir, '..', '..');
  const botEnvPath = path.resolve(botDir, '.env');
  const backgroundPath = path.resolve(repoRoot, 'meet-transcriber', 'background.js');
  const defaultEndpoint = await readBackgroundDefaultUploadEndpoint(backgroundPath);

  let outputs = {};
  if (stackName) {
    outputs = loadStackOutputs(stackName, region);
  }

  const artifactEndpoint = outputs.ArtifactUploadFunctionUrl || defaultEndpoint;
  const bucketName = outputs.BucketName || '';
  const snsTopicArn = outputs.SnsTopicArn || '';
  if (!artifactEndpoint) {
    throw new Error('Could not determine artifact endpoint from stack outputs or background.js defaults.');
  }

  await writeEnvValues(botEnvPath, {
    AWS_REGION: region,
    S3_BUCKET: bucketName,
    SNS_TOPIC_ARN: snsTopicArn,
    ARTIFACT_UPLOAD_ENDPOINT: artifactEndpoint
  });

  await updateExtensionDefaultEndpoints(backgroundPath, artifactEndpoint);

  console.log('Endpoint wiring complete.');
  if (stackName) console.log(`- Stack: ${stackName}`);
  else console.log('- Stack: (none provided, used local defaults)');
  console.log(`- Region: ${region}`);
  console.log(`- Artifact endpoint: ${artifactEndpoint}`);
  if (bucketName) console.log(`- Bucket: ${bucketName}`);
}

main().catch((error) => {
  console.error('Failed wiring endpoints:', error.message);
  process.exitCode = 1;
});
