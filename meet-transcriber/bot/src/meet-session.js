import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickFirstMatching(page, selectors) {
  for (const selector of selectors) {
    const node = await page.$(selector);
    if (!node) continue;
    try {
      await node.click();
      return true;
    } catch (error) {
      // Keep trying other selectors.
    }
  }
  return false;
}

/**
 * Dismisses Google Meet's pre-join media consent dialog ("Continue without microphone and camera").
 * Uses Puppeteer trusted clicks (ElementHandle.click) and avoids filtering by aria-hidden,
 * because Meet marks the entire page wrapper as aria-hidden="true" when this dialog is open.
 */
async function dismissPreJoinMediaPrompt(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      // Strategy 1: Direct selector for the MDC dialog cancel action button.
      const mdcBtn = await page.$('button[data-mdc-dialog-action="cancel"]');
      if (mdcBtn) {
        const text = await mdcBtn.evaluate((el) => (el.textContent || '').toLowerCase());
        if (text.includes('without microphone') || text.includes('continue without')) {
          await mdcBtn.click();
          console.log(`Pre-join media prompt clicked via MDC selector (attempt ${attempt + 1}/8).`);
          await sleep(700);
          return { state: 'clicked', attempt: attempt + 1 };
        }
      }

      // Strategy 2: Find by visible text content, using ElementHandle for trusted click.
      // Intentionally does NOT filter by aria-hidden — Meet wraps everything in aria-hidden when dialog is open.
      const btnHandle = await page.evaluateHandle(() => {
        const needle = 'continue without microphone and camera';
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        for (const btn of allButtons) {
          const combined = ((btn.textContent || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
          if (!combined.includes(needle)) continue;
          const rect = btn.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          const style = window.getComputedStyle(btn);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
          if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
          return btn;
        }
        // Fallback: find any span/element with the text and walk up to its button ancestor.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
          const text = (node.textContent || '').toLowerCase().trim();
          if (!text.includes(needle)) continue;
          const rect = node.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          const btn = node.closest('button, [role="button"]');
          if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') return btn;
        }
        return null;
      });

      const btnElement = btnHandle.asElement();
      if (btnElement) {
        await btnElement.click();
        console.log(`Pre-join media prompt clicked via text search (attempt ${attempt + 1}/8).`);
        await sleep(700);
        return { state: 'clicked', attempt: attempt + 1 };
      }

      // Detect if the modal text is present even though we couldn't find a clickable button.
      const modalPresent = await page.evaluate(() => {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        return bodyText.includes('do you want people to see and hear you in the meeting')
          || bodyText.includes('continue without microphone and camera');
      }).catch(() => false);

      console.log(`Pre-join media prompt attempt ${attempt + 1}/8: modal_visible=${modalPresent}, no clickable button found.`);
    } catch (error) {
      console.warn(`Pre-join media prompt attempt ${attempt + 1}/8 error:`, error.message);
    }
    await sleep(600);
  }

  const finalPresent = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    return bodyText.includes('do you want people to see and hear you in the meeting')
      || bodyText.includes('continue without microphone and camera');
  }).catch(() => false);
  return { state: finalPresent ? 'visible' : 'absent', attempt: 8 };
}

async function maybeSignIn(page, config) {
  if (!config.googleEmail || !config.googlePassword) return;

  await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.type('input[type="email"]', config.googleEmail, { delay: 30 });
  await clickFirstMatching(page, ['#identifierNext button', '#identifierNext']);
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await page.type('input[type="password"]', config.googlePassword, { delay: 30 });
  await clickFirstMatching(page, ['#passwordNext button', '#passwordNext']);
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
}

async function disableMicAndCamera(page) {
  const clickOffControlByLabel = async (keywords) => {
    return page.evaluate((needles) => {
      const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const node of nodes) {
        const text = (node.textContent || '').toLowerCase();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        const combined = `${text} ${aria}`;
        if (!needles.some((needle) => combined.includes(needle))) continue;
        const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        node.click();
        return true;
      }
      return false;
    }, keywords);
  };

  try {
    // Strict safety: only click explicit OFF controls; never generic toggles.
    // Covers both pre-join lobby labels and in-meeting toolbar labels.
    const micClicked = await clickOffControlByLabel([
      'turn off microphone',
      'mute microphone',
      'mute'
    ]);
    await sleep(500);
    const camClicked = await clickOffControlByLabel([
      'turn off camera',
      'camera is on',
      'stop video'
    ]);
    if (micClicked || camClicked) {
      console.log('AV controls clicked:', { micClicked, camClicked });
    }
  } catch (error) {
    console.warn('Warning: could not click explicit mic/cam OFF controls', error.message);
  }
}

