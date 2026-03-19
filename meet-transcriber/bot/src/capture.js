function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueNonEmptyLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const trimmed = (line || '').trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Scrapes live speech captions from Google Meet's DOM.
 * Tries specific caption container selectors first, falls back to aria-live="polite"
 * only as a last resort, with a noise filter to reject short UI strings (dropdowns, labels).
 */
async function scrapeCaptions(page) {
  const candidates = await page.evaluate(() => {
    // Minimum length to reject short UI noise (language names, labels, single words).
    const MIN_CAPTION_LENGTH = 15;

    // Priority order: most specific Meet caption selectors first.
    // [aria-live="polite"] is last-resort only — it also fires on language dropdowns.
    const selectors = [
      'div[jsname="tgaKEf"]',           // live caption transcript region
      '[data-speaker-id]',               // individual speaker caption lines
      '.iOzk7',                          // caption speaker name + text container
      '.bh44bd',                         // caption text line
      '[jsname="YSxPC"]',                // known Meet caption jsname
      '.TBMuR.byzRgd',
      '.a4cQT',
      '[aria-live="polite"]'             // last resort only
    ];

    const text = [];
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((node) => {
        const value = (node.textContent || '').trim();
        if (value.length >= MIN_CAPTION_LENGTH) text.push(value);
      });
      if (text.length > 0) break;
    }
    return text;
  });

  return uniqueNonEmptyLines(candidates);
}

export function startCaptureLoop({ page, config, onBatch, onTick, onFatal }) {
  let running = true;
  let screenshots = [];
  let captionLog = [];
  let windowStartedAt = new Date();
  const intervalMs = config.captureIntervalSec * 1000;
  let consecutiveScreenshotFailures = 0;
  const maxConsecutiveScreenshotFailures = 6;

  const loop = (async () => {
    while (running) {
      const now = new Date();
      let imageBase64 = '';
      let screenshotError = null;
      try {
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: config.screenshotQuality,
          fullPage: false
        });
        imageBase64 = Buffer.from(screenshotBuffer).toString('base64');
        consecutiveScreenshotFailures = 0;
      } catch (error) {
        screenshotError = error;
        consecutiveScreenshotFailures += 1;
        console.warn('Capture warning: screenshot failed', error.message);
      }

      try {
        const lines = await scrapeCaptions(page);
        if (lines.length > 0) {
          captionLog.push(...lines);
        }
      } catch (error) {
        console.warn('Capture warning: caption scrape failed', error.message);
      }

      if (imageBase64) {
        screenshots.push(imageBase64);
      }

      if (onTick) {
        await onTick({
          timestamp: now.toISOString(),
          screenshotCount: screenshots.length,
          consecutiveScreenshotFailures
        });
      }

      if (consecutiveScreenshotFailures >= maxConsecutiveScreenshotFailures) {
        const message = `Capture stopped after ${consecutiveScreenshotFailures} consecutive screenshot failures. Last error: ${screenshotError?.message || 'unknown'}`;
        if (onFatal) {
          await onFatal(new Error(message));
        }
        running = false;
      }

      if (screenshots.length >= config.batchSize) {
        const endedAt = new Date();
        const uniqueCaptions = uniqueNonEmptyLines(captionLog).join('\n');
        await onBatch({
          screenshots,
          captions: uniqueCaptions,
          startedAtIso: windowStartedAt.toISOString(),
          endedAtIso: endedAt.toISOString()
        });
        screenshots = [];
        captionLog = [];
        windowStartedAt = endedAt;
      }

      await sleep(intervalMs);
    }
  })();

  return {
    async stop() {
      running = false;
      await loop.catch((error) => {
        console.warn('Capture loop stopped with warning', error.message);
      });

      if (screenshots.length > 0) {
        const endedAt = new Date();
        const uniqueCaptions = uniqueNonEmptyLines(captionLog).join('\n');
        await onBatch({
          screenshots,
          captions: uniqueCaptions,
          startedAtIso: windowStartedAt.toISOString(),
          endedAtIso: endedAt.toISOString()
        });
      }
    }
  };
}
