// Popup script for Kayako Pagination Cacher
// Handles all popup interactions and configuration management

class KayakoCacherPopup {
  constructor() {
    this.config = null;
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    console.log('Initializing Kayako Cacher popup');
    
    try {
      // Load current configuration
      await this.loadConfig();
      console.log('Config loaded:', this.config);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Update UI with current config
      this.updateUI();
      console.log('UI updated with config');
      
      // Load and display cache stats
      await this.refreshCacheStats();
      
      // Check if we're on a Kayako page
      await this.checkKayakoStatus();
    } catch (error) {
      console.error('Error during popup initialization:', error);
      this.showError('Failed to initialize popup');
    }
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response.success) {
        this.config = response.config;
        console.log('Loaded config:', this.config);
      } else {
        console.error('Failed to load config:', response.error);
        this.showError('Failed to load configuration');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.showError('Extension communication error');
    }
  }

  async saveConfig() {
    if (!this.config) {
      console.error('No config to save');
      return;
    }
    
    console.log('Saving config:', this.config);
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateConfig', 
        config: this.config 
      });
      
      if (response && response.success) {
        console.log('Config saved successfully:', response.config);
        this.config = response.config; // Update local config with saved version
        this.showSuccess('Settings saved');
      } else {
        console.error('Failed to save config:', response?.error || 'No response');
        this.showError('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      this.showError('Failed to save settings: ' + error.message);
    }
  }

  setupEventListeners() {
    // Pagination limit selector
    const paginationLimit = document.getElementById('pagination-limit');
    if (paginationLimit) {
      paginationLimit.addEventListener('change', async (e) => {
        this.config.paginationLimit = parseInt(e.target.value);
        await this.saveConfig();
      });
    }

    // Cache enabled toggle
    const enableCache = document.getElementById('enable-cache');
    if (enableCache) {
      enableCache.addEventListener('change', async (e) => {
        this.config.cacheEnabled = e.target.checked;
        await this.saveConfig();
      });
    }

    // Cache expiry selector
    const cacheExpiry = document.getElementById('cache-expiry');
    if (cacheExpiry) {
      cacheExpiry.addEventListener('change', async (e) => {
        this.config.cacheExpiry = parseInt(e.target.value);
        await this.saveConfig();
      });
    }

    // Preload all toggle
    const preloadAll = document.getElementById('preload-all');
    if (preloadAll) {
      preloadAll.addEventListener('change', async (e) => {
        this.config.preloadAll = e.target.checked;
        await this.saveConfig();
      });
    }

    // Max cache size input
    const maxCacheSize = document.getElementById('max-cache-size');
    if (maxCacheSize) {
      maxCacheSize.addEventListener('change', async (e) => {
        this.config.maxCacheSize = parseInt(e.target.value) * 1024 * 1024; // Convert MB to bytes
        await this.saveConfig();
      });
    }

    // Action buttons
    const loadAllPosts = document.getElementById('load-all-posts');
    if (loadAllPosts) {
      loadAllPosts.addEventListener('click', () => this.loadAllPosts());
    }

    const clearCache = document.getElementById('clear-cache');
    if (clearCache) {
      clearCache.addEventListener('click', () => this.clearCache());
    }

    const refreshStats = document.getElementById('refresh-stats');
    if (refreshStats) {
      refreshStats.addEventListener('click', () => this.refreshCacheStats());
    }

    const showDebug = document.getElementById('show-debug');
    if (showDebug) {
      showDebug.addEventListener('click', () => this.showDebugInfo());
    }

    const toggleAdvanced = document.getElementById('toggle-advanced');
    if (toggleAdvanced) {
      toggleAdvanced.addEventListener('click', () => this.toggleAdvancedSection());
    }

    // Image optimization toggle
    const enableImageOpt = document.getElementById('enable-image-optimization');
    if (enableImageOpt) {
      enableImageOpt.addEventListener('change', async (e) => {
        this.config.imageOptimizationEnabled = e.target.checked;
        await this.saveConfig();
      });
    }

    // Image optimization settings
    const imageQuality = document.getElementById('image-quality');
    if (imageQuality) {
      imageQuality.addEventListener('change', async (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0.1 && val <= 1) {
          this.config.imageQuality = val;
          await this.saveConfig();
        }
      });
    }

    const imageFormat = document.getElementById('image-format');
    if (imageFormat) {
      imageFormat.addEventListener('change', async (e) => {
        this.config.imageFormat = e.target.value;
        await this.saveConfig();
      });
    }

    const imageMaxWidth = document.getElementById('image-max-width');
    if (imageMaxWidth) {
      imageMaxWidth.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 320 && val <= 8192) {
          this.config.imageMaxWidth = val;
          await this.saveConfig();
        }
      });
    }

    const imageMaxHeight = document.getElementById('image-max-height');
    if (imageMaxHeight) {
      imageMaxHeight.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 320 && val <= 8192) {
          this.config.imageMaxHeight = val;
          await this.saveConfig();
        }
      });
    }
  }

  updateUI() {
    if (!this.config) return;

    // Update pagination limit
    const paginationLimit = document.getElementById('pagination-limit');
    if (paginationLimit) {
      paginationLimit.value = this.config.paginationLimit;
    }

    // Update cache enabled
    const enableCache = document.getElementById('enable-cache');
    if (enableCache) {
      enableCache.checked = this.config.cacheEnabled;
    }

    // Update cache expiry
    const cacheExpiry = document.getElementById('cache-expiry');
    if (cacheExpiry) {
      cacheExpiry.value = this.config.cacheExpiry;
    }

    // Update preload all
    const preloadAll = document.getElementById('preload-all');
    if (preloadAll) {
      preloadAll.checked = this.config.preloadAll;
    }

    // Update max cache size (convert bytes to MB)
    const maxCacheSize = document.getElementById('max-cache-size');
    if (maxCacheSize) {
      maxCacheSize.value = Math.round(this.config.maxCacheSize / 1024 / 1024);
    }

    // Update image optimization toggle
    const enableImageOpt = document.getElementById('enable-image-optimization');
    if (enableImageOpt) {
      enableImageOpt.checked = !!this.config.imageOptimizationEnabled;
    }

    // Update image optimization inputs
    const imageQuality = document.getElementById('image-quality');
    if (imageQuality) {
      imageQuality.value = (this.config.imageQuality ?? 0.8);
    }
    const imageFormat = document.getElementById('image-format');
    if (imageFormat) {
      imageFormat.value = (this.config.imageFormat ?? 'jpeg');
    }
    const imageMaxWidth = document.getElementById('image-max-width');
    if (imageMaxWidth) {
      imageMaxWidth.value = (this.config.imageMaxWidth ?? 1920);
    }
    const imageMaxHeight = document.getElementById('image-max-height');
    if (imageMaxHeight) {
      imageMaxHeight.value = (this.config.imageMaxHeight ?? 1080);
    }
  }

  async checkKayakoStatus() {
    try {
      console.log('Checking Kayako status...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      console.log('Current tab:', currentTab?.url);
      
      const statusDot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      
      // Check if on any supported Kayako domain (updated for broader patterns)
      const supportedDomains = [
        'kayako.com/agent',
        '.gfi.com/agent',
        '.aurea.com/agent', 
        '.ignitetech.com/agent',
        '.crossover.com/agent',
        '.totogi.com/agent',
        '.alpha.school/agent',
        '.cloudsense.com/agent',
        '.kandy.io/agent',
        'dnnsupport.dnnsoftware.com/agent',
        'csai.trilogy.com/agent'
      ];
      
      const isOnKayako = currentTab && currentTab.url && 
        supportedDomains.some(domain => currentTab.url.includes(domain));
      
      if (isOnKayako) {
        console.log('✅ Active on supported Kayako page:', currentTab.url);
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Active on Kayako';
      } else {
        console.log('❌ Not on supported Kayako page:', currentTab?.url);
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Not on Kayako page';
      }
    } catch (error) {
      console.error('Error checking status:', error);
      const statusDot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      if (statusDot && statusText) {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Status unknown';
      }
    }
  }

  async refreshCacheStats() {
    try {
      // Try to get stats from content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs[0]) {
        try {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getCacheStats' });
          
          if (response && response.success) {
            const stats = response.stats;
            
            document.getElementById('cache-entries').textContent = stats.entries || '0';
            document.getElementById('cache-size').textContent = (stats.sizeKB || 0) + ' KB';
            document.getElementById('cache-oldest').textContent = 'localStorage';
            document.getElementById('cache-newest').textContent = stats.working ? 'Active' : 'Inactive';
            
            return;
          }
        } catch (error) {
          console.log('Content script stats failed, trying background');
        }
      }
      
      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ action: 'getCacheStats' });
      
      if (response && response.success) {
        const stats = response.stats;
        
        document.getElementById('cache-entries').textContent = stats.entryCount || '0';
        document.getElementById('cache-size').textContent = stats.formattedSize || '0 B';
        document.getElementById('cache-oldest').textContent = 'Background';
        document.getElementById('cache-newest').textContent = 'Active';
      }
    } catch (error) {
      console.error('Error getting cache stats:', error);
      // Set default values instead of showing error
      document.getElementById('cache-entries').textContent = '0';
      document.getElementById('cache-size').textContent = '0 KB';
      document.getElementById('cache-oldest').textContent = 'None';
      document.getElementById('cache-newest').textContent = 'None';
    }
  }

  async loadAllPosts() {
    if (this.isLoading) {
      console.log('Already loading posts, skipping...');
      return;
    }
    
    console.log('Starting loadAllPosts...');
    
    try {
      this.isLoading = true;
      const button = document.getElementById('load-all-posts');
      
      if (!button) {
        throw new Error('Load posts button not found');
      }
      
      const originalText = button.textContent;
      button.textContent = '⏳ Loading...';
      button.classList.add('loading');
      button.disabled = true;
      
      // Check if we're on a Kayako page
      console.log('Querying for active tab...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      console.log('Found tab:', currentTab?.url);
      
      if (!currentTab) {
        throw new Error('No active tab found');
      }
      
      if (!currentTab.url) {
        throw new Error('Cannot access tab URL - check permissions');
      }
      
      if (!currentTab.url.includes('kayako.com/agent')) {
        throw new Error('Please navigate to a Kayako ticket page first');
      }
      
      console.log('Sending message to content script...');
      
      // Send message to content script to load all posts
      const response = await chrome.tabs.sendMessage(currentTab.id, { 
        action: 'loadAllPosts' 
      });
      
      console.log('Content script response:', response);
      
      if (response && response.success) {
        this.showSuccess('All posts loaded and cached successfully!');
      } else {
        throw new Error(response?.error || 'Content script did not respond successfully');
      }
      
      // Refresh stats after a delay
      setTimeout(() => this.refreshCacheStats(), 2000);
    } catch (error) {
      console.error('Error loading all posts:', error);
      
      if (error.message.includes('Could not establish connection')) {
        this.showError('Extension not active on this page. Try refreshing the page.');
      } else {
        this.showError(error.message || 'Failed to load posts');
      }
    } finally {
      this.isLoading = false;
      const button = document.getElementById('load-all-posts');
      if (button) {
        button.textContent = '📥 Load All Posts Now';
        button.classList.remove('loading');
        button.disabled = false;
      }
    }
  }

  async clearCache() {
    if (this.isLoading) return;
    
    if (!confirm('Are you sure you want to clear all cached data?')) {
      return;
    }
    
    try {
      this.isLoading = true;
      const button = document.getElementById('clear-cache');
      const originalText = button.textContent;
      button.textContent = '⏳ Clearing...';
      button.classList.add('loading');
      
      // Try to clear cache via content script first
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      let response = null;
      
      if (tabs[0]) {
        try {
          // Try content script method
          await chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'executeScript',
            script: `
              if (typeof window.clearKayakoCache === 'function') {
                const count = window.clearKayakoCache();
                console.log('🗑️ Cleared ' + count + ' localStorage entries');
              } else {
                console.log('❌ clearKayakoCache function not available');
              }
            `
          });
          response = { success: true, clearedCount: 'localStorage' };
        } catch (error) {
          console.log('Content script clear failed, trying background');
        }
      }
      
      if (!response) {
        // Fallback to background script
        response = await chrome.runtime.sendMessage({ action: 'clearCache' });
      }
      
      if (response.success) {
        this.showSuccess(`Cleared ${response.clearedCount} cache entries`);
        await this.refreshCacheStats();
      } else {
        throw new Error(response.error || 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.showError(error.message || 'Failed to clear cache');
    } finally {
      this.isLoading = false;
      const button = document.getElementById('clear-cache');
      button.textContent = '🗑️ Clear Cache';
      button.classList.remove('loading');
    }
  }

  async showDebugInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      const debugContent = document.getElementById('debug-content');
      debugContent.textContent = `Current Tab: ${currentTab?.url || 'Unknown'}
Current Config: ${JSON.stringify(this.config, null, 2)}
Extension ID: ${chrome.runtime.id}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}`;
    } catch (error) {
      console.error('Error showing debug info:', error);
      const debugContent = document.getElementById('debug-content');
      debugContent.textContent = `Error loading debug info: ${error.message}`;
    }
  }

  toggleAdvancedSection() {
    const section = document.getElementById('advanced-section');
    const button = document.getElementById('toggle-advanced');
    
    if (section.classList.contains('visible')) {
      section.classList.remove('visible');
      button.textContent = 'Advanced Settings';
    } else {
      section.classList.add('visible');
      button.textContent = 'Hide Advanced';
    }
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#dc3545' : '#28a745'};
      color: white;
      padding: 8px 15px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes slideOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }
`;
document.head.appendChild(style);

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new KayakoCacherPopup();
});