async function verifyMicCameraOff(page) {
  const state = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const mic = buttons.find((node) => {
      const text = (node.textContent || '').toLowerCase();
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const combined = `${text} ${aria}`;
      return combined.includes('microphone') || combined.includes('mute');
    });
    const cam = buttons.find((node) => {
      const text = (node.textContent || '').toLowerCase();
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const combined = `${text} ${aria}`;
      return combined.includes('camera');
    });
    const isOff = (node, target) => {
      if (!node) return false;
      const ariaPressed = node.getAttribute('aria-pressed');
      const ariaLabel = (node.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes(`turn on ${target}`)) return true;
      if (ariaPressed === 'false') return true;
      return false;
    };
    return {
      micOff: isOff(mic, 'microphone'),
      camOff: isOff(cam, 'camera')
    };
  });
  return state;
}

async function ensureMicCameraOff(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await disableMicAndCamera(page);
    await sleep(350);
    const state = await verifyMicCameraOff(page);
    if (state.micOff && state.camOff) {
      return state;
    }
  }
  return verifyMicCameraOff(page);
}

async function joinMeet(page) {
  const clickResult = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const target = nodes.find((node) => {
      const text = (node.textContent || '').toLowerCase();
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const combined = `${text} ${aria}`;
      if (!(combined.includes('ask to join') || combined.includes('join now'))) return false;
      const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
      return !disabled;
    });

    if (!target) {
      return { clicked: false, label: '' };
    }

    target.click();
    return {
      clicked: true,
      label: (target.textContent || target.getAttribute('aria-label') || '').trim()
    };
  });

  if (clickResult.clicked) {
    console.log(`Join click sent to: ${clickResult.label}`);
    return true;
  }

  return false;
}

async function enableCaptions(page) {
  const clicked = await clickFirstMatching(page, [
    'button[aria-label*="Turn on captions"]',
    'button[aria-label*="captions"]',
    'div[role="button"][aria-label*="captions"]'
  ]);
  if (!clicked) {
    try {
      await page.keyboard.press('KeyC');
      await sleep(250);
      await page.keyboard.down('Shift');
      await page.keyboard.press('KeyC');
      await page.keyboard.up('Shift');
    } catch (_error) {
      // no-op
    }
  }
}
async function ensureCaptionsEnabled(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await enableCaptions(page);
    await sleep(600);
    if (await isCaptionsOn(page)) {
      return true;
    }
  }
  return false;
}


async function isCaptionsOn(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
    return nodes.some((node) => {
      const label = ((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')).toLowerCase();
      return label.includes('turn off captions');
    });
  });
}

/**
 * Dismisses any post-join consent dialog that has a "Join now" button (transcription warnings,
 * Gemini notes, third-party app sharing like Read AI, etc.). Clicks "Join now" to proceed.
 */
async function dismissPostJoinConsentDialog(page) {
  try {
    const result = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const joinNowNode = nodes.find((node) => {
        const text = (node.textContent || '').toLowerCase().trim();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase().trim();
        return text === 'join now' || aria === 'join now';
      });
      if (!joinNowNode) return { clicked: false, reason: null };
      const disabled = joinNowNode.hasAttribute('disabled') || joinNowNode.getAttribute('aria-disabled') === 'true';
      if (disabled) return { clicked: false, reason: 'join_now_disabled' };
      const dialogText = (joinNowNode.closest('[role="dialog"], [role="alertdialog"], .mUIrbf-RMB1Gb')
        ?.textContent || document.body?.innerText || '').substring(0, 300).trim();
      joinNowNode.click();
      return { clicked: true, reason: dialogText };
    });
    if (result.clicked) {
      console.log('Post-join consent dialog dismissed (clicked Join now). Context:', result.reason?.substring(0, 120));
      await sleep(700);
    }
    return result.clicked;
  } catch (error) {
    if (!String(error?.message || '').includes('detached')) {
      console.warn('Could not process post-join consent dialog:', error.message);
    }
    return false;
  }
}

