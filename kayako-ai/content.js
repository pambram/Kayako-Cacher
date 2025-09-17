// Kayako AI Text Enhancer - Content Script
// Adds AI enhancement buttons to Froala editors

class KayakoAIEnhancer {
  constructor() {
    this.config = null;
    this.isProcessing = false;
    this.init();
  }

  async init() {
    console.log('🤖 Kayako AI Text Enhancer initializing on:', window.location.href);
    
    try {
      // Load configuration
      await this.loadConfig();
      console.log('✅ Config loaded:', this.config);
      
      // Wait for page to stabilize
      await this.waitForPageReady();
      
      // Check if we can find any editors
      const containers = document.querySelectorAll('.ko-text-editor__container_1p5g6r');
      const toolbars = document.querySelectorAll('.fr-toolbar');
      console.log(`🔍 Found ${containers.length} Kayako containers and ${toolbars.length} Froala toolbars`);
      
      // Set up observers for dynamic content
      this.setupObservers();
      
      // Initial enhancement of existing editors
      this.enhanceExistingEditors();
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts();
      
      console.log('🎉 Kayako AI Text Enhancer fully initialized');
      
      // Show success notification
      this.showNotification('🤖 AI Text Enhancer loaded successfully', 'success');
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.showNotification('❌ AI Enhancement failed to initialize: ' + error.message, 'error');
    }
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['kayakoAIConfig']);
      this.config = result.kayakoAIConfig || {
        apiKey: '',
        provider: 'openai', // openai, anthropic, etc
        model: 'gpt-5-mini',
        enabled: true
      };
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = { enabled: false };
    }
  }

  async waitForPageReady() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }

  setupObservers() {
    // Observe DOM changes to catch dynamically loaded editors
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.classList?.contains('ko-text-editor__container_1p5g6r') ||
                node.querySelector?.('.ko-text-editor__container_1p5g6r') ||
                node.classList?.contains('ko-text-editor__header_1p5g6r') ||
                node.querySelector?.('.ko-text-editor__header_1p5g6r')) {
              shouldCheck = true;
            }
          }
        });
        }
      });
      
      if (shouldCheck) {
        // Debounce to avoid excessive calls
        clearTimeout(this.enhanceTimeout);
        this.enhanceTimeout = setTimeout(() => {
          this.enhanceExistingEditors();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  enhanceExistingEditors() {
    // Find all Kayako text editor containers that haven't been enhanced yet
    const containers = document.querySelectorAll('.ko-text-editor__container_1p5g6r');
    
    console.log(`🔍 Found ${containers.length} Kayako text editor containers`);
    
    containers.forEach(container => {
      // Look for Kayako toolbar header within the container (not the hidden Froala one)
      const kayakoHeader = container.querySelector('.ko-text-editor__header_1p5g6r:not([data-ai-enhanced])');
      if (kayakoHeader) {
        console.log('🎯 Found Kayako toolbar header in container');
        this.enhanceKayakoToolbar(kayakoHeader, container);
      }
    });
  }

  enhanceKayakoToolbar(kayakoHeader, container) {
    if (kayakoHeader.dataset.aiEnhanced || !this.config?.enabled) {
      return;
    }

    console.log('🔧 Enhancing Kayako toolbar with AI buttons');

    // Mark as enhanced to avoid duplicate processing
    kayakoHeader.dataset.aiEnhanced = 'true';

    // Find the editor instance (Froala editor within the container)
    const editorWrapper = container.querySelector('.fr-element');
    if (!editorWrapper) {
      console.warn('⚠️ Could not find Froala editor element in container');
      return;
    }

    // Create AI button group styled for Kayako
    const aiButtonGroup = this.createKayakoAIButton(editorWrapper);
    
    // Find a good place to insert the button - look for existing button groups
    const buttonGroups = kayakoHeader.querySelectorAll('.ko-text-editor__group_1p5g6r');
    if (buttonGroups.length > 0) {
      // Add to the last button group
      const lastGroup = buttonGroups[buttonGroups.length - 1];
      console.log('🔧 Adding AI button to last Kayako button group');
      lastGroup.appendChild(aiButtonGroup);
    } else {
      console.log('🔧 Adding AI button to end of Kayako header');
      kayakoHeader.appendChild(aiButtonGroup);
    }
    
    // Debug: Check if button was added
    const addedButton = kayakoHeader.querySelector('.kayako-ai-dropdown');
    if (addedButton) {
      console.log('✅ AI button successfully added to Kayako toolbar:', addedButton);
      console.log('✅ Button visible:', addedButton.offsetWidth > 0 && addedButton.offsetHeight > 0);
      
      const styles = window.getComputedStyle(addedButton);
      console.log('🔍 Button styles:', {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        width: addedButton.offsetWidth + 'px',
        height: addedButton.offsetHeight + 'px'
      });
      
    } else {
      console.error('❌ AI button not found after insertion');
    }
  }

  createKayakoAIButton(editorElement) {
    // Create button wrapper to match Kayako's style
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'ko-text-editor__item_1p5g6r ko-text-editor__itemWrap_1p5g6r kayako-ai-wrapper';
    
    // Define AI enhancement actions
    const actions = [
      {
        id: 'polish',
        icon: '✨',
        title: 'Polish',
        prompt: 'Polish and improve the following text while maintaining its original meaning and tone:'
      },
      {
        id: 'formalize',
        icon: '👔',
        title: 'Formalize',
        prompt: 'Rewrite the following text to be more formal and professional:'
      },
      {
        id: 'elaborate',
        icon: '📝',
        title: 'Elaborate',
        prompt: 'Expand and elaborate on the following text with more details and context:'
      },
      {
        id: 'shorten',
        icon: '✂️',
        title: 'Shorten',
        prompt: 'Rewrite the following text to be more concise while keeping the key information:'
      },
      {
        id: 'help_write',
        icon: '✍️',
        title: 'Help me write',
        prompt: 'custom' // Special marker for custom prompt handling
      }
    ];

    // Create dropdown button styled like Kayako buttons  
    const dropdownButton = document.createElement('button');
    dropdownButton.type = 'button';
    dropdownButton.className = 'kayako-ai-dropdown';
    dropdownButton.title = 'AI Text Enhancement';
    dropdownButton.innerHTML = '🤖';
    dropdownButton.setAttribute('aria-label', 'AI Text Enhancement');

    // Create dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'kayako-ai-dropdown-menu';
    dropdownMenu.style.display = 'none';

    // Add action buttons to dropdown
    actions.forEach((action, index) => {
      // Add separator before "Help me write" (like Gmail)
      if (action.id === 'help_write') {
        const separator = document.createElement('div');
        separator.className = 'kayako-ai-dropdown-separator';
        dropdownMenu.appendChild(separator);
      }
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kayako-ai-action-btn';
      button.dataset.action = action.id;
      button.innerHTML = `${action.icon} ${action.title}`;
      button.title = action.title;
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (action.id === 'help_write') {
          this.showCustomPromptModal(editorElement);
        } else {
          this.handleAIAction(action, editorElement);
        }
        
        dropdownMenu.style.display = 'none';
      });
      
      dropdownMenu.appendChild(button);
    });

    // Toggle dropdown on button click
    dropdownButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isVisible = dropdownMenu.style.display === 'block';
      
      // Hide all other dropdowns first
      document.querySelectorAll('.kayako-ai-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
      });
      
      if (!isVisible) {
        // Calculate available space and adjust dropdown height
        this.adjustDropdownSize(dropdownMenu, dropdownButton);
        dropdownMenu.style.display = 'block';
      } else {
        dropdownMenu.style.display = 'none';
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!buttonWrapper.contains(e.target)) {
        dropdownMenu.style.display = 'none';
      }
    });

    buttonWrapper.appendChild(dropdownButton);
    buttonWrapper.appendChild(dropdownMenu);

    return buttonWrapper;
  }

  async handleAIAction(action, editorElement) {
    if (this.isProcessing) {
      this.showNotification('⏳ Already processing, please wait...', 'warning');
      return;
    }

    if (!this.config?.apiKey) {
      this.showNotification('❌ Please configure your AI API key in the extension settings', 'error');
      return;
    }

    const textData = this.getEditorText(editorElement);
    if (!textData.extractedText || textData.extractedText.trim().length === 0) {
      this.showNotification('❌ No text found to enhance', 'error');
      return;
    }

    console.log(`🤖 Processing AI action: ${action.id} on text:`, textData.extractedText.substring(0, 100) + '...');

    this.isProcessing = true;
    this.showNotification(`🤖 ${action.title}...`, 'info');

    try {
      const enhancedText = await this.callAI(action.prompt, textData.extractedText);
      
      if (enhancedText && enhancedText !== textData.extractedText) {
        // Show preview with Insert/Cancel options instead of direct replacement
        this.showAIPreview(editorElement, textData, enhancedText, action.title);
      } else {
        this.showNotification('❌ No enhancement was generated', 'error');
      }
    } catch (error) {
      console.error('AI processing error:', error);
      this.showNotification(`❌ AI enhancement failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  getEditorText(editorElement) {
    // Try different methods to get text content from Froala
    let fullText = '';
    if (editorElement.innerText) {
      fullText = editorElement.innerText.trim();
    } else if (editorElement.textContent) {
      fullText = editorElement.textContent.trim();
    } else {
      // Fallback to getting text from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editorElement.innerHTML;
      fullText = tempDiv.textContent || tempDiv.innerText || '';
    }

    // Look for PR template pattern
    return this.extractFromTemplate(fullText);
  }

  extractFromTemplate(text) {
    console.log('🔍 Full text content for template detection:', JSON.stringify(text));
    
    // Look for the PR template pattern - more flexible with whitespace
    const prPattern = /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Best\s+regards,/i;
    const match = text.match(prPattern);
    
    console.log('🔍 Regex match result:', match);
    
    if (match && match[1]) {
      const extractedText = match[1].trim();
      console.log('🎯 Extracted text from PR template:', extractedText);
      
      // Find the positions more carefully
      const beforeMatch = text.substring(0, match.index);
      const questionPart = match[0].substring(0, match[0].indexOf(match[1]));
      const afterMatch = text.substring(match.index + match[0].length);
      
      return {
        hasTemplate: true,
        extractedText: extractedText,
        fullText: text,
        beforeText: beforeMatch + questionPart,
        afterText: '\n\nBest regards,' + afterMatch
      };
    }
    
    console.log('📝 No PR template found, using full text');
    console.log('🔍 Text length:', text.length, 'Text preview:', text.substring(0, 200));
    return {
      hasTemplate: false,
      extractedText: text,
      fullText: text
    };
  }

  setEditorText(editorElement, textData, newText) {
    let finalText;
    
    if (textData.hasTemplate) {
      // Replace only the content between template markers
      finalText = textData.beforeText + newText + textData.afterText;
    } else {
      // Replace entire text
      finalText = newText;
    }
    
    // Set the text content in the Froala editor
    editorElement.innerHTML = finalText.replace(/\n/g, '<br>');
    
    // Trigger input event to notify Froala of the change
    const inputEvent = new Event('input', { bubbles: true });
    editorElement.dispatchEvent(inputEvent);
    
    // Also try to trigger Froala's change event
    const changeEvent = new Event('fr-change', { bubbles: true });
    editorElement.dispatchEvent(changeEvent);
  }

  showAIPreview(editorElement, originalTextData, enhancedText, actionTitle) {
    // Remove any existing preview
    const existingPreview = document.querySelector('.kayako-ai-preview');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'kayako-ai-preview';
    
    preview.innerHTML = `
      <div class="ai-preview-header">
        <span class="ai-preview-title">✨ AI Enhanced (${actionTitle})</span>
        <button class="ai-preview-close" type="button">×</button>
      </div>
      <div class="ai-preview-content">
        <div class="ai-preview-section">
          <div class="ai-preview-label">Original:</div>
          <div class="ai-preview-text ai-preview-original">${originalTextData.extractedText}</div>
        </div>
        <div class="ai-preview-section">
          <div class="ai-preview-label">Enhanced:</div>
          <div class="ai-preview-text ai-preview-enhanced">${enhancedText}</div>
        </div>
      </div>
      <div class="ai-preview-actions">
        <button class="ai-preview-btn ai-preview-cancel" type="button">Cancel</button>
        <button class="ai-preview-btn ai-preview-insert" type="button">Insert</button>
      </div>
    `;

    // Position near the editor
    const editorContainer = editorElement.closest('.ko-text-editor__container_1p5g6r');
    if (editorContainer) {
      editorContainer.appendChild(preview);
    } else {
      document.body.appendChild(preview);
    }

    // Add event listeners
    preview.querySelector('.ai-preview-close').addEventListener('click', () => {
      preview.remove();
    });

    preview.querySelector('.ai-preview-cancel').addEventListener('click', () => {
      preview.remove();
    });

    preview.querySelector('.ai-preview-insert').addEventListener('click', () => {
      this.setEditorText(editorElement, originalTextData, enhancedText);
      this.showNotification(`✅ ${actionTitle} applied successfully`, 'success');
      preview.remove();
      
      // Highlight the new text briefly
      setTimeout(() => {
        this.highlightNewText(editorElement);
      }, 100);
    });
  }

  highlightNewText(editorElement) {
    // Add temporary highlight class
    editorElement.classList.add('kayako-ai-highlighted');
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      editorElement.classList.remove('kayako-ai-highlighted');
    }, 3000);
  }

  adjustDropdownSize(dropdownMenu, dropdownButton) {
    // Calculate available space below the button
    const buttonRect = dropdownButton.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - buttonRect.bottom - 20; // 20px buffer
    
    // Calculate natural height of dropdown content
    dropdownMenu.style.display = 'block';
    dropdownMenu.style.maxHeight = 'none';
    const naturalHeight = dropdownMenu.scrollHeight;
    dropdownMenu.style.display = 'none';
    
    console.log('🔍 Dropdown sizing:', {
      availableHeight,
      naturalHeight,
      buttonBottom: buttonRect.bottom,
      viewportHeight
    });
    
    // Set appropriate max-height with scrollbar if needed
    if (naturalHeight > availableHeight && availableHeight > 100) {
      dropdownMenu.style.maxHeight = Math.max(200, availableHeight) + 'px';
      console.log('📏 Dropdown will scroll, max-height set to:', dropdownMenu.style.maxHeight);
    } else {
      dropdownMenu.style.maxHeight = '300px'; // Default
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Option + Shift + H to open "Help me write" 
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        
        // Find the active editor (one that's focused or in a focused container)
        const activeEditor = this.findActiveEditor();
        if (activeEditor) {
          console.log('⌨️ Keyboard shortcut triggered: Help me write');
          this.showCustomPromptModal(activeEditor);
        } else {
          this.showNotification('⌨️ Place cursor in a text editor first', 'warning');
        }
      }
    });
    
    console.log('⌨️ Keyboard shortcuts registered (Option + Shift + H)');
  }

  findActiveEditor() {
    // Try to find the currently focused editor
    const focusedElement = document.activeElement;
    
    // Check if we're in a Froala editor
    if (focusedElement && focusedElement.classList.contains('fr-element')) {
      return focusedElement;
    }
    
    // Check if focus is within a Kayako text editor container
    const editorContainer = focusedElement?.closest('.ko-text-editor__container_1p5g6r');
    if (editorContainer) {
      const editor = editorContainer.querySelector('.fr-element');
      if (editor) return editor;
    }
    
    // Fallback: find the first visible editor on the page
    const allEditors = document.querySelectorAll('.ko-text-editor__container_1p5g6r .fr-element');
    for (const editor of allEditors) {
      const rect = editor.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return editor;
      }
    }
    
    return null;
  }

  showCustomPromptModal(editorElement) {
    // Remove any existing modal
    const existingModal = document.querySelector('.kayako-ai-custom-prompt');
    if (existingModal) {
      existingModal.remove();
    }

    // Create custom prompt modal
    const modal = document.createElement('div');
    modal.className = 'kayako-ai-custom-prompt';
    
    modal.innerHTML = `
      <div class="ai-custom-prompt-header">
        <span class="ai-custom-prompt-title">✍️ Help me write</span>
        <button class="ai-custom-prompt-close" type="button">×</button>
      </div>
      <div class="ai-custom-prompt-content">
        <div class="ai-custom-prompt-input-group">
          <label for="customPromptInput">What would you like help writing?</label>
          <textarea id="customPromptInput" placeholder="Describe what you want to write, e.g., 'Write a professional follow-up email asking for a project update'" rows="3"></textarea>
        </div>
      </div>
      <div class="ai-custom-prompt-actions">
        <button class="ai-custom-prompt-btn ai-custom-prompt-cancel" type="button">Cancel</button>
        <button class="ai-custom-prompt-btn ai-custom-prompt-generate" type="button">Generate</button>
      </div>
    `;

    // Position the modal
    document.body.appendChild(modal);

    // Focus the textarea
    setTimeout(() => {
      modal.querySelector('#customPromptInput').focus();
    }, 100);

    // Add event listeners
    modal.querySelector('.ai-custom-prompt-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.ai-custom-prompt-cancel').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.ai-custom-prompt-generate').addEventListener('click', () => {
      const customPrompt = modal.querySelector('#customPromptInput').value.trim();
      if (customPrompt) {
        modal.remove();
        this.handleCustomPrompt(customPrompt, editorElement);
      } else {
        this.showNotification('Please enter a prompt', 'warning');
      }
    });

    // Handle Enter key in textarea
    modal.querySelector('#customPromptInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        modal.querySelector('.ai-custom-prompt-generate').click();
      }
    });
  }

  async handleCustomPrompt(customPrompt, editorElement) {
    if (this.isProcessing) {
      this.showNotification('⏳ Already processing, please wait...', 'warning');
      return;
    }

    if (!this.config?.apiKey) {
      this.showNotification('❌ Please configure your AI API key in the extension settings', 'error');
      return;
    }

    console.log(`🤖 Processing custom prompt:`, customPrompt);

    this.isProcessing = true;
    this.showNotification(`🤖 Generating content...`, 'info');

    try {
      // For custom prompts, we don't extract from template - we generate new content
      const textData = this.getEditorText(editorElement);
      let contextText = textData.extractedText.trim();
      
      // If there's existing text, include it as context
      let fullPrompt = customPrompt;
      if (contextText) {
        fullPrompt = `${customPrompt}\n\nCurrent text for context:\n${contextText}`;
      }

      const generatedText = await this.callAI('Generate text based on the following request:', fullPrompt);
      
      if (generatedText) {
        // For custom prompts, show preview with option to replace or append
        this.showCustomWritePreview(editorElement, textData, generatedText, customPrompt, contextText);
      } else {
        this.showNotification('❌ No content was generated', 'error');
      }
    } catch (error) {
      console.error('Custom prompt error:', error);
      this.showNotification(`❌ Content generation failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  showCustomWritePreview(editorElement, originalTextData, generatedText, customPrompt, existingText) {
    // Remove any existing preview
    const existingPreview = document.querySelector('.kayako-ai-preview');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'kayako-ai-preview';
    
    const hasExistingText = existingText && existingText.length > 0;
    
    preview.innerHTML = `
      <div class="ai-preview-header">
        <span class="ai-preview-title">✍️ Generated Content</span>
        <button class="ai-preview-close" type="button">×</button>
      </div>
      <div class="ai-preview-content">
        <div class="ai-preview-section">
          <div class="ai-preview-label">Your request: "${customPrompt}"</div>
        </div>
        ${hasExistingText ? `
        <div class="ai-preview-section">
          <div class="ai-preview-label">Current text:</div>
          <div class="ai-preview-text ai-preview-original">${existingText}</div>
        </div>` : ''}
        <div class="ai-preview-section">
          <div class="ai-preview-label">Generated content:</div>
          <div class="ai-preview-text ai-preview-enhanced">${generatedText}</div>
        </div>
      </div>
      <div class="ai-preview-actions">
        <button class="ai-preview-btn ai-preview-cancel" type="button">Cancel</button>
        ${hasExistingText ? `
          <button class="ai-preview-btn ai-preview-append" type="button">Append</button>
          <button class="ai-preview-btn ai-preview-replace" type="button">Replace</button>
        ` : `
          <button class="ai-preview-btn ai-preview-insert" type="button">Insert</button>
        `}
      </div>
    `;

    // Position near the editor
    const editorContainer = editorElement.closest('.ko-text-editor__container_1p5g6r');
    if (editorContainer) {
      editorContainer.appendChild(preview);
    } else {
      document.body.appendChild(preview);
    }

    // Add event listeners
    preview.querySelector('.ai-preview-close').addEventListener('click', () => {
      preview.remove();
    });

    preview.querySelector('.ai-preview-cancel').addEventListener('click', () => {
      preview.remove();
    });

    // Handle insert/replace/append actions
    const insertBtn = preview.querySelector('.ai-preview-insert');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'insert');
        this.showNotification(`✅ Content inserted successfully`, 'success');
        preview.remove();
      });
    }

    const replaceBtn = preview.querySelector('.ai-preview-replace');
    if (replaceBtn) {
      replaceBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'replace');
        this.showNotification(`✅ Content replaced successfully`, 'success');
        preview.remove();
      });
    }

    const appendBtn = preview.querySelector('.ai-preview-append');
    if (appendBtn) {
      appendBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'append');
        this.showNotification(`✅ Content appended successfully`, 'success');
        preview.remove();
      });
    }
  }

  insertCustomText(editorElement, originalTextData, generatedText, action) {
    let finalText;
    
    if (action === 'insert' || !originalTextData.extractedText.trim()) {
      // Insert new content (for empty editor or explicit insert)
      if (originalTextData.hasTemplate) {
        finalText = originalTextData.beforeText + generatedText + originalTextData.afterText;
      } else {
        finalText = generatedText;
      }
    } else if (action === 'replace') {
      // Replace existing content
      if (originalTextData.hasTemplate) {
        finalText = originalTextData.beforeText + generatedText + originalTextData.afterText;
      } else {
        finalText = generatedText;
      }
    } else if (action === 'append') {
      // Append to existing content
      if (originalTextData.hasTemplate) {
        const appendedContent = originalTextData.extractedText + '\n\n' + generatedText;
        finalText = originalTextData.beforeText + appendedContent + originalTextData.afterText;
      } else {
        finalText = originalTextData.fullText + '\n\n' + generatedText;
      }
    }
    
    // Set the text content in the Froala editor
    editorElement.innerHTML = finalText.replace(/\n/g, '<br>');
    
    // Trigger input event to notify Froala of the change
    const inputEvent = new Event('input', { bubbles: true });
    editorElement.dispatchEvent(inputEvent);
    
    // Also try to trigger Froala's change event
    const changeEvent = new Event('fr-change', { bubbles: true });
    editorElement.dispatchEvent(changeEvent);
    
    // Highlight the new text briefly
    setTimeout(() => {
      this.highlightNewText(editorElement);
    }, 100);
  }

  async callAI(prompt, text) {
    const systemPrompt = this.config.systemPrompt || 'You are a helpful assistant that enhances text for customer support communications. Always maintain a professional and helpful tone. Return only the enhanced text without any explanations or additional commentary.';
    
    const model = this.config.model || 'gpt-5-mini';
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `${prompt}\n\nText to enhance:\n${text}`
        }
      ],
      max_completion_tokens: 2000
    };

    // Only add temperature for models that support it (not GPT-5)
    if (!model.startsWith('gpt-5')) {
      requestBody.temperature = this.config.temperature || 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received message:', message.action);
      
      switch (message.action) {
        case 'configUpdated':
          this.config = message.config;
          console.log('✅ Config updated in content script:', this.config);
          sendResponse({ success: true });
          break;
        case 'getStatus':
          sendResponse({
            success: true,
            status: {
              enhancedEditors: document.querySelectorAll('.ko-text-editor__header_1p5g6r[data-ai-enhanced]').length,
              isProcessing: this.isProcessing
            }
          });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.kayako-ai-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'kayako-ai-notification';
    notification.textContent = message;
    
    const colors = {
      success: { bg: '#28a745', text: '#fff' },
      error: { bg: '#dc3545', text: '#fff' },
      warning: { bg: '#ffc107', text: '#000' },
      info: { bg: '#17a2b8', text: '#fff' }
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${color.bg};
      color: ${color.text};
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 350px;
      word-wrap: break-word;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto remove after delay
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }
    }, type === 'error' ? 5000 : 3000);
  }
}

// Initialize when the page is ready
console.log('🤖 Kayako AI Content Script loaded on:', window.location.href);
console.log('🤖 Document state:', document.readyState);

try {
  if (document.readyState === 'loading') {
    console.log('🤖 Waiting for DOM to load...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🤖 DOM loaded, initializing...');
      new KayakoAIEnhancer();
    });
  } else {
    console.log('🤖 DOM already ready, initializing immediately...');
    new KayakoAIEnhancer();
  }
} catch (error) {
  console.error('🤖 Critical error in content script initialization:', error);
}
