#!/usr/bin/env node
/**
 * One-time setup script to obtain a refresh token for the Meet Media API.
 *
 * Prerequisites:
 *   1. Add http://localhost:9876/oauth2callback to Authorized Redirect URIs:
 *      https://console.cloud.google.com/apis/credentials
 *      → Edit your OAuth 2.0 client → Authorized redirect URIs → Add the URL above
 *
 *   2. Copy the credentials file path to MEDIA_API_CREDENTIALS_PATH in .env
 *
 * Usage:
 *   node src/media-api/setup-oauth.js
 *
 * The script will:
 *   - Print the Google authorization URL
 *   - Start a local server on port 9876
 *   - Wait for you to authorize in your browser
 *   - Print the MEDIA_API_REFRESH_TOKEN to add to .env
 */
import 'dotenv/config';
import path from 'node:path';
import { runOAuthFlow } from './auth.js';

const credentialsPath = process.env.MEDIA_API_CREDENTIALS_PATH ||
  path.resolve(process.cwd(), 'media-api-credentials.json');

runOAuthFlow(credentialsPath)
  .then(() => {
    console.log('Setup complete. Add the MEDIA_API_REFRESH_TOKEN shown above to your .env file.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('OAuth setup failed:', err.message);
    process.exit(1);
  });
