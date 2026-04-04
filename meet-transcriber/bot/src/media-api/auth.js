import { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';

const SCOPES = [
  'https://www.googleapis.com/auth/meetings.conference.media.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly'
];

let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Load OAuth2 credentials from the downloaded client secret JSON file.
 * Supports both "web" and "installed" application types.
 */
async function loadOAuthCredentials(credentialsPath) {
  const raw = await fs.readFile(credentialsPath, 'utf8');
  const json = JSON.parse(raw);
  const creds = json.web || json.installed;
  if (!creds) throw new Error(`Invalid credentials file: expected "web" or "installed" key in ${credentialsPath}`);
  return creds;
}

/**
 * Get a valid access token for the Meet Media API.
 * Caches the token until 5 minutes before expiry.
 *
 * For production use, this requires either:
 * 1. A refresh token stored in config (obtained via one-time browser consent flow)
 * 2. Service account impersonation
 *
 * The credentials file is a Web OAuth client (not a service account), so we need
 * a refresh token from a one-time user consent flow.
 */
export async function getMediaApiAccessToken(config) {
  const now = Date.now();
  // Return cached token if still valid (with 5-minute buffer)
  if (_cachedToken && _tokenExpiry > now + 5 * 60 * 1000) {
    return _cachedToken;
  }

  const credentialsPath = config.mediaApiCredentialsPath;
  if (!credentialsPath) {
    throw new Error('mediaApiCredentialsPath not configured. Set MEDIA_API_CREDENTIALS_PATH in .env');
  }

  const creds = await loadOAuthCredentials(credentialsPath);
  const oauth2Client = new OAuth2Client(creds.client_id, creds.client_secret, creds.redirect_uris?.[0]);

  const refreshToken = config.mediaApiRefreshToken;
  if (!refreshToken) {
    throw new Error(
      'mediaApiRefreshToken not configured. Run the one-time OAuth consent flow to obtain a refresh token. ' +
      'Set MEDIA_API_REFRESH_TOKEN in .env.'
    );
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();
  _cachedToken = credentials.access_token;
  _tokenExpiry = credentials.expiry_date || (now + 3600 * 1000);

  console.log('[mediaApi:auth] Access token refreshed, expires at', new Date(_tokenExpiry).toISOString());
  return _cachedToken;
}

const LOCALHOST_REDIRECT = 'http://localhost:9876/oauth2callback';

/**
 * One-time OAuth consent flow using a local HTTP server to capture the callback.
 * This works with Web OAuth clients (which don't support the oob redirect).
 *
 * IMPORTANT: Before running, add http://localhost:9876/oauth2callback to
 * Authorized Redirect URIs in the Google Cloud Console for this OAuth client.
 * Console: APIs & Services > Credentials > Edit OAuth client > Authorized redirect URIs
 */
export async function runOAuthFlow(credentialsPath) {
  const { createServer } = await import('node:http');
  const { URL } = await import('node:url');

  const creds = await loadOAuthCredentials(credentialsPath);
  const oauth2Client = new OAuth2Client(creds.client_id, creds.client_secret, LOCALHOST_REDIRECT);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('\n=== Google Meet Media API OAuth Setup ===');
  console.log('\nSTEP 1 — Add the redirect URI to Google Cloud Console:');
  console.log('  https://console.cloud.google.com/apis/credentials');
  console.log('  Edit your OAuth client → Authorized redirect URIs → Add:');
  console.log(`  ${LOCALHOST_REDIRECT}\n`);
  console.log('STEP 2 — Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('Waiting for OAuth callback on http://localhost:9876 ...\n');

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:9876');
        const code = url.searchParams.get('code');
        if (!code) {
          res.end('No code found in callback. Try again.');
          return;
        }
        res.end('<h2>Authorization successful! You can close this tab.</h2>');
        server.close();

        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens.refresh_token) {
          throw new Error(
            'No refresh token returned. The account may have already authorized this app.\n' +
            'Revoke access at https://myaccount.google.com/permissions and try again.'
          );
        }
        console.log('\n=== Refresh Token Obtained ===');
        console.log('Add this to your .env file:');
        console.log(`MEDIA_API_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        resolve(tokens.refresh_token);
      } catch (err) {
        res.end(`Error: ${err.message}`);
        server.close();
        reject(err);
      }
    });
    server.listen(9876, () => {
      console.log('Local OAuth callback server listening on http://localhost:9876');
    });
    server.on('error', reject);
  });
}

// Keep backward-compat alias
export const generateOAuthRefreshToken = runOAuthFlow;
export async function exchangeCodeForRefreshToken() {
  throw new Error('Use runOAuthFlow() instead — the local callback server handles code exchange automatically.');
}
