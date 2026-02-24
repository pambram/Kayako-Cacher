// Kayako AI Text Enhancer - Popup Script

class PopupManager {
  constructor() {
    this.config = null;
    this.templates = [];
    this.editingTemplateId = null;
    this.init();
  }

  async init() {
    console.log('Popup initializing...');
    
    // Load current configuration
    await this.loadConfig();
    
    // Load templates
    await this.loadTemplates();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update UI with current config
    this.updateUI();
    
    // Check extension status
    this.checkStatus();
    
    // Initialize help section (collapsed by default)
    this.initHelpSection();
    
    // Initialize templates section (collapsed by default)
    this.initTemplatesSection();
    
    // Initialize experimental section (collapsed by default)
    this.initExperimentalSection();
    
    console.log('Popup initialized');
  }
  
  async loadTemplates() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTemplates' });
      if (response.success) {
        this.templates = response.templates || [];
        this.renderTemplates();
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }
  
  initTemplatesSection() {
    const content = document.getElementById('templatesContent');
    const icon = document.querySelector('#templatesToggle .collapse-icon');
    content.style.display = 'none';
    icon.textContent = '▶';
  }

  initHelpSection() {
    const helpContent = document.getElementById('helpContent');
    const helpIcon = document.querySelector('.help-toggle-icon');
    
    // Start collapsed
    helpContent.style.display = 'none';
    helpIcon.textContent = '▶';
  }
  
