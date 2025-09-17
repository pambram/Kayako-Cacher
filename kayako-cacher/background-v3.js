// Background script for Kayako Pagination Cacher
// Handles configuration management and communication with content scripts

console.log('🚀 Kayako Pagination Cacher v5.3.3 service worker started - REGRESSION FIXES');

// Default configuration
const DEFAULT_CONFIG = {
  paginationLimit: 100,
  cacheEnabled: true,
  cacheExpiry: 30 * 60 * 1000, // 30 minutes
  preloadAll: false,
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  imageOptimizationEnabled: true,
  imageQuality: 0.8,
  imageMaxWidth: 1920,
  imageMaxHeight: 1080,
  imageFormat: 'jpeg'
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
    
    // Clean up any expired cache entries on install/update
    await cleanupExpiredCache();
    console.log('✅ Initial cache cleanup completed');
  } catch (error) {
    console.error('❌ Error during installation:', error);
  }
});

// Set up cache cleanup on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Extension startup - running cache cleanup');
  try {
    await cleanupExpiredCache();
    console.log('✅ Startup cache cleanup completed');
  } catch (error) {
    console.error('❌ Error during startup cleanup:', error);
  }
});

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
      case 'clearCache':
        await handleClearCache(sendResponse);
        break;
      case 'getCacheStats':
        await handleGetCacheStats(sendResponse);
        break;
      case 'trackPerformance':
        handleTrackPerformance(message.data);
        sendResponse({ success: true });
        break;
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

// Clear all cached data
async function handleClearCache(sendResponse) {
  try {
    console.log('🗑️ Clearing cache...');
    // Get all storage keys
    const allItems = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allItems).filter(key => 
      key.startsWith('kayako_cache_') || key.startsWith('kayako_posts_')
    );
    
    // Remove cache keys
    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
    }
    
    console.log(`✅ Cleared ${cacheKeys.length} cache entries`);
    sendResponse({ success: true, clearedCount: cacheKeys.length });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get cache statistics
async function handleGetCacheStats(sendResponse) {
  try {
    console.log('📊 Getting cache statistics...');
    
    // Clean up expired entries before getting stats
    await cleanupExpiredCache();
    
    const allItems = await chrome.storage.local.get();
    const cacheEntries = Object.entries(allItems).filter(([key]) => 
      key.startsWith('kayako_cache_') || key.startsWith('kayako_posts_')
    );
    
    let totalSize = 0;
    let entryCount = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;
    
    cacheEntries.forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        const entrySize = JSON.stringify(value).length;
        totalSize += entrySize;
        entryCount++;
        
        if (value.timestamp) {
          oldestEntry = Math.min(oldestEntry, value.timestamp);
          newestEntry = Math.max(newestEntry, value.timestamp);
        }
      }
    });
    
    const perf = await chrome.storage.local.get(['kayako_perf']);
    const savedMs = (perf && perf.kayako_perf && typeof perf.kayako_perf.savedMsTotal === 'number') ? perf.kayako_perf.savedMsTotal : 0;
    const stats = {
      totalSize,
      entryCount,
      oldestEntry: oldestEntry === Date.now() ? null : oldestEntry,
      newestEntry: newestEntry === 0 ? null : newestEntry,
      formattedSize: formatBytes(totalSize),
      savedMsTotal: savedMs
    };
    
    console.log('✅ Cache stats computed:', stats);
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Track performance metrics
function handleTrackPerformance(data) {
  try {
    const networkMs = typeof data.networkMs === 'number' ? data.networkMs : 0;
    const savedMs = typeof data.savedMs === 'number' ? data.savedMs : networkMs;
    chrome.storage.local.get(['kayako_perf']).then(res => {
      const current = res.kayako_perf || { savedMsTotal: 0, samples: 0 };
      const updated = {
        savedMsTotal: current.savedMsTotal + savedMs,
        samples: current.samples + 1,
        last: { url: data.url || '', networkMs, ts: Date.now() }
      };
      return chrome.storage.local.set({ 'kayako_perf': updated });
    }).catch(() => {});
  } catch (_) {}
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

// Utility function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Clean up expired cache entries
async function cleanupExpiredCache() {
  try {
    console.log('🧹 Starting cache cleanup...');
    const config = await chrome.storage.local.get(['kayako_config']);
    const cacheExpiry = config.kayako_config?.cacheExpiry || DEFAULT_CONFIG.cacheExpiry;
    const cutoffTime = Date.now() - cacheExpiry;
    
    const allItems = await chrome.storage.local.get();
    const expiredKeys = [];
    
    Object.entries(allItems).forEach(([key, value]) => {
      if ((key.startsWith('kayako_cache_') || key.startsWith('kayako_posts_')) && 
          value && value.timestamp && value.timestamp < cutoffTime) {
        expiredKeys.push(key);
      }
    });
    
    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove(expiredKeys);
      console.log(`✅ Cleaned up ${expiredKeys.length} expired cache entries`);
    } else {
      console.log('✅ No expired cache entries found');
    }
  } catch (error) {
    console.error('❌ Error cleaning up cache:', error);
  }
}

console.log('✅ Background script loaded successfully');