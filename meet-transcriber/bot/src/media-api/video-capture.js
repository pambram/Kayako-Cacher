import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';

/**
 * VideoCaptureLoop — periodic frame capture from WebRTC video tracks.
 *
 * How screenshots work in Media API mode:
 *   1. Google sends VP8/VP9/AV1 encoded RTP packets via the WebRTC connection.
 *   2. werift delivers each packet as a raw Buffer via track.onReceiveRtp.subscribe().
 *   3. We accumulate RTP payloads into a buffer for each video track.
 *   4. Every captureIntervalSec, we pipe the accumulated VP8/VP9 stream through
 *      ffmpeg to extract one JPEG frame.
 *   5. The JPEG is base64-encoded and fed into the existing analyzeBatch() pipeline
 *      unchanged — same as the Puppeteer screenshot path.
 *
 * This gives us real captured frames from the meeting, not browser screenshots.
 * Quality and fidelity depend on the video stream Google sends (usually the
 * presenter's screen share or the active speaker's video).
 */
export class VideoCaptureLoop {
  constructor({ captureIntervalSec, screenshotQuality, batchSize, onBatch, onTick }) {
    this.captureIntervalSec = captureIntervalSec || 10;
    this.screenshotQuality = screenshotQuality || 70;
    this.batchSize = batchSize || 6;
    this.onBatch = onBatch;
    this.onTick = onTick;

    this._running = false;
    this._screenshots = [];
    this._captions = [];
    this._windowStartedAt = new Date();
    this._intervalHandle = null;

    // Per-track RTP packet buffers (raw VP8/VP9 payloads for ffmpeg decode)
    this._rtpPacketsByTrack = new Map();
    this._hasVideoData = false;
  }

  addVideoTrack(track, trackIndex) {
    this._rtpPacketsByTrack.set(trackIndex, []);
    // werift MediaStreamTrack has onReceiveRtp as a werift Event with .subscribe()
    if (track?.onReceiveRtp?.subscribe) {
      track.onReceiveRtp.subscribe((rtp) => {
        if (!this._running) return;
        const buf = Buffer.isBuffer(rtp.payload) ? rtp.payload : Buffer.from(rtp.payload);
        const packets = this._rtpPacketsByTrack.get(trackIndex) || [];
        packets.push(buf);
        // Keep a rolling 2-second buffer (discard oldest to prevent unbounded growth)
        if (packets.length > 600) packets.splice(0, packets.length - 600);
        this._rtpPacketsByTrack.set(trackIndex, packets);
        this._hasVideoData = true;
      });
      console.log(`[videoCapture] Subscribed to video RTP on track ${trackIndex}`);
    }
    console.log(`[videoCapture] Registered video track ${trackIndex}`);
  }

  /**
   * Receives a JPEG frame (base64) captured inside the browser via canvas.toDataURL().
   * Used in Media API mode as an alternative to RTP-based ffmpeg decoding.
   */
  addBrowserFrame(base64jpeg) {
    if (!this._running || !base64jpeg) return;
    this._screenshots.push(base64jpeg);
    if (this.onTick) {
      this.onTick({ timestamp: new Date().toISOString(), screenshotCount: this._screenshots.length, consecutiveScreenshotFailures: 0 });
    }
    if (this._screenshots.length >= this.batchSize) {
      this._flush().catch(err => console.warn('[videoCapture] Browser frame flush error:', err.message));
    }
  }

  addCaption(line) {
    if (line && line.trim()) this._captions.push(line.trim());
  }

  start() {
    this._running = true;
    this._windowStartedAt = new Date();
    this._intervalHandle = setInterval(() => this._tick(), this.captureIntervalSec * 1000);
    console.log(`[videoCapture] Started (interval: ${this.captureIntervalSec}s, batch: ${this.batchSize})`);
  }

  async stop() {
    this._running = false;
    clearInterval(this._intervalHandle);
    this._intervalHandle = null;
    if (this._screenshots.length > 0 && this.onBatch) await this._flush();
    console.log('[videoCapture] Stopped');
  }

  async _tick() {
    if (!this._running) return;
    const frame = await this._captureFrame();
    if (frame) this._screenshots.push(frame);

    // Only emit tick when there are screenshots accumulating (avoid log spam
    // in Media API mode where frames arrive via addBrowserFrame, not _captureFrame)
    if (this.onTick && this._screenshots.length > 0) {
      this.onTick({ timestamp: new Date().toISOString(), screenshotCount: this._screenshots.length, consecutiveScreenshotFailures: 0 });
    }
    if (this._screenshots.length >= this.batchSize) await this._flush();
  }

  async _flush() {
    const endedAt = new Date();
    const screenshots = this._screenshots.splice(0);
    const captions = [...new Set(this._captions.splice(0))].join('\n');
    const startedAt = this._windowStartedAt;
    this._windowStartedAt = endedAt;
    if (this.onBatch) {
      await this.onBatch({ screenshots, captions, startedAtIso: startedAt.toISOString(), endedAtIso: endedAt.toISOString() });
    }
  }

  /**
   * Extract one JPEG frame from the accumulated RTP payload buffer using ffmpeg.
   *
   * The accumulated VP8/VP9 RTP payloads are fed to ffmpeg as a raw stream.
   * ffmpeg decodes the video and outputs a single JPEG frame as base64.
   *
   * If ffmpeg is not available or there's insufficient video data, returns null.
   */
  async _captureFrame() {
    if (!this._hasVideoData) return null;

    // Take all accumulated packets from the primary video track
    const primaryTrack = [...this._rtpPacketsByTrack.keys()].sort()[0];
    if (primaryTrack === undefined) return null;

    const packets = this._rtpPacketsByTrack.get(primaryTrack) || [];
    if (packets.length === 0) return null;

    const payload = Buffer.concat(packets.splice(0));

    try {
      const jpeg = await this._decodeFrameViaFfmpeg(payload);
      return jpeg ? jpeg.toString('base64') : null;
    } catch (err) {
      console.warn('[videoCapture] Frame decode failed:', err.message);
      return null;
    }
  }

  _decodeFrameViaFfmpeg(rawPayload) {
    return new Promise((resolve, reject) => {
      // Feed raw VP8 RTP payloads to ffmpeg; extract one JPEG frame
      const ff = spawn('ffmpeg', [
        '-f', 'rtp', '-i', 'pipe:0',     // input: RTP stream from stdin
        '-frames:v', '1',                  // grab one frame
        '-f', 'mjpeg',                     // output format: JPEG
        '-q:v', String(Math.ceil((100 - this.screenshotQuality) / 10) + 1), // quality 1-10
        'pipe:1'                           // output to stdout
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      const chunks = [];
      ff.stdout.on('data', (c) => chunks.push(c));
      ff.stderr.on('data', () => {}); // suppress ffmpeg log noise

      ff.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          resolve(null); // No frame decoded — not an error, just no usable data yet
        }
      });
      ff.on('error', () => resolve(null)); // ffmpeg not installed — silent no-op

      ff.stdin.write(rawPayload);
      ff.stdin.end();
    });
  }
}