  initExperimentalSection() {
    const content = document.getElementById('experimentalContent');
    const icon = document.querySelector('#experimentalToggle .collapse-icon');
    content.style.display = 'none';
    icon.textContent = '▶';
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response.success) {
        this.config = response.config;
        // console.log('Config loaded:', this.config);
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

    // Provider selection
    document.getElementById('provider').addEventListener('change', (e) => {
      this.toggleProviderFields(e.target.value);
      this.saveConfig();
    });

    // Live validation for API keys
    document.getElementById('openaiKey').addEventListener('input', (e) => {
      const value = e.target.value;
      const isValid = value.startsWith('sk-') && value.length > 10;
      e.target.style.borderColor = isValid ? '#28a745' : '#e9ecef';
    });
    document.getElementById('anthropicKey').addEventListener('input', (e) => {
      const value = e.target.value;
      const isValid = value.startsWith('sk-ant-') && value.length > 10;
      e.target.style.borderColor = isValid ? '#28a745' : '#e9ecef';
    });

    // Auto-save ticket context state
    document.getElementById('useTicketContext').addEventListener('change', () => {
      this.saveConfig();
    });

    // Auto-save experimental features toggles
    document.getElementById('enableUrlFetch').addEventListener('change', () => {
      this.saveConfig();
    });
    document.getElementById('enableWebSearch').addEventListener('change', () => {
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
    
    // Toggle templates section
    document.getElementById('templatesToggle').addEventListener('click', () => {
      this.toggleTemplatesSection();
    });
    
    // Toggle experimental section
    document.getElementById('experimentalToggle').addEventListener('click', () => {
      this.toggleExperimentalSection();
    });
    
    // Add new template
    document.getElementById('addTemplate').addEventListener('click', () => {
      this.openTemplateModal(null);
    });
    
    // Sort templates alphabetically
    document.getElementById('sortTemplates').addEventListener('click', () => {
      this.sortTemplatesAlphabetically();
    });
    
    // Template modal actions
    document.getElementById('closeTemplateModal').addEventListener('click', () => {
      this.closeTemplateModal();
    });
    document.getElementById('cancelTemplateEdit').addEventListener('click', () => {
      this.closeTemplateModal();
    });
    document.getElementById('saveTemplate').addEventListener('click', () => {
      this.saveTemplateFromModal();
    });
    document.getElementById('deleteTemplate').addEventListener('click', () => {
      this.deleteCurrentTemplate();
    });
    
    // Close modal on backdrop click
    document.getElementById('templateModal').addEventListener('click', (e) => {
      if (e.target.id === 'templateModal') {
        this.closeTemplateModal();
      }
    });
  }

  updateUI() {
    if (!this.config) return;

    // Migrate old config if needed
    if (this.config.apiKey && !this.config.openaiKey) {
      this.config.openaiKey = this.config.apiKey;
    }

    // Update form fields
    const provider = this.config.provider || 'openai';
    document.getElementById('provider').value = provider;
    document.getElementById('openaiKey').value = this.config.openaiKey || '';
    document.getElementById('anthropicKey').value = this.config.anthropicKey || '';
    document.getElementById('model').value = this.config.model || 'gpt-5.2';
    document.getElementById('useTicketContext').checked = this.config.useTicketContext === true;
    document.getElementById('systemPrompt').value = this.config.systemPrompt || '';
    document.getElementById('temperature').value = this.config.temperature || '0.7';
    
    // Context size limit
    document.getElementById('maxContextChars').value = this.config.maxContextChars || '60000';

    // Update experimental features
    document.getElementById('tavilyKey').value = this.config.tavilyKey || '';
    document.getElementById('enableUrlFetch').checked = this.config.enableUrlFetch === true;
    document.getElementById('enableWebSearch').checked = this.config.enableWebSearch === true;
    document.getElementById('threeSixtyRulesUrl').value = this.config.threeSixtyRulesUrl || '';

    // Show/hide provider-specific fields
    this.toggleProviderFields(provider);

    // Update API key field styling
    const apiKeyField = document.getElementById(provider === 'openai' ? 'openaiKey' : 'anthropicKey');
    const key = provider === 'openai' ? this.config.openaiKey : this.config.anthropicKey;
    if (key) {
      const isValid = key.startsWith('sk-') && key.length > 10;
      apiKeyField.style.borderColor = isValid ? '#28a745' : '#dc3545';
    }

    // Show/hide temperature control based on current model
    this.toggleTemperatureVisibility(this.config.model || 'gpt-5.2');
  }

  toggleProviderFields(provider) {
    const openaiGroup = document.getElementById('openaiKeyGroup');
    const anthropicGroup = document.getElementById('anthropicKeyGroup');
    const openaiModels = document.getElementById('openaiModels');
    const claudeModels = document.getElementById('claudeModels');

    if (provider === 'openai') {
      openaiGroup.style.display = 'block';
      anthropicGroup.style.display = 'none';
      openaiModels.style.display = '';
      claudeModels.style.display = 'none';
    } else {
      openaiGroup.style.display = 'none';
      anthropicGroup.style.display = 'block';
      openaiModels.style.display = 'none';
      claudeModels.style.display = '';
    }
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
  
  toggleTemplatesSection() {
    const content = document.getElementById('templatesContent');
    const icon = document.querySelector('#templatesToggle .collapse-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.textContent = '▼';
    } else {
      content.style.display = 'none';
      icon.textContent = '▶';
    }
  }
  
  toggleExperimentalSection() {
    const content = document.getElementById('experimentalContent');
    const icon = document.querySelector('#experimentalToggle .collapse-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.textContent = '▼';
    } else {
      content.style.display = 'none';
      icon.textContent = '▶';
    }
  }
  
  renderTemplates() {
    const container = document.getElementById('templatesList');
    
    if (!this.templates || this.templates.length === 0) {
      container.innerHTML = '<div class="templates-empty">No custom templates yet. The default template from your Kayako editor will be used.</div>';
      return;
    }
    
    container.innerHTML = this.templates.map((t, index) => `
      <div class="template-item" data-id="${t.id}" data-index="${index}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="template-info">
          <div class="template-name">${this.escapeHtml(t.name)}</div>
        </div>
        <div class="template-actions">
          <button class="btn-icon edit-template" data-id="${t.id}" title="Edit">✏️</button>
        </div>
      </div>
    `).join('');
    
    // Add click handlers for edit buttons
    container.querySelectorAll('.edit-template').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.dataset.id;
        this.openTemplateModal(id);
      });
    });
    
    // Also allow clicking the template info to edit (but not drag handle)
    container.querySelectorAll('.template-info').forEach(info => {
      info.addEventListener('click', (e) => {
        const item = info.closest('.template-item');
        const id = item.dataset.id;
        this.openTemplateModal(id);
      });
    });
    
