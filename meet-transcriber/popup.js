// Google Meet AI Transcriber - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadSavedTranscripts();
  setupEventListeners();
});

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    
    if (response.success) {
      const config = response.config;
      
      // Set form values
      document.getElementById('provider').value = config.provider || 'anthropic';
      document.getElementById('openai-key').value = config.openaiKey || '';
      document.getElementById('anthropic-key').value = config.anthropicKey || '';
      document.getElementById('model').value = config.model || 'claude-haiku-4-5';
      document.getElementById('capture-interval').value = config.captureInterval || 10;
      document.getElementById('batch-size').value = config.batchSize || 6;
      document.getElementById('image-quality').value = config.imageQuality || 0.5;
      document.getElementById('technical-mode').checked = config.technicalMode !== false;
      document.getElementById('meta-analysis-enabled').checked = config.enableMetaAnalysis !== false;
      document.getElementById('meta-interval').value = config.metaAnalysisInterval || 5;
      document.getElementById('meta-window').value = config.metaAnalysisWindow || 5;
      document.getElementById('aws-access-key').value = config.awsAccessKeyId || '';
      document.getElementById('aws-secret-key').value = config.awsSecretAccessKey || '';
      
      // Update slider displays
      updateSliderDisplays();
      updateTechnicalModeLabel();
      updateMetaLabel();
      
      // Update model options based on provider
      updateModelOptions(config.provider);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

function setupEventListeners() {
  // Provider change
  document.getElementById('provider').addEventListener('change', (e) => {
    updateModelOptions(e.target.value);
  });
  
  // Sliders
  document.getElementById('capture-interval').addEventListener('input', updateSliderDisplays);
  document.getElementById('batch-size').addEventListener('input', updateSliderDisplays);
  document.getElementById('image-quality').addEventListener('input', updateSliderDisplays);
  
  // Technical mode toggle
  document.getElementById('technical-mode').addEventListener('change', updateTechnicalModeLabel);
  
  // Meta-analysis controls
  document.getElementById('meta-analysis-enabled').addEventListener('change', updateMetaLabel);
  document.getElementById('meta-interval').addEventListener('input', updateSliderDisplays);
  document.getElementById('meta-window').addEventListener('input', updateSliderDisplays);
  
  // Buttons
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('reset-btn').addEventListener('click', resetSettings);
  document.getElementById('show-panel-btn').addEventListener('click', showPanelOnMeet);
  document.getElementById('clear-saved-btn').addEventListener('click', clearSavedTranscripts);
}

function updateSliderDisplays() {
  const interval = document.getElementById('capture-interval').value;
  const batchSize = document.getElementById('batch-size').value;
  const quality = document.getElementById('image-quality').value;
  const metaInterval = document.getElementById('meta-interval').value;
  const metaWindow = document.getElementById('meta-window').value;
  
  document.getElementById('interval-value').textContent = `${interval}s`;
  
  const totalTime = interval * batchSize;
  document.getElementById('batch-value').textContent = `${batchSize} (${totalTime}s)`;
  
  document.getElementById('quality-value').textContent = `${Math.round(quality * 100)}%`;
  
  document.getElementById('meta-interval-value').textContent = `Every ${metaInterval} batches`;
  document.getElementById('meta-window-value').textContent = `${metaWindow} minutes`;
}

function updateTechnicalModeLabel() {
  const isEnabled = document.getElementById('technical-mode').checked;
  const label = document.getElementById('technical-mode-label');
  label.textContent = isEnabled ? 'Enabled (Verbose)' : 'Disabled (Standard)';
}

function updateMetaLabel() {
  const isEnabled = document.getElementById('meta-analysis-enabled').checked;
  const label = document.getElementById('meta-label');
  label.textContent = isEnabled ? 'Enabled' : 'Disabled';
}

function updateModelOptions(provider) {
  const modelSelect = document.getElementById('model');
  const anthropicGroup = document.getElementById('anthropic-models');
  const openaiGroup = document.getElementById('openai-models');
  
  if (provider === 'anthropic') {
    anthropicGroup.style.display = '';
    openaiGroup.style.display = 'none';
    // Set default Anthropic model if current selection is OpenAI
    if (modelSelect.value.startsWith('gpt-')) {
      modelSelect.value = 'claude-4-5-haiku';
    }
  } else {
    anthropicGroup.style.display = 'none';
    openaiGroup.style.display = '';
    // Set default OpenAI model if current selection is Anthropic
    if (modelSelect.value.startsWith('claude-')) {
      modelSelect.value = 'gpt-5-mini';
    }
  }
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Saving...';
  
  try {
    const config = {
      provider: document.getElementById('provider').value,
      openaiKey: document.getElementById('openai-key').value,
      anthropicKey: document.getElementById('anthropic-key').value,
      model: document.getElementById('model').value,
      captureInterval: parseInt(document.getElementById('capture-interval').value),
      batchSize: parseInt(document.getElementById('batch-size').value),
      imageQuality: parseFloat(document.getElementById('image-quality').value),
      imageFormat: 'jpeg',
      enabled: true,
      technicalMode: document.getElementById('technical-mode').checked,
      maxTokens: 4000,
      enableMetaAnalysis: document.getElementById('meta-analysis-enabled').checked,
      metaAnalysisInterval: parseInt(document.getElementById('meta-interval').value),
      metaAnalysisWindow: parseInt(document.getElementById('meta-window').value),
      awsAccessKeyId: document.getElementById('aws-access-key').value,
      awsSecretAccessKey: document.getElementById('aws-secret-key').value,
      awsRegion: 'us-east-1',
      s3Bucket: 'meet-transcriber-uploads-899084202472'
    };
    
    // Validate that at least one API key is provided
    if (!config.openaiKey && !config.anthropicKey) {
      showStatus('Please provide at least one API key', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
      return;
    }
    
    // Validate that the correct API key is provided for the selected provider
    if (config.provider === 'openai' && !config.openaiKey) {
      showStatus('OpenAI API key is required when using OpenAI provider', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
      return;
    }
    
    if (config.provider === 'anthropic' && !config.anthropicKey) {
      showStatus('Anthropic API key is required when using Anthropic provider', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: config
    });
    
    if (response.success) {
      showStatus('✅ Settings saved successfully!', 'success');
      saveBtn.textContent = '✅ Saved!';
      setTimeout(() => {
        saveBtn.textContent = '💾 Save Settings';
      }, 2000);
    } else {
      throw new Error(response.error || 'Failed to save settings');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('❌ Failed to save: ' + error.message, 'error');
    saveBtn.textContent = '💾 Save Settings';
  } finally {
    saveBtn.disabled = false;
  }
}

async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return;
  }
  
  try {
    const defaultConfig = {
      provider: 'anthropic',
      openaiKey: '',
      anthropicKey: '',
      model: 'claude-4-5-haiku',
      enabled: true,
      captureInterval: 10,
      batchSize: 6,
      imageQuality: 0.5,
      imageFormat: 'jpeg'
    };
    
    const response = await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: defaultConfig
    });
    
    if (response.success) {
      await loadSettings();
      showStatus('✅ Settings reset to defaults', 'success');
    } else {
      throw new Error(response.error || 'Failed to reset settings');
    }
  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('❌ Failed to reset: ' + error.message, 'error');
  }
}

