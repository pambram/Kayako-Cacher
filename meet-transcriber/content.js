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
          </div>
          <div class="output-content" id="transcript-output">
            <p class="placeholder">Start recording to see transcript...</p>
          </div>
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
    
    // Reset batch count
    this.controlPanel.querySelector('#batch-count').textContent = '0';
    
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
    
    entries.forEach(entry => {
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

