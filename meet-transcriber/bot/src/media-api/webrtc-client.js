/**
 * Meet Media API WebRTC client.
 *
 * Key design decisions (aligned with official Google TypeScript sample):
 *
 * 1. connectActiveConference via raw HTTP fetch() — NOT the gRPC library.
 * 2. RTCPeerConnection runs inside a headless Puppeteer page for
 *    browser-native, standards-compliant SDP generation.
 * 3. Two-phase SDP creation: audio + data channels (phase 1), then video
 *    (phase 2) — preserves the required m-line order: audio, application, video.
 * 4. Video frames captured in-browser via canvas.toDataURL() and forwarded
 *    to Node via page.exposeFunction().
 * 5. Audio captured in-browser via ScriptProcessorNode + WAV encoding,
 *    forwarded to Node via page.exposeFunction().
 */

import { OAuth2Client } from 'google-auth-library';
import fsSync from 'node:fs';
import fsPromises from 'node:fs/promises';
import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const MEET_API_BASE = 'https://meet.googleapis.com/v2beta';

// ── OAuth2 helpers ──────────────────────────────────────────────────────────

async function getAccessToken(config) {
  const credPath = config.mediaApiCredentialsPath;
  if (!credPath) throw new Error('MEDIA_API_CREDENTIALS_PATH not set');
  const raw = JSON.parse(await fsPromises.readFile(credPath, 'utf8'));
  const creds = raw.web || raw.installed;
  if (!creds) throw new Error('Invalid credentials file');
  const oauth2 = new OAuth2Client(
    creds.client_id,
    creds.client_secret,
    'http://localhost:3030/api/media-api/callback'
  );
  const refreshToken = config.mediaApiRefreshToken;
  if (!refreshToken) throw new Error('MEDIA_API_REFRESH_TOKEN not set — connect your Google account in Configuration');
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  return credentials.access_token;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function extractMeetingCode(meetUrl) {
  const match = String(meetUrl).match(/\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
  if (!match) throw new Error(`Could not extract meeting code from URL: ${meetUrl}`);
  return match[1].toLowerCase();
}

function detectChrome() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  return candidates.find(c => fsSync.existsSync(c)) || '';
}

// ── connectActiveConference via raw HTTP (matches official reference) ───────

async function connectActiveConference(meetingCode, sdpOffer, accessToken) {
  const spaceName = `spaces/${meetingCode}`;
  const url = `${MEET_API_BASE}/${spaceName}:connectActiveConference`;
  console.log(`[mediaApi] POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ offer: sdpOffer })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = body;
    try { detail = JSON.stringify(JSON.parse(body), null, 2); } catch (_e) {}
    throw new Error(`connectActiveConference HTTP ${response.status}: ${detail}`);
  }

  const payload = await response.json();
  if (!payload.answer) throw new Error('No SDP answer in connectActiveConference response');
  return payload.answer;
}

// ── Main session class ───────────────────────────────────────────────────────

/**
 * MediaApiSession — browser-native RTCPeerConnection for SDP generation,
 * raw HTTP for the Meet API call, and Puppeteer exposeFunction to bridge
 * video frames + audio chunks back to Node.
 */
export class MediaApiSession {
  constructor({ onVideoFrame, onAudioChunk, onParticipants, onSessionState, onDisconnect }) {
    this.onVideoFrame = onVideoFrame;       // (base64jpeg: string) => void
    this.onAudioChunk = onAudioChunk;       // (base64wav: string) => void
    this.onParticipants = onParticipants;
    this.onSessionState = onSessionState;
    this.onDisconnect = onDisconnect;

    this._browser = null;
    this._page = null;
    this._disconnected = false;
    this.connected = false;
  }

  async connect(meetUrl, config) {
    const meetingCode = extractMeetingCode(meetUrl);
    console.log(`[mediaApi] Connecting to meeting code: ${meetingCode}`);

    const accessToken = await getAccessToken(config);
    console.log('[mediaApi] Access token obtained');

    const chromePath = config.chromePath || detectChrome();
    if (!chromePath) throw new Error('Chrome not found for Media API WebRTC. Set CHROME_BIN.');

    const puppeteer = addExtra(puppeteerCore);
    puppeteer.use(StealthPlugin());
    this._browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        ...(process.platform !== 'darwin' ? ['--no-sandbox'] : []),
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--mute-audio',
        '--autoplay-policy=no-user-gesture-required', // needed for AudioContext without user gesture
        '--window-size=640,480'
      ]
    });

    const [page] = await this._browser.pages();
    this._page = page;
    await page.goto('about:blank');

    // Expose Node callbacks BEFORE any page.evaluate that uses them
    await page.exposeFunction('__mediaApiOnVideoFrame', (base64jpeg) => {
      if (this.onVideoFrame) this.onVideoFrame(base64jpeg);
    });
    await page.exposeFunction('__mediaApiOnAudioChunk', (base64wav) => {
      if (this.onAudioChunk) this.onAudioChunk(base64wav);
    });
    await page.exposeFunction('__mediaApiOnSessionState', (state) => {
      console.log(`[mediaApi] Connection state: ${state}`);
      if (state === 'connected') {
        console.log('[mediaApi] WebRTC session established with Meet Media API');
        this.connected = true;
      }
      if (this.onSessionState) this.onSessionState(state);
      if ((state === 'disconnected' || state === 'failed' || state === 'closed') && !this._disconnected) {
        this._disconnected = true;
        if (this.onDisconnect) this.onDisconnect(state);
      }
    });
    await page.exposeFunction('__mediaApiOnMeetState', (jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (this.onParticipants) this.onParticipants(parsed);
        const connState = parsed?.sessionStatus?.connectionState;
        if (connState) {
          console.log(`[mediaApi] Meet session state: ${connState}`);
          if (this.onSessionState) this.onSessionState(connState);
          if (connState === 'STATE_DISCONNECTED' && !this._disconnected) {
            this._disconnected = true;
            if (this.onDisconnect) this.onDisconnect(connState);
          }
        }
      } catch (_e) {}
    });

    const numVideoStreams = Math.max(0, Math.min(3, config.mediaApiVideoStreams || 1));
    const captureIntervalMs = (config.captureIntervalSec || 5) * 1000;

    // Phase 1 + Phase 2 SDP offer generation inside the browser
    console.log('[mediaApi] Setting up RTCPeerConnection in browser...');
    const sdpOffer = await page.evaluate(async (numVideo) => {
      const pc = new RTCPeerConnection({
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'max-bundle',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Phase 1 — audio transceivers + data channels
      for (let i = 0; i < 3; i++) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      const dcOpts = { ordered: true };
      pc.createDataChannel('session-control', dcOpts);
      pc.createDataChannel('media-stats', dcOpts);
      if (numVideo > 0) {
        pc.createDataChannel('video-assignment', dcOpts);
        pc.createDataChannel('media-entries', dcOpts);
        pc.createDataChannel('participants', dcOpts);
      }
      const offer1 = await pc.createOffer();
      await pc.setLocalDescription(offer1);

      // Phase 2 — video transceivers
      for (let i = 0; i < numVideo; i++) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
      const offer2 = await pc.createOffer();
      await pc.setLocalDescription(offer2);

      // Wait for ICE gathering
      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') resolve();
        });
        setTimeout(resolve, 10000);
      });

      window.__meetPc = pc;
      return pc.localDescription?.sdp || offer2.sdp;
    }, numVideoStreams);

    const hasCandidates = sdpOffer.includes('a=candidate');
    console.log(`[mediaApi] SDP offer ready. Has candidates: ${hasCandidates}. Length: ${sdpOffer.length}`);

    // Send to Meet API via raw HTTP
    const sdpAnswer = await connectActiveConference(meetingCode, sdpOffer, accessToken);
    console.log('[mediaApi] Received SDP answer');

    // Apply answer and set up track handlers (video canvas capture + audio ScriptProcessor)
    await page.evaluate(async (answer, capIntervalMs) => {
      const pc = window.__meetPc;

      // Connection state → exposed function
      pc.addEventListener('connectionstatechange', () => {
        window.__mediaApiOnSessionState(pc.connectionState);
      });

      // Data channel messages (session-control, participants)
      pc.addEventListener('datachannel', (e) => {
        if (e.channel.label === 'session-control' || e.channel.label === 'participants') {
          e.channel.addEventListener('message', (msg) => {
            window.__mediaApiOnMeetState(msg.data);
          });
        }
      });

      // Track handler — set up BEFORE setRemoteDescription so we don't miss tracks
      pc.addEventListener('track', (e) => {
        const track = e.track;
        const stream = (e.streams && e.streams[0]) || new MediaStream([track]);

        if (track.kind === 'video') {
          // Draw track to canvas, capture JPEG, forward to Node
          const video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.width = 1280;
          video.height = 720;
          document.body.appendChild(video);
          video.srcObject = stream;

          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d');
          document.body.appendChild(canvas);

          setInterval(() => {
            try {
              if (video.readyState >= 2 && video.videoWidth > 0) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const base64 = dataUrl.split(',')[1];
                if (base64) window.__mediaApiOnVideoFrame(base64);
              }
            } catch (_e) {}
          }, capIntervalMs);

        } else if (track.kind === 'audio') {
          // Capture PCM via ScriptProcessorNode, encode as WAV, forward to Node
          try {
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const source = audioCtx.createMediaStreamSource(stream);
            // bufferSize, inputChannels, outputChannels
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);

            const FLUSH_SAMPLES = 16000 * 10; // 10 seconds at 16kHz
            let pcmAccum = [];

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              for (let i = 0; i < inputData.length; i++) pcmAccum.push(inputData[i]);

              if (pcmAccum.length >= FLUSH_SAMPLES) {
                const samples = pcmAccum.splice(0, FLUSH_SAMPLES);
                // Build WAV in browser
                const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
                const view = new DataView(wavBuffer);
                const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
                writeStr(0, 'RIFF');
                view.setUint32(4, 36 + samples.length * 2, true);
                writeStr(8, 'WAVE');
                writeStr(12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);    // PCM
                view.setUint16(22, 1, true);    // mono
                view.setUint32(24, 16000, true); // sample rate
                view.setUint32(28, 32000, true); // byte rate
                view.setUint16(32, 2, true);    // block align
                view.setUint16(34, 16, true);   // bits per sample
                writeStr(36, 'data');
                view.setUint32(40, samples.length * 2, true);
                for (let i = 0; i < samples.length; i++) {
                  const s = Math.max(-1, Math.min(1, samples[i]));
                  view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                }
                // Base64-encode in chunks to avoid stack overflow on large arrays
                const bytes = new Uint8Array(wavBuffer);
                let binary = '';
                const CHUNK = 8192;
                for (let i = 0; i < bytes.length; i += CHUNK) {
                  binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
                }
                window.__mediaApiOnAudioChunk(btoa(binary));
              }
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);
          } catch (audioErr) {
            console.log('[mediaApi] Audio capture setup failed:', audioErr.message);
          }
        }
      });

      // Apply the SDP answer (triggers ICE connectivity and track delivery)
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    }, sdpAnswer, captureIntervalMs);

    console.log('[mediaApi] Track handlers registered, remote description applied');
    return this;
  }

  disconnect() {
    this._disconnected = true;
    if (this._page) {
      this._page.evaluate(() => {
        if (window.__meetPc) window.__meetPc.close();
      }).catch(() => {});
    }
    if (this._browser) {
      this._browser.close().catch(() => {});
      this._browser = null;
    }
    console.log('[mediaApi] Disconnected');
  }
}