async function showPanelOnMeet() {
  const btn = document.getElementById('show-panel-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Finding Meet tab...';
  
  try {
    // Find the Meet tab
    const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    
    if (tabs.length === 0) {
      showStatus('❌ No Google Meet tab found. Please open a Meet call first.', 'error');
      btn.textContent = '📺 Show Panel on Meet Tab';
      btn.disabled = false;
      return;
    }
    
    const meetTab = tabs[0];
    
    // Inject/reinitialize the content script
    await chrome.scripting.executeScript({
      target: { tabId: meetTab.id },
      files: ['content.js']
    });
    
    // Also inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: meetTab.id },
      files: ['styles.css']
    });
    
    showStatus('✅ Control panel injected! Check your Meet tab.', 'success');
    btn.textContent = '✅ Panel Shown!';
    
    setTimeout(() => {
      btn.textContent = '📺 Show Panel on Meet Tab';
      btn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error showing panel:', error);
    showStatus('❌ Failed to show panel: ' + error.message, 'error');
    btn.textContent = '📺 Show Panel on Meet Tab';
    btn.disabled = false;
  }
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = 'status-message status-' + type;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 5000);
}

/** Load and display saved transcripts from Chrome storage */
async function loadSavedTranscripts() {
  try {
    const result = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = result.meetTranscriptSessions || {};
    const listEl = document.getElementById('saved-transcripts-list');
    
    const sessionIds = Object.keys(sessions).sort((a, b) => {
      return new Date(sessions[b].lastUpdated) - new Date(sessions[a].lastUpdated);
    });
    
    if (sessionIds.length === 0) {
      listEl.innerHTML = '<p class="no-transcripts">No saved transcripts yet</p>';
      return;
    }
    
    listEl.innerHTML = sessionIds.map(id => {
      const session = sessions[id];
      const date = new Date(session.lastUpdated);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const meetCode = session.url.split('/').pop().split('?')[0] || 'unknown';
      
      return `
        <div class="saved-transcript-item" data-session-id="${id}">
          <div class="transcript-info">
            <span class="transcript-date">${dateStr} ${timeStr}</span>
            <span class="transcript-meet">Meet: ${meetCode}</span>
            <span class="transcript-batches">${session.batchCount} batches</span>
          </div>
          <div class="transcript-actions">
            <button class="btn-icon download-saved" title="Download">💾</button>
            <button class="btn-icon copy-saved" title="Copy">📋</button>
            <button class="btn-icon delete-saved" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners for buttons
    listEl.querySelectorAll('.download-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.closest('.saved-transcript-item').dataset.sessionId;
        downloadSavedTranscript(sessionId, sessions[sessionId]);
      });
    });
    
    listEl.querySelectorAll('.copy-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.closest('.saved-transcript-item').dataset.sessionId;
        copySavedTranscript(sessions[sessionId]);
      });
    });
    
    listEl.querySelectorAll('.delete-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.closest('.saved-transcript-item').dataset.sessionId;
        deleteSavedTranscript(sessionId);
      });
    });
    
  } catch (error) {
    console.error('Error loading saved transcripts:', error);
  }
}

function downloadSavedTranscript(sessionId, session) {
  const text = `Google Meet AI Transcription\n============================\n\nMeet URL: ${session.url}\nRecorded: ${session.startTime}\nLast Updated: ${session.lastUpdated}\nBatches: ${session.batchCount}\n\n${session.transcript}`;
  
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meet-transcript-${new Date(session.lastUpdated).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('💾 Transcript downloaded', 'success');
}function copySavedTranscript(session) {
  navigator.clipboard.writeText(session.transcript).then(() => {
    showStatus('📋 Transcript copied to clipboard', 'success');
  }).catch(error => {
    showStatus('❌ Failed to copy', 'error');
    console.error('Copy failed:', error);
  });
}

async function deleteSavedTranscript(sessionId) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = result.meetTranscriptSessions || {};
    delete sessions[sessionId];
    await chrome.storage.local.set({ meetTranscriptSessions: sessions });
    await loadSavedTranscripts();
    showStatus('🗑️ Transcript deleted', 'success');
  } catch (error) {
    console.error('Error deleting transcript:', error);
    showStatus('❌ Failed to delete', 'error');
  }
}

async function clearSavedTranscripts() {
  if (!confirm('Are you sure you want to delete all saved transcripts?')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(['meetTranscriptSessions']);
    await loadSavedTranscripts();
    showStatus('🗑️ All transcripts cleared', 'success');
  } catch (error) {
    console.error('Error clearing transcripts:', error);
    showStatus('❌ Failed to clear', 'error');
  }
}
