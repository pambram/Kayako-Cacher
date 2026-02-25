// Google Meet AI Transcriber - Content Script

class MeetTranscriber {
  constructor() {
    this.config = null;
    this.isRecording = false;
    this.isProcessing = false; // Prevent concurrent batch processing
    this.screenshotBuffer = [];
    this.captureInterval = null;
    this.transcriptionHistory = '';
    this.controlPanel = null;
    this.meetTabId = null; // Store the Meet tab ID
    // Meta-analysis tracking
    this.transcriptLog = []; // Store all transcripts with timestamps
    this.batchCounter = 0; // Track number of batches processed
    // Session tracking for auto-save
    this.sessionId = `meet-${Date.now()}`;
    this.meetUrl = window.location.href;
    // TL;DR and Story Arc state
    this.currentTldr = null;
    this.currentStoryArc = null;
    this.init();
  }

  async init() {
    console.log('🎥 Google Meet AI Transcriber initializing on:', window.location.href);
    
    try {
      await this.loadConfig();
      await this.waitForPageReady();
      this.createControlPanel();
      this.setupMessageListeners();
      
      console.log('✅ Meet Transcriber initialized successfully');
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.showNotification('❌ Failed to initialize: ' + error.message, 'error');
    }
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['meetTranscriberConfig']);
      this.config = result.meetTranscriberConfig || {
        provider: 'anthropic',
        enabled: true,
        captureInterval: 10,
        batchSize: 6,
        imageQuality: 0.5,
        imageFormat: 'jpeg'
      };
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = { enabled: false };
    }
  }

  async waitForPageReady() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000); // Wait a bit more for Meet to fully load
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 2000));
      }
    });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'configUpdated') {
        this.config = request.config;
        console.log('📝 Config updated in content script');
      }
    });
  }

  createControlPanel() {
    // Create floating control panel
    const panel = document.createElement('div');
    panel.id = 'meet-transcriber-panel';
    panel.innerHTML = `
      <div class="transcriber-header">
        <span class="transcriber-title">🎥 AI Transcriber</span>
        <button class="transcriber-minimize" title="Minimize">−</button>
      </div>
      <div class="transcriber-body">
        <div class="transcriber-status">
          <span class="status-indicator"></span>
          <span class="status-text">Ready</span>
        </div>
        <div class="transcriber-controls">
          <button class="transcriber-btn start-btn" title="Start Recording">
            <span class="btn-icon">▶</span> Start
          </button>
          <button class="transcriber-btn stop-btn" disabled title="Stop Recording">
            <span class="btn-icon">⏹</span> Stop
          </button>
          <button class="transcriber-btn clear-btn" title="Clear Transcript">
            <span class="btn-icon">🗑</span> Clear
          </button>
        </div>
        <div class="transcriber-stats">
          <div class="stat">
            <span class="stat-label">Screenshots:</span>
            <span class="stat-value" id="screenshot-count">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">Batches:</span>
            <span class="stat-value" id="batch-count">0</span>
          </div>
        </div>
        <div class="transcriber-output">
          <div class="output-header">
            <span>Live Transcript</span>
            <button class="copy-btn" title="Copy transcript">📋</button>
            <button class="download-btn" title="Download transcript">💾</button>
            <button class="upload-s3-btn" title="Upload to S3">☁️</button>
            <button class="import-btn" title="Continue from file">📂</button>
            <button class="tldr-btn" title="Generate TL;DR">📝</button>
            <button class="arc-btn" title="Build Story Arc">📖</button>
            <button class="arc-download-btn" title="Download Story Arc" disabled>📖💾</button>
          </div>
          <div class="output-content" id="transcript-output">
            <p class="placeholder">Start recording to see transcript...</p>
          </div>
          <input type="file" id="import-file-input" accept=".txt" style="display:none" />
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.controlPanel = panel;
    
    // Set up event listeners
    panel.querySelector('.start-btn').addEventListener('click', () => this.startRecording());
    panel.querySelector('.stop-btn').addEventListener('click', () => this.stopRecording());
    panel.querySelector('.clear-btn').addEventListener('click', () => this.clearTranscript());
    panel.querySelector('.copy-btn').addEventListener('click', () => this.copyTranscript());
    panel.querySelector('.download-btn').addEventListener('click', () => this.downloadTranscript());
    panel.querySelector('.upload-s3-btn').addEventListener('click', () => this.uploadToS3());
    panel.querySelector('.import-btn').addEventListener('click', () => this.showImportOptions());
    panel.querySelector('.tldr-btn').addEventListener('click', () => this.generateTldr());
    panel.querySelector('.arc-btn').addEventListener('click', () => this.generateStoryArc());
    panel.querySelector('.arc-download-btn').addEventListener('click', () => this.downloadStoryArc());
    panel.querySelector('#import-file-input').addEventListener('change', (e) => this.importFromFile(e));
    panel.querySelector('.transcriber-minimize').addEventListener('click', () => this.toggleMinimize());
    
    // Make panel draggable
    this.makeDraggable(panel);
  }

  makeDraggable(element) {
    const header = element.querySelector('.transcriber-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('transcriber-minimize')) return;
      isDragging = true;
      initialX = e.clientX - element.offsetLeft;
      initialY = e.clientY - element.offsetTop;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  toggleMinimize() {
    const body = this.controlPanel.querySelector('.transcriber-body');
    const minimizeBtn = this.controlPanel.querySelector('.transcriber-minimize');
    
    if (body.style.display === 'none') {
      body.style.display = 'block';
      minimizeBtn.textContent = '−';
    } else {
      body.style.display = 'none';
      minimizeBtn.textContent = '+';
    }
  }

  async startRecording() {
    if (this.isRecording) return;
    
    if (!this.config.anthropicKey && !this.config.openaiKey) {
      this.showNotification('⚠️ Please configure your API key in the extension settings first', 'error');
      return;
    }
    
    this.isRecording = true;
    this.screenshotBuffer = [];
    this.updateStatus('recording', 'Recording...');
    
    // Enable/disable buttons
    this.controlPanel.querySelector('.start-btn').disabled = true;
    this.controlPanel.querySelector('.stop-btn').disabled = false;
    
    // Start capturing screenshots
    this.captureInterval = setInterval(() => {
      this.captureScreenshot();
    }, this.config.captureInterval * 1000);
    
    // Take first screenshot immediately
    this.captureScreenshot();
    
    this.showNotification('🎥 Recording started', 'success');
    console.log('▶️ Recording started');
  }

  async stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    clearInterval(this.captureInterval);
    this.captureInterval = null;
    
    this.updateStatus('idle', 'Stopped');
    
    // Enable/disable buttons
    this.controlPanel.querySelector('.start-btn').disabled = false;
    this.controlPanel.querySelector('.stop-btn').disabled = true;
    
    // Process any remaining screenshots in buffer
    if (this.screenshotBuffer.length > 0) {
      await this.processScreenshots();
    }
    
    this.showNotification('⏹ Recording stopped', 'info');
    console.log('⏹ Recording stopped');

    // Auto-generate TL;DR if we have batches and none exists yet
    if (this.transcriptLog.length > 0 && !this.currentTldr) {
      await this.generateTldr();
    }
    // Auto-generate Story Arc if we have batches
    if (this.transcriptLog.length > 0) {
      await this.generateStoryArc();
    }
  }

  async captureScreenshot() {
    try {
      // Skip if already processing OR buffer is full
      if (this.isProcessing) {
        console.log('⏭️ Skipping capture - batch processing in progress');
        return;
      }
      
      if (this.screenshotBuffer.length >= this.config.batchSize) {
        console.log('⏭️ Skipping capture - batch is already full');
        return;
      }
      
      // Request screenshot from background script
      // The background script will handle finding the right tab
      const response = await chrome.runtime.sendMessage({
        action: 'captureTab',
        tabId: null // Let background handle tab selection
      });
      
      if (response.success) {
        // Double-check buffer size again (race condition protection)
        if (this.screenshotBuffer.length >= this.config.batchSize) {
          console.log('⏭️ Buffer filled while capturing - discarding screenshot');
          return;
        }
        
        const screenshot = {
          dataUrl: response.dataUrl,
          timestamp: new Date().toISOString()
        };
        
        this.screenshotBuffer.push(screenshot);
        this.updateScreenshotCount();
        
        console.log(`📸 Screenshot captured (${this.screenshotBuffer.length}/${this.config.batchSize})`);
        
        // Process batch when we reach the batch size (exactly, not >=)
        if (this.screenshotBuffer.length === this.config.batchSize && !this.isProcessing) {
          // Use setImmediate to avoid blocking
          setTimeout(() => this.processScreenshots(), 0);
        }
      } else {
        // Only log error if it's not an expected skip
        if (!response.skipNotification && 
            !response.error.includes('devtools') && 
            !response.error.includes('chrome://') &&
            !response.error.includes('not currently visible')) {
          console.error('Failed to capture screenshot:', response.error);
        }
        // If Meet tab not visible, that's fine - we'll capture next time it is
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }

  async processScreenshots() {
    // Check if already processing or no screenshots
    if (this.isProcessing) {
      console.log('⚠️ Already processing - skipping duplicate call');
      return;
    }
    
    if (this.screenshotBuffer.length === 0) {
      console.log('⚠️ No screenshots to process');
      return;
    }
    
    // Set processing flag FIRST to prevent concurrent processing
    this.isProcessing = true;
    
    try {
      // Grab current buffer and clear it IMMEDIATELY to prevent duplicates
      const screenshots = [...this.screenshotBuffer];
      this.screenshotBuffer = [];
      this.updateScreenshotCount();
      
      this.updateStatus('processing', 'Analyzing...');
      console.log(`🔄 Processing ${screenshots.length} screenshots... (batch #${this.batchCounter + 1})`);
      
      // Send to background for AI analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeScreenshots',
        screenshots: screenshots,
        previousContext: this.transcriptionHistory
      });
      
      if (response.success) {
        // Update transcript display
        this.appendTranscription(response.transcription, screenshots[0].timestamp);
        
        // Update history (keep last 2 batches for context)
        this.transcriptionHistory = response.transcription;
        
        // Store in transcript log for meta-analysis
        this.transcriptLog.push({
          content: response.transcription,
          timestamp: screenshots[0].timestamp,
          batchNumber: this.batchCounter + 1
        });
        
        this.batchCounter++;
        this.updateBatchCount();
        
        console.log(`✅ Batch #${this.batchCounter} analyzed successfully`);
        
        // Auto-save to Chrome storage after each batch
        await this.autoSaveTranscript();
        
        // Check if we should generate meta-summary
        if (this.config.enableMetaAnalysis && 
            this.batchCounter % this.config.metaAnalysisInterval === 0 &&
            this.transcriptLog.length > 0) {
          console.log(`📊 Triggering meta-summary (every ${this.config.metaAnalysisInterval} batches, batch #${this.batchCounter})`);
          await this.generateMetaSummary();
        }
        
        this.updateStatus(this.isRecording ? 'recording' : 'idle', 
                         this.isRecording ? 'Recording...' : 'Ready');
      } else {
        this.showNotification('❌ Analysis failed: ' + response.error, 'error');
        console.error('Analysis failed:', response.error);
        this.updateStatus('error', 'Error: ' + response.error);
      }
    } catch (error) {
      console.error('Error processing screenshots:', error);
      this.showNotification('❌ Error processing screenshots', 'error');
      this.updateStatus('error', 'Error');
    } finally {
      // Always clear processing flag
      this.isProcessing = false;
    }
  }

  appendTranscription(text, timestamp) {
    const output = this.controlPanel.querySelector('#transcript-output');
    const placeholder = output.querySelector('.placeholder');
    
    if (placeholder) {
      placeholder.remove();
    }
    
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    
    const time = new Date(timestamp).toLocaleTimeString();
    entry.innerHTML = `
      <div class="entry-timestamp">${time}</div>
      <div class="entry-content">${this.formatMarkdown(text)}</div>
    `;
    
    output.appendChild(entry);
    
    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;
  }

  formatMarkdown(text) {
    // Simple markdown formatting
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  updateStatus(status, text) {
    const indicator = this.controlPanel.querySelector('.status-indicator');
    const statusText = this.controlPanel.querySelector('.status-text');
    
    indicator.className = 'status-indicator';
    indicator.classList.add('status-' + status);
    statusText.textContent = text;
  }

  updateScreenshotCount() {
    const count = this.controlPanel.querySelector('#screenshot-count');
    count.textContent = this.screenshotBuffer.length;
  }

  updateBatchCount() {
    const count = this.controlPanel.querySelector('#batch-count');
    const current = parseInt(count.textContent) || 0;
    count.textContent = current + 1;
  }

  async generateMetaSummary() {
    try {
      console.log('📊 Generating meta-summary...');
      
      // Get transcripts from the last N minutes
      const timeWindowMs = this.config.metaAnalysisWindow * 60 * 1000;
      const now = Date.now();
      
      const recentTranscripts = this.transcriptLog.filter(t => {
        const tTime = new Date(t.timestamp).getTime();
        return (now - tTime) <= timeWindowMs;
      });
      
      if (recentTranscripts.length === 0) {
        console.log('No recent transcripts to summarize');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateMetaSummary',
        transcripts: recentTranscripts,
        timeWindow: this.config.metaAnalysisWindow
      });
      
      if (response.success) {
        this.appendMetaSummary(response.summary);
        console.log('✅ Meta-summary generated');
      } else {
        console.error('Meta-summary failed:', response.error);
      }
    } catch (error) {
      console.error('Error generating meta-summary:', error);
    }
  }

  appendMetaSummary(summary) {
    const output = this.controlPanel.querySelector('#transcript-output');
    const placeholder = output.querySelector('.placeholder');
    
    if (placeholder) {
      placeholder.remove();
    }
    
    const entry = document.createElement('div');
    entry.className = 'transcript-entry meta-summary';
    
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
      <div class="entry-timestamp meta-timestamp">📊 Summary Generated: ${time}</div>
      <div class="entry-content meta-content">${this.formatMarkdown(summary)}</div>
    `;
    
    output.appendChild(entry);
    
    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;
  }

  clearTranscript() {
    const output = this.controlPanel.querySelector('#transcript-output');
    output.innerHTML = '<p class="placeholder">Start recording to see transcript...</p>';
    this.transcriptionHistory = '';
    this.transcriptLog = [];
    this.batchCounter = 0;
    this.currentTldr = null;
    this.currentStoryArc = null;
    
    // Reset batch count and button states
    this.controlPanel.querySelector('#batch-count').textContent = '0';
    this.controlPanel.querySelector('.tldr-btn').disabled = false;
    this.controlPanel.querySelector('.arc-download-btn').disabled = true;
    
    this.showNotification('🗑 Transcript cleared', 'info');
  }

  copyTranscript() {
    const output = this.controlPanel.querySelector('#transcript-output');
    const entries = output.querySelectorAll('.transcript-entry');
    
    let text = '';
    entries.forEach(entry => {
      const time = entry.querySelector('.entry-timestamp').textContent;
      const content = entry.querySelector('.entry-content').textContent;
      text += `[${time}]\n${content}\n\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification('📋 Transcript copied to clipboard', 'success');
    }).catch(error => {
      this.showNotification('❌ Failed to copy transcript', 'error');
      console.error('Copy failed:', error);
    });
  }

  downloadTranscript() {
    const output = this.controlPanel.querySelector('#transcript-output');
    const entries = output.querySelectorAll('.transcript-entry');
    
    let text = 'Google Meet AI Transcription\n';
    text += '============================\n\n';
    text += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (this.currentTldr) {
      text += '=== TL;DR ===\n';
      text += this.currentTldr + '\n\n';
      text += '=== Transcript ===\n\n';
    }
    
    entries.forEach(entry => {
      if (entry.classList.contains('tldr-entry')) return;
      const time = entry.querySelector('.entry-timestamp').textContent;
      const content = entry.querySelector('.entry-content').textContent;
      text += `[${time}]\n${content}\n\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showNotification('💾 Transcript downloaded', 'success');
  }

  /** Auto-save transcript to Chrome storage after each batch */
  async autoSaveTranscript() {
    try {
      const output = this.controlPanel.querySelector('#transcript-output');
      const entries = output.querySelectorAll('.transcript-entry');
      
      if (entries.length === 0) return;
      
      // Build transcript text
      let text = '';
      entries.forEach(entry => {
        const time = entry.querySelector('.entry-timestamp').textContent;
        const content = entry.querySelector('.entry-content').textContent;
        text += `[${time}]\n${content}\n\n`;
      });
      
      // Get existing saved transcripts
      const result = await chrome.storage.local.get(['meetTranscriptSessions']);
      const sessions = result.meetTranscriptSessions || {};
      
      // Save/update current session
      sessions[this.sessionId] = {
        url: this.meetUrl,
        startTime: sessions[this.sessionId]?.startTime || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        batchCount: this.batchCounter,
        transcript: text,
        batches: this.transcriptLog,
        tldr: this.currentTldr || null,
        storyArc: this.currentStoryArc || null
      };
      
      // Keep only last 10 sessions to avoid storage bloat
      const sessionIds = Object.keys(sessions).sort((a, b) => {
        return new Date(sessions[b].lastUpdated) - new Date(sessions[a].lastUpdated);
      });
      if (sessionIds.length > 10) {
        sessionIds.slice(10).forEach(id => delete sessions[id]);
      }
      
      await chrome.storage.local.set({ meetTranscriptSessions: sessions });
      console.log(`💾 Auto-saved transcript (batch #${this.batchCounter})`);
    } catch (error) {
      console.error('Error auto-saving transcript:', error);
    }
  }

  /** Upload transcript to S3 and get presigned URL */
  async uploadToS3() {
    const output = this.controlPanel.querySelector('#transcript-output');
    const entries = output.querySelectorAll('.transcript-entry');
    
    if (entries.length === 0) {
      this.showNotification('⚠️ No transcript to upload', 'error');
      return;
    }
    
    // Build transcript text
    let text = 'Google Meet AI Transcription\n============================\n\n';
    text += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    entries.forEach(entry => {
      const time = entry.querySelector('.entry-timestamp').textContent;
      const content = entry.querySelector('.entry-content').textContent;
      text += `[${time}]\n${content}\n\n`;
    });
    
    this.showNotification('☁️ Uploading to S3...', 'info');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'uploadToS3',
        transcript: text,
        meetUrl: this.meetUrl
      });
      
      if (response.success) {
        // Copy presigned URL to clipboard
        await navigator.clipboard.writeText(response.url);
        this.showNotification('✅ Uploaded! Presigned URL copied to clipboard (7 days valid)', 'success');
        console.log('☁️ S3 Upload successful:', response.key);
        console.log('📎 Presigned URL:', response.url);
      } else {
        this.showNotification('❌ Upload failed: ' + response.error, 'error');
        console.error('S3 upload failed:', response.error);
      }
    } catch (error) {
      this.showNotification('❌ Upload error: ' + error.message, 'error');
      console.error('S3 upload error:', error);
    }
  }

  /** Show import options - from file or from saved session */
  async showImportOptions() {
    // Check for saved sessions first
    const result = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = result.meetTranscriptSessions || {};
    const sessionList = Object.entries(sessions).sort((a, b) => 
      new Date(b[1].lastUpdated) - new Date(a[1].lastUpdated)
    );
    
    // Create a simple modal/dropdown for options
    const existingModal = document.getElementById('import-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.className = 'import-modal';
    modal.innerHTML = `
      <div class="import-modal-content">
        <div class="import-modal-header">
          <span>📂 Continue Transcript</span>
          <button class="import-modal-close">×</button>
        </div>
        <div class="import-modal-body">
          <button class="import-option import-from-file">
            <span class="import-icon">📄</span>
            <span>Import from .txt file</span>
          </button>
          ${sessionList.length > 0 ? `
            <div class="import-divider">Or continue from saved session:</div>
            <div class="saved-sessions-list">
              ${sessionList.slice(0, 5).map(([id, session]) => `
                <button class="import-option import-session" data-session-id="${id}">
                  <span class="import-icon">💾</span>
                  <div class="session-info">
                    <span class="session-time">${new Date(session.lastUpdated).toLocaleString()}</span>
                    <span class="session-details">${session.batchCount || 0} batches • ${session.url?.split('/').pop() || 'Unknown'}</span>
                  </div>
                </button>
              `).join('')}
            </div>
          ` : '<div class="no-sessions">No saved sessions found</div>'}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.import-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.import-from-file').addEventListener('click', () => {
      modal.remove();
      this.controlPanel.querySelector('#import-file-input').click();
    });
    modal.querySelectorAll('.import-session').forEach(btn => {
      btn.addEventListener('click', () => {
        const sessionId = btn.dataset.sessionId;
        this.importFromSession(sessionId, sessions[sessionId]);
        modal.remove();
      });
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /** Import transcript from a saved session */
  async importFromSession(sessionId, session) {
    if (!session?.transcript) {
      this.showNotification('⚠️ Session has no transcript data', 'error');
      return;
    }
    
    // Parse the transcript and load it
    this.loadTranscriptText(session.transcript, `session ${sessionId}`);
    this.batchCounter = session.batchCount || 0;
    this.controlPanel.querySelector('#batch-count').textContent = this.batchCounter;
    
    this.showNotification(`✅ Loaded ${this.batchCounter} batches from saved session`, 'success');
  }

  /** Import transcript from a text file */
  importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.loadTranscriptText(text, file.name);
      this.showNotification(`✅ Imported transcript from ${file.name}`, 'success');
    };
    reader.onerror = () => {
      this.showNotification('❌ Failed to read file', 'error');
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  }

  /** Load transcript text into the panel */
  loadTranscriptText(text, source) {
    const output = this.controlPanel.querySelector('#transcript-output');
    
    // Clear placeholder if present
    const placeholder = output.querySelector('.placeholder');
    if (placeholder) placeholder.remove();
    
    // Parse the text - look for [timestamp] patterns
    const entries = [];
    const lines = text.split('\n');
    let currentEntry = null;
    let batchCount = 0;
    
    for (const line of lines) {
      const timestampMatch = line.match(/^\[([^\]]+)\]$/);
      if (timestampMatch) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = { timestamp: timestampMatch[1], content: '' };
        batchCount++;
      } else if (currentEntry && line.trim()) {
        currentEntry.content += (currentEntry.content ? '\n' : '') + line;
      }
    }
    if (currentEntry && currentEntry.content) {
      entries.push(currentEntry);
    }
    
    // If no structured entries found, just add the whole text as one entry
    if (entries.length === 0 && text.trim()) {
      entries.push({
        timestamp: 'Imported',
        content: text.trim()
      });
      batchCount = 1;
    }
    
    // Add entries to the panel
    entries.forEach(entry => {
      const entryDiv = document.createElement('div');
      entryDiv.className = 'transcript-entry imported-entry';
      entryDiv.innerHTML = `
        <div class="entry-timestamp">${entry.timestamp}</div>
        <div class="entry-content">${entry.content}</div>
      `;
      output.appendChild(entryDiv);
      
      // Also add to transcriptLog for meta-analysis
      this.transcriptLog.push({
        timestamp: Date.now(),
        content: entry.content
      });
    });
    
    // Update batch counter
    this.batchCounter = Math.max(this.batchCounter, batchCount);
    this.controlPanel.querySelector('#batch-count').textContent = this.batchCounter;
    
    // Scroll to bottom
    output.scrollTop = output.scrollHeight;
    
    console.log(`📂 Imported ${entries.length} entries from ${source}`);
  }

  /** Generate TL;DR from full transcript (only if one doesn't exist yet) */
  async generateTldr() {
    if (this.currentTldr) {
      this.showNotification('📝 TL;DR already exists for this session', 'info');
      return;
    }

    if (this.transcriptLog.length === 0) {
      this.showNotification('⚠️ No transcript batches to summarize', 'error');
      return;
    }

    const tldrBtn = this.controlPanel.querySelector('.tldr-btn');
    tldrBtn.disabled = true;
    this.updateStatus('processing', 'Generating TL;DR...');

    try {
      const fullTranscript = this.transcriptLog
        .map((t, i) => `--- Batch ${i + 1} (${new Date(t.timestamp).toLocaleTimeString()}) ---\n${t.content}`)
        .join('\n\n');

      // Dispatch to background (fire-and-forget, writes result to storage)
      await chrome.runtime.sendMessage({
        action: 'generateTldr',
        sessionId: this.sessionId,
        fullTranscript
      });

      // Poll for completion
      const tldr = await this.pollForSessionField('tldr');
      if (tldr) {
        this.currentTldr = tldr;
        this.prependTldr(tldr);
        await this.autoSaveTranscript();
        this.showNotification('📝 TL;DR generated', 'success');
        console.log('✅ TL;DR generated');
      } else {
        tldrBtn.disabled = false;
        this.showNotification('❌ TL;DR generation failed or timed out', 'error');
      }
    } catch (error) {
      tldrBtn.disabled = false;
      this.showNotification('❌ TL;DR error: ' + error.message, 'error');
      console.error('TL;DR error:', error);
    } finally {
      this.updateStatus(this.isRecording ? 'recording' : 'idle',
                       this.isRecording ? 'Recording...' : 'Ready');
    }
  }

  /** Prepend TL;DR as a styled entry at the top of transcript output */
  prependTldr(tldr) {
    const output = this.controlPanel.querySelector('#transcript-output');
    const placeholder = output.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const entry = document.createElement('div');
    entry.className = 'transcript-entry tldr-entry';
    entry.innerHTML = `
      <div class="entry-timestamp tldr-timestamp">📝 TL;DR</div>
      <div class="entry-content tldr-content">${this.formatMarkdown(tldr)}</div>
    `;
    output.insertBefore(entry, output.firstChild);
  }

  /** Build story arc by progressive batch replay */
  async generateStoryArc() {
    if (this.transcriptLog.length === 0) {
      this.showNotification('⚠️ No transcript batches to build arc from', 'error');
      return;
    }

    const arcBtn = this.controlPanel.querySelector('.arc-btn');
    arcBtn.disabled = true;
    this.updateStatus('processing', 'Building Story Arc...');

    try {
      const batches = this.transcriptLog.map(t => ({
        timestamp: t.timestamp,
        content: t.content
      }));

      console.log(`📖 Building story arc from ${batches.length} batches...`);

      await chrome.runtime.sendMessage({
        action: 'generateStoryArc',
        sessionId: this.sessionId,
        batches
      });

      // Poll for completion
      const storyArc = await this.pollForSessionField('storyArc');
      if (storyArc) {
        this.currentStoryArc = storyArc;
        this.controlPanel.querySelector('.arc-download-btn').disabled = false;
        await this.autoSaveTranscript();
        this.showNotification('📖 Story Arc built — click 📖💾 to download', 'success');
        console.log('✅ Story arc generated');
      } else {
        this.showNotification('❌ Story Arc failed or timed out', 'error');
      }
    } catch (error) {
      this.showNotification('❌ Story Arc error: ' + error.message, 'error');
      console.error('Story arc error:', error);
    } finally {
      arcBtn.disabled = false;
      this.updateStatus(this.isRecording ? 'recording' : 'idle',
                       this.isRecording ? 'Recording...' : 'Ready');
    }
  }

  /** Poll chrome.storage until a session field appears (set by background task) */
  async pollForSessionField(field, timeoutMs = 300000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await chrome.storage.local.get(['meetTranscriptSessions']);
      const sessions = result.meetTranscriptSessions || {};
      const session = sessions[this.sessionId];
      if (session?.[field]) return session[field];
      // Check if task errored out
      const taskResult = await chrome.storage.local.get(['meetTranscriberTasks']);
      const tasks = taskResult.meetTranscriberTasks || {};
      const taskKey = this.sessionId + ':' + (field === 'tldr' ? 'tldr' : 'arc');
      if (tasks[taskKey]?.status === 'error') return null;
      if (!tasks[taskKey]) return session?.[field] || null;
    }
    return null;
  }

  /** Download the story arc as a separate text file */
  downloadStoryArc() {
    if (!this.currentStoryArc) {
      this.showNotification('⚠️ No story arc to download — build one first', 'error');
      return;
    }

    let text = 'Google Meet - Story Arc\n';
    text += '=======================\n\n';
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Meet URL: ${this.meetUrl}\n\n`;
    text += this.currentStoryArc;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-story-arc-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification('📖 Story Arc downloaded', 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `meet-notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MeetTranscriber();
  });
} else {
  new MeetTranscriber();
}

