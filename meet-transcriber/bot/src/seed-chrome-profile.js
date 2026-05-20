/**
 * seed-chrome-profile.js
 *
 * One-time manual setup: opens Chrome with the bot's persistent profile in
 * a visible (non-headless) window so you can sign in to a Google account manually.
 * When you close the window, the signed-in session cookies are saved to the
 * profile directory and will be used by all future bot runs.
 *
 * Usage:
 *   npm run seed-profile
 *
 * Steps:
 *   1. A Chrome window opens at accounts.google.com
 *   2. Sign in to the dedicated bot Google account (e.g. witnessai.bot@gmail.com)
 *   3. Complete any setup steps Google shows (skip 2FA setup, skip recovery, etc.)
 *   4. Navigate to meet.google.com to confirm you're signed in
 *   5. Close the Chrome window — the session is now saved
 *
 * After seeding, the bot will join meetings as this account.
 * Add it to Google Calendar invites for direct-admit (no "Ask to join" needed).
 */
import 'dotenv/config';
import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'node:path';
import { loadConfig } from './config.js';

const config = loadConfig({}, { requireMeetUrl: false, requireSecrets: false });
const userDataDir = config.userDataDir || path.join(config.outputDir, 'chrome-profile');
const chromePath = config.chromePath;

if (!chromePath) {
  console.error('Error: Chrome not found. Set CHROME_BIN in .env');
  process.exit(1);
}

console.log(`
============================================================
  Chrome Profile Seeder
============================================================
  Profile directory: ${userDataDir}
  Chrome:            ${chromePath}

  Steps:
  1. A Chrome window will open at accounts.google.com
  2. Sign in to your dedicated bot Google account
     (e.g. witnessai.bot@gmail.com — NOT your personal account)
  3. Skip any 2FA/recovery setup prompts
  4. Navigate to meet.google.com to confirm sign-in
  5. Close the Chrome window when done

  The signed-in session will be saved automatically.
============================================================
`);

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: false,
  userDataDir,
  ignoreDefaultArgs: ['--enable-automation', '--disable-component-update', '--disable-default-apps'],
  args: [
    '--window-size=1280,900',
    '--disable-blink-features=AutomationControlled',
    '--lang=en-US',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=SyncToSignin,IdentityConsistencyAccountConsistency,Translate',
  ],
  defaultViewport: null,
});

const [page] = await browser.pages();
await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2' });

console.log('Chrome window opened. Sign in manually, then close the window.');
console.log('Waiting for you to close Chrome...');

await new Promise((resolve) => {
  browser.on('disconnected', resolve);
});

console.log('\nChrome closed. Profile saved.');
console.log(`Signed-in session stored at: ${userDataDir}`);
console.log('\nYou can now run the bot — it will join meetings as the signed-in account.');
console.log('Tip: add the bot account to Google Calendar invites for direct admit.');
process.exit(0);
