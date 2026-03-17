// Google Meet AI Transcriber - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadSavedTranscripts();
  setupEventListeners();
});

let lastLoadedConfig = null;

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    
    if (response.success) {
      const config = response.config;
      lastLoadedConfig = config;
      
      // Set form values
      document.getElementById('provider').value = config.provider || 'anthropic';
      document.getElementById('openai-key').value = config.openaiKey || '';
      document.getElementById('anthropic-key').value = config.anthropicKey || '';
      document.getElementById('model').value = config.model || 'claude-haiku-4-5';
      document.getElementById('summary-model').value = config.summaryModel || 'claude-sonnet-4-6';
      document.getElementById('tldr-model').value = config.tldrModel || 'claude-opus-4-6';
      document.getElementById('story-arc-model').value = config.storyArcModel || 'claude-opus-4-6';
      document.getElementById('bullet-points-model').value = config.bulletPointsModel || 'claude-opus-4-6';
      document.getElementById('capture-interval').value = config.captureInterval || 10;
      document.getElementById('batch-size').value = config.batchSize || 6;
      document.getElementById('image-quality').value = config.imageQuality || 0.5;
      document.getElementById('technical-mode').checked = config.technicalMode !== false;
      document.getElementById('meta-analysis-enabled').checked = config.enableMetaAnalysis !== false;
      document.getElementById('meta-interval').value = config.metaAnalysisInterval || 5;
      document.getElementById('meta-window').value = config.metaAnalysisWindow || 5;
      document.getElementById('kt-screenshot-enabled').checked = Boolean(config.enableScreenshotClassifier);
      document.getElementById('kt-screenshot-model').value = config.screenshotClassifierModel || 'claude-haiku-4-5';
      document.getElementById('kt-screenshot-endpoint').value = config.s3ScreenshotEndpoint || config.s3UploadEndpoint || '';
      
      // Update slider displays
      updateSliderDisplays();
      updateTechnicalModeLabel();
      updateMetaLabel();
      updateKtScreenshotLabel();
      
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
  document.getElementById('kt-screenshot-enabled').addEventListener('change', updateKtScreenshotLabel);
  
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

function updateKtScreenshotLabel() {
  const isEnabled = document.getElementById('kt-screenshot-enabled').checked;
  const label = document.getElementById('kt-screenshot-label');
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
      summaryModel: document.getElementById('summary-model').value,
      tldrModel: document.getElementById('tldr-model').value,
      storyArcModel: document.getElementById('story-arc-model').value,
      bulletPointsModel: document.getElementById('bullet-points-model').value,
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
      enableScreenshotClassifier: document.getElementById('kt-screenshot-enabled').checked,
      screenshotClassifierModel: document.getElementById('kt-screenshot-model').value,
      s3ScreenshotEndpoint: document.getElementById('kt-screenshot-endpoint').value.trim(),
    };
    if (!config.s3ScreenshotEndpoint) {
      config.s3ScreenshotEndpoint = lastLoadedConfig?.s3UploadEndpoint || '';
    }
    
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
      imageFormat: 'jpeg',
      enableScreenshotClassifier: false,
      screenshotClassifierModel: 'claude-haiku-4-5',
      s3ScreenshotEndpoint: ''
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

// Poll interval for background task progress
let taskPollInterval = null;
// Track which sessions have expanded arc details (survives re-renders)
const expandedArcs = new Set();

function startTaskPolling() {
  if (taskPollInterval) return;
  taskPollInterval = setInterval(async () => {
    const result = await chrome.storage.local.get(['meetTranscriberTasks']);
    const tasks = result.meetTranscriberTasks || {};
    const hasRunning = Object.values(tasks).some(t => t.status === 'running');
    await loadSavedTranscripts();
    if (!hasRunning) {
      clearInterval(taskPollInterval);
      taskPollInterval = null;
    }
  }, 2000);
}

/** Load and display saved transcripts from Chrome storage */
async function loadSavedTranscripts() {
  try {
    const [sessResult, taskResult] = await Promise.all([
      chrome.storage.local.get(['meetTranscriptSessions']),
      chrome.storage.local.get(['meetTranscriberTasks'])
    ]);
    const sessions = sessResult.meetTranscriptSessions || {};
    const tasks = taskResult.meetTranscriberTasks || {};
    const listEl = document.getElementById('saved-transcripts-list');
    
    const sessionIds = Object.keys(sessions).sort((a, b) => {
      return new Date(sessions[b].lastUpdated) - new Date(sessions[a].lastUpdated);
    });
    
    if (sessionIds.length === 0) {
      listEl.innerHTML = '<p class="no-transcripts">No saved transcripts yet</p>';
      return;
    }

    // Check if any tasks are running and start polling if so
    const hasRunning = Object.values(tasks).some(t => t.status === 'running');
    if (hasRunning) startTaskPolling();
    
    listEl.innerHTML = sessionIds.map(id => {
      const session = sessions[id];
      const date = new Date(session.lastUpdated);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const meetCode = session.url.split('/').pop().split('?')[0] || 'unknown';
      
      const hasTldr = !!session.tldr;
      const hasArc = !!session.storyArc;
      const hasBullets = !!session.bulletPoints;
      const hasBatches = getSessionBatches(session).length > 0;
      const tldrTask = tasks[id + ':tldr'];
      const arcTask = tasks[id + ':arc'];
      const bulletsTask = tasks[id + ':bullets'];
      const anyBusy = tldrTask?.status === 'running' || arcTask?.status === 'running' || bulletsTask?.status === 'running';
      const arcBusy = arcTask?.status === 'running';
      const arcProgress = arcTask ? `${arcTask.progress || 0}/${arcTask.total || '?'}` : '';
      const arcPct = (arcTask && arcTask.total) ? Math.round(((arcTask.progress || 0) / arcTask.total) * 100) : 0;
      const hasDraftArc = arcBusy && arcTask?.checkpoint?.currentArc;
      const showArcExpander = hasArc || hasDraftArc;
      const arcLabel = hasArc ? '📖 Story Arc' : '📖 Story Arc (draft — in progress)';
      const isExpanded = expandedArcs.has(id);
      const badges = [hasTldr ? 'TL;DR' : '', hasArc ? 'Arc' : hasDraftArc ? 'Arc (draft)' : '', hasBullets ? 'Bullets' : ''].filter(Boolean).join(' · ');

      let busyLabel = '';
      if (tldrTask?.status === 'running') busyLabel = 'TL;DR...';
      else if (bulletsTask?.status === 'running') busyLabel = 'Bullets...';
      else if (arcBusy) busyLabel = `Arc ${arcProgress} (~${arcPct}%)`;

      return `
        <div class="saved-transcript-item-wrapper" data-session-id="${id}">
          <div class="saved-transcript-item">
            <div class="transcript-info">
              <span class="transcript-date">${dateStr} ${timeStr} ${showArcExpander ? `<button class="btn-expand arc-expand" title="Expand">${isExpanded ? '▼' : '▶'}</button>` : ''}</span>
              <span class="transcript-meet">Meet: ${meetCode}</span>
              <span class="transcript-batches">${session.batchCount} batches${badges ? ' · ' + badges : ''}</span>
            </div>
            <div class="transcript-actions">
              <button class="btn-icon download-saved" title="Download transcript">💾</button>
              <button class="btn-icon copy-saved" title="Copy transcript">📋</button>
              <div class="popup-summarize-wrap">
                <button class="btn-icon popup-summarize-toggle" title="${anyBusy ? busyLabel + ' — click to open menu' : 'Summarize'}">${anyBusy ? '<span class="spinner"></span>' : '✨'}</button>
                <div class="popup-summarize-menu" style="display:none">
                  <button class="popup-sum-opt" data-action="tldr">${tldrTask?.status === 'running' ? '<span class="spinner-sm"></span> TL;DR...' : '📝 TL;DR'}</button>
                  <button class="popup-sum-opt" data-action="arc" ${!hasBatches ? 'disabled' : ''}>${arcBusy ? '<span class="spinner-sm"></span> Arc ' + arcProgress : '📖 Story Arc'}</button>
                  <button class="popup-sum-opt" data-action="bullets">${bulletsTask?.status === 'running' ? '<span class="spinner-sm"></span> Bullets...' : '📋 Bullet Points'}</button>
                  ${showArcExpander ? '<button class="popup-sum-opt" data-action="dl-arc">💾 Download Arc</button>' : ''}
                  ${showArcExpander ? '<button class="popup-sum-opt" data-action="cp-arc">📋 Copy Arc</button>' : ''}
                </div>
              </div>
              <button class="btn-icon delete-saved" title="Delete">🗑️</button>
            </div>
          </div>
          ${showArcExpander ? `
          <div class="arc-detail" style="display:${isExpanded ? 'block' : 'none'}">
            <div class="arc-detail-row">
              <span class="arc-detail-label">${arcLabel}</span>
              <div class="arc-detail-actions">
                <button class="btn-icon arc-download" title="Download Story Arc">💾</button>
                <button class="btn-icon arc-copy" title="Copy Story Arc">📋</button>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Wire up event listeners
    listEl.querySelectorAll('.download-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        downloadSavedTranscript(sid, sessions[sid]);
      });
    });
    
    listEl.querySelectorAll('.copy-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        copySavedTranscript(sessions[sid]);
      });
    });
    
    // Summarize dropdown per row
    listEl.querySelectorAll('.popup-summarize-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = e.target.closest('.popup-summarize-wrap');
        const menu = wrap.querySelector('.popup-summarize-menu');
        // Close all other open menus
        listEl.querySelectorAll('.popup-summarize-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
      });
    });

    listEl.querySelectorAll('.popup-sum-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = e.target.closest('.popup-summarize-wrap');
        wrap.querySelector('.popup-summarize-menu').style.display = 'none';
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        const action = e.target.closest('.popup-sum-opt').dataset.action;
        if (action === 'tldr') {
          if (tasks[sid + ':tldr']?.status === 'running') {
            chrome.runtime.sendMessage({ action: 'cancelTask', taskKey: sid + ':tldr' });
            showStatus('TL;DR cancelled', 'info');
          } else { dispatchTldr(sid, sessions[sid]); }
        } else if (action === 'arc') {
          if (tasks[sid + ':arc']?.status === 'running') {
            chrome.runtime.sendMessage({ action: 'cancelTask', taskKey: sid + ':arc' });
            showStatus('Story Arc cancelled', 'info');
          } else { dispatchStoryArc(sid, sessions[sid]); }
        } else if (action === 'bullets') {
          if (tasks[sid + ':bullets']?.status === 'running') {
            chrome.runtime.sendMessage({ action: 'cancelTask', taskKey: sid + ':bullets' });
            showStatus('Bullet Points cancelled', 'info');
          } else { dispatchBulletPoints(sid, sessions[sid]); }
        } else if (action === 'dl-arc') {
          const arcText = sessions[sid]?.storyArc || tasks[sid + ':arc']?.checkpoint?.currentArc;
          if (arcText) downloadArcText(sessions[sid], arcText, tasks[sid + ':arc']);
        } else if (action === 'cp-arc') {
          const arcText = sessions[sid]?.storyArc || tasks[sid + ':arc']?.checkpoint?.currentArc;
          if (arcText) navigator.clipboard.writeText(arcText).then(() => showStatus('Arc copied', 'success'));
        }
        loadSavedTranscripts();
      });
    });

    // Close popup menus on outside click
    document.addEventListener('click', () => {
      listEl.querySelectorAll('.popup-summarize-menu').forEach(m => m.style.display = 'none');
    });

    listEl.querySelectorAll('.arc-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = e.target.closest('.saved-transcript-item-wrapper');
        const sid = wrapper.dataset.sessionId;
        const detail = wrapper.querySelector('.arc-detail');
        const isOpen = detail.style.display !== 'none';
        if (isOpen) {
          expandedArcs.delete(sid);
          detail.style.display = 'none';
          e.target.textContent = '▶';
        } else {
          expandedArcs.add(sid);
          detail.style.display = 'block';
          e.target.textContent = '▼';
        }
      });
    });

    listEl.querySelectorAll('.arc-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        const arcText = sessions[sid]?.storyArc || tasks[sid + ':arc']?.checkpoint?.currentArc;
        if (!arcText) { showStatus('⚠️ No arc content available', 'error'); return; }
        navigator.clipboard.writeText(arcText).then(() => {
          showStatus('📋 Story Arc copied to clipboard', 'success');
        }).catch(() => showStatus('❌ Failed to copy', 'error'));
      });
    });

    listEl.querySelectorAll('.arc-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        const session = sessions[sid];
        const arcText = session?.storyArc || tasks[sid + ':arc']?.checkpoint?.currentArc;
        if (!arcText) { showStatus('⚠️ No arc content available', 'error'); return; }
        const isDraft = !session?.storyArc;
        let text = `Google Meet - Story Arc${isDraft ? ' (DRAFT)' : ''}\n`;
        text += '=======================\n\n';
        text += `Meet URL: ${session.url}\n`;
        text += `Recorded: ${session.startTime}\n`;
        text += `Generated: ${new Date().toLocaleString()}\n`;
        if (isDraft) {
          const task = tasks[sid + ':arc'];
          text += `Status: In progress — ${task?.progress || 0}/${task?.total || '?'} steps\n`;
        }
        text += '\n' + arcText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meet-story-arc${isDraft ? '-draft' : ''}-${new Date(session.lastUpdated).toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus(`📖 Story Arc ${isDraft ? 'draft ' : ''}downloaded`, 'success');
      });
    });

    listEl.querySelectorAll('.delete-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.target.closest('.saved-transcript-item-wrapper').dataset.sessionId;
        deleteSavedTranscript(sid);
      });
    });
    
  } catch (error) {
    console.error('Error loading saved transcripts:', error);
  }
}

