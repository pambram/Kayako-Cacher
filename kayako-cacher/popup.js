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
      // Populate version from manifest
      try {
        const manifest = chrome.runtime.getManifest();
        const vEl = document.getElementById('version');
        if (vEl && manifest && manifest.version) vEl.textContent = manifest.version;
      } catch (_) {}

      // Load current configuration
      await this.loadConfig();
      // console.log('Config loaded:', this.config);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Update UI with current config
      this.updateUI();
      console.log('UI updated with config');
      
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
      let debounceTimerW = null;
      const persist = async (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          const clamped = Math.max(50, Math.min(8192, val));
          if (this.config.imageMaxWidth !== clamped) {
            this.config.imageMaxWidth = clamped;
            await this.saveConfig();
            this.updateUI();
          }
        }
      };
      const queuePersist = (e) => {
        if (debounceTimerW) clearTimeout(debounceTimerW);
        debounceTimerW = setTimeout(() => persist(e), 400);
      };
      imageMaxWidth.addEventListener('input', queuePersist);
      imageMaxWidth.addEventListener('change', persist);
      imageMaxWidth.addEventListener('blur', persist);
    }

    const imageMaxHeight = document.getElementById('image-max-height');
    if (imageMaxHeight) {
      let debounceTimerH = null;
      const persistH = async (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          const clamped = Math.max(50, Math.min(8192, val));
          if (this.config.imageMaxHeight !== clamped) {
            this.config.imageMaxHeight = clamped;
            await this.saveConfig();
            this.updateUI();
          }
        }
      };
      const queuePersistH = (e) => {
        if (debounceTimerH) clearTimeout(debounceTimerH);
        debounceTimerH = setTimeout(() => persistH(e), 400);
      };
      imageMaxHeight.addEventListener('input', queuePersistH);
      imageMaxHeight.addEventListener('change', persistH);
      imageMaxHeight.addEventListener('blur', persistH);
    }
    
    // Debug button
    const showDebug = document.getElementById('show-debug');
    if (showDebug) {
      showDebug.addEventListener('click', () => this.showDebugInfo());
    }

    // Advanced toggle
    const toggleAdvanced = document.getElementById('toggle-advanced');
    if (toggleAdvanced) {
      toggleAdvanced.addEventListener('click', () => this.toggleAdvancedSection());
    }
  }

  updateUI() {
    if (!this.config) return;

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

  // Cache functions removed in simplified build

  // Posts loader removed

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