    // Drag and drop reordering
    this.setupDragAndDrop(container);
  }
  
  setupDragAndDrop(container) {
    let draggedItem = null;
    let draggedIndex = null;
    
    container.querySelectorAll('.template-item').forEach(item => {
      // Only allow drag from the handle
      item.querySelector('.drag-handle').addEventListener('mousedown', () => {
        item.setAttribute('draggable', 'true');
      });
      
      item.addEventListener('mouseup', () => {
        // Keep draggable for the drag operation
      });
      
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.id);
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        container.querySelectorAll('.template-item').forEach(i => {
          i.classList.remove('drag-over');
        });
        draggedItem = null;
        draggedIndex = null;
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (item !== draggedItem) {
          item.classList.add('drag-over');
        }
      });
      
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });
      
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        
        if (item === draggedItem) return;
        
        const targetIndex = parseInt(item.dataset.index);
        
        // Reorder templates array
        const [movedTemplate] = this.templates.splice(draggedIndex, 1);
        this.templates.splice(targetIndex, 0, movedTemplate);
        
        // Save and re-render
        await this.saveTemplatesOrder();
        this.renderTemplates();
      });
    });
  }
  
  async saveTemplatesOrder() {
    try {
      await chrome.runtime.sendMessage({
        action: 'saveTemplates',
        templates: this.templates
      });
    } catch (error) {
      console.error('Error saving template order:', error);
    }
  }
  
  async sortTemplatesAlphabetically() {
    this.templates.sort((a, b) => a.name.localeCompare(b.name));
    await this.saveTemplatesOrder();
    this.renderTemplates();
    this.showSuccess('Templates sorted alphabetically');
  }
  
  openTemplateModal(templateId) {
    this.editingTemplateId = templateId;
    const modal = document.getElementById('templateModal');
    const title = document.getElementById('templateModalTitle');
    const deleteBtn = document.getElementById('deleteTemplate');
    
    if (templateId) {
      // Editing existing template
      const template = this.templates.find(t => t.id === templateId);
      if (!template) return;
      
      title.textContent = 'Edit Template';
      document.getElementById('templateName').value = template.name;
      document.getElementById('templateText').value = template.template;
      deleteBtn.style.display = 'block';
    } else {
      // Adding new template
      title.textContent = 'Add New Template';
      document.getElementById('templateName').value = '';
      document.getElementById('templateText').value = '';
      deleteBtn.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    document.getElementById('templateName').focus();
  }
  
  closeTemplateModal() {
    document.getElementById('templateModal').style.display = 'none';
    this.editingTemplateId = null;
  }
  
  async saveTemplateFromModal() {
    const name = document.getElementById('templateName').value.trim();
    const template = document.getElementById('templateText').value.trim();
    
    if (!name) {
      this.showError('Please enter a template name');
      return;
    }
    
    if (!template) {
      this.showError('Please enter the template content');
      return;
    }
    
    const id = this.editingTemplateId || this.generateTemplateId(name);
    
    const templateObj = { id, name, template };
    
    if (this.editingTemplateId) {
      // Update existing
      const index = this.templates.findIndex(t => t.id === this.editingTemplateId);
      if (index >= 0) {
        this.templates[index] = templateObj;
      }
    } else {
      // Add new
      this.templates.push(templateObj);
    }
    
    // Save to storage
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveTemplates',
        templates: this.templates
      });
      
      if (response.success) {
        this.renderTemplates();
        this.closeTemplateModal();
        this.showSuccess('Template saved successfully!');
      } else {
        this.showError('Failed to save template: ' + response.error);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      this.showError('Failed to save template');
    }
  }
  
  async deleteCurrentTemplate() {
    if (!this.editingTemplateId) return;
    
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    this.templates = this.templates.filter(t => t.id !== this.editingTemplateId);
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveTemplates',
        templates: this.templates
      });
      
      if (response.success) {
        this.renderTemplates();
        this.closeTemplateModal();
        this.showSuccess('Template deleted');
      } else {
        this.showError('Failed to delete template: ' + response.error);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      this.showError('Failed to delete template');
    }
  }
  
  generateTemplateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async saveConfig() {
    try {
      const provider = document.getElementById('provider').value;
      const newConfig = {
        provider: provider,
        openaiKey: document.getElementById('openaiKey').value.trim(),
        anthropicKey: document.getElementById('anthropicKey').value.trim(),
        // Keep old apiKey for backward compatibility
        apiKey: provider === 'openai' ? document.getElementById('openaiKey').value.trim() : document.getElementById('anthropicKey').value.trim(),
        model: document.getElementById('model').value,
        enabled: true,
        useTicketContext: document.getElementById('useTicketContext').checked,
        systemPrompt: document.getElementById('systemPrompt').value.trim(),
        temperature: parseFloat(document.getElementById('temperature').value),
        // Context size limit
        maxContextChars: parseInt(document.getElementById('maxContextChars').value) || 60000,
        // Experimental features
        tavilyKey: document.getElementById('tavilyKey').value.trim(),
        enableUrlFetch: document.getElementById('enableUrlFetch').checked,
        enableWebSearch: document.getElementById('enableWebSearch').checked,
        threeSixtyRulesUrl: document.getElementById('threeSixtyRulesUrl').value.trim()
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
