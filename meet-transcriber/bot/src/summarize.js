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

function isOpenAIModel(model) {
  return String(model || '').startsWith('gpt-') || String(model || '').startsWith('o1') || String(model || '').startsWith('o3');
}

function isGeminiModel(model) {
  return String(model || '').startsWith('gemini-');
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
    // 429 = rate limit, 529 = Anthropic overloaded — both transient, both retryable.
    if ((response.status === 429 || response.status === 529) && attempt < RATE_LIMIT_MAX_RETRIES) {
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

async function openaiText(apiKey, model, system, user, maxTokens = 4000) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
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
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
}

function llmText(config, model, system, user, maxTokens = 4000) {
  if (isOpenAIModel(model)) {
    return openaiText(config.openaiApiKey, model, system, user, maxTokens);
  }
  if (isGeminiModel(model)) {
    return geminiText(config.geminiApiKey, model, system, user, maxTokens);
  }
  return anthropicText(config.anthropicApiKey, model, system, user, maxTokens);
}

/**
 * Generates a summary using a user-defined custom summarizer definition.
 * Supports map-reduce for large transcripts and optional vision input.
 */
export async function generateCustomSummary(transcript, config, summarizerDef, onProgress) {
  const model = summarizerDef.model || config.summaryModel || 'claude-sonnet-4-6';
  const system = summarizerDef.prompt || 'Summarize this meeting transcript concisely.';
  const maxTokens = 4000;
  const inputTokens = estimateTokenCount(transcript);
  const useMapReduce = inputTokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS;

  if (!useMapReduce) {
    return llmText(config, model, system, `Summarize this meeting transcript:\n\n${transcript}`, maxTokens);
  }

  const chunks = chunkTranscriptByApproxTokens(transcript);
  let summary = '';
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const userPrompt = i === 0
      ? `Summarize this meeting transcript chunk:\n\n${chunk}`
      : `<current_summary>\n${summary}\n</current_summary>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the summary by merging this new chunk. Deduplicate and preserve key details including any resolution. Output only the updated summary.`;
    summary = await llmText(config, model, system, userPrompt, maxTokens);
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }
  return summary;
}

// Maximum transcript tokens accepted for KT document generation (no map-reduce — needs holistic view).
const KT_MAX_INPUT_TOKENS = 800000;

const KT_SYSTEM_PROMPT = `You are an expert Technical Writer and Knowledge Management Specialist. Your primary task is to transform raw, timestamped session transcripts into highly structured, professional Knowledge Transfer (KT) documents and Standard Operating Procedures (SOPs).

You will receive a detailed transcript of a technical session. This transcript will contain chronological logs of actions performed, systems accessed, verbal instructions, and links to screenshots captured during the session.

Your objective is to synthesize this raw data into a clean, actionable, and easy-to-follow instructional document.

### CRITICAL REQUIREMENTS:
1. **Format as an SOP:** Organize the information logically rather than strictly chronologically. Group related actions into clear phases or steps.
2. **Actionable Language:** Write step-by-step instructions using the imperative mood (e.g., "Click the submit button," "Navigate to the dashboard").
3. **Embed Screenshots Inline:** This is an absolute requirement. You must embed the provided screenshot URLs inline directly below the corresponding instructional step using Markdown image syntax: \`![Descriptive Alt Text](URL)\`. Do not group all images at the bottom of the document. If an image shows a specific UI action, place it exactly where that action is described.
4. **Filter the Noise:** Exclude unnecessary transcript metadata, conversational filler, and troubleshooting dead-ends unless they highlight an important edge case or known error.
5. **Output format:** The entire response MUST be valid Markdown. Use headers, bold, bullet lists, and numbered steps as appropriate.

### REQUIRED DOCUMENT STRUCTURE:
Please use the following Markdown template for your output:

# 📄 Knowledge Transfer (KT) Document: [Insert Clear Subject/Process Name]

**Date:** [Extract Date]
**Presenter/SME:** [Extract Presenter Name]
**Subject:** [Brief description of the workflow]
**Environment/Account:** [Note any specific accounts, test environments, or user profiles used]

---

## 🛠️ 1. Systems & Access Required
[List all platforms, portals, URLs, and specific permission levels or credentials required to perform the workflow.]

---

## 📋 2. Prerequisites & Pre-Checks
[List any checks, capacity limits, or configurations that must be verified *before* beginning the actual steps.]

---

## 🧑‍💻 3. Step-by-Step Instructions
[Break down the core workflow into numbered steps. Group them logically using sub-headers (e.g., ### Phase A: Setup). Embed the relevant markdown screenshots directly beneath the step they illustrate.]

---

## 📓 4. Backend Configuration / Data Sync (If applicable)
[List any secondary platforms, spreadsheets, or databases that must be manually updated to reflect the changes made in the main steps.]

---

## ✅ 5. Verification & Testing
[Provide the exact steps required to verify that the process was completed successfully from the end-user or system perspective.]

---

## 🚨 6. Exceptions, Edge Cases & Escalation
[Highlight any special scenarios (e.g., "If X happens, do Y"), known errors, or escalation contacts mentioned in the transcript.]

---
IMPORTANT: Read the transcript carefully to understand the context of each screenshot link. Match the visual evidence to the text instructions perfectly.`;

