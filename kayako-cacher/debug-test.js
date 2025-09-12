// Debug utility for Kayako Pagination Cacher
// Run these commands in the appropriate console to test functionality

// === POPUP CONSOLE TESTS ===
// (Right-click extension icon → "Inspect popup" → Console tab)

const debugPopup = {
  // Test config loading
  async testConfigLoad() {
    console.log('🧪 Testing config load...');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      console.log('✅ Config response:', response);
      return response;
    } catch (error) {
      console.error('❌ Config load error:', error);
      return null;
    }
  },

  // Test config saving  
  async testConfigSave() {
    console.log('🧪 Testing config save...');
    const testConfig = { paginationLimit: 123, cacheEnabled: true };
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateConfig', 
        config: testConfig 
      });
      console.log('✅ Save response:', response);
      return response;
    } catch (error) {
      console.error('❌ Config save error:', error);
      return null;
    }
  },

  // Test load all posts
  async testLoadAllPosts() {
    console.log('🧪 Testing load all posts...');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('📋 Active tab:', tabs[0]?.url);
      
      const response = await chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'loadAllPosts' 
      });
      console.log('✅ Load posts response:', response);
      return response;
    } catch (error) {
      console.error('❌ Load posts error:', error);
      return null;
    }
  },

  // Run all tests
  async runAll() {
    console.log('🔧 Running all popup tests...');
    await this.testConfigLoad();
    await this.testConfigSave();
    await this.testLoadAllPosts();
    console.log('🎉 Popup tests complete');
  }
};

// === CONTENT SCRIPT CONSOLE TESTS ===
// (On Kayako page → F12 → Console tab)

const debugContent = {
  // Check if content script is loaded
  checkContentScript() {
    console.log('🧪 Checking content script...');
    const loaded = typeof window.kayakoLoadAllPosts === 'function';
    console.log(loaded ? '✅ Content script loaded' : '❌ Content script not loaded');
    return loaded;
  },

  // Test manual load all posts
  async testManualLoad() {
    console.log('🧪 Testing manual load all posts...');
    if (typeof window.kayakoLoadAllPosts === 'function') {
      try {
        const result = await window.kayakoLoadAllPosts();
        console.log('✅ Manual load result:', result);
        return result;
      } catch (error) {
        console.error('❌ Manual load error:', error);
        return null;
      }
    } else {
      console.error('❌ kayakoLoadAllPosts function not available');
      return null;
    }
  },

  // Check storage
  async checkStorage() {
    console.log('🧪 Checking storage...');
    try {
      const config = await chrome.storage.local.get(['kayako_config']);
      console.log('✅ Storage config:', config);
      
      const cache = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(cache).filter(k => k.startsWith('kayako_cache_'));
      console.log(`✅ Found ${cacheKeys.length} cache entries`);
      
      return { config, cacheCount: cacheKeys.length };
    } catch (error) {
      console.error('❌ Storage check error:', error);
      return null;
    }
  },

  // Run all content tests
  async runAll() {
    console.log('🔧 Running all content script tests...');
    this.checkContentScript();
    await this.checkStorage();
    await this.testManualLoad();
    console.log('🎉 Content script tests complete');
  }
};

// === BACKGROUND SCRIPT TESTS ===
// (chrome://extensions → Details → "Inspect views: service worker" → Console)

const debugBackground = {
  // Test message handling
  testMessageHandling() {
    console.log('🧪 Background script message handlers ready');
    console.log('✅ Available handlers: getConfig, updateConfig, clearCache, getCacheStats');
  },

  // Check storage directly
  async checkStorage() {
    console.log('🧪 Checking background storage...');
    try {
      const all = await chrome.storage.local.get();
      console.log('✅ All storage:', all);
      return all;
    } catch (error) {
      console.error('❌ Storage error:', error);
      return null;
    }
  }
};

console.log(`
🔧 KAYAKO CACHER DEBUG UTILITIES LOADED

=== USAGE ===

IN POPUP CONSOLE (Right-click extension icon → Inspect popup):
debugPopup.runAll()           // Test all popup functions
debugPopup.testConfigLoad()   // Test loading configuration
debugPopup.testConfigSave()   // Test saving configuration
debugPopup.testLoadAllPosts() // Test load all posts button

IN CONTENT SCRIPT CONSOLE (Kayako page → F12):
debugContent.runAll()         // Test all content functions  
debugContent.checkContentScript() // Check if content script loaded
debugContent.testManualLoad() // Test manual load function
debugContent.checkStorage()   // Check storage state

IN BACKGROUND CONSOLE (Extensions → Details → Inspect service worker):
debugBackground.checkStorage() // Check storage from background
debugBackground.testMessageHandling() // Check message handlers

=== QUICK TESTS ===
// Test if extension is working at all:
chrome.storage.local.get('kayako_config', console.log)

// Test content script manually:
window.kayakoLoadAllPosts && window.kayakoLoadAllPosts()
`);

// Make available globally
if (typeof window !== 'undefined') {
  window.debugPopup = debugPopup;
  window.debugContent = debugContent;
  window.debugBackground = debugBackground;
}