function downloadSavedTranscript(sessionId, session) {
  let text = `Google Meet AI Transcription\n============================\n\nMeet URL: ${session.url}\nRecorded: ${session.startTime}\nLast Updated: ${session.lastUpdated}\nBatches: ${session.batchCount}\n\n`;
  if (session.tldr) {
    text += `=== TL;DR ===\n${session.tldr}\n\n=== Transcript ===\n\n`;
  }
  text += session.transcript;
  
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meet-transcript-${new Date(session.lastUpdated).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('💾 Transcript downloaded', 'success');
}

/** Parse flat transcript text into structured batches array */
function parseBatchesFromTranscript(transcript) {
  if (!transcript) return [];
  const batches = [];
  const lines = transcript.split('\n');
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]$/);
    if (match) {
      if (current && current.content.trim()) batches.push(current);
      current = { timestamp: match[1], content: '' };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line;
    }
  }
  if (current && current.content.trim()) batches.push(current);
  return batches;
}

/** Get batches for a session -- uses stored array or parses from transcript */
function getSessionBatches(session) {
  if (session.batches && session.batches.length > 0) return session.batches;
  return parseBatchesFromTranscript(session.transcript);
}

/** Dispatch TL;DR generation to background (fire-and-forget, allows regeneration) */
async function dispatchTldr(sessionId, session) {
  await chrome.runtime.sendMessage({
    action: 'generateTldr',
    sessionId,
    fullTranscript: session.transcript
  });
  showStatus('📝 Generating TL;DR in background...', 'info');
  startTaskPolling();
  await loadSavedTranscripts();
}

