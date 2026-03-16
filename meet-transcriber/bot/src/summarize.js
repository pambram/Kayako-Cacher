import {
  TLDR_SYSTEM_PROMPT,
  ARC_SYSTEM_PROMPT,
  BULLET_POINTS_SYSTEM_PROMPT
} from './prompts.js';

async function anthropicText(apiKey, model, system, user, maxTokens = 4000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
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

  const json = await response.json();
  return json.content?.find((item) => item.type === 'text')?.text?.trim() || '';
}

function groupBatchesIntoChunks(batches, maxChunks = 10) {
  if (batches.length <= maxChunks) return batches.map((batch) => [batch]);
  const chunkSize = Math.ceil(batches.length / maxChunks);
  const chunks = [];
  for (let i = 0; i < batches.length; i += chunkSize) {
    chunks.push(batches.slice(i, i + chunkSize));
  }
  return chunks;
}

function formatChunk(chunk) {
  return chunk
    .map((batch) => `<window time="${batch.timestampLabel}">\n${batch.content}\n</window>`)
    .join('\n\n');
}

export async function generateTldr(fullTranscript, config) {
  return anthropicText(
    config.anthropicApiKey,
    config.tldrModel,
    config.promptSet?.tldrSystem || TLDR_SYSTEM_PROMPT,
    `Generate a TL;DR for this meeting transcript:\n\n${fullTranscript}`,
    1500
  );
}

export async function generateBulletPoints(fullTranscript, config) {
  return anthropicText(
    config.anthropicApiKey,
    config.bulletsModel,
    config.promptSet?.bulletSystem || BULLET_POINTS_SYSTEM_PROMPT,
    `Convert this meeting transcript into status update bullet points:\n\n${fullTranscript}`,
    3000
  );
}

export async function generateStoryArc(entries, config, onProgress) {
  const chunks = groupBatchesIntoChunks(entries, 10);
  let arc = '';

  for (let i = 0; i < chunks.length; i += 1) {
    const windows = formatChunk(chunks[i]);
    const prompt = i === 0
        ? `Write the opening of the story arc from these observation windows.\n\n${windows}`
        : `<existing_arc>\n${arc}\n</existing_arc>\n\n${windows}\n\nOutput the updated arc. Fold new info into existing sections when the topic fits. Only add a new section if the subject clearly changed. Compress earlier sections if the arc is getting too long. Target: 6-10 sections total. Output only the arc text.`;

    arc = await anthropicText(
      config.anthropicApiKey,
      config.arcModel,
      config.promptSet?.arcSystem || ARC_SYSTEM_PROMPT,
      prompt,
      3500
    );

    if (onProgress) {
      await onProgress({ current: i + 1, total: chunks.length });
    }
  }

  return arc;
}
