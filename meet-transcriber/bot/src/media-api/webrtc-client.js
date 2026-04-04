/**
 * Meet Media API WebRTC client.
 *
 * Aligned with official Google TypeScript reference:
 *   https://github.com/googleworkspace/meet-media-api-samples
 *
 * 1. RTCPeerConnection runs inside Puppeteer for browser-native SDP.
 * 2. connectActiveConference via raw HTTP (not gRPC).
 * 3. Two-phase SDP: audio + data channels → setLocalDescription → video → createOffer again.
 * 4. After STATE_JOINED on session-control data channel, sends a video-assignment
 *    layout request so Meet actually routes video frames to our transceivers.
 * 5. Video frames captured via canvas.toDataURL → exposeFunction → Node.
 * 6. Audio captured via ScriptProcessorNode → WAV → exposeFunction → Node.
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

// ── connectActiveConference via raw HTTP ─────────────────────────────────────

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

export class MediaApiSession {
  constructor({ onVideoFrame, onAudioChunk, onParticipants, onSessionState, onDisconnect }) {
    this.onVideoFrame = onVideoFrame;
    this.onAudioChunk = onAudioChunk;
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
        '--autoplay-policy=no-user-gesture-required',
        '--window-size=640,480'
      ]
    });

    const [page] = await this._browser.pages();
    this._page = page;
    await page.goto('about:blank');

    // Expose Node callbacks to the browser context
    await page.exposeFunction('__onVideoFrame', (base64jpeg) => {
      if (this.onVideoFrame) this.onVideoFrame(base64jpeg);
    });
    await page.exposeFunction('__onAudioChunk', (base64wav) => {
      if (this.onAudioChunk) this.onAudioChunk(base64wav);
    });
    await page.exposeFunction('__onLog', (msg) => {
      console.log(`[mediaApi:browser] ${msg}`);
    });
    await page.exposeFunction('__onConnectionState', (state) => {
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
    await page.exposeFunction('__onMeetSessionState', (stateStr) => {
      console.log(`[mediaApi] Meet session state: ${stateStr}`);
      if (this.onSessionState) this.onSessionState(stateStr);
      if (stateStr === 'STATE_DISCONNECTED' && !this._disconnected) {
        this._disconnected = true;
        if (this.onDisconnect) this.onDisconnect(stateStr);
      }
    });
    await page.exposeFunction('__onParticipants', (jsonStr) => {
      try { if (this.onParticipants) this.onParticipants(JSON.parse(jsonStr)); } catch (_e) {}
    });

    const numVideoStreams = Math.max(0, Math.min(3, config.mediaApiVideoStreams || 1));
    const captureIntervalMs = (config.captureIntervalSec || 5) * 1000;

    // ── Build SDP + wire up everything inside the browser ──────────────
    console.log('[mediaApi] Setting up RTCPeerConnection in browser...');
    const sdpOffer = await page.evaluate(async (numVideo, capIntervalMs) => {

      const pc = new RTCPeerConnection({
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'max-bundle',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      let trackCount = 0;
      let videoTrackCount = 0;
      let audioTrackCount = 0;

      // ── 1. ontrack — set up BEFORE setRemoteDescription ───────────
      pc.ontrack = (e) => {
        trackCount++;
        const track = e.track;
        const stream = (e.streams && e.streams[0]) || new MediaStream([track]);
        window.__onLog(`ontrack fired: kind=${track.kind} id=${track.id} label=${track.label} (track #${trackCount})`);

        if (track.kind === 'video') {
          videoTrackCount++;
          const video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          document.body.appendChild(video);
          video.srcObject = stream;

          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d');

          const captureId = setInterval(() => {
            try {
              if (video.readyState >= 2 && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const b64 = dataUrl.split(',')[1];
                if (b64 && b64.length > 100) {
                  window.__onVideoFrame(b64);
                }
              }
            } catch (_e) {}
          }, capIntervalMs);

          // Stop capturing when track ends
          track.onended = () => {
            clearInterval(captureId);
            window.__onLog(`Video track ${track.id} ended`);
          };

        } else if (track.kind === 'audio') {
          audioTrackCount++;
          try {
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            const FLUSH_SAMPLES = 16000 * 10; // 10s at 16kHz
            let pcmAccum = [];

            processor.onaudioprocess = (ev) => {
              const input = ev.inputBuffer.getChannelData(0);
              for (let i = 0; i < input.length; i++) pcmAccum.push(input[i]);

              if (pcmAccum.length >= FLUSH_SAMPLES) {
                const samples = pcmAccum.splice(0, FLUSH_SAMPLES);
                // Build WAV header
                const wavBuf = new ArrayBuffer(44 + samples.length * 2);
                const dv = new DataView(wavBuf);
                const ws = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
                ws(0, 'RIFF');
                dv.setUint32(4, 36 + samples.length * 2, true);
                ws(8, 'WAVE'); ws(12, 'fmt ');
                dv.setUint32(16, 16, true);
                dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
                dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true);
                dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
                ws(36, 'data');
                dv.setUint32(40, samples.length * 2, true);
                for (let i = 0; i < samples.length; i++) {
                  const s = Math.max(-1, Math.min(1, samples[i]));
                  dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                }
                const bytes = new Uint8Array(wavBuf);
                let binary = '';
                const CHUNK = 8192;
                for (let i = 0; i < bytes.length; i += CHUNK) {
                  binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
                }
                window.__onAudioChunk(btoa(binary));
                window.__onLog(`Audio chunk flushed: ${samples.length} samples`);
              }
            };
            source.connect(processor);
            processor.connect(audioCtx.destination);
          } catch (err) {
            window.__onLog(`Audio capture error: ${err.message}`);
          }
        }
      };

      // ── 2. Connection state → Node ─────────────────────────────────
      pc.onconnectionstatechange = () => {
        window.__onConnectionState(pc.connectionState);
      };

      // ── 3. Phase 1 — audio transceivers + data channels ────────────
      for (let i = 0; i < 3; i++) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      const dcConfig = { ordered: true };

      // Session-control data channel
      const sessionControlDC = pc.createDataChannel('session-control', dcConfig);
      sessionControlDC.onopen = () => window.__onLog('DC session-control opened');
      sessionControlDC.onclose = () => window.__onLog('DC session-control closed');
      sessionControlDC.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          window.__onLog(`DC session-control msg: ${ev.data.slice(0, 200)}`);
          if (msg?.resources?.[0]?.sessionStatus?.connectionState) {
            const cs = msg.resources[0].sessionStatus.connectionState;
            window.__onMeetSessionState(cs);
            // After STATE_JOINED, request video assignment layout
            if (cs === 'STATE_JOINED' && window.__videoAssignmentDC && numVideo > 0) {
              window.__onLog('STATE_JOINED — sending video assignment request');
              const canvases = [];
              for (let i = 0; i < numVideo; i++) {
                canvases.push({
                  id: i + 1,
                  dimensions: { width: 1280, height: 720 },
                  relevant: {}
                });
              }
              const request = {
                requestId: 1,
                setAssignment: {
                  layoutModel: {
                    label: Date.now().toString(),
                    canvases
                  },
                  maxVideoResolution: { width: 1920, height: 1080, frameRate: 30 }
                }
              };
              try {
                window.__videoAssignmentDC.send(JSON.stringify({ request }));
                window.__onLog('Video assignment request sent');
              } catch (sendErr) {
                window.__onLog(`Video assignment send error: ${sendErr.message}`);
              }
            }
          }
        } catch (_e) {}
      };

      // Media-stats data channel — MUST upload stats periodically or Meet disconnects
      // with REASON_PROTOCOL_VIOLATION
      const mediaStatsDC = pc.createDataChannel('media-stats', dcConfig);
      const statsAllowlist = new Map();
      let statsRequestId = 1;
      let statsIntervalId = 0;
      const STATS_TYPE_MAP = {
        'codec': 'codec', 'candidate-pair': 'candidate_pair',
        'media-playout': 'media_playout', 'transport': 'transport',
        'local-candidate': 'local_candidate', 'remote-candidate': 'remote_candidate',
        'inbound-rtp': 'inbound_rtp'
      };
      const camelToUnderscore = (s) => s.replace(/([A-Z])/g, '_$1').toLowerCase();

      const sendMediaStats = async () => {
        try {
          const stats = await pc.getStats();
          const sections = [];
          stats.forEach((report) => {
            if (statsAllowlist.has(report.type)) {
              const allowedKeys = statsAllowlist.get(report.type);
              const filtered = {};
              for (const [key, val] of Object.entries(report)) {
                if (key !== 'id' && allowedKeys.includes(key)) {
                  filtered[camelToUnderscore(key)] = val;
                }
              }
              const typeKey = STATS_TYPE_MAP[report.type] || report.type;
              sections.push({ id: report.id, [typeKey]: filtered });
            }
          });
          if (sections.length > 0 && mediaStatsDC.readyState === 'open') {
            const req = { request: { requestId: statsRequestId++, uploadMediaStats: { sections } } };
            mediaStatsDC.send(JSON.stringify(req));
          }
        } catch (err) {
          window.__onLog(`Stats upload error: ${err.message}`);
        }
      };

      mediaStatsDC.onopen = () => window.__onLog('DC media-stats opened');
      mediaStatsDC.onclose = () => { clearInterval(statsIntervalId); statsIntervalId = 0; };
      mediaStatsDC.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.resources?.[0]?.configuration) {
            const cfg = data.resources[0].configuration;
            // Parse allowlist: { "inbound-rtp": { "keys": ["id","bytesReceived",...] }, ... }
            if (cfg.allowlist) {
              for (const [type, val] of Object.entries(cfg.allowlist)) {
                statsAllowlist.set(type, val.keys || []);
              }
            }
            // Start periodic upload at the requested interval
            if (cfg.uploadIntervalSeconds && cfg.uploadIntervalSeconds > 0) {
              if (statsIntervalId) clearInterval(statsIntervalId);
              statsIntervalId = setInterval(sendMediaStats, cfg.uploadIntervalSeconds * 1000);
              window.__onLog(`Media stats: uploading every ${cfg.uploadIntervalSeconds}s (${statsAllowlist.size} stat types)`);
            }
          }
        } catch (_e) {}
      };

      // Conditional channels for video
      if (numVideo > 0) {
        const videoAssignmentDC = pc.createDataChannel('video-assignment', dcConfig);
        window.__videoAssignmentDC = videoAssignmentDC;
        videoAssignmentDC.onopen = () => window.__onLog('DC video-assignment opened');
        videoAssignmentDC.onclose = () => window.__onLog('DC video-assignment closed');
        videoAssignmentDC.onmessage = (ev) => {
          window.__onLog(`DC video-assignment msg: ${ev.data.slice(0, 300)}`);
        };

        const mediaEntriesDC = pc.createDataChannel('media-entries', dcConfig);
        mediaEntriesDC.onopen = () => window.__onLog('DC media-entries opened');
        mediaEntriesDC.onmessage = (ev) => {
          window.__onLog(`DC media-entries msg: ${ev.data.slice(0, 300)}`);
        };

        const participantsDC = pc.createDataChannel('participants', dcConfig);
        participantsDC.onopen = () => window.__onLog('DC participants opened');
        participantsDC.onmessage = (ev) => {
          window.__onLog(`DC participants msg: ${ev.data.slice(0, 300)}`);
          window.__onParticipants(ev.data);
        };
      }

      // Phase 1 SDP
      const offer1 = await pc.createOffer();
      await pc.setLocalDescription(offer1);

      // ── 4. Phase 2 — video transceivers ────────────────────────────
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
    }, numVideoStreams, captureIntervalMs);

    const hasCandidates = sdpOffer.includes('a=candidate');
    console.log(`[mediaApi] SDP offer ready. Has candidates: ${hasCandidates}. Length: ${sdpOffer.length}`);

    // Send to Meet API
    const sdpAnswer = await connectActiveConference(meetingCode, sdpOffer, accessToken);
    console.log('[mediaApi] Received SDP answer');

    // Apply the answer (triggers ICE + track delivery)
    await page.evaluate(async (answer) => {
      await window.__meetPc.setRemoteDescription({ type: 'answer', sdp: answer });
      window.__onLog('Remote description applied');
    }, sdpAnswer);

    console.log('[mediaApi] Remote description applied, waiting for tracks...');
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
