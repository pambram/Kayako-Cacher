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
  const toggleIfOnByLabel = async (keywords, offMarkers) => {
    return page.evaluate((needles, offStates) => {
      const nodes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const node of nodes) {
        const text = (node.textContent || '').toLowerCase();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        const combined = `${text} ${aria}`;
        if (!needles.some((needle) => combined.includes(needle))) continue;
        if (offStates.some((marker) => combined.includes(marker))) {
          return false;
        }
        const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        node.click();
        return true;
      }
      return false;
    }, keywords, offMarkers);
  };

  try {
    // Prefer explicit pre-join controls when available.
    const micClicked = await toggleIfOnByLabel([
      'turn off microphone',
      'mute microphone',
      'microphone'
    ], [
      'turn on microphone',
      'microphone off',
      'unmute'
    ]);
    await sleep(500);
    const camClicked = await toggleIfOnByLabel([
      'turn off camera',
      'camera is on',
      'camera'
    ], [
      'turn on camera',
      'camera off'
    ]);
    if (micClicked || camClicked) {
      console.log('Pre-join AV controls clicked:', { micClicked, camClicked });
      return;
    }

    // Fallback keyboard shortcuts if controls are not detected.
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyD');
    await page.keyboard.up('Meta');
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyD');
    await page.keyboard.up('Control');
    await sleep(300);
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Meta');
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Control');
  } catch (error) {
    console.warn('Warning: could not toggle mic/cam via keyboard', error.message);
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
    await sleep(intervalMs);
  }

  return { av: lastAv, captionsOn: lastCaptionsOn, attempts: maxAttempts };
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

async function waitForMeetingAdmission(page, waitSec) {
  const timeoutAt = Date.now() + waitSec * 1000;
  while (Date.now() < timeoutAt) {
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

async function waitForJoinButtonEnabled(page, waitSec) {
  const timeoutAt = Date.now() + waitSec * 1000;
  while (Date.now() < timeoutAt) {
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

export async function startMeetSession(config) {
  const puppeteer = addExtra(puppeteerCore);
  if (config.enableStealth) {
    puppeteer.use(StealthPlugin());
  }

  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: config.headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ],
    defaultViewport: { width: 1440, height: 900 }
  });

  const [page] = await browser.pages();
  await page.bringToFront();

  await page.goto(config.meetUrl, { waitUntil: 'networkidle2' });
  await sleep(3000);

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
    const joinEnabled = await waitForJoinButtonEnabled(page, 20);
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
    console.log('Join diagnostics (post-signin):', await collectJoinDiagnostics(page));
  }

  await ensureMicCameraOff(page);
  console.log('Join diagnostics (pre-click):', await collectJoinDiagnostics(page));
  const clickedJoin = await joinMeet(page);
  if (!clickedJoin) {
    console.log('Join diagnostics (click-missed):', await collectJoinDiagnostics(page));
    throw new Error('Could not find Ask to join / Join now button.');
  }
  await waitForMeetingAdmission(page, config.joinWaitSec);
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
    async waitForEnd() {
      while (true) {
        const ended = await detectMeetingEnded(page);
        if (ended) return 'meeting-ended';
        if (Date.now() - startedAt > timeoutMs) return 'timeout';
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
