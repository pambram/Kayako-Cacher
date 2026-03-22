import {
  ANALYSIS_SYSTEM_PROMPT_STANDARD,
  ANALYSIS_SYSTEM_PROMPT_TECHNICAL
} from './prompts.js';

function isOpenAIModel(model) {
  return String(model || '').startsWith('gpt-') || String(model || '').startsWith('o1') || String(model || '').startsWith('o3');
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

function toOpenAIImagePayload(base64Jpeg) {
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${base64Jpeg}`,
      detail: 'low'
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

async function openaiRequest(apiKey, payload) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
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
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

// Appended to the system prompt when running in bot mode.
// The extension's system prompt references "captions" as text visible in screenshots;
// the bot additionally supplies verbatim caption text in the user message, so we tell
// the model to treat that block as high-signal spoken dialogue.
const BOT_CAPTION_SUFFIX = `

The user message also includes caption text scraped live from the meeting ("Captions from this period"). Treat this as verbatim spoken dialogue — it is the primary source of conversation content. Give it equal or higher weight than what is visible in screenshots.`;

export async function analyzeBatch(batch, previousContext, config) {
  // Mirror the extension's system prompt exactly, then append the bot-specific caption note.
  const baseSystemPrompt = config.technicalMode
    ? (config.promptSet?.analysisTechnical || ANALYSIS_SYSTEM_PROMPT_TECHNICAL)
    : (config.promptSet?.analysisStandard || ANALYSIS_SYSTEM_PROMPT_STANDARD);
  const systemPrompt = baseSystemPrompt + BOT_CAPTION_SUFFIX;

  // User message mirrors background.js lines 448-450 exactly, then prepends capture metadata.
  const instruction = previousContext
    ? 'Analyze these new screenshots. Focus on NEW technical details, commands, resources, or changes not mentioned in previous context:'
    : 'This is the first batch of screenshots. Perform a detailed technical analysis of this Google Meet call:';

  const textPrelude = [
    `Capture window: ${batch.startedAtIso} -> ${batch.endedAtIso}`,
    previousContext ? `Previous context:\n${previousContext}` : '',
    batch.captions ? `Captions from this period:\n${batch.captions}` : 'Captions from this period: (none detected)',
    instruction
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

  if (isOpenAIModel(config.analysisModel)) {
    const messageContent = [
      { type: 'text', text: textPrelude },
      ...validScreenshots.map(toOpenAIImagePayload)
    ];
    const body = {
      model: config.analysisModel,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageContent }
      ]
    };
    const data = await openaiRequest(config.openaiApiKey, body);
    const analysisText = data.choices?.[0]?.message?.content?.trim() || '';
    return { text: analysisText, raw: data };
  }

  const content = [
    { type: 'text', text: textPrelude },
    ...validScreenshots.map(toAnthropicImagePayload)
  ];

  const body = {
    model: config.analysisModel,
    max_tokens: 4000,
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
