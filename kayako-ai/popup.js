// Kayako AI Text Enhancer - Popup Script

class PopupManager {
  constructor() {
    this.config = null;
    this.init();
  }

  async init() {
    console.log('Popup initializing...');
    
    // Load current configuration
    await this.loadConfig();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update UI with current config
    this.updateUI();
    
    // Check extension status
    this.checkStatus();
    
    // Initialize help section (collapsed by default)
    this.initHelpSection();
    
    console.log('Popup initialized');
  }

  initHelpSection() {
    const helpContent = document.getElementById('helpContent');
    const helpIcon = document.querySelector('.help-toggle-icon');
    
    // Start collapsed
    helpContent.style.display = 'none';
    helpIcon.textContent = '▶';
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response.success) {
        this.config = response.config;
        console.log('Config loaded:', this.config);
      } else {
        console.error('Failed to load config:', response.error);
        this.showError('Failed to load configuration');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.showError('Failed to communicate with extension');
    }
  }

  setupEventListeners() {
    // Save configuration
    document.getElementById('saveConfig').addEventListener('click', () => {
      this.saveConfig();
    });

    // Test API connection
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });

    // Refresh current page
    document.getElementById('refreshPage').addEventListener('click', () => {
      this.refreshCurrentTab();
    });

    // Live validation for API key
    document.getElementById('apiKey').addEventListener('input', (e) => {
      const value = e.target.value;
      const isValid = value.startsWith('sk-') && value.length > 10;
      e.target.style.borderColor = isValid ? '#28a745' : '#e9ecef';
    });

    // Auto-save ticket context state
    document.getElementById('useTicketContext').addEventListener('change', () => {
      this.saveConfig();
    });

    // Show/hide temperature control based on model selection
    document.getElementById('model').addEventListener('change', (e) => {
      this.toggleTemperatureVisibility(e.target.value);
    });

    // Toggle help section
    document.getElementById('helpToggle').addEventListener('click', () => {
      this.toggleHelpSection();
    });
  }

  updateUI() {
    if (!this.config) return;

    // Update form fields
    document.getElementById('apiKey').value = this.config.apiKey || '';
    document.getElementById('model').value = this.config.model || 'gpt-5-mini';
    document.getElementById('useTicketContext').checked = this.config.useTicketContext === true;
    document.getElementById('systemPrompt').value = this.config.systemPrompt || '';
    document.getElementById('temperature').value = this.config.temperature || '0.7';

    // Update API key field styling
    const apiKeyField = document.getElementById('apiKey');
    if (this.config.apiKey) {
      const isValid = this.config.apiKey.startsWith('sk-') && this.config.apiKey.length > 10;
      apiKeyField.style.borderColor = isValid ? '#28a745' : '#dc3545';
    }

    // Show/hide temperature control based on current model
    this.toggleTemperatureVisibility(this.config.model || 'gpt-5-mini');
  }

  toggleTemperatureVisibility(model) {
    const temperatureGroup = document.getElementById('temperatureGroup');
    const temperatureSelect = document.getElementById('temperature');
    const gpt5Warning = document.getElementById('gpt5Warning');

    if (model && model.startsWith('gpt-5')) {
      // GPT-5 models don't support custom temperature
      temperatureSelect.disabled = true;
      temperatureSelect.style.opacity = '0.6';
      gpt5Warning.style.display = 'block';
    } else {
      // Other models support temperature
      temperatureSelect.disabled = false;
      temperatureSelect.style.opacity = '1';
      gpt5Warning.style.display = 'none';
    }
  }

  toggleHelpSection() {
    const helpContent = document.getElementById('helpContent');
    const helpIcon = document.querySelector('.help-toggle-icon');
    
    if (helpContent.style.display === 'none') {
      helpContent.style.display = 'block';
      helpIcon.textContent = '▼';
    } else {
      helpContent.style.display = 'none'; 
      helpIcon.textContent = '▶';
    }
  }

  async saveConfig() {
    try {
      const newConfig = {
        apiKey: document.getElementById('apiKey').value.trim(),
        model: document.getElementById('model').value,
        enabled: true, // Always enabled - remove if you want to disable
        useTicketContext: document.getElementById('useTicketContext').checked,
        systemPrompt: document.getElementById('systemPrompt').value.trim(),
        temperature: parseFloat(document.getElementById('temperature').value),
        provider: 'openai' // Currently only supporting OpenAI
      };

      const response = await chrome.runtime.sendMessage({
        action: 'updateConfig',
        config: newConfig
      });

      if (response.success) {
        this.config = newConfig;
        this.showSuccess('Configuration saved successfully!');
        
        // Update status after save
        setTimeout(() => this.checkStatus(), 500);
      } else {
        this.showError('Failed to save configuration: ' + response.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      this.showError('Failed to save configuration');
    }
  }

  async testConnection() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;

    if (!apiKey) {
      this.showError('Please enter your API key first');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.showError('Invalid API key format. OpenAI keys start with "sk-"');
      return;
    }

    this.showLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testConnection',
        config: { apiKey, model }
      });

      this.showLoading(false);

      if (response.success) {
        this.showSuccess(`✅ Connection successful!\nModel: ${response.model || model}`);
      } else {
        this.showError('Connection failed: ' + response.error);
      }
    } catch (error) {
      this.showLoading(false);
      console.error('Error testing connection:', error);
      this.showError('Connection test failed');
    }
  }

  async checkStatus() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !this.isKayakoTab(tab.url)) {
        document.getElementById('extensionStatus').textContent = 'Not on Kayako page';
        document.getElementById('extensionStatus').className = 'status-value error';
        return;
      }

      // Try to get status from content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      
      if (response.success) {
        document.getElementById('extensionStatus').textContent = 'Active';
        document.getElementById('extensionStatus').className = 'status-value';
      } else {
        document.getElementById('extensionStatus').textContent = 'Not loaded';
        document.getElementById('extensionStatus').className = 'status-value error';
      }
    } catch (error) {
      console.log('Status check error (expected on non-Kayako pages):', error);
      document.getElementById('extensionStatus').textContent = 'Not available';
      document.getElementById('extensionStatus').className = 'status-value error';
    }
  }

  isKayakoTab(url) {
    if (!url) return false;
    
    const kayakoDomains = [
      'kayako.com/agent',
      'gfi.com/agent',
      'aurea.com/agent',
      'ignitetech.com/agent',
      'crossover.com/agent',
      'totogi.com/agent',
      'alpha.school/agent',
      'cloudsense.com/agent',
      'kandy.io/agent',
      'dnnsupport.dnnsoftware.com/agent',
      'csai.trilogy.com/agent'
    ];

    return kayakoDomains.some(domain => url.includes(domain));
  }

  async refreshCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.reload(tab.id);
        this.showSuccess('Page refreshed!');
        
        // Close popup after refreshing
        setTimeout(() => window.close(), 1000);
      }
    } catch (error) {
      console.error('Error refreshing tab:', error);
      this.showError('Failed to refresh page');
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Remove existing notifications
    const existing = document.querySelector('.popup-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `popup-notification ${type}`;
    notification.textContent = message;

    // Style the notification
    const colors = {
      success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
      error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' }
    };

    const color = colors[type] || colors.error;

    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 20px;
      right: 20px;
      background: ${color.bg};
      color: ${color.text};
      border: 1px solid ${color.border};
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1001;
      animation: slideDown 0.3s ease-out;
      white-space: pre-line;
      max-height: 100px;
      overflow-y: auto;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after delay
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }
    }, type === 'error' ? 5000 : 3000);
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
  });
} else {
  new PopupManager();
}