async function ensureMeetingControlsReady(page, maxAttempts = 20, intervalMs = 2000) {
  let lastAv = { micOff: false, camOff: false };
  let lastCaptionsOn = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastAv = await verifyMicCameraOff(page);
    lastCaptionsOn = await isCaptionsOn(page);
    const done = lastAv.micOff && lastAv.camOff && lastCaptionsOn;

    console.log('Post-join controls check:', {
      attempt,
      maxAttempts,
      micOff: lastAv.micOff,
      camOff: lastAv.camOff,
      captionsOn: lastCaptionsOn,
      done
    });

    if (done) {
      return { av: lastAv, captionsOn: lastCaptionsOn, attempts: attempt };
    }

    if (!lastAv.micOff || !lastAv.camOff) {
      await disableMicAndCamera(page);
      await sleep(900);
    }
    if (!lastCaptionsOn) {
      await enableCaptions(page);
      await sleep(700);
    }
    await dismissPostJoinConsentDialog(page);
    const notification = await dismissInMeetingNotifications(page);
    if (notification) {
      console.log('Dismissed in-meeting notification:', notification.replace(/\n/g, ' '));
    }
    await sleep(intervalMs);
  }

  return { av: lastAv, captionsOn: lastCaptionsOn, attempts: maxAttempts };
}

/**
 * Dismisses generic informational/warning modals that Meet shows during a call.
 * Examples: "Others may see your video differently", "You can still turn off your mic", etc.
 * Returns the text of the dismissed modal if one was found, otherwise null.
 */
async function dismissInMeetingNotifications(page) {
  try {
    return await page.evaluate(() => {
      // Button labels that indicate a dismissible notification/tip (not action dialogs).
      const dismissLabels = ['got it', 'ok', 'dismiss', 'close', 'ok, got it', 'done'];
      const isVisible = (node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      // Find dismiss-style buttons that are visible and not inside the main toolbar.
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
        if (!dismissLabels.some((lbl) => text === lbl || aria === lbl)) continue;
        if (!isVisible(btn)) continue;
        // Avoid dismissing join/leave/caption controls — those have longer surrounding context.
        const parentText = (btn.closest('[role="dialog"], [role="alertdialog"], [jsname], .VfPpkd-Jh9lGc') || btn.parentElement)
          ?.innerText?.toLowerCase() || '';
        if (
          parentText.includes('leave') ||
          parentText.includes('end the call for') ||
          parentText.includes('turn on captions')
        ) continue;
        // We have a dismiss candidate.
        const modalText = (btn.closest('[role="dialog"], [role="alertdialog"], .XKSfm-RLmnJb, .VfPpkd-Jh9lGc') || btn.parentElement)
          ?.innerText?.slice(0, 120) || text;
        btn.click();
        return modalText.trim();
      }
      return null;
    });
  } catch (error) {
    if (!String(error.message).toLowerCase().includes('detached')) {
      console.warn('In-meeting notification dismissal error:', error.message);
    }
    return null;
  }
}

async function detectMeetingEnded(page) {
  return page.evaluate(() => {
    const markers = [
      'You left the meeting',
      'Meeting ended',
      'Return to home screen',
      'You can close this tab'
    ];
    const body = document.body?.innerText || '';
    return markers.some((marker) => body.includes(marker));
  });
}

async function countNonBotParticipants(page, botName) {
  try {
    return await page.evaluate((ownName) => {
      const botLower = (ownName || 'meet bot').toLowerCase();

      // Try the participant count badge first — fast path.
      const countBadge = document.querySelector('[data-participant-count], .uGOf1d, [jsname="r4nke"]');
      if (countBadge) {
        const n = parseInt(countBadge.textContent, 10);
        if (!isNaN(n)) return Math.max(0, n - 1); // subtract ourselves
      }

      // Fall back to walking visible participant name elements.
      const nameEls = Array.from(document.querySelectorAll(
        '[jsname="A4nspb"], [jsname="GvcuGe"], .zWGUib'
      ));
      if (nameEls.length === 0) return null; // can't determine

      const others = nameEls.filter((el) => {
        const text = (el.textContent || '').toLowerCase().trim();
        return text && !text.includes(botLower) && text !== 'you';
      });
      return others.length;
    }, botName);
  } catch (_error) {
    return null; // page may be detached; caller should handle gracefully
  }
}

