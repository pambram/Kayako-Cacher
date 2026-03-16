import {
  TLDR_SYSTEM_PROMPT,
  ARC_SYSTEM_PROMPT,
  BULLET_POINTS_SYSTEM_PROMPT
} from './prompts.js';

export const MAX_SINGLE_SUMMARY_INPUT_TOKENS = 200000;
export const MAP_REDUCE_CHUNK_TOKENS = 100000;
const RATE_LIMIT_MAX_RETRIES = 2;
const RATE_LIMIT_BASE_WAIT_MS = 12000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function anthropicText(apiKey, model, system, user, maxTokens = 4000) {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
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

    if (response.ok) {
      const json = await response.json();
      return json.content?.find((item) => item.type === 'text')?.text?.trim() || '';
    }

    let errorBody = '';
    try {
      const parsed = await response.json();
      errorBody = parsed?.error?.message || JSON.stringify(parsed);
    } catch (error) {
      errorBody = await response.text();
    }

    // Auto-retry transient rate limiting using Retry-After when available.
    if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSec = Number(retryAfterHeader);
      const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : RATE_LIMIT_BASE_WAIT_MS * (attempt + 1);
      console.warn(`Anthropic rate limit hit; retrying in ${waitMs}ms (attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES + 1})`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Anthropic request failed (${response.status}): ${errorBody}`);
  }

  throw new Error('Anthropic request failed after rate-limit retries');
}

export function estimateTokenCount(text) {
  if (!text) return 0;
  // Practical approximation for planning/chunking.
  return Math.ceil(text.length / 4);
}

function chunkTranscriptByApproxTokens(text, chunkTokenBudget = MAP_REDUCE_CHUNK_TOKENS) {
  const lines = String(text || '').split('\n');
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokenCount(`${line}\n`);
    if (current.length && currentTokens + lineTokens > chunkTokenBudget) {
      chunks.push(current.join('\n'));
      current = [line];
      currentTokens = lineTokens;
    } else {
      current.push(line);
      currentTokens += lineTokens;
    }
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks.length ? chunks : [''];
}

function groupBatchesIntoChunks(batches, chunkTokenBudget = MAP_REDUCE_CHUNK_TOKENS) {
  if (!batches || batches.length === 0) return [];
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const batch of batches) {
    const snippet = `<window time="${batch.timestampLabel}">\n${batch.content || ''}\n</window>\n`;
    const batchTokens = estimateTokenCount(snippet);
    if (current.length && currentTokens + batchTokens > chunkTokenBudget) {
      chunks.push(current);
      current = [batch];
      currentTokens = batchTokens;
    } else {
      current.push(batch);
      currentTokens += batchTokens;
    }
  }
  if (current.length) chunks.push(current);
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

export async function generateTldrMapReduce(fullTranscript, config, onProgress) {
  const chunks = chunkTranscriptByApproxTokens(fullTranscript);
  let summary = '';

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const userPrompt = i === 0
      ? `Generate a TL;DR for this meeting transcript chunk:\n\n${chunk}`
      : `<current_tldr>\n${summary}\n</current_tldr>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the TL;DR by merging this new chunk into the existing TL;DR. Keep it concise and preserve key decisions, actions, and outcomes. Output only the updated TL;DR.`;
    summary = await anthropicText(
      config.anthropicApiKey,
      config.tldrModel,
      config.promptSet?.tldrSystem || TLDR_SYSTEM_PROMPT,
      userPrompt,
      1800
    );
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return summary;
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

export async function generateBulletPointsMapReduce(fullTranscript, config, onProgress) {
  const chunks = chunkTranscriptByApproxTokens(fullTranscript);
  let summary = '';

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const userPrompt = i === 0
      ? `Convert this meeting transcript chunk into status update bullet points:\n\n${chunk}`
      : `<current_bullets>\n${summary}\n</current_bullets>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the bullet-point status summary by incorporating new facts from the chunk while deduplicating repeated information. Output only the updated bullets.`;
    summary = await anthropicText(
      config.anthropicApiKey,
      config.bulletsModel,
      config.promptSet?.bulletSystem || BULLET_POINTS_SYSTEM_PROMPT,
      userPrompt,
      3200
    );
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return summary;
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

export async function generateStoryArcMapReduce(fullTranscript, config, onProgress) {
  const chunks = chunkTranscriptByApproxTokens(fullTranscript);
  let arc = '';

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const prompt = i === 0
      ? `Write the opening of the story arc from this transcript chunk.\n\n${chunk}`
      : `<existing_arc>\n${arc}\n</existing_arc>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the story arc by folding in new details from this chunk. Merge into existing sections where possible, only add new sections for clearly new themes. Keep it concise and chronological. Output only the updated arc.`;
    arc = await anthropicText(
      config.anthropicApiKey,
      config.arcModel,
      config.promptSet?.arcSystem || ARC_SYSTEM_PROMPT,
      prompt,
      3500
    );
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return arc;
}