async function geminiText(apiKey, model, system, user, maxTokens = 4000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: `${system}\n\n---\n\n${user}` }] }],
    generationConfig: { maxOutputTokens: maxTokens }
  };

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const json = await response.json();
      const parts = json.candidates?.[0]?.content?.parts || [];
      return parts.filter((p) => typeof p.text === 'string' && p.text.trim()).map((p) => p.text).join('').trim();
    }

    let errorBody = '';
    try {
      const parsed = await response.json();
      errorBody = parsed?.error?.message || JSON.stringify(parsed);
    } catch (_e) {
      errorBody = await response.text();
    }

    if ((response.status === 429 || response.status === 503) && attempt < RATE_LIMIT_MAX_RETRIES) {
      const waitMs = RATE_LIMIT_BASE_WAIT_MS * (attempt + 1);
      console.warn(`Gemini rate limit; retrying in ${waitMs}ms (attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES + 1})`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }
  throw new Error('Gemini request failed after retries');
}

async function geminiKtRequest(apiKey, model, transcript) {
  // v1beta supports URL context; v1alpha is only needed for per-part media_resolution
  // which doesn't apply here since we aren't sending inline images.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: `${KT_SYSTEM_PROMPT}\n\n---\n\nTRANSCRIPT:\n${transcript}` }
        ]
      }
    ],
    tools: [{ urlContext: {} }],
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'high' },
      maxOutputTokens: 16000
    }
  };

  console.log(`[KT] Calling ${model} via Gemini API (attempt budget: ${RATE_LIMIT_MAX_RETRIES + 1})`);

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const json = await response.json();
      const parts = json.candidates?.[0]?.content?.parts || [];
      // Collect all text parts (skip thought signatures and empty parts).
      const text = parts
        .filter((p) => typeof p.text === 'string' && p.text.trim())
        .map((p) => p.text)
        .join('');
      console.log(`[KT] Gemini response ok; output length ${text.length} chars`);
      return text.trim();
    }

    let errorBody = '';
    try {
      const parsed = await response.json();
      errorBody = parsed?.error?.message || JSON.stringify(parsed);
    } catch (_e) {
      errorBody = await response.text();
    }

    console.error(`[KT] Gemini error (HTTP ${response.status}, attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES + 1}): ${errorBody}`);

    // Detect hard quota/billing errors — don't retry those.
    const isHardLimit = response.status === 400
      && (errorBody.toLowerCase().includes('usage limits') || errorBody.toLowerCase().includes('quota'));
    if (isHardLimit) {
      throw new Error(`Gemini API quota/billing error: ${errorBody}`);
    }

    if ((response.status === 429 || response.status === 503) && attempt < RATE_LIMIT_MAX_RETRIES) {
      const retryAfterSec = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : RATE_LIMIT_BASE_WAIT_MS * (attempt + 1);
      console.warn(`[KT] Rate limited; retrying in ${waitMs}ms (attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES + 1})`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  throw new Error('Gemini request failed after retries');
}

export async function generateKtDocument(transcript, config) {
  const estimatedTokens = estimateTokenCount(transcript);
  if (estimatedTokens > KT_MAX_INPUT_TOKENS) {
    throw new Error(
      `Transcript is too large for KT document generation (~${Math.round(estimatedTokens / 1000)}k tokens; limit is ${KT_MAX_INPUT_TOKENS / 1000}k). ` +
      'Use TL;DR or Bullets for very long meetings.'
    );
  }
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in Configuration or .env to use KT document generation.');
  }
  const model = config.ktModel || 'gemini-3.1-pro-preview';
  console.log(`Generating KT document with ${model} (~${Math.round(estimatedTokens / 1000)}k estimated tokens)`);
  return geminiKtRequest(config.geminiApiKey, model, transcript);
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

const META_SUMMARY_PROMPT_TEMPLATE = (timeWindow) => `You are summarizing technical meeting activity from recent transcript logs.

TIME WINDOW: Last ${timeWindow} minutes

STRICT RULES:
- IGNORE anything about "AI Transcriber", "Batches", "Screenshots", "Recording status"
- ONLY extract actual technical work performed
- If nothing technical happened, say "No significant technical activity in this window"
- Be FACTUAL - no speculation, no severity assessments, no narratives

EXTRACT:
- Commands executed (verbatim)
- Metrics/values observed (exact numbers)
- Resources accessed (AWS accounts, services, specific IDs)
- Errors/logs investigated (actual error messages)
- Changes made (deployments, configs, etc.)
- Findings from investigations (what was discovered)

FORMAT:
**Last ${timeWindow} Minutes**

🔧 **Actions & Findings:**
• [HH:MM] - [Factual observation with specific details]
• [HH:MM] - [Command/metric/resource/error - be specific]

If nothing technical: "No significant technical activity in this window"`;

export async function generateMetaSummary(recentEntries, config) {
  const timeWindow = config.metaAnalysisWindow || 5;
  const system = META_SUMMARY_PROMPT_TEMPLATE(timeWindow);
  const user = recentEntries
    .map((e, i) => `\n--- Batch ${i + 1} (${e.timestampLabel}) ---\n${e.content}`)
    .join('\n\n');
  return llmText(config, config.summaryModel, system, user, 2000);
}

export async function generateTldr(fullTranscript, config) {
  return llmText(
    config,
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
      : `<current_tldr>\n${summary}\n</current_tldr>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the TL;DR by merging this new chunk. Ensure the final TL;DR reflects the complete resolution if one was found in later chunks. Do not drop resolution details when merging. Deduplicate; output only the updated TL;DR.`;
    summary = await llmText(
      config,
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
  return llmText(
    config,
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
    summary = await llmText(
      config,
      config.bulletsModel,
      config.promptSet?.bulletSystem || BULLET_POINTS_SYSTEM_PROMPT,
      userPrompt,
      3200
    );
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return summary;
}

/**
 * Incremental bullet generation: takes already-generated bullets and only processes
 * transcript entries that are new since the last generation.  The LLM appends the
 * missing time-block updates and deduplicates, preserving reverse-chronological order.
 *
 * If newTranscript is empty, returns existingBullets unchanged (no LLM call).
 * If the combined token count would exceed MAX_SINGLE_SUMMARY_INPUT_TOKENS, the new
 * transcript is chunked and folded in iteratively, seeded with the existing bullets.
 */
export async function generateBulletPointsIncremental(existingBullets, newTranscript, config, onProgress) {
  if (!newTranscript || !newTranscript.trim()) {
    return existingBullets;
  }

  const system = config.promptSet?.bulletSystem || BULLET_POINTS_SYSTEM_PROMPT;
  const combined = existingBullets + newTranscript;
  const estimatedTokens = estimateTokenCount(combined);

  if (estimatedTokens <= MAX_SINGLE_SUMMARY_INPUT_TOKENS) {
    const userPrompt = `<current_bullets>
${existingBullets}
</current_bullets>

<new_entries>
${newTranscript}
</new_entries>

These new transcript entries happened AFTER the existing bullet-point summary above.
Add new time-block updates for the new entries only. Preserve all existing blocks unchanged.
Maintain reverse-chronological order (most recent first).
Deduplicate if any new entry overlaps with an already-covered topic.
Output only the complete updated bullets (existing + new appended).`;

    if (onProgress) await onProgress({ current: 1, total: 1 });
    return llmText(config, config.bulletsModel, system, userPrompt, 3500);
  }

  // New transcript too large: chunk it and fold incrementally, seeded with existing bullets.
  const chunks = chunkTranscriptByApproxTokens(newTranscript);
  let bullets = existingBullets;

  for (let i = 0; i < chunks.length; i += 1) {
    const userPrompt = `<current_bullets>
${bullets}
</current_bullets>

<new_entries>
${chunks[i]}
</new_entries>

Add new time-block updates for the new entries. Preserve existing blocks unchanged.
Maintain reverse-chronological order. Deduplicate overlaps.
Output only the complete updated bullets.`;

    bullets = await llmText(config, config.bulletsModel, system, userPrompt, 3500);
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return bullets;
}

export async function generateStoryArc(entries, config, onProgress) {
  const chunks = groupBatchesIntoChunks(entries, 10);
  let arc = '';

  for (let i = 0; i < chunks.length; i += 1) {
    const windows = formatChunk(chunks[i]);
    const prompt = i === 0
        ? `Write the opening of the story arc from these observation windows.\n\n${windows}`
        : `<existing_arc>\n${arc}\n</existing_arc>\n\n${windows}\n\nOutput the updated arc. Fold new info into existing sections when the topic fits. Only add a new section if the subject clearly changed. Compress earlier sections if the arc is getting too long. Target: 6-10 sections total. Output only the arc text.`;

    arc = await llmText(
      config,
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
    arc = await llmText(
      config,
      config.arcModel,
      config.promptSet?.arcSystem || ARC_SYSTEM_PROMPT,
      prompt,
      3500
    );
    if (onProgress) await onProgress({ current: i + 1, total: chunks.length });
  }

  return arc;
}
