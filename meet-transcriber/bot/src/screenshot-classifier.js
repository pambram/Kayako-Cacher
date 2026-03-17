import { uploadArtifacts } from './delivery.js';

const FALLBACK_KT_SCREENSHOT_CLASSIFIER_PROMPT = `You are a screenshot classifier for Knowledge Transfer (KT) meeting documentation.
You receive a batch of screenshots from a screen-sharing session along with the transcript
of what was discussed during this batch.

DECIDE: Does any screenshot in this batch show something that should be saved for documentation?

SAVE a screenshot if it shows:
- A system interface, dashboard, or admin panel being demonstrated
- Architecture diagrams, workflow diagrams, or process flows
- Code being walked through or explained
- Configuration screens, settings, or infrastructure views
- Error messages, log outputs, or debugging sessions
- Database schemas, API responses, or data structures
- Any visual that would help someone understand the system being transferred

DO NOT SAVE if the batch only shows:
- Google Meet participant tiles / video feeds
- Generic web pages with no technical content
- The AI Transcriber panel itself
- Blurry, transitional, or duplicate views of already-captured content

Select at most ONE screenshot from the batch -- the clearest, most informative one.

Respond with JSON only: {"save": true/false, "index": N, "reason": "one line"}`;

function stripMarkdownCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size && !setB.size) return 1;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function looksLikeNovelAspect(reason) {
  const text = String(reason || '').toLowerCase();
  const noveltyHints = [
    'different',
    'another',
    'new',
    'menu',
    'tab',
    'panel',
    'setting',
    'section',
    'aspect'
  ];
  return noveltyHints.some((hint) => text.includes(hint));
}

function isReasonNearDuplicate(reason, previousSelections) {
  const reasonTokens = tokenize(reason);
  if (!reasonTokens.length) return false;
  for (const prev of previousSelections || []) {
    const prevTokens = tokenize(prev?.reason || '');
    if (!prevTokens.length) continue;
    const score = jaccard(reasonTokens, prevTokens);
    if (score >= 0.78) {
      return true;
    }
  }
  return false;
}

function toAnthropicImagePayload(base64Jpeg) {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: base64Jpeg
    }
  };
}

async function anthropicRequest(apiKey, payload) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorBody = '';
    try {
      const parsed = await response.json();
      errorBody = parsed?.error?.message || JSON.stringify(parsed);
    } catch (_error) {
      errorBody = await response.text();
    }
    throw new Error(`KT screenshot classifier request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function uploadViaArtifactEndpoint(imageBuffer, meetCode, batchNumber, endpoint) {
  const tryPayloads = [
    { action: 'getImageUploadUrl', meetCode, batchNumber },
    { action: 'getUploadUrl', meetCode, batchNumber, fileType: 'image' }
  ];
  let uploadUrl = '';
  let downloadUrl = '';
  let lastError = null;

  for (const payload of tryPayloads) {
    try {
      const presignResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!presignResponse.ok) {
        const errorText = await presignResponse.text();
        throw new Error(`HTTP ${presignResponse.status} - ${errorText}`);
      }
      const parsed = await presignResponse.json();
      if (parsed?.uploadUrl && parsed?.downloadUrl) {
        uploadUrl = parsed.uploadUrl;
        downloadUrl = parsed.downloadUrl;
        break;
      }
      throw new Error('Missing uploadUrl/downloadUrl');
    } catch (error) {
      lastError = error;
      console.warn(`Artifact endpoint presign fallback failed for ${payload.action}:`, error.message);
    }
  }

  if (!uploadUrl || !downloadUrl) {
    throw new Error(`Artifact endpoint did not return upload URL: ${lastError?.message || 'unknown error'}`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageBuffer
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Artifact image upload failed: ${uploadResponse.status} - ${text}`);
  }
  return downloadUrl;
}

