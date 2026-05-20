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

async function maybeSignIn(page, config, emitStatus) {
  if (!config.googleEmail || !config.googlePassword) return;

  console.log(`[signIn] Navigating to Google sign-in page...`);
  await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle2' });

  console.log(`[signIn] Entering email...`);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await sleep(300);
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', config.googleEmail, { delay: 50 });
  await sleep(300);
  await clickFirstMatching(page, ['#identifierNext button', '#identifierNext']);
  // Wait for the page to transition to the password step.
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await sleep(500);

  console.log(`[signIn] Waiting for password field... URL: ${page.url()}`);
  // Google uses several possible selectors for the password input depending on flow version.
  const pwdSelector = await Promise.race([
    page.waitForSelector('input[type="password"]',  { timeout: 15000 }).then(() => 'input[type="password"]'),
    page.waitForSelector('input[name="Passwd"]',     { timeout: 15000 }).then(() => 'input[name="Passwd"]'),
    page.waitForSelector('input[name="password"]',   { timeout: 15000 }).then(() => 'input[name="password"]'),
    page.waitForSelector('#password input',          { timeout: 15000 }).then(() => '#password input'),
  ]).catch(() => null);

  if (!pwdSelector) {
    console.warn(`[signIn] Could not find password field. Page HTML snippet: ${(await page.evaluate(() => document.body?.innerHTML?.slice(0, 500) || '').catch(() => ''))}`);
    throw new Error('Google sign-in: password field not found');
  }

  console.log(`[signIn] Password field found via: ${pwdSelector}`);
  await sleep(300);
  await page.click(pwdSelector);
  await page.type(pwdSelector, config.googlePassword, { delay: 50 });
  await sleep(300);
  await clickFirstMatching(page, ['#passwordNext button', '#passwordNext']);
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  // Google sign-in may have 2FA or multiple redirects — wait up to 2 minutes.
  console.log(`[signIn] Waiting for sign-in to complete (up to 120s)...`);
  let twoFaLogged = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const url = page.url();
    if (!url.includes('accounts.google.com')) {
      break;
    }
    // Detect 2FA prompt and keep waiting — user needs to approve on their phone.
    // Dismiss "Sign in to Chrome?" / work profile modal if it appears mid-flow.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.toLowerCase().includes('without an account') ||
        b.textContent.toLowerCase().includes('use chrome without')
      );
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);

    const bodyText = await page.evaluate(() => (document.body?.innerText || '').toLowerCase()).catch(() => '');
    if (bodyText.includes('2-step') || bodyText.includes('verification') || bodyText.includes('verify it')) {
      if (!twoFaLogged) {
        console.log(`[signIn] 2FA prompt detected — waiting for approval on phone...`);
        if (emitStatus) emitStatus('signin_waiting_2fa', { message: 'Waiting for 2FA approval on phone' });
      }
      twoFaLogged = true;
      // Don't break — keep polling until the user taps Yes on their phone.
      continue;
    }
  }

  await sleep(1000);

  // Dismiss the "Sign in to Chrome?" browser profile dialog if it appears.
  const dismissedChromeSignin = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) =>
      b.textContent.toLowerCase().includes('without an account') ||
      b.textContent.toLowerCase().includes('use chrome without')
    );
    if (btn) { btn.click(); return true; }
    return false;
  }).catch(() => false);
  if (dismissedChromeSignin) {
    console.log('[signIn] Dismissed "Sign in to Chrome?" profile dialog.');
    await sleep(800);
  }

  console.log(`[signIn] Sign-in flow finished. Final URL: ${page.url()}`);
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
 * Dismisses generic informational/warning modals and in-call action dialogs that Meet shows
 * during a call.  Handles two categories:
 *
 *   1. Info/tip dismissals: "Got it", "OK", "Dismiss", "Close", "Done"
 *   2. Action-dialog cancellations: "Cancel" buttons on mute/remove/participant dialogs
 *      (e.g. "Mute Priyanka for everyone?") — always clicks Cancel to avoid the destructive action.
 *
 * Safety: never clicks Cancel if the dialog context mentions "leave" or "end the call for everyone"
 * to avoid accidentally cancelling the bot's own leave action.
 *
 * Returns the text of the dismissed modal if one was found, otherwise null.
 */
