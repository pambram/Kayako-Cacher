/**
 * Popup Script - Kayako Simple Paginator
 * 
 * Manages the popup UI and communicates with the injected script
 */

class KayakoPaginatorPopup {
  constructor() {
    this.config = {
      paginationLimit: 100
    };
    
    this.init();
  }
  
  async init() {
    console.log('[Popup] Initializing...');
    
    // Load saved configuration
    await this.loadConfig();
    
    // Update UI with config
    this.updateUI();
    
    // Check if we're on a Kayako page
    await this.checkStatus();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('[Popup] Ready');
  }
  
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['kayako_paginator_config']);
      if (result.kayako_paginator_config) {
        this.config = { ...this.config, ...result.kayako_paginator_config };
        console.log('[Popup] Config loaded:', this.config);
      }
    } catch (error) {
      console.error('[Popup] Error loading config:', error);
    }
  }
  
  async saveConfig() {
    try {
      await chrome.storage.local.set({
        kayako_paginator_config: this.config
      });
      console.log('[Popup] Config saved:', this.config);
      
      // Try to send message to content script to update the injected script
      await this.notifyContentScript();
    } catch (error) {
      console.error('[Popup] Error saving config:', error);
    }
  }
  
  async notifyContentScript() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateConfig',
          config: this.config
        });
      }
    } catch (error) {
      // Ignore - content script might not be loaded yet
      console.log('[Popup] Could not notify content script:', error.message);
    }
  }
  
  updateUI() {
    // Update pagination limit selector
    const limitSelect = document.getElementById('pagination-limit');
    if (limitSelect) {
      limitSelect.value = this.config.paginationLimit;
    }
  }
  
  async checkStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      const statusDot = document.querySelector('.dot');
      const statusText = document.getElementById('status-text');
      
      if (!currentTab || !currentTab.url) {
        this.setStatus('Unknown', false);
        return;
      }
      
      // Check if on supported domain
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
      
      const isOnKayako = supportedDomains.some(domain => currentTab.url.includes(domain));
      
      if (isOnKayako) {
        this.setStatus('Active', true);
        // Try to get stats
        await this.refreshStats();
      } else {
        this.setStatus('Not on Kayako page', false);
      }
    } catch (error) {
      console.error('[Popup] Error checking status:', error);
      this.setStatus('Error', false);
    }
  }
  
  setStatus(text, isActive) {
    const statusDot = document.querySelector('.dot');
    const statusText = document.getElementById('status-text');
    
    if (statusText) {
      statusText.textContent = text;
    }
    
    if (statusDot) {
      statusDot.classList.remove('active', 'error');
      if (isActive) {
        statusDot.classList.add('active');
      } else if (text === 'Error') {
        statusDot.classList.add('error');
      }
    }
  }
  
  async refreshStats() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) return;
      
      // Execute script to get stats from the page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          if (window.__KayakoPaginator__ && window.__KayakoPaginator__.stats) {
            return window.__KayakoPaginator__.stats();
          }
          return null;
        }
      });
      
      if (results && results[0] && results[0].result) {
        const stats = results[0].result;
        console.log('[Popup] Stats:', stats);
        
        // Update stats UI
        document.getElementById('stat-intercepted').textContent = stats.intercepted || 0;
        document.getElementById('stat-modified').textContent = stats.modified || 0;
        document.getElementById('stat-total').textContent = stats.total || 0;
        
        // Show stats section
        document.getElementById('stats-section').style.display = 'block';
      }
    } catch (error) {
      console.log('[Popup] Could not get stats:', error.message);
      // Don't show error to user - extension might not be loaded yet
    }
  }
  
  setupEventListeners() {
    // Pagination limit selector
    const limitSelect = document.getElementById('pagination-limit');
    if (limitSelect) {
      limitSelect.addEventListener('change', async (e) => {
        this.config.paginationLimit = parseInt(e.target.value);
        await this.saveConfig();
        
        // Show brief success message
        this.showNotification('Settings saved! Reload the page to apply.');
      });
    }
    
    // Refresh stats button
    const refreshBtn = document.getElementById('refresh-stats');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshStats();
      });
    }
  }
  
  showNotification(message) {
    // Simple notification using browser's built-in alert for now
    // Could be enhanced with custom toast notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KayakoPaginatorPopup();
});