export async function classifyAndUploadKtScreenshot(batch, transcriptText, config, options = {}) {
  if (!config.enableScreenshotClassifier) {
    return { selected: false, reason: 'Classifier disabled' };
  }
  if (!config.s3Bucket && !config.artifactUploadEndpoint) {
    return { selected: false, reason: 'No upload destination configured (S3 bucket or artifact endpoint)' };
  }
  const screenshots = Array.isArray(batch?.screenshots) ? batch.screenshots : [];
  if (!screenshots.length) {
    return { selected: false, reason: 'No screenshots in batch' };
  }

  const prompt = config.promptSet?.ktScreenshotClassifierSystem || FALLBACK_KT_SCREENSHOT_CLASSIFIER_PROMPT;
  const userParts = [];
  if (config.meetingObjective) {
    userParts.push(`Meeting objective: ${config.meetingObjective}`);
    userParts.push('');
  }
  userParts.push(`Batch transcript:\n${transcriptText || ''}`);
  userParts.push('');
  userParts.push(`Batch number: ${options.batchNumber || 0}`);
  userParts.push(`Screenshot count: ${screenshots.length}`);
  if (Array.isArray(options.previousSelections) && options.previousSelections.length > 0) {
    const history = options.previousSelections.slice(-6).map((item) => (
      `- batch ${item.batchNumber}: ${item.reason || 'n/a'}`
    )).join('\n');
    userParts.push('');
    userParts.push('Previously saved screenshots (avoid duplicates unless truly novel):');
    userParts.push(history);
    userParts.push('Only save if this batch adds a truly new entity or a clearly different aspect (for example another menu item or panel).');
  }
  userParts.push('Return JSON only.');

  const content = [{ type: 'text', text: userParts.join('\n') }];
  screenshots.forEach((screenshot, idx) => {
    content.push({ type: 'text', text: `Screenshot index ${idx}` });
    content.push(toAnthropicImagePayload(screenshot));
  });

  const body = {
    model: config.screenshotClassifierModel,
    max_tokens: 300,
    system: prompt,
    messages: [{ role: 'user', content }]
  };

  const data = await anthropicRequest(config.anthropicApiKey, body);
  const rawText = data.content?.find((item) => item.type === 'text')?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(rawText));
  } catch (_error) {
    return { selected: false, reason: 'Classifier returned invalid JSON' };
  }

  const save = Boolean(parsed?.save);
  const index = Number(parsed?.index);
  const reason = parsed?.reason ? String(parsed.reason) : '';
  if (!save || !Number.isInteger(index) || index < 0 || index >= screenshots.length) {
    return { selected: false, reason: reason || 'No suitable screenshot' };
  }
  if (isReasonNearDuplicate(reason, options.previousSelections) && !looksLikeNovelAspect(reason)) {
    return { selected: false, reason: 'Very similar to previously saved screenshot; skipped as duplicate' };
  }

  const imageBuffer = Buffer.from(screenshots[index], 'base64');
  const imageName = `kt-screenshot-batch-${options.batchNumber || 0}.jpg`;
  let imageUrl = '';
  if (config.artifactUploadEndpoint) {
    imageUrl = await uploadViaArtifactEndpoint(
      imageBuffer,
      config.meetUrl ? config.meetUrl.split('/').filter(Boolean).pop().split('?')[0] : 'unknown',
      options.batchNumber || 0,
      config.artifactUploadEndpoint
    );
  } else {
    const upload = await uploadArtifacts(
      [
        {
          name: imageName,
          content: imageBuffer,
          contentType: 'image/jpeg'
        }
      ],
      config,
      {
        basePrefix: `${options.runId || 'run'}/screenshots`,
        fixedSuffix: `batch-${options.batchNumber || 0}`
      }
    );
    imageUrl = upload.files?.[0]?.url || '';
  }
  if (!imageUrl) {
    return { selected: false, reason: 'Failed to upload selected screenshot' };
  }

  return {
    selected: true,
    selectedIndex: index,
    reason: reason || 'Selected by KT classifier',
    imageUrl
  };
}