export async function dismissInMeetingNotifications(page) {
  try {
    return await page.evaluate(() => {
      // Button labels for simple info/tip dismissals.
      const dismissLabels = ['got it', 'ok', 'dismiss', 'close', 'ok, got it', 'done'];

      // Keywords that indicate the dialog is the bot's own leave/end-call flow — never cancel those.
      const leaveKeywords = ['leave', 'end the call for', 'hang up'];

      const isVisible = (node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      const getParentContext = (btn) =>
        (btn.closest('[role="dialog"], [role="alertdialog"], [jsname], .VfPpkd-Jh9lGc') || btn.parentElement)
          ?.innerText?.toLowerCase() || '';

      const getModalText = (btn) =>
        (btn.closest('[role="dialog"], [role="alertdialog"], .XKSfm-RLmnJb, .VfPpkd-Jh9lGc') || btn.parentElement)
          ?.innerText?.slice(0, 120) || (btn.textContent || '').trim();

      const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));

      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
        if (!isVisible(btn)) continue;

        const isTipDismissal = dismissLabels.some((lbl) => text === lbl || aria === lbl);
        const isCancelAction = text === 'cancel' || aria === 'cancel';

        if (!isTipDismissal && !isCancelAction) continue;

        const parentText = getParentContext(btn);

        // Skip tip-dismissals that are really join/caption controls.
        if (isTipDismissal && parentText.includes('turn on captions')) continue;

        // Safety: never cancel the bot's own leave flow.
        if (leaveKeywords.some((kw) => parentText.includes(kw))) continue;

        const modalText = getModalText(btn);
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

      // ─── Strategy 1: aria-label on the "people" toolbar button ──────
      // This is the most stable — Meet uses aria-labels like
      // "People (3)" or "1 participant" that survive UI redesigns.
      const allButtons = Array.from(document.querySelectorAll(
        'button[aria-label], div[role="button"][aria-label]'
      ));
      for (const btn of allButtons) {
        const aria = btn.getAttribute('aria-label') || '';
        // Match patterns: "People (3)", "Show everyone (3)", "3 people in this call",
        // "Participants (3)", "1 participant", etc.
        const m = aria.match(/(?:people|participant|everyone|in this call)[^\d]*(\d+)|(\d+)[^\d]*(?:people|participant)/i);
        if (m) {
          const total = parseInt(m[1] || m[2], 10);
          if (!isNaN(total)) return Math.max(0, total - 1); // subtract ourselves (the bot)
        }
      }

      // ─── Strategy 2: numeric text node next to the people icon ──────
      // The participant-count chip in the top toolbar typically shows just "3".
      // Find any small numeric element adjacent to a "people" icon or i18n attribute.
      const peopleIcons = Array.from(document.querySelectorAll(
        'i[data-tooltip*="people" i], i[aria-label*="people" i], svg[aria-label*="people" i]'
      ));
      for (const icon of peopleIcons) {
        const container = icon.closest('button, div[role="button"], li, div');
        if (!container) continue;
        const text = (container.textContent || '').trim();
        const m = text.match(/^\s*(\d+)\s*$/);
        if (m) {
          const total = parseInt(m[1], 10);
          if (!isNaN(total)) return Math.max(0, total - 1);
        }
      }

      // ─── Strategy 3: count distinct video/avatar tiles on stage ─────
      // Each participant has a tile container with role="region" or known classes.
      // We count tiles whose visible name is NOT our bot name.
      const tileSelectors = [
        '[data-self-name]',                       // when self-view is rendered
        '[data-participant-id]',                  // participant tile attribute
        'div[data-allocation-index]',             // grid tile (older)
        'div[role="region"][aria-label]',         // accessible tile region
        'div[jscontroller][data-participant-id]'  // newer tile
      ];
      const tiles = new Set();
      for (const sel of tileSelectors) {
        document.querySelectorAll(sel).forEach((el) => tiles.add(el));
      }
      if (tiles.size > 0) {
        let others = 0;
        for (const tile of tiles) {
          const label = (tile.getAttribute('aria-label') || tile.textContent || '').toLowerCase();
          if (!label) continue;
          if (label.includes(botLower)) continue;
          if (label.trim() === 'you' || label.trim() === 'self') continue;
          others++;
        }
        return others;
      }

      // ─── Strategy 4: visible name elements in the stage area ───────
      // Walk all elements that look like a participant name footer (small text near the bottom of a tile).
      const nameEls = Array.from(document.querySelectorAll(
        '[jsname="A4nspb"], [jsname="GvcuGe"], [jsname="m6lDLb"], .zWGUib, .ZjFb7c, .NnTWjc'
      ));
      if (nameEls.length > 0) {
        const others = nameEls.filter((el) => {
          const text = (el.textContent || '').toLowerCase().trim();
          return text && !text.includes(botLower) && text !== 'you';
        });
        return others.length;
      }

      return null; // none of the strategies worked
    }, botName);
  } catch (_error) {
    return null;
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

  // Persistent user data dir gives Chrome realistic state (history, prefs)
  // across runs — fresh profiles are a major bot-detection signal.
  const userDataDir = config.userDataDir || `${config.outputDir}/chrome-profile`;

  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: config.headless,
    userDataDir,
    // Strip --enable-automation flag AND its companion DevTools-protocol switch.
    // Both are needed; the lone --enable-automation removal is no longer enough
    // because Puppeteer also sets useAutomationExtension which trips Meet detection.
    ignoreDefaultArgs: [
      '--enable-automation',
      '--disable-component-update',
      '--disable-default-apps'
    ],
    args: [
      ...(process.platform !== 'darwin' ? ['--no-sandbox'] : []),
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      // Residential proxy to avoid datacenter IP blocks on Google Meet.
      // Set PUPPETEER_PROXY=http://user:pass@host:port in .env or config.
      ...(config.puppeteerProxy ? [`--proxy-server=${config.puppeteerProxy}`] : []),
      '--window-size=1920,1080',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--lang=en-US',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=SyncToSignin,IdentityConsistencyAccountConsistency,Translate'
      // NOTE: do NOT override --user-agent. Letting Chrome use its real UA
      // matches the rest of the browser fingerprint (canvas, WebGL, fonts, etc.)
      // A mismatched UA is the #1 anti-bot detection signal.
    ],
    defaultViewport: null  // use the real window size, not a forced viewport
  });

  const [page] = await browser.pages();
  await page.bringToFront();
  await page.browserContext().overridePermissions('https://meet.google.com', ['notifications', 'camera', 'microphone']);

  // Additional stealth: remove automation fingerprints that the stealth plugin may not fully cover.
  // Note: the stealth plugin already handles most of these, but Meet's detection is aggressive,
  // so we redo them defensively.
  await page.evaluateOnNewDocument(() => {
    // navigator.webdriver — the canonical bot signal
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Remove the automation flag from the prototype chain too
    delete navigator.__proto__.webdriver;

    // Realistic languages, hardware concurrency, deviceMemory
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // Plugins — browsers normally have a non-empty plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
        ];
        arr.item = (i) => arr[i];
        arr.namedItem = (name) => arr.find((p) => p.name === name);
        return arr;
      }
    });

    // Permissions API — bots often have weird permission states.
    // CRITICAL: must preserve `this` binding when delegating to the original
    // method, otherwise we get "Illegal invocation" errors that crash the host page.
    const permissions = window.navigator.permissions;
    const originalQuery = permissions?.query;
    if (originalQuery) {
      permissions.query = function (parameters) {
        if (parameters?.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(permissions, parameters);
      };
    }

    // window.chrome — must exist with runtime + loadTimes + csi for parity with real Chrome
    if (!window.chrome) {
      window.chrome = {};
    }
    window.chrome.runtime = window.chrome.runtime || {};
    window.chrome.loadTimes = window.chrome.loadTimes || function () { return {}; };
    window.chrome.csi = window.chrome.csi || function () { return {}; };

    // WebGL vendor/renderer — pretend to be a real GPU
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameter.call(this, parameter);
    };
  });

  // When forceGoogleSignIn is set, sign in BEFORE loading Meet so Google
  // recognises the bot as an authenticated org member on first page load.
  // This prevents the hard denial that happens when cloud IPs hit Meet as anonymous guests.
  if (config.forceGoogleSignIn) {
    if (!config.googleEmail || !config.googlePassword) {
      throw new Error('forceGoogleSignIn is enabled but GOOGLE_EMAIL/GOOGLE_PASSWORD are not configured.');
    }
    console.log(`forceGoogleSignIn: signing in as ${config.googleEmail} before loading Meet...`);
    await maybeSignIn(page, config, emitStatus);
    console.log('Sign-in complete. Loading Meet URL...');
  }

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
  // When signed in, Meet shows the pre-join screen without a name field (uses account name).
  const joinMode = (canGuestJoin && !config.forceGoogleSignIn) ? 'guest' : 'google-signin';
  console.log(`Join mode selected: ${joinMode}`);
  if (joinMode === 'guest') {
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
  } else if (!config.forceGoogleSignIn) {
    // No guest name UI and no forceGoogleSignIn — check if the profile is already
    // signed in (seeded via `npm run seed-profile`). If the page shows a pre-join
    // screen with a Join button (but no name field), we're signed in already.
    const alreadySignedIn = await page.evaluate(() => {
      const body = (document.body?.innerText || '').toLowerCase();
      // Meet shows "Ready to join?" or a join button without a name field when signed in.
      return body.includes('ready to join') || body.includes('join now') ||
        Boolean(document.querySelector('div[jsname="Qx7uuf"]')); // pre-join container
    }).catch(() => false);

    if (alreadySignedIn) {
      console.log('Profile already signed in — proceeding as authenticated user.');
    } else if (config.googleEmail && config.googlePassword) {
      console.log(`Signing in as ${config.googleEmail}...`);
      await maybeSignIn(page, config, emitStatus);
      await page.goto(config.meetUrl, { waitUntil: 'networkidle2' });
      await sleep(3000);
      await dismissPreJoinMediaPromptWithStatus();
      await dismissPreJoinMediaPromptWithStatus();
      console.log('Join diagnostics (post-signin):', await collectJoinDiagnostics(page));
    } else {
      // No credentials, no guest UI, not signed in — nothing we can do.
      console.log('Join diagnostics (no-auth-path):', await collectJoinDiagnostics(page));
      throw new Error('Cannot join: no guest UI, not signed in, and no credentials configured. Run `npm run seed-profile` to sign in the bot account.');
    }
  } else {
    console.log('Already signed in (forceGoogleSignIn path) — proceeding to join.');
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
      let nullCountStreak = 0; // consecutive ticks where countNonBotParticipants returned null

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

        // Strategy A: explicit "alone" signals in the Meet DOM.
        const isAloneByDom = await page.evaluate(() => {
          const body = (document.body?.innerText || '').toLowerCase();
          const aloneMarkers = [
            "no one else is in this meeting",  // confirmed from screenshot
            "no one else is here",
            "you're the only one here",
            "you are the only one here",
            "waiting for others to join",
            "invite people to join you",
            "no one else is in the meeting",
            "no one else in this call",
          ];
          return aloneMarkers.some((m) => body.includes(m));
        }).catch(() => false);

        // Strategy B: participant count via DOM selectors.
        const humanCount = await countNonBotParticipants(page, config.guestName).catch(() => null);

        // Treat as zero participants if DOM explicitly says we're alone,
        // OR if count is 0, OR if count has been null (undetectable) for
        // a sustained streak (selector mismatch on Meet UI update).
        const nullStreakThreshold = Math.ceil(emptyGraceSec / 2) + 3; // ~grace period worth of nulls (2s poll)
        if (humanCount === null) {
          nullCountStreak++;
        } else {
          nullCountStreak = 0;
        }
        const effectivelyEmpty = isAloneByDom
          || humanCount === 0
          || nullCountStreak >= nullStreakThreshold;

        if (effectivelyEmpty) {
          if (!emptyStartedAt) {
            const reason = isAloneByDom ? 'alone DOM signal' : humanCount === 0 ? 'count=0' : `null for ${nullCountStreak} ticks`;
            // DOM "alone" banner is reliable enough to use a shorter grace period (10s)
            // since it only appears when everyone else has truly left.
            const effectiveGraceSec = isAloneByDom ? Math.min(emptyGraceSec, 10) : emptyGraceSec;
            const effectiveGraceMs = effectiveGraceSec * 1000;
            emptyStartedAt = Date.now() - (emptyGraceMs - effectiveGraceMs); // fast-track if DOM signal
            console.log(`No human participants detected (${reason}); grace period starts (${effectiveGraceSec}s).`);
            if (onStatus) onStatus('empty_meeting_grace', { graceSec: effectiveGraceSec, reason });
          } else {
            const elapsed = Math.floor((Date.now() - emptyStartedAt) / 1000);
            const remaining = emptyGraceSec - elapsed;
            if (elapsed % 15 === 0) console.log(`Still no humans; leaving in ${remaining}s.`);
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
          nullCountStreak = 0;
        }

        // Poll every 2s to catch transient "No one else is in this meeting" banners
        // that appear briefly and then disappear from the DOM.
        await sleep(2000);
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
