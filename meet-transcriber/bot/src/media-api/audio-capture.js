/**
 * AudioCaptureLoop handles real-time audio from WebRTC tracks.
 *
 * Transcription strategy (in order of quality):
 *   1. Deepgram streaming API — lowest latency, real-time captions
 *   2. OpenAI Whisper API — batch transcription every N seconds
 *   3. None — audio received but not transcribed (captions are empty)
 *
 * The transcribed text is injected into the video capture loop's caption
 * buffer, so it flows into the existing analyzeBatch() pipeline unchanged.
 */

const BUFFER_FLUSH_MS = 10000; // flush audio buffer for transcription every 10s

export class AudioCaptureLoop {
  constructor({ onCaption, transcriptionMode, openaiApiKey, deepgramApiKey }) {
    this.onCaption = onCaption;          // called with each transcribed line
    this.transcriptionMode = transcriptionMode || 'none';
    this.openaiApiKey = openaiApiKey;
    this.deepgramApiKey = deepgramApiKey;

    this._audioBuffers = [];             // raw PCM/opus chunks
    this._running = false;
    this._flushTimer = null;
    this._deepgramSocket = null;
    this._audioTracks = [];
  }

  /**
   * Receives a base64-encoded WAV chunk captured inside the browser via ScriptProcessorNode.
   * Used in Media API mode. The WAV is decoded to a Buffer and fed into the
   * same transcription pipeline (Whisper / Deepgram) as the werift path.
   */
  addBrowserAudioChunk(base64wav) {
    if (!this._running || !base64wav) return;
    const buf = Buffer.from(base64wav, 'base64');
    this._audioBuffers.push(buf);
  }

  /**
   * Register an audio track from the WebRTC session.
   * werift RTPTrack fires onReceiveRtp with raw Opus packets.
   */
  addAudioTrack(track, trackIndex) {
    this._audioTracks.push({ track, trackIndex });
    // werift MediaStreamTrack exposes onReceiveRtp as a werift Event with .subscribe()
    if (track?.onReceiveRtp?.subscribe) {
      track.onReceiveRtp.subscribe((rtp) => {
        if (this._running && rtp?.payload) {
          this._audioBuffers.push(Buffer.isBuffer(rtp.payload) ? rtp.payload : Buffer.from(rtp.payload));
        }
      });
      console.log(`[audioCapture] Subscribed to audio RTP on track ${trackIndex}`);
    }
    console.log(`[audioCapture] Registered audio track ${trackIndex}`);
  }

  async start() {
    this._running = true;
    if (this.transcriptionMode === 'deepgram' && this.deepgramApiKey) {
      await this._startDeepgramStream();
    } else if (this.transcriptionMode === 'whisper' && this.openaiApiKey) {
      this._flushTimer = setInterval(() => this._flushToWhisper(), BUFFER_FLUSH_MS);
    } else {
      console.log('[audioCapture] No transcription configured — audio received but not transcribed');
    }
    console.log(`[audioCapture] Audio capture started (mode: ${this.transcriptionMode})`);
  }

  async stop() {
    this._running = false;
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._deepgramSocket) {
      try { this._deepgramSocket.finish(); } catch (_e) {}
      this._deepgramSocket = null;
    }
    console.log('[audioCapture] Audio capture stopped');
  }

  // ── Deepgram real-time streaming ──────────────────────────────────────────

  async _startDeepgramStream() {
    try {
      const { createClient } = await import('@deepgram/sdk');
      const dg = createClient(this.deepgramApiKey);
      const connection = dg.listen.live({
        model: 'nova-2',
        language: 'en-US',
        encoding: 'opus',
        sample_rate: 48000,
        channels: 2,
        smart_format: true,
        interim_results: false
      });

      connection.on('transcriptReceived', (data) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          console.log(`[audioCapture] Deepgram: "${transcript}"`);
          if (this.onCaption) this.onCaption(transcript.trim());
        }
      });

      connection.on('error', (err) => {
        console.warn('[audioCapture] Deepgram error:', err?.message || err);
      });

      // Pipe buffered audio to Deepgram
      setInterval(() => {
        if (!this._running || this._audioBuffers.length === 0) return;
        const chunks = this._audioBuffers.splice(0, this._audioBuffers.length);
        const combined = Buffer.concat(chunks);
        if (connection.getReadyState() === 1) {
          connection.send(combined);
        }
      }, 250);

      this._deepgramSocket = connection;
      console.log('[audioCapture] Deepgram streaming started');
    } catch (err) {
      console.warn('[audioCapture] Failed to start Deepgram:', err.message);
    }
  }

  // ── OpenAI Whisper batch transcription ────────────────────────────────────

  async _flushToWhisper() {
    if (this._audioBuffers.length === 0) return;
    const chunks = this._audioBuffers.splice(0, this._audioBuffers.length);
    const audioData = Buffer.concat(chunks);
    if (audioData.length < 1000) return; // skip tiny clips

    try {
      const FormData = (await import('form-data')).default;
      const { default: fetch } = await import('node-fetch');

      const form = new FormData();
      form.append('file', audioData, { filename: 'audio.opus', contentType: 'audio/ogg; codecs=opus' });
      form.append('model', 'whisper-1');
      form.append('language', 'en');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.openaiApiKey}`, ...form.getHeaders() },
        body: form
      });

      if (!res.ok) {
        console.warn('[audioCapture] Whisper error:', res.status, await res.text());
        return;
      }

      const data = await res.json();
      const transcript = data.text?.trim();
      if (transcript) {
        console.log(`[audioCapture] Whisper: "${transcript.slice(0, 80)}..."`);
        if (this.onCaption) this.onCaption(transcript);
      }
    } catch (err) {
      console.warn('[audioCapture] Whisper transcription failed:', err.message);
    }
  }
}