async function leaveMeeting(page) {
  try {
    const clicked = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const leaveNode = nodes.find((node) => {
        const text = (node.textContent || '').toLowerCase();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        const combined = `${text} ${aria}`;
        return combined.includes('leave call')
          || combined.includes('leave meeting')
          || combined.includes('hang up')
          || combined.includes('end call');
      });
      if (!leaveNode) return false;
      const disabled = leaveNode.hasAttribute('disabled') || leaveNode.getAttribute('aria-disabled') === 'true';
      if (disabled) return false;
      leaveNode.click();
      return true;
    });

    if (clicked) {
      console.log('Leave call button clicked.');
      await sleep(800);
      return true;
    }
  } catch (error) {
    console.warn('Leave call click failed:', error.message);
  }
  return false;
}

async function detectJoinDenied(page) {
  return page.evaluate(() => {
    const body = document.body?.innerText || '';
    return body.includes("You can't join this video call");
  });
}

async function setGuestName(page, guestName) {
  const selectors = [
    'input[aria-label*="Your name"]',
    'input[placeholder*="Your name"]',
    'input[type="text"]'
  ];

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (!input) continue;
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, guestName, { delay: 35 });
    return true;
  }

  return false;
}

async function isInMeeting(page) {
  return page.evaluate(() => {
    const joinedSelectors = [
      'button[aria-label*="Leave call"]',
      'button[aria-label*="Turn on captions"]',
      'button[aria-label*="Turn off captions"]'
    ];
    return joinedSelectors.some((selector) => document.querySelector(selector));
  });
}

