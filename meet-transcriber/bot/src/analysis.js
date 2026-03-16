import {
  ANALYSIS_SYSTEM_PROMPT_STANDARD,
  ANALYSIS_SYSTEM_PROMPT_TECHNICAL
} from './prompts.js';

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
    } catch (error) {
      errorBody = await response.text();
    }
    throw new Error(`Anthropic request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function analyzeBatch(batch, previousContext, config) {
  const systemPrompt = config.technicalMode
    ? (config.promptSet?.analysisTechnical || ANALYSIS_SYSTEM_PROMPT_TECHNICAL)
    : (config.promptSet?.analysisStandard || ANALYSIS_SYSTEM_PROMPT_STANDARD);

  const textPrelude = [
    `Capture window: ${batch.startedAtIso} -> ${batch.endedAtIso}`,
    previousContext ? `Previous context:\n${previousContext}` : '',
    batch.captions ? `Captions from this period:\n${batch.captions}` : 'Captions from this period: (none detected)',
    'Analyze this batch and produce a transcript entry.'
  ]
    .filter(Boolean)
    .join('\n\n');

  const validScreenshots = (batch.screenshots || []).filter((image) => {
    if (!image || typeof image !== 'string') return false;
    if (image.length < 100) return false;
    return /^[A-Za-z0-9+/=]+$/.test(image);
  });

  if (validScreenshots.length !== (batch.screenshots || []).length) {
    console.warn(
      `Analysis warning: dropped ${
        (batch.screenshots || []).length - validScreenshots.length
      } invalid screenshot payload(s) before API call`
    );
  }

  if (validScreenshots.length === 0) {
    throw new Error('No valid screenshots available for analysis batch.');
  }

  const content = [
    { type: 'text', text: textPrelude },
    ...validScreenshots.map(toAnthropicImagePayload)
  ];

  const body = {
    model: config.analysisModel,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content }]
  };

  const data = await anthropicRequest(config.anthropicApiKey, body);
  const analysisText = data.content?.find((item) => item.type === 'text')?.text?.trim() || '';
  return {
    text: analysisText,
    raw: data
  };
}