/** Dispatch Story Arc generation to background (fire-and-forget) */
async function dispatchStoryArc(sessionId, session) {
  const batches = getSessionBatches(session);
  if (batches.length === 0) {
    showStatus('⚠️ No batch data available for this transcript', 'error');
    return;
  }
  await chrome.runtime.sendMessage({
    action: 'generateStoryArc',
    sessionId,
    batches
  });
  showStatus('📖 Building Story Arc in background...', 'info');
  startTaskPolling();
  await loadSavedTranscripts();
}

/** Dispatch Bullet Points generation to background (fire-and-forget) */
async function dispatchBulletPoints(sessionId, session) {
  await chrome.runtime.sendMessage({
    action: 'generateBulletPoints',
    sessionId,
    fullTranscript: session.transcript
  });
  showStatus('📋 Generating Bullet Points in background...', 'info');
  startTaskPolling();
  await loadSavedTranscripts();
}

/** Download arc text (works for both final and draft) */
function downloadArcText(session, arcText, arcTask) {
  const isDraft = !session?.storyArc;
  let text = `Google Meet - Story Arc${isDraft ? ' (DRAFT)' : ''}\n`;
  text += '=======================\n\n';
  text += `Meet URL: ${session.url}\nRecorded: ${session.startTime}\nGenerated: ${new Date().toLocaleString()}\n`;
  if (isDraft && arcTask) text += `Status: In progress - ${arcTask.progress || 0}/${arcTask.total || '?'} steps\n`;
  text += '\n' + arcText;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meet-story-arc${isDraft ? '-draft' : ''}-${new Date(session.lastUpdated).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus(`Story Arc ${isDraft ? 'draft ' : ''}downloaded`, 'success');
}

/** Copy Story Arc text to clipboard */
function copySavedStoryArc(session) {
  if (!session.storyArc) {
    showStatus('⚠️ No story arc to copy', 'error');
    return;
  }
  navigator.clipboard.writeText(session.storyArc).then(() => {
    showStatus('📋 Story Arc copied to clipboard', 'success');
  }).catch(error => {
    showStatus('❌ Failed to copy', 'error');
    console.error('Copy failed:', error);
  });
}

/** Download Story Arc for a saved transcript */
function downloadSavedStoryArc(session) {
  if (!session.storyArc) {
    showStatus('⚠️ No story arc — build one first', 'error');
    return;
  }

  let text = 'Google Meet - Story Arc\n';
  text += '=======================\n\n';
  text += `Meet URL: ${session.url}\n`;
  text += `Recorded: ${session.startTime}\n`;
  text += `Generated: ${new Date().toLocaleString()}\n\n`;
  text += session.storyArc;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meet-story-arc-${new Date(session.lastUpdated).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showStatus('📖 Story Arc downloaded', 'success');
}

function copySavedTranscript(session) {
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