async function waitForMeetingAdmission(page, waitSec, onModalCheck, emitStatus) {
  const timeoutAt = Date.now() + waitSec * 1000;
  while (Date.now() < timeoutAt) {
    if (onModalCheck) {
      try {
        await onModalCheck();
      } catch (error) {
        if (!String(error?.message || '').toLowerCase().includes('detached frame')) {
          console.warn('Modal check warning during admission wait:', error.message);
        }
      }
    }
    try {
      await dismissPostJoinConsentDialog(page);
    } catch (error) {
      if (!String(error?.message || '').toLowerCase().includes('detached frame')) {
        console.warn('Transcription warning check failed during admission wait:', error.message);
      }
    }
    if (emitStatus) {
      emitStatus('join_wait_tick', { secondsRemaining: Math.max(0, Math.round((timeoutAt - Date.now()) / 1000)) });
    }
    if (await detectJoinDenied(page)) {
      console.log('Join diagnostics (denied-during-wait):', await collectJoinDiagnostics(page));
      throw new Error("Join denied by Google Meet. This account must be invited or admitted by the host.");
    }
    if (await isInMeeting(page)) {
      return true;
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for admission after ${waitSec}s.`);
}

async function hasGuestJoinUi(page) {
  return page.evaluate(() => {
    const hasNameInput = Boolean(
      document.querySelector('input[aria-label*="Your name"], input[placeholder*="Your name"]')
    );
    const hasJoinButton = Array.from(document.querySelectorAll('button, div[role="button"]')).some((node) => {
      const text = (node.textContent || '').toLowerCase();
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const combined = `${text} ${aria}`;
      return combined.includes('ask to join') || combined.includes('join now');
    });
    return hasNameInput && hasJoinButton;
  });
}

async function waitForJoinButtonEnabled(page, waitSec, onModalCheck) {
  const timeoutAt = Date.now() + waitSec * 1000;
  while (Date.now() < timeoutAt) {
    if (onModalCheck) await onModalCheck();
    const state = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const target = nodes.find((node) => {
        const text = (node.textContent || '').toLowerCase();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        const combined = `${text} ${aria}`;
        return combined.includes('ask to join') || combined.includes('join now');
      });
      if (!target) return { exists: false, enabled: false, label: '' };
      const disabled = target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true';
      return {
        exists: true,
        enabled: !disabled,
        label: (target.textContent || target.getAttribute('aria-label') || '').trim()
      };
    });

    if (state.exists && state.enabled) {
      console.log(`Join button enabled: ${state.label}`);
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function collectJoinDiagnostics(page) {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const joinButtonCandidates = Array.from(
      document.querySelectorAll('button, div[role="button"]')
    )
      .map((node) => ({
        text: (node.textContent || '').trim(),
        ariaLabel: node.getAttribute('aria-label') || '',
        disabled: node.getAttribute('aria-disabled') === 'true' || node.hasAttribute('disabled')
      }))
      .filter((entry) => {
        const combined = `${entry.text} ${entry.ariaLabel}`.toLowerCase();
        return combined.includes('join') || combined.includes('admit') || combined.includes('ask');
      })
      .slice(0, 10);

    const nameInput = document.querySelector('input[aria-label*="Your name"], input[placeholder*="Your name"], input[type="text"]');

    return {
      location: window.location.href,
      title: document.title,
      hasJoinDeniedText: bodyText.includes("You can't join this video call"),
      hasNameInput: Boolean(nameInput),
      nameInputDisabled: nameInput ? nameInput.disabled : null,
      joinButtons: joinButtonCandidates
    };
  });
}

export async function startMeetSession(config, hooks = {}) {
  const emitStatus = (event, payload = {}) => {
    if (hooks?.onStatus) {
      hooks.onStatus(event, payload);
    }
  };

  async function dismissPreJoinMediaPromptWithStatus() {
    const result = await dismissPreJoinMediaPrompt(page);
    if (result?.state === 'clicked') {
      emitStatus('prejoin_media_prompt', { state: 'clicked', attempt: result.attempt });
    } else if (result?.state === 'visible') {
      emitStatus('prejoin_media_prompt', { state: 'visible', attempt: result.attempt });
    } else {
      emitStatus('prejoin_media_prompt', { state: 'absent', attempt: result?.attempt || 0 });
    }
    return result;
  }

  const puppeteer = addExtra(puppeteerCore);
  if (config.enableStealth) {
    puppeteer.use(StealthPlugin());
  }

  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: config.headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      // --no-sandbox is required on Linux (Docker/CI) but produces a warning on macOS.
      ...(process.platform !== 'darwin' ? ['--no-sandbox'] : []),
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required'
    ],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 }
  });

  const [page] = await browser.pages();
  await page.bringToFront();
  await page.browserContext().overridePermissions('https://meet.google.com', ['notifications', 'camera', 'microphone']);

  await page.goto(config.meetUrl, { waitUntil: 'networkidle2' });
  await sleep(3000);
  await dismissPreJoinMediaPromptWithStatus();
  await dismissPreJoinMediaPromptWithStatus();

  const initialDiagnostics = await collectJoinDiagnostics(page);
  console.log('Join diagnostics (initial):', initialDiagnostics);

  if (await detectJoinDenied(page)) {
    console.log('Join diagnostics (denied-initial):', await collectJoinDiagnostics(page));
    throw new Error("Join denied by Google Meet. This account must be invited or admitted by the host.");
  }

  const canGuestJoin = await hasGuestJoinUi(page);
  const joinMode = canGuestJoin && !config.forceGoogleSignIn ? 'guest' : 'google-signin';
  console.log(`Join mode selected: ${joinMode}`);
  if (canGuestJoin && !config.forceGoogleSignIn) {
    console.log(`Guest join UI detected. Joining as guest name: ${config.guestName}`);
    const filledName = await setGuestName(page, config.guestName);
    if (!filledName) {
      throw new Error('Guest join detected but could not fill name input.');
    }
    const joinEnabled = await waitForJoinButtonEnabled(page, 20, dismissPreJoinMediaPromptWithStatus);
    if (!joinEnabled) {
      console.log('Join diagnostics (guest-button-disabled):', await collectJoinDiagnostics(page));
      throw new Error('Ask to join button stayed disabled after entering guest name.');
    }
  } else {
    if (!config.googleEmail || !config.googlePassword) {
      throw new Error('Guest join unavailable and GOOGLE_EMAIL/GOOGLE_PASSWORD not configured.');
    }
    console.log('Guest join unavailable or forced sign-in enabled. Signing in with Google account.');
    await maybeSignIn(page, config);
    await page.goto(config.meetUrl, { waitUntil: 'networkidle2' });
    await sleep(3000);
    await dismissPreJoinMediaPromptWithStatus();
    await dismissPreJoinMediaPromptWithStatus();
    console.log('Join diagnostics (post-signin):', await collectJoinDiagnostics(page));
  }

  await dismissPreJoinMediaPromptWithStatus();
  await ensureMicCameraOff(page);
  console.log('Join diagnostics (pre-click):', await collectJoinDiagnostics(page));
  const clickedJoin = await joinMeet(page);
  if (!clickedJoin) {
    console.log('Join diagnostics (click-missed):', await collectJoinDiagnostics(page));
    throw new Error('Could not find Ask to join / Join now button.');
  }
  // Modal often renders right after clicking join; let DOM settle first.
  await sleep(1000);
  await dismissPreJoinMediaPromptWithStatus();
  await waitForMeetingAdmission(page, config.joinWaitSec, dismissPreJoinMediaPromptWithStatus, emitStatus);
  await dismissPostJoinConsentDialog(page);
  console.log('Meeting admission confirmed. Verifying controls...');
  await sleep(2000);
  const ready = await ensureMeetingControlsReady(page);
  const av = ready.av;
  const captionsOn = ready.captionsOn;
  console.log('AV state after join:', av);
  if (!av.micOff || !av.camOff) {
    console.warn('Meet bot could not fully verify mic/camera are off.');
  }
  console.log('Caption toggle attempted. Captions on:', captionsOn);

  const startedAt = Date.now();
  const timeoutMs = config.maxMeetingMinutes * 60 * 1000;

  return {
    page,
    browser,
    diagnostics: {
      avState: av,
      captionsOn
    },
    async waitForEnd(onStatus) {
      const emptyGraceSec = config.emptyMeetingGraceSec ?? 60;
      const emptyGraceMs  = emptyGraceSec * 1000;
      let emptyStartedAt  = null;

      while (true) {
        const ended = await detectMeetingEnded(page).catch(() => false);
        if (ended) return 'meeting-ended';
        if (Date.now() - startedAt > timeoutMs) return 'timeout';

        // Continuously dismiss any informational popups Meet may show during the session.
        const notification = await dismissInMeetingNotifications(page).catch(() => null);
        if (notification) {
          console.log('Dismissed in-meeting notification (during wait):', notification.replace(/\n/g, ' '));
          if (onStatus) onStatus('notification_dismissed', { text: notification.slice(0, 120) });
        }

        // Detect when all humans have left — only bots remain.
        const humanCount = await countNonBotParticipants(page, config.guestName).catch(() => null);
        if (humanCount !== null) {
          if (humanCount === 0) {
            if (!emptyStartedAt) {
              emptyStartedAt = Date.now();
              console.log(`No human participants detected; grace period starts (${emptyGraceSec}s).`);
              if (onStatus) onStatus('empty_meeting_grace', { graceSec: emptyGraceSec });
            } else {
              const elapsed = Math.floor((Date.now() - emptyStartedAt) / 1000);
              const remaining = emptyGraceSec - elapsed;
              console.log(`Still no humans; leaving in ${remaining}s.`);
              if (onStatus) onStatus('empty_meeting_grace', { graceSec: emptyGraceSec, remainingSec: remaining });
              if (Date.now() - emptyStartedAt >= emptyGraceMs) {
                console.log('Grace period expired — leaving empty meeting.');
                return 'participants-left';
              }
            }
          } else {
            if (emptyStartedAt) {
              console.log(`${humanCount} human participant(s) back — grace period cancelled.`);
              if (onStatus) onStatus('empty_meeting_grace_cancelled', { humanCount });
            }
            emptyStartedAt = null;
          }
        }

        await sleep(5000);
      }
    },
    async leave() {
      if (page.isClosed()) return false;
      return leaveMeeting(page);
    },
    async close() {
      await browser.close();
    }
  };
}
