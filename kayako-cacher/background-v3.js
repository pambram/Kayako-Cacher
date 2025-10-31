// Background script for Kayako Pagination Cacher
// Handles configuration management and communication with content scripts

console.log('🚀 Kayako Image Optimizer service worker started');

// Default configuration
const DEFAULT_CONFIG = {
  imageOptimizationEnabled: true,
  imageQuality: 0.8,
  imageMaxWidth: 1920,
  imageMaxHeight: 1080,
  imageFormat: 'auto'
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 Kayako Pagination Cacher extension installed/updated:', details.reason);
  
  try {
    const existing = await chrome.storage.local.get(['kayako_config']);
    const current = existing.kayako_config;
    if (!current) {
      await chrome.storage.local.set({ 'kayako_config': DEFAULT_CONFIG });
      console.log('✅ Default configuration set (fresh install)');
    } else {
      // Merge in any new defaults without overwriting user values
      const merged = { ...DEFAULT_CONFIG, ...current };
      await chrome.storage.local.set({ 'kayako_config': merged });
      console.log('✅ Configuration preserved across update');
    }
    
    // No cache to clean in simplified image-only build
  } catch (error) {
    console.error('❌ Error during installation:', error);
  }
});

// No-op startup handler in simplified build

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.action, 'from:', sender.tab?.url || 'popup');
  
  // Handle messages asynchronously
  handleMessage(message, sender, sendResponse);
  
  return true; // Keep the message channel open for async responses
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'getConfig':
        await handleGetConfig(sendResponse);
        break;
      case 'updateConfig':
        await handleUpdateConfig(message.config, sendResponse);
        break;
      // cache-related actions removed in simplified build
      default:
        console.log('❓ Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get current configuration
async function handleGetConfig(sendResponse) {
  try {
    console.log('📖 Loading configuration...');
    const result = await chrome.storage.local.get(['kayako_config']);
    const config = { ...DEFAULT_CONFIG, ...(result.kayako_config || {}) };
    console.log('✅ Configuration loaded:', config);
    sendResponse({ success: true, config });
  } catch (error) {
    console.error('❌ Error getting config:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Update configuration
async function handleUpdateConfig(newConfig, sendResponse) {
  try {
    console.log('💾 Updating configuration:', newConfig);
    const result = await chrome.storage.local.get(['kayako_config']);
    const currentConfig = { ...DEFAULT_CONFIG, ...(result.kayako_config || {}) };
    const updatedConfig = { ...currentConfig, ...newConfig };
    
    await chrome.storage.local.set({
      'kayako_config': updatedConfig
    });
    
    console.log('✅ Configuration updated successfully:', updatedConfig);
    sendResponse({ success: true, config: updatedConfig });
    
    // Notify all Kayako tabs about the config change
    broadcastConfigUpdate(updatedConfig);
  } catch (error) {
    console.error('❌ Error updating config:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Broadcast configuration updates to all Kayako tabs
async function broadcastConfigUpdate(config) {
  try {
    console.log('📡 Broadcasting config update to Kayako tabs...');
    const tabs = await chrome.tabs.query({ url: "*://*.kayako.com/agent/*" });
    
    let successCount = 0;
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'configUpdated',
          config: config
        });
        successCount++;
      } catch (err) {
        // Ignore errors for inactive tabs
        console.log(`Could not send config update to tab ${tab.id}: ${err.message}`);
      }
    }
    
    console.log(`✅ Config broadcast sent to ${successCount}/${tabs.length} Kayako tabs`);
  } catch (error) {
    console.error('❌ Error broadcasting config update:', error);
  }
}

// Cache utilities removed

console.log('✅ Background script loaded successfully');