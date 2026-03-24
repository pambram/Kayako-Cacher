import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

function extractRegex(source, regex, label) {
  const match = source.match(regex);
  if (!match || !match[1]) {
    throw new Error(`Failed to extract ${label} from background.js`);
  }
  return match[1];
}

export async function loadExtensionPromptSet() {
  // In Docker (WORKDIR /app, background.js copied to /app/background.js), check cwd first.
  // In local dev (cwd = .../meet-transcriber/bot), fall back to ../background.js.
  const cwdCandidate = path.resolve(process.cwd(), 'background.js');
  const parentCandidate = path.resolve(process.cwd(), '..', 'background.js');
  const backgroundPath = fsSync.existsSync(cwdCandidate) ? cwdCandidate : parentCandidate;
  const source = await fs.readFile(backgroundPath, 'utf8');

  const analysisPrompts = source.match(
    /const systemPrompt = config\.technicalMode \?\s*`([\s\S]*?)`\s*:\s*`([\s\S]*?)`;/m
  );
  if (!analysisPrompts || !analysisPrompts[1] || !analysisPrompts[2]) {
    throw new Error('Failed to extract analysis prompts from background.js');
  }

  const tldrSystemMatch = source.match(
    /const\s+tldrSystemPrompt\s*=\s*`([\s\S]*?)`;/m
  ) || source.match(
    /system:\s*`([\s\S]*?)`,\s*messages:\s*\[\{ role: 'user', content: `[\s\S]*?\$\{fullTranscript\}` \}\]/m
  ) || source.match(
    /system:\s*`([\s\S]*?)`,\s*messages:\s*\[\{ role: 'user', content: `Generate a TL;DR for this meeting transcript:/m
  );
  if (!tldrSystemMatch || !tldrSystemMatch[1]) {
    throw new Error('Failed to extract tldr system prompt from background.js');
  }
  const tldrSystem = tldrSystemMatch[1];

  const bulletPrompt = extractRegex(
    source,
    /const BULLET_POINTS_PROMPT = `([\s\S]*?)`;/m,
    'bullet points prompt'
  );

  const arcSystem = extractRegex(
    source,
    /const ARC_SYSTEM_PROMPT = `([\s\S]*?)`;/m,
    'story arc system prompt'
  );

  const ktScreenshotClassifierSystem = extractRegex(
    source,
    /const KT_SCREENSHOT_CLASSIFIER_PROMPT = `([\s\S]*?)`;/m,
    'KT screenshot classifier prompt'
  );

  return {
    analysisTechnical: analysisPrompts[1],
    analysisStandard: analysisPrompts[2],
    tldrSystem,
    bulletSystem: bulletPrompt,
    arcSystem,
    ktScreenshotClassifierSystem
  };
}
