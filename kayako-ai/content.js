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
      // console.log('✅ Config loaded:', this.config);
      
      // Wait for page to stabilize
      await this.waitForPageReady();
      
      // Check if we can find any editors
      const containers = document.querySelectorAll('.ko-text-editor__container_1p5g6r');
      const toolbars = document.querySelectorAll('.fr-toolbar');
      // console.log(`🔍 Found ${containers.length} Kayako containers and ${toolbars.length} Froala toolbars`);
      
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
      const config = result.kayakoAIConfig || {};
      
      // Migrate old apiKey to openaiKey if needed
      if (config.apiKey && !config.openaiKey) {
        config.openaiKey = config.apiKey;
      }
      
      this.config = {
        provider: config.provider || 'openai',
        openaiKey: config.openaiKey || '',
        anthropicKey: config.anthropicKey || '',
        apiKey: config.apiKey || config.openaiKey || config.anthropicKey || '',
        model: config.model || 'gpt-5-mini',
        enabled: config.enabled !== false,
        useTicketContext: config.useTicketContext || false,
        systemPrompt: config.systemPrompt || '',
        temperature: config.temperature || 0.7
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
    
    // console.log(`🔍 Found ${containers.length} Kayako text editor containers`);
    
    containers.forEach(container => {
      // Look for Kayako toolbar header within the container (not the hidden Froala one)
      const kayakoHeader = container.querySelector('.ko-text-editor__header_1p5g6r:not([data-ai-enhanced])');
      if (kayakoHeader) {
        // console.log('🎯 Found Kayako toolbar header in container');
        this.enhanceKayakoToolbar(kayakoHeader, container);
      }
    });
  }

  enhanceKayakoToolbar(kayakoHeader, container) {
    if (kayakoHeader.dataset.aiEnhanced) {
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
      // console.log('🔧 Adding AI button to last Kayako button group');
      lastGroup.appendChild(aiButtonGroup);
    } else {
      // console.log('🔧 Adding AI button to end of Kayako header');
      kayakoHeader.appendChild(aiButtonGroup);
    }
    // Removed quick Beautify icon to avoid duplication; Beautify is in AI dropdown only
    
    // Debug: Check if button was added
    const addedButton = kayakoHeader.querySelector('.kayako-ai-dropdown');
    if (addedButton) {
      // console.log('✅ AI button successfully added to Kayako toolbar:', addedButton);
      // console.log('✅ Button visible:', addedButton.offsetWidth > 0 && addedButton.offsetHeight > 0);
      
      const styles = window.getComputedStyle(addedButton);
      // console.log('🔍 Button styles:', {
      //   display: styles.display,
      //   visibility: styles.visibility,
      //   opacity: styles.opacity,
      //   width: addedButton.offsetWidth + 'px',
      //   height: addedButton.offsetHeight + 'px'
      // });
      
    } else {
      console.error('❌ AI button not found after insertion');
    }
  }

  createKayakoAIButton(editorElement) {
    // Create button wrapper to match Kayako's style
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'ko-text-editor__item_1p5g6r ko-text-editor__itemWrap_1p5g6r kayako-ai-wrapper';
    
    // Define AI enhancement actions
    const formatHint = 'Additionally, format the output using only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>; organize into short paragraphs and bullet lists where appropriate; no headings, tables, images, or Markdown. Keep [LINK#] and [IMG#] placeholders intact. Return only the HTML.';
    const actions = [
      {
        id: 'polish',
        icon: '✨',
        title: 'Polish',
        prompt: 'Polish and improve ONLY the grammar, spelling, punctuation, and readability of the following text. DO NOT change the meaning, content, facts, or intent. DO NOT add new information or remove existing information. Keep ALL original details, names, instructions, and requests exactly as they are. Only fix language issues. ' + formatHint,
        tooltip: 'Improve grammar and readability; keep meaning intact.'
      },
      {
        id: 'formalize',
        icon: '👔',
        title: 'Formalize',
        prompt: 'Rewrite the following text to be more formal and professional: ' + formatHint,
        tooltip: 'Make tone professional; do not change meaning.'
      },
      {
        id: 'elaborate',
        icon: '📝',
        title: 'Elaborate',
        prompt: 'Expand and elaborate on the following text with more details and context: ' + formatHint,
        tooltip: 'Add helpful detail and context; preserve intent.'
      },
      {
        id: 'shorten',
        icon: '✂️',
        title: 'Shorten',
        prompt: 'Rewrite the following text to be more concise while keeping the key information: ' + formatHint,
        tooltip: 'Make concise; keep key information.'
      },
      {
        id: 'kid_friendly',
        icon: '🧒',
        title: 'Make Kid Friendly',
        prompt: 'kid_friendly',
        tooltip: 'Rephrase so a child of a chosen age understands (ask age)'
      },
      {
        id: 'beautify',
        icon: '🎛️',
        title: 'Beautify',
        prompt: 'FORMAT-ONLY TRANSFORM. Do not add, remove, reorder, or alter ANY words or punctuation. Do not change casing or correct typos. Use the exact original text, only wrapping/structuring with simple HTML. Constraints: NO Markdown, NO code blocks, NO tables, NO images, NO headings. Use only <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>. Keep [LINK#] and [IMG#] placeholders intact. You may split paragraphs and group lines into bullet lists without changing the text itself. Return ONLY the HTML.',
        tooltip: 'Format-only: exact words preserved; structure with paragraphs and lists.'
      },
      {
        id: 'hone_in',
        icon: '🎯',
        title: 'Help me hone in',
        prompt: 'custom_hone',
        tooltip: 'Refine the current response using your instructions.'
      },
      {
        id: 'help_write',
        icon: '✍️',
        title: 'Help me write',
        prompt: 'custom', // Special marker for custom prompt handling
        tooltip: 'Open custom prompt to generate new content.'
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
      if (action.id === 'beautify' || action.id === 'hone_in' || action.id === 'help_write') {
        const separator = document.createElement('div');
        separator.className = 'kayako-ai-dropdown-separator';
        dropdownMenu.appendChild(separator);
      }
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kayako-ai-action-btn';
      button.dataset.action = action.id;
      button.innerHTML = `${action.icon} ${action.title}`;
      button.title = action.tooltip || action.title;
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (action.id === 'help_write') {
          this.showCustomPromptModal(editorElement, e.currentTarget);
        } else if (action.id === 'hone_in') {
          this.showHoneInModal(editorElement, e.currentTarget);
        } else if (action.id === 'kid_friendly') {
          this.showKidFriendlyModal(editorElement, e.currentTarget);
        } else {
          this.handleAIAction(action, editorElement, e.currentTarget);
        }
        
        dropdownMenu.style.display = 'none';
      });

      // Capture selection on mousedown BEFORE focus changes clear it
      button.addEventListener('mousedown', () => {
        if (action.id === 'help_write') return; // help_write ignores selection
        try {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (!r.collapsed && editorElement.contains(r.commonAncestorContainer)) {
              this._preSelectionRange = r.cloneRange();
            } else {
              this._preSelectionRange = null;
            }
          }
        } catch (_) {
          this._preSelectionRange = null;
        }
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

  showKidFriendlyModal(editorElement, anchorEl = null) {
    // Capture current selection inside the editor BEFORE showing the modal
    let capturedRange = this._preSelectionRange ? this._preSelectionRange.cloneRange() : null;
    // Clear stored pre-selection after reading it
    this._preSelectionRange = null;
    console.log('🧪 Kid-friendly modal: pre-selection exists?', !!capturedRange);
    try {
      const sel = window.getSelection();
      console.log('🧪 Current selection:', sel ? `${sel.rangeCount} ranges, collapsed: ${sel.isCollapsed}` : 'none');
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        // CAPTURE SELECTION ANYWHERE, not just inside editorElement
        if (!r.collapsed) {
          capturedRange = r.cloneRange();
          console.log('🧪 Captured selection from anywhere on page');
          try {
            const tmp = r.cloneContents();
            const div = document.createElement('div');
            div.appendChild(tmp);
            const txt = (div.textContent || '').trim();
            console.log(`🎯 Kid-friendly: captured selection of ${txt.length} chars`);
          } catch (_) {}
        }
      }
    } catch (_) {}
    console.log('🧪 Final capturedRange before modal:', !!capturedRange);
    // Remove any existing modal
    const existingModal = document.querySelector('.kayako-ai-custom-prompt');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'kayako-ai-custom-prompt';
    modal.innerHTML = `
      <div class="ai-custom-prompt-header">
        <span class="ai-custom-prompt-title">🧒 Make Kid Friendly</span>
        <button class="ai-custom-prompt-close" type="button">×</button>
      </div>
      <div class="ai-custom-prompt-content">
        <div class="ai-custom-prompt-input-group">
          <label for="kidAgeInput">Age of the child</label>
          <input id="kidAgeInput" type="number" min="3" max="18" step="1" placeholder="e.g., 10" />
          <small style="color: #6c757d; font-size: 11px; margin-top: 4px; display: block;">Use an age between 3 and 18. We’ll adjust clarity and tone for that age.</small>
        </div>
      </div>
      <div class="ai-custom-prompt-actions">
        <button class="ai-custom-prompt-btn ai-custom-prompt-cancel" type="button">Cancel</button>
        <button class="ai-custom-prompt-btn ai-custom-prompt-generate" type="button">Transform</button>
      </div>
    `;

    document.body.appendChild(modal);
    this.makeDraggable(modal);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    modal.querySelector('.ai-custom-prompt-close').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });
    modal.querySelector('.ai-custom-prompt-cancel').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });
    modal.querySelector('.ai-custom-prompt-generate').addEventListener('click', () => {
      const ageVal = parseInt(modal.querySelector('#kidAgeInput').value, 10);
      if (!Number.isFinite(ageVal) || ageVal < 3 || ageVal > 18) {
        this.showNotification('Please enter a valid age between 3 and 18', 'warning');
        return;
      }
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
      this.handleKidFriendly(ageVal, editorElement, capturedRange, anchorEl);
    });
  }

  async handleKidFriendly(age, editorElement, preCapturedRange = null, anchorEl = null) {
    if (this.isProcessing) {
      this.showNotification('⏳ Already processing, please wait...', 'warning');
      return;
    }
    if (!this.config?.apiKey) {
      this.showNotification('❌ Please configure your AI API key in the extension settings', 'error');
      return;
    }

    console.log('🧪 handleKidFriendly: received preCapturedRange?', !!preCapturedRange);
    if (preCapturedRange) {
      console.log('🧪 preCapturedRange collapsed?', preCapturedRange.collapsed);
    }

    // Prefer selection when present; else template area; else full editor
    let textData = null;
    try {
      const range = preCapturedRange;
      const hasRange = range && !range.collapsed;
      console.log('🧪 Using range?', hasRange);
      if (hasRange) {
        const cloned = range.cloneContents();
        const holder = document.createElement('div');
        holder.appendChild(cloned);
        const tmpExtraction = this.extractTextWithLinkPlaceholders(holder);
        console.log('🧪 Extracted from range:', (tmpExtraction.textWithPlaceholders || '').length, 'chars');
        // Determine insertion target from editor (template vs whole editor)
        const editorCtx = this.getEditorText(editorElement);
        textData = {
          hasTemplate: !!editorCtx?.hasTemplate,
          extractedText: (tmpExtraction.textWithPlaceholders || '').trim(),
          fullText: tmpExtraction.textWithPlaceholders || '',
          linkMap: tmpExtraction.linkMap || {},
          imgMap: tmpExtraction.imgMap || {},
          // Do NOT set selectionRange so we insert into template/editor, not the page selection
          editorElement: editorElement
        };
        const dbgLen = (textData.extractedText || '').length;
        console.log(`🎯 Kid-friendly: operating on selection (${dbgLen} chars); target: ${textData.hasTemplate ? 'template placeholder' : 'editor body'}`);
      }
    } catch (e) {
      console.error('🧪 Error processing preCapturedRange:', e);
    }
    if (!textData) {
      console.log('🧪 No selection data, falling back to editor extraction');
      textData = this.getEditorText(editorElement);
      console.log(`🎯 Kid-friendly: operating on ${textData.hasTemplate ? 'template placeholder' : 'whole editor'} (${(textData.extractedText || textData.fullText || '').length} chars)`);
    }
    // If template detected but placeholder is empty, fall back to whole editor content
    if (textData && textData.hasTemplate && (!textData.extractedText || textData.extractedText.trim().length === 0)) {
      console.log('🎯 Kid-friendly: template detected with empty placeholder – falling back to whole editor text');
      textData = { ...textData, hasTemplate: false, extractedText: (textData.fullText || '').trim() };
    }
    console.log('🧪 Final textData.extractedText length:', (textData?.extractedText || '').length);
    if (!textData.extractedText || textData.extractedText.trim().length === 0) {
      console.error('🧪 FAILING: No text found to transform');
      this.showNotification('❌ No text found to transform', 'error');
      return;
    }

    this.isProcessing = true;
    const processingNotification = this.showPersistentNotification(`🤖 Making kid friendly (age ${age})...`, 'info', null, anchorEl || this.getAnchorForEditor(editorElement));

    try {
      let ticketContext = '';
      if (this.config?.useTicketContext) {
        const contextData = this.extractTicketContext();
        ticketContext = contextData.text || '';
      }
      const formatting = 'Use only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>. Keep [LINK#] and [IMG#] placeholders intact. No headings, tables, images, or Markdown. Return only the HTML.';
      const prompt = `Rephrase the following support response so it is clear and relatable to a child around ${age} years old, without changing the factual meaning or commitments. Use plain words, short sentences, and a warm, respectful tone. Switch to a child-friendly tone, for example, instead of "Dear" use "Hi" or "Hello". Briefly explain technical words in simple language when necessary. Avoid promises of timelines or remote sessions. ${formatting}`;

      let enhancedText = await this.callAI(prompt, textData.extractedText, ticketContext);
      if (!enhancedText || enhancedText.trim().length === 0) {
        console.warn('⚠️ Kid-friendly returned empty; falling back to showing original text');
        enhancedText = textData.extractedText;
      }

      processingNotification.remove();

      if (enhancedText) {
        const cleanEnhancedText = this.normalizeHTMLForInsert(enhancedText.trim().replace(/^\s+/gm, ''));
        this.showAIPreview(editorElement, textData, cleanEnhancedText, `Make Kid Friendly (age ${age})`);
      } else {
        this.showNotification('❌ No enhancement was generated', 'error');
      }
    } catch (error) {
      processingNotification.remove();
      console.error('Kid-friendly error:', error);
      this.showNotification(`❌ Kid-friendly failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  async handleAIAction(action, editorElement, anchorEl = null) {
    if (this.isProcessing) {
      this.showNotification('⏳ Already processing, please wait...', 'warning');
      return;
    }

    if (!this.config?.apiKey) {
      this.showNotification('❌ Please configure your AI API key in the extension settings', 'error');
      return;
    }

    // If there is a non-empty selection inside the editor, operate ONLY on the selection
    let textData = null;
    try {
      const selection = window.getSelection();
      const hasRange = selection && selection.rangeCount > 0;
      const range = hasRange ? selection.getRangeAt(0) : null;
      const isInEditor = range && !range.collapsed && editorElement.contains(range.commonAncestorContainer);
      if (isInEditor) {
        const cloned = range.cloneContents();
        const holder = document.createElement('div');
        holder.appendChild(cloned);
        const tmpExtraction = this.extractTextWithLinkPlaceholders(holder);
        textData = {
          hasTemplate: false,
          extractedText: (tmpExtraction.textWithPlaceholders || '').trim(),
          fullText: tmpExtraction.textWithPlaceholders || '',
          linkMap: tmpExtraction.linkMap || {},
          selectionRange: range,
          editorElement: editorElement
        };
      }
    } catch (e) {
      console.warn('Selection processing failed, falling back to editor extraction:', e?.message || e);
    }
    // Fallback: use template-aware extraction for the whole editor
    if (!textData) {
      textData = this.getEditorText(editorElement);
    }

    // For templates, allow empty content (placeholder area might be empty)
    if (!textData.hasTemplate && (!textData.extractedText || textData.extractedText.trim().length === 0)) {
      this.showNotification('❌ No text found to enhance', 'error');
      return;
    }
    
    // If template is detected but placeholder is empty, inform user
    if (textData.hasTemplate && (!textData.extractedText || textData.extractedText.trim().length === 0)) {
      console.log('🎯 Template detected with empty placeholder - will use template structure');
    }

    console.log(`🤖 Processing AI action: ${action.id} on text:`, textData.extractedText.substring(0, 100) + '...');

    this.isProcessing = true;
    const processingNotification = this.showPersistentNotification(`🤖 ${action.title}...`, 'info', null, anchorEl || this.getAnchorForEditor(editorElement));

    try {
      // Get ticket context if enabled - only for actions that draft new content
      // Skip for text transformation actions (polish, formalize, simplify, kidfriendly, beautify)
      const textTransformActions = ['polish', 'formalize', 'simplify', 'kidfriendly', 'beautify'];
      let ticketContext = '';
      if (this.config?.useTicketContext && !textTransformActions.includes(action.id)) {
        const contextData = this.extractTicketContext();
        ticketContext = contextData.text || '';
        console.log('🎯 Extracted ticket context:', ticketContext ? 'Found context' : 'No context found');
      } else if (textTransformActions.includes(action.id)) {
        console.log(`🔧 Skipping ticket context for ${action.id} (text transformation action)`);
      }
      
      let enhancedText = await this.callAI(action.prompt, textData.extractedText, ticketContext);
      
      // For Beautify, sanitize to the limited HTML the editor supports
      if (action.id === 'beautify' && enhancedText) {
        enhancedText = this.sanitizeBeautifyHTML(enhancedText);
      }
      // If Beautify returned empty, fall back to input text so we can still format locally
      if (action.id === 'beautify' && (!enhancedText || !enhancedText.trim())) {
        try { console.warn('Beautify returned empty; falling back to local formatting.'); } catch (_) {}
        enhancedText = textData.extractedText || '';
      }
      
      // Remove processing notification before showing modal
      processingNotification.remove();
      
      // For Beautify, always show the preview if we received any text at all.
      // The preview normalization may introduce formatting (e.g., <br>, lists)
      // even when the raw text matches the input.
      if (enhancedText && (action.id === 'beautify' || enhancedText !== textData.extractedText)) {
        // Clean up the enhanced text before showing preview
        const cleanEnhancedText = this.normalizeHTMLForInsert(enhancedText.trim().replace(/^\s+/gm, ''));
        
        // Show preview with Insert/Cancel options instead of direct replacement
        this.showAIPreview(editorElement, textData, cleanEnhancedText, action.title);
      } else {
        this.showNotification('❌ No enhancement was generated', 'error');
      }
    } catch (error) {
      // Remove processing notification on error
      processingNotification.remove();
      console.error('AI processing error:', error);
      this.showNotification(`❌ AI enhancement failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  getEditorText(editorElement) {
    // Preserve links by replacing them with placeholders before text extraction
    const { textWithPlaceholders, linkMap, imgMap } = this.extractTextWithLinkPlaceholders(editorElement);

    console.log('🔍 Raw extracted text (first 300 chars):', JSON.stringify(textWithPlaceholders.substring(0, 300)));
    console.log('🔗 Found links:', Object.keys(linkMap).length);

    // Look for PR template pattern
    const templateData = this.extractFromTemplate(textWithPlaceholders, editorElement);
    
    // Add link information to the template data
    templateData.linkMap = linkMap;
    templateData.imgMap = imgMap;
    
    return templateData;
  }

  // Remove leading/trailing separator lines (e.g., ======) and empty lines
  cleanTemplateEdges(text) {
    try {
      const lines = (text || '').split(/\r?\n/);
      while (lines.length && (/^\s*$/.test(lines[0]) || /^[-=]{3,}\s*$/.test(lines[0].trim()))) {
        lines.shift();
      }
      while (lines.length && (/^\s*$/.test(lines[lines.length - 1]) || /^[-=]{3,}\s*$/.test(lines[lines.length - 1].trim()))) {
        lines.pop();
      }
      return lines.join('\n').trim();
    } catch (_) { return (text || '').trim(); }
  }

  extractTextWithLinkPlaceholders(editorElement) {
    // Clone the element to avoid modifying the original
    const clonedElement = editorElement.cloneNode(true);
    
    // Find all links and replace with placeholders
    const links = clonedElement.querySelectorAll('a[href]');
    const linkMap = {};
    
    links.forEach((link, index) => {
      const placeholder = `[LINK${index + 1}]`;
      const linkInfo = {
        href: link.href,
        text: link.textContent || link.innerText || '',
        title: link.title || '',
        target: link.target || ''
      };
      
      linkMap[placeholder] = linkInfo;
      
      // Replace the link with just the placeholder text
      const textNode = document.createTextNode(placeholder);
      link.parentNode.replaceChild(textNode, link);
    });
    
    // Find all images and replace with placeholders to preserve them
    const images = clonedElement.querySelectorAll('img');
    const imgMap = {};
    images.forEach((img, index) => {
      const placeholder = `[IMG${index + 1}]`;
      // Preserve the exact original markup to avoid losing inline styles/attrs
      const html = img.outerHTML;
      imgMap[placeholder] = html;
      const textNode = document.createTextNode(placeholder);
      img.parentNode.replaceChild(textNode, img);
    });
    
    // Extract text content from the modified clone with preserved breaks
    const textContent = this.getTextWithBreaks(clonedElement);
    
    return {
      textWithPlaceholders: textContent,
      linkMap: linkMap,
      imgMap: imgMap
    };
  }

  // Convert DOM to plain text, preserving logical line breaks
  getTextWithBreaks(root) {
    const BLOCK_TAGS = new Set(['P','DIV','SECTION','ARTICLE','HEADER','FOOTER','H1','H2','H3','H4','H5','H6','LI']);
    let out = '';
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === 'BR') {
        out += '\n';
        return;
      }
      if (tag === 'LI') {
        // Ensure list items appear on their own lines
        // Keep exact text (format-only rule), do not add markers
        node.childNodes.forEach(walk);
        out += '\n';
        return;
      }
      node.childNodes.forEach(walk);
      if (BLOCK_TAGS.has(tag)) {
        out += '\n';
      }
    };
    walk(root);
    // Collapse excessive blank lines but preserve single line breaks
    return out.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  extractFromTemplate(text, editorElement) {
    console.log('🔍 Full text content for template detection:', JSON.stringify(text.substring(0, 500)));
    
    // Try multiple patterns to catch the PR template
    const patterns = [
      // Original template variants
      /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Best\s+regards,/i,
      /What is the PR to the customer\?\s*([\s\S]*?)\s*Best regards,/i,
      /PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Best\s+regards,/i,
      // Original template ending at Additional Context
      /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Additional\s*Context(?:\?|:)/i,
      // New Alpha EDU template variants starting at the new header
      /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?\s*([\s\S]*?)\s*Best\s+regards,/i,
      /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?\s*([\s\S]*?)\s*^\s*=+\s*$/im,
      /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?\s*([\s\S]*?)\s*Additional\s*Context(?:\?|:)/i
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      console.log(`🔍 Pattern ${i + 1} match result:`, match ? 'FOUND' : 'NOT FOUND');
      
      if (match) {
        // Extract the content between the markers (can be empty/whitespace)
        const extractedText = match[1] ? this.cleanTemplateEdges(match[1]) : '';
        console.log('🎯 Extracted text from PR template (can be empty):', JSON.stringify(extractedText));
        console.log('🎯 Template detected with', extractedText.length, 'characters of content');
        
        return {
          hasTemplate: true,
          extractedText: extractedText, // Allow empty content
          fullText: text,
          editorElement: editorElement, // Store reference for DOM manipulation
          originalHTML: editorElement.innerHTML // Store original HTML
        };
      }
    }
    
    // Fallback: manual boundary search to be resilient to minor formatting changes
    try {
      const startRes = [
        /What\s+is\s+the\s+PR\s+to\s+the\s+customer\b/i,
        /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?/i
      ];
      const endRes = [
        /Best\s+regards,/i,
        /Additional\s*Context(?:\?|:)/i,
        /^\s*=+\s*$/im
      ];
      let startM = null; let startRe = null;
      for (const re of startRes) { const m = re.exec(text); if (m) { startM = m; startRe = re; break; } }
      if (startM) {
        const startIdx = startM.index + startM[0].length;
        // Find first end marker after start
        const rest = text.slice(startIdx);
        const matches = endRes.map(re => re.exec(rest)).filter(Boolean).map(m => m.index);
        let endIdx = rest.length;
        if (matches.length) endIdx = Math.min(...matches);
        const between = this.cleanTemplateEdges(rest.slice(0, endIdx));
        console.log('🎯 Fallback template extraction used. Length:', between.length);
        return {
          hasTemplate: true,
          extractedText: between,
          fullText: text,
          editorElement: editorElement,
          originalHTML: editorElement.innerHTML
        };
      }
    } catch (_) {}

    console.log('📝 No PR template found with any pattern, using full text');
    return {
      hasTemplate: false,
      extractedText: text.trim(),
      fullText: text
    };
  }

  // Extract everything after the "Additional Context?" section header.
  // Works on the plain text with link placeholders.
  extractAdditionalContextSection(fullText) {
    try {
      const text = fullText || '';
      const m = /Additional\s*Context(?:\?|:)/i.exec(text);
      const idx = m ? m.index : -1;
      if (idx === -1) {
        return '';
      }
      let after = text.slice(idx + m[0].length);
      // Drop leading separators (lines of only '=') and empty lines
      const lines = after.split(/\r?\n/);
      while (lines.length && (/^\s*$/.test(lines[0]) || /^=+$/.test(lines[0].trim()))) {
        lines.shift();
      }
      return lines.join('\n').trim();
    } catch (_) {
      return '';
    }
  }

  setEditorText(editorElement, textData, newText) {
    // Normalize placeholders then restore links/images in the enhanced text
    const normalized = this.normalizePlaceholders(newText, textData.linkMap, textData.imgMap);
    const textWithRestoredLinks = this.restoreLinksInText(normalized, textData.linkMap);
    const textWithRestoredMedia = this.restoreImagesInText(textWithRestoredLinks, textData.imgMap);
    
    // If user selected a specific range, replace only that selection
    if (textData.selectionRange) {
      try {
        const range = textData.selectionRange;
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.normalizeHTMLForInsert(textWithRestoredMedia);
        while (wrapper.firstChild) {
          fragment.appendChild(wrapper.firstChild);
        }
        range.deleteContents();
        range.insertNode(fragment);
        // Move cursor to end
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        range.collapse(false);
      } catch (e) {
        console.warn('Selection replacement failed, falling back to template/full replace');
      }
      
      // Trigger events
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      const changeEvent = new Event('fr-change', { bubbles: true });
      editorElement.dispatchEvent(changeEvent);
      return;
    }

    if (textData.hasTemplate) {
      // Prefer DOM Range replacement between template markers for robustness
      const inserted = this.replaceTemplatePlaceholder(editorElement, textWithRestoredMedia);
      if (!inserted) {
        console.warn('⚠️ Could not locate template markers reliably; falling back to regex replace');
        const cleanedOriginal = (textData.extractedText || '').trim();
        if (cleanedOriginal.length > 0) {
          // Use innerHTML replacement with regex to preserve HTML structure
          console.log('🔧 Performing HTML-based surgical replacement (fallback with non-empty original)');
          const escapedOriginalText = cleanedOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const newHTML = textData.originalHTML.replace(
            new RegExp(escapedOriginalText, 'g'),
            this.normalizeHTMLForInsert(textWithRestoredMedia)
          );
          editorElement.innerHTML = newHTML;
        } else {
          // Empty placeholder: insert immediately after the start marker
          console.log('🔧 Empty placeholder; inserting after start marker');
          const insertedAtStart = this.insertAfterTemplateStart(editorElement, this.normalizeHTMLForInsert(textWithRestoredMedia));
          if (!insertedAtStart) {
            console.warn('⚠️ Could not insert after start marker; falling back to end append');
            editorElement.innerHTML = this.normalizeHTMLForInsert(textWithRestoredMedia);
          }
        }
      }
      
    } else {
      // Replace entire text
      editorElement.innerHTML = this.normalizeHTMLForInsert(textWithRestoredMedia);
    }
    
    // Trigger input event to notify Froala of the change
    const inputEvent = new Event('input', { bubbles: true });
    editorElement.dispatchEvent(inputEvent);
    
    // Also try to trigger Froala's change event
    const changeEvent = new Event('fr-change', { bubbles: true });
    editorElement.dispatchEvent(changeEvent);
  }

  restoreLinksInText(text, linkMap) {
    if (!linkMap || Object.keys(linkMap).length === 0) {
      return text;
    }
    
    let restoredText = text;
    
    // Replace each placeholder with proper HTML link
    Object.entries(linkMap).forEach(([placeholder, linkInfo]) => {
      const linkHTML = `<a href="${linkInfo.href}"${linkInfo.title ? ` title="${linkInfo.title}"` : ''}${linkInfo.target ? ` target="${linkInfo.target}"` : ''}>${linkInfo.text}</a>`;
      
      // Replace placeholder with actual link HTML
      restoredText = restoredText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), linkHTML);
    });
    
    console.log('🔗 Links restored:', Object.keys(linkMap).length, 'links');
    return restoredText;
  }

  restoreImagesInText(text, imgMap) {
    if (!imgMap || Object.keys(imgMap).length === 0) {
      return text;
    }
    let restoredText = text;
    Object.entries(imgMap).forEach(([placeholder, html]) => {
      const re = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      restoredText = restoredText.replace(re, html);
    });
    console.log('🖼️ Images restored:', Object.keys(imgMap).length, 'images');
    return restoredText;
  }

  // Normalize placeholder variants like LINK2 or [ LINK 2 ] back to [LINK2]
  normalizePlaceholders(text, linkMap = {}, imgMap = {}) {
    if (!text) return text;
    let out = text;
    const toNormalize = [];
    Object.keys(linkMap || {}).forEach((ph) => toNormalize.push(ph));
    Object.keys(imgMap || {}).forEach((ph) => toNormalize.push(ph));
    toNormalize.forEach((placeholder) => {
      const m = placeholder.match(/^\[(LINK|IMG)(\d+)\]$/i);
      if (!m) return;
      const kind = m[1];
      const num = m[2];
      // Match variants with optional brackets/spaces/case-insensitive
      const variantRe = new RegExp(`\\[?\\s*${kind}\\s*${num}\\s*\\]?`, 'gi');
      out = out.replace(variantRe, `[${kind.toUpperCase()}${num}]`);
    });
    return out;
  }

  // Extract [IMG#] placeholders from text and return compressed data URLs for those images using imgMap
  async collectContextImagesAsDataUrls(contextText, imgMap) {
    try {
      if (!contextText || !imgMap) return [];
      const placeholders = Array.from(new Set((contextText.match(/\[IMG\d+\]/g) || [])));
      if (placeholders.length === 0) return [];
      console.log(`🖼️ Processing ${placeholders.length} images for context`);
      const dataUrls = [];
      for (const ph of placeholders) {
        const html = imgMap[ph];
        if (!html) continue;
        const div = document.createElement('div');
        div.innerHTML = html;
        const img = div.querySelector('img');
        if (!img) continue;
        const src = img.getAttribute('src');
        if (!src) continue;
        try {
          let dataUrl = '';
          if (src.startsWith('data:')) {
            dataUrl = src;
          } else {
            const res = await fetch(src, { credentials: 'include' });
            const blob = await res.blob();
            dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
          if (typeof dataUrl === 'string') {
            // Compress image to reduce token usage
            const compressed = await this.compressImageDataUrl(dataUrl);
            dataUrls.push(compressed);
            console.log(`🖼️ Image ${ph}: original ${Math.round(dataUrl.length/1024)}KB → compressed ${Math.round(compressed.length/1024)}KB`);
          }
        } catch (e) {
          try { console.warn('⚠️ Could not include image in context:', ph, e?.message || e); } catch (_) {}
        }
      }
      console.log(`🖼️ Total images included: ${dataUrls.length}`);
      return dataUrls;
    } catch (_) {
      return [];
    }
  }

  // Compress image data URL to reduce token usage (target max 100KB per image)
  async compressImageDataUrl(dataUrl) {
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });
      
      const canvas = document.createElement('canvas');
      const maxDim = 1024; // max width/height
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round(h * maxDim / w);
          w = maxDim;
        } else {
          w = Math.round(w * maxDim / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      
      // Try JPEG at 0.7 quality first
      let compressed = canvas.toDataURL('image/jpeg', 0.7);
      // If still too large, reduce quality further
      if (compressed.length > 150000) { // ~100KB base64
        compressed = canvas.toDataURL('image/jpeg', 0.5);
      }
      return compressed;
    } catch (e) {
      console.warn('⚠️ Image compression failed, using original:', e?.message || e);
      return dataUrl;
    }
  }

  // Fast classification to determine if prompt is for an escalation (uses Haiku for speed)
  async classifyPromptAsEscalation(prompt) {
    try {
      console.log('🔍 Classifying prompt for escalation...');
      const classificationPrompt = `Classify if this support agent request is asking to write an ESCALATION (to another team, engineering, DevOps, etc) or a CUSTOMER RESPONSE (reply to customer).

Request: "${prompt}"

Reply with ONLY one word: ESCALATION or CUSTOMER`;

      // Use Haiku for fast classification (falls back to current model if Anthropic not configured)
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'classifyPrompt',
          prompt: classificationPrompt
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.result || '');
          }
        });
      });

      const isEscalation = (response || '').toUpperCase().includes('ESCALATION');
      console.log(`🏷️ Prompt classified as: ${isEscalation ? 'ESCALATION' : 'CUSTOMER RESPONSE'}`);
      return isEscalation;
    } catch (error) {
      console.warn('⚠️ Classification failed, defaulting to customer response:', error?.message);
      return false; // Default to customer response section
    }
  }

  // Replace content in the escalation section of the template
  replaceEscalationSection(editorElement, newTextHTML) {
    try {
      const startRe = /Also\s+fill\s+the\s+following\s+if\s+you\s+are\s+proposing\s+an\s+escalation:?/i;
      
      const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null, false);
      let startNode = null, startOffset = 0;
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const val = node.nodeValue;
        const m = val.match(startRe);
        if (m) {
          startNode = node;
          startOffset = m.index + m[0].length;
          break;
        }
      }
      
      if (!startNode) {
        console.warn('⚠️ Could not find escalation section marker');
        return false;
      }
      
      // Find the end of the document or next major section
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEndAfter(editorElement.lastChild || editorElement);
      
      // Delete content after the marker and insert new content
      range.deleteContents();
      
      // Insert a line break then the new content
      const brNode = document.createElement('br');
      const contentWrapper = document.createElement('span');
      contentWrapper.innerHTML = newTextHTML;
      
      range.insertNode(contentWrapper);
      range.insertNode(brNode);
      
      console.log('✅ Escalation content inserted successfully');
      return true;
    } catch (error) {
      console.error('Error replacing escalation section:', error);
      return false;
    }
  }

  // Replace content between PR template markers when placeholder is empty
  replaceTemplatePlaceholder(editorElement, newTextHTML) {
    try {
      const startReList = [
        /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?/i,
        /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?/i
      ];
      const endReList = [
        /Best\s+regards,/i,
        /Additional\s*Context(?:\?|:)/i,
        /Also\s+fill\s+the\s+following/i
      ];
      const delimRe = /^\s*=+\s*$/; // delimiter lines made of '=' only
      
      const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null, false);
      let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
      let candidateEndNode = null, candidateEndOffset = 0; // end just before bottom delimiter
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const val = node.nodeValue;
        if (!startNode) {
          for (const re of startReList) {
            const m = val.match(re);
            if (m) {
              startNode = node;
              startOffset = m.index + m[0].length;
              break;
            }
          }
        } else {
          // Track bottom delimiter lines to preserve them
          if (val && delimRe.test(val.trim())) {
            candidateEndNode = node;
            candidateEndOffset = 0; // end before delimiter
          }
          for (const endRe of endReList) {
            const m2 = val.match(endRe);
            if (m2) {
              // Prefer ending before the last seen delimiter if available
              if (candidateEndNode) {
                endNode = candidateEndNode;
                endOffset = candidateEndOffset;
              } else {
                endNode = node;
                endOffset = m2.index;
              }
              break;
            }
          }
          if (endNode) break;
        }
      }
      
      // If we saw a delimiter after start but no explicit end marker, end at that delimiter
      if (startNode && !endNode && candidateEndNode) {
        endNode = candidateEndNode;
        endOffset = candidateEndOffset;
      }

      if (!startNode && !endNode) {
        console.warn('⚠️ Could not find template markers for insertion');
        return false;
      }

      // If no end marker, place at end of editor
      if (startNode && !endNode) {
        endNode = editorElement.lastChild;
        endOffset = endNode && endNode.nodeType === Node.TEXT_NODE ? endNode.nodeValue.length : 0;
      }
      // If no start marker, place before the end marker (rare)
      if (!startNode && endNode) {
        startNode = editorElement.firstChild;
        startOffset = 0;
      }
      
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      
      // Delete existing content between markers (could be empty)
      range.deleteContents();
      
      // Prepare fragment from new HTML (convert if needed)
      const fragment = document.createDocumentFragment();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.normalizeHTMLForInsert(newTextHTML);
      while (wrapper.firstChild) {
        fragment.appendChild(wrapper.firstChild);
      }
      
      // Insert at caret position (between markers)
      range.insertNode(fragment);
      
      return true;
    } catch (e) {
      console.error('Template placeholder replacement failed:', e);
      return false;
    }
  }

  // Insert content right after the PR start marker when placeholder is empty
  insertAfterTemplateStart(editorElement, newTextHTML) {
    try {
      const startRes = [
        /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?/i,
        /All\s+actions\s+should\s+include\s+a\s+PR\s+to\s+the\s+customer:?/i
      ];
      const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null, false);
      let startNode = null, startOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const val = node.nodeValue;
        for (const re of startRes) {
          const m = val.match(re);
          if (m) {
            startNode = node;
            startOffset = m.index + m[0].length;
            break;
          }
        }
        if (startNode) break;
      }
      if (!startNode) return false;
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.collapse(true);
      const fragment = document.createDocumentFragment();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = newTextHTML;
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
      range.insertNode(fragment);
      return true;
    } catch (e) {
      console.warn('Failed to insert after template start:', e);
      return false;
    }
  }

  // Sanitize Beautify output to a safe subset for Froala/Kayako
  sanitizeBeautifyHTML(html) {
    try {
      // If it's plain text (no tags), don't sanitize here to avoid
      // collapsing newlines/bullets. Downstream normalization will
      // convert newlines to <br> or lists.
      if (!/<[^>]+>/.test(html || '')) {
        return (html || '').toString();
      }

      const container = document.createElement('div');
      container.innerHTML = html;
      
      const allowed = new Set(['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'div']);
      
      const cleanNode = (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          let tag = node.tagName.toLowerCase();
          
          // Normalize tags
          if (tag === 'b') { tag = 'strong'; const repl = document.createElement('strong'); moveChildren(node, repl); node.replaceWith(repl); node = repl; }
          if (tag === 'i') { tag = 'em'; const repl = document.createElement('em'); moveChildren(node, repl); node.replaceWith(repl); node = repl; }
          if (tag === 'div') { /* div is fine; Froala often uses div */ }
          
          // Headings and other blocks -> convert to <p><strong>text</strong></p>
          if (/^h[1-6]$/.test(tag)) {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = node.textContent.trim();
            p.appendChild(strong);
            node.replaceWith(p);
            cleanNode(p);
            return;
          }
          
          // Disallowed tags -> unwrap contents
          if (!allowed.has(tag)) {
            const parent = node.parentNode;
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
            return;
          }
          
          // Strip attributes
          const attrs = Array.from(node.attributes || []);
          attrs.forEach(attr => {
            const name = attr.name.toLowerCase();
            if (tag === 'a') {
              if (!['href', 'title', 'target'].includes(name)) node.removeAttribute(name);
            } else {
              node.removeAttribute(name);
            }
          });
          
          // Validate anchor href
          if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            if (!this.isSafeHref(href)) {
              // Unsafe: unwrap
              const parent = node.parentNode;
              while (node.firstChild) parent.insertBefore(node.firstChild, node);
              parent.removeChild(node);
              return;
            }
            if (!node.getAttribute('target')) node.setAttribute('target', '_blank');
          }
          
          // Recurse
          let child = node.firstChild;
          while (child) {
            const next = child.nextSibling;
            cleanNode(child);
            child = next;
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          // Normalize whitespace (keep single spaces; remove tabs/newlines - LLM should structure with tags)
          node.nodeValue = node.nodeValue.replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
        }
      };
      
      const moveChildren = (from, to) => {
        while (from.firstChild) to.appendChild(from.firstChild);
      };
      
      // Clean children of container
      let child = container.firstChild;
      while (child) {
        const next = child.nextSibling;
        cleanNode(child);
        child = next;
      }
      
      // Convert stray text nodes at root into paragraphs
      const wrapTextNodes = () => {
        const nodes = Array.from(container.childNodes);
        nodes.forEach(n => {
          if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) {
            const p = document.createElement('p');
            p.textContent = n.nodeValue.trim();
            container.replaceChild(p, n);
          }
        });
      };
      wrapTextNodes();
      
      return container.innerHTML;
    } catch (e) {
      console.warn('Beautify sanitization failed, returning raw text');
      return (html || '').toString();
    }
  }

  isSafeHref(href) {
    try {
      const u = new URL(href, window.location.origin);
      return ['http:', 'https:'].includes(u.protocol);
    } catch (_) {
      return false;
    }
  }

  // Decide how to inject AI output: keep allowed HTML as-is; otherwise
  // convert plaintext bullets to lists or map newlines to <br>
  normalizeHTMLForInsert(html) {
    const hasTags = /<(p|ul|ol|li|strong|em|a|img)\b/i.test(html || '');
    if (!hasTags) {
      const listified = this.convertPlaintextListToHTML(html || '');
      if (listified) return listified;
      // Wrap paragraphs separated by blank lines in <p>, keep single newlines as <br>
      const text = (html || '');
      const paragraphs = text.split(/\r?\n\s*\r?\n/);
      const wrapped = paragraphs
        .map(p => `<p>${this.escapeHTML(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      return this.stabilizeHTMLForEditor(wrapped);
    }
    return this.stabilizeHTMLForEditor(html || '');
  }

  // Convert plaintext lines starting with -, *, •, or 1. into simple lists (markup only; keep text as-is)
  convertPlaintextListToHTML(text) {
    const lines = (text || '').split(/\r?\n/).map(l => l.trimEnd());
    if (lines.length < 3) return '';
    const bulletRe = /^\s*([\-\*•])\s+/;
    const numRe = /^\s*(\d+)\.[\)\.]?\s+/;
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const bulletCount = nonEmptyLines.filter(l => bulletRe.test(l)).length;
    const numCount = nonEmptyLines.filter(l => numRe.test(l)).length;
    if (nonEmptyLines.length === 0) return '';
    const isBulletList = bulletCount >= Math.max(3, Math.ceil(nonEmptyLines.length * 0.6));
    const isNumList = !isBulletList && (numCount >= Math.max(3, Math.ceil(nonEmptyLines.length * 0.6)));
    if (!isBulletList && !isNumList) return '';
    const tag = isNumList ? 'ol' : 'ul';
    const items = nonEmptyLines.map(l => `<li>${this.escapeHTML(l)}</li>`).join('');
    return `<${tag}>${items}</${tag}>`;
  }

  escapeHTML(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Minimize Froala reflow issues by removing stray <br> and empty blocks
  stabilizeHTMLForEditor(html) {
    try {
      const container = document.createElement('div');
      container.innerHTML = (html || '').toString();

      const isMeaningful = (node) => {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
          return node.nodeValue && node.nodeValue.replace(/[\s\u00a0]/g, '') !== '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = node.tagName.toLowerCase();
        if (tag === 'img' || tag === 'br') return true;
        // Anchors/formatting are meaningful if they contain meaningful descendants
        return Array.from(node.childNodes).some(isMeaningful);
      };

      const removeWhitespaceTextNodes = (el) => {
        Array.from(el.childNodes).forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE && (!n.nodeValue || n.nodeValue.replace(/[\s\u00a0]/g, '') === '')) {
            el.removeChild(n);
          }
        });
      };

      const collapseConsecutiveBr = (el) => {
        let i = 0;
        while (i < el.childNodes.length - 1) {
          const a = el.childNodes[i];
          const b = el.childNodes[i + 1];
          if (a.nodeType === Node.ELEMENT_NODE && b && b.nodeType === Node.ELEMENT_NODE && a.tagName === 'BR' && b.tagName === 'BR') {
            el.removeChild(b);
            continue; // stay on same index to catch further BRs
          }
          i++;
        }
      };

      const trimBrEdges = (el) => {
        // leading
        while (el.firstChild && el.firstChild.nodeType === Node.ELEMENT_NODE && el.firstChild.tagName === 'BR') {
          el.removeChild(el.firstChild);
        }
        // trailing
        while (el.lastChild && el.lastChild.nodeType === Node.ELEMENT_NODE && el.lastChild.tagName === 'BR') {
          el.removeChild(el.lastChild);
        }
      };

      const clean = (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();

        if (tag === 'p' || tag === 'li' || tag === 'div') {
          removeWhitespaceTextNodes(node);
          collapseConsecutiveBr(node);
          trimBrEdges(node);
        }

        // Recurse
        Array.from(node.childNodes).forEach(clean);

        // Remove empty blocks that are not meaningful
        if ((tag === 'p' || tag === 'li' || tag === 'div') && !isMeaningful(node)) {
          node.remove();
          return;
        }

        // Ensure UL/OL contain only LI children; remove direct BR or whitespace
        if (tag === 'ul' || tag === 'ol') {
          Array.from(node.childNodes).forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE && (!n.nodeValue || n.nodeValue.replace(/[\s\u00a0]/g, '') === '')) n.remove();
            if (n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'br') n.remove();
          });
        }
      };

      clean(container);
      let out = container.innerHTML;

      // Final fallback collapses
      out = out.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>');
      out = out.replace(/<li>\s*<\/li>/gi, '');
      return out;
    } catch (_) {
      // Regex fallback if DOM ops fail
      let out = (html || '').toString();
      out = out.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>');
      out = out.replace(/<p>\s*(?:<br\s*\/?>\s*)+/gi, '<p>');
      out = out.replace(/(?:<br\s*\/?>\s*)+\s*<\/p>/gi, '</p>');
      out = out.replace(/<li>\s*(?:<br\s*\/?>\s*)+/gi, '<li>');
      out = out.replace(/(?:<br\s*\/?>\s*)+\s*<\/li>/gi, '</li>');
      out = out.replace(/<li>\s*<\/li>/gi, '');
      out = out.replace(/<p>\s*<\/p>/gi, '<p></p>');
      return out;
    }
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
          <button class="ai-preview-copy-btn" type="button" title="Copy text">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
            Copy
          </button>
          <div class="ai-preview-text ai-preview-enhanced">${enhancedText.replace(/^\s+/gm, '').trim()}</div>
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
      document.removeEventListener('keydown', onKeyDown);
    });

    preview.querySelector('.ai-preview-cancel').addEventListener('click', () => {
      preview.remove();
      document.removeEventListener('keydown', onKeyDown);
    });

    // Copy button functionality
    const copyBtn = preview.querySelector('.ai-preview-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          // Get clean text content (remove HTML but preserve line breaks)
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = enhancedText;
          const cleanText = (tempDiv.textContent || tempDiv.innerText || enhancedText).trim();
          
          await navigator.clipboard.writeText(cleanText);
          
          // Visual feedback - just change to checkmark
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          `;
          copyBtn.style.color = '#28a745';
          
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.color = '';
          }, 1000);
          
        } catch (error) {
          console.error('Copy failed:', error);
          this.showNotification('❌ Copy failed', 'error');
        }
      });
    }

    preview.querySelector('.ai-preview-insert').addEventListener('click', () => {
      this.setEditorText(editorElement, originalTextData, enhancedText);
      this.showNotification(`✅ ${actionTitle} applied successfully`, 'success');
      preview.remove();
      document.removeEventListener('keydown', onKeyDown);
      
      // Highlight the new text briefly
      setTimeout(() => {
        this.highlightNewText(editorElement);
      }, 100);
    });

    // ESC to close
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
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
    
    // console.log('🔍 Dropdown sizing:', {
    //   availableHeight,
    //   naturalHeight,
    //   buttonBottom: buttonRect.bottom,
    //   viewportHeight
    // });
    
    // Set appropriate max-height with scrollbar if needed
    if (naturalHeight > availableHeight && availableHeight > 150) {
      const maxHeight = Math.max(200, Math.min(400, availableHeight));
      dropdownMenu.style.maxHeight = maxHeight + 'px';
      dropdownMenu.style.overflowY = 'auto';
      console.log('📏 Dropdown will scroll, max-height set to:', maxHeight + 'px');
    } else if (availableHeight <= 150) {
      // Very limited space - position above button instead
      dropdownMenu.style.top = 'auto';
      dropdownMenu.style.bottom = '100%';
      dropdownMenu.style.marginTop = '0';
      dropdownMenu.style.marginBottom = '4px';
      dropdownMenu.style.maxHeight = '300px';
      console.log('📏 Limited space, positioning dropdown above button');
    } else {
      dropdownMenu.style.maxHeight = '400px'; // Default
      dropdownMenu.style.overflowY = 'auto';
      // Reset position to default
      dropdownMenu.style.top = '100%';
      dropdownMenu.style.bottom = 'auto';
      dropdownMenu.style.marginTop = '4px';
      dropdownMenu.style.marginBottom = '0';
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
    
    // console.log('⌨️ Keyboard shortcuts registered');
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

  showCustomPromptModal(editorElement, anchorEl = null) {
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
          <textarea id="customPromptInput" placeholder="e.g., 'Follow-up asking for project status', 'Thank you for reporting the issue', 'Request additional information about the problem'" rows="3"></textarea>
          <small style="color: #6c757d; font-size: 11px; margin-top: 4px; display: block;">
            💡 Tip: Responses will automatically start with "Dear [Customer]," and include relevant product context if available.
          </small>
        </div>
      </div>
      <div class="ai-custom-prompt-actions">
        <button class="ai-custom-prompt-btn ai-custom-prompt-cancel" type="button">Cancel</button>
        <button class="ai-custom-prompt-btn ai-custom-prompt-generate" type="button">Generate</button>
      </div>
    `;

    // Position the modal
    document.body.appendChild(modal);
    
    // Make modal draggable
    this.makeDraggable(modal);

    // Focus the textarea
    setTimeout(() => {
      modal.querySelector('#customPromptInput').focus();
    }, 100);

    // Add event listeners
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    modal.querySelector('.ai-custom-prompt-close').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });

    modal.querySelector('.ai-custom-prompt-cancel').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });

    modal.querySelector('.ai-custom-prompt-generate').addEventListener('click', () => {
      const customPrompt = modal.querySelector('#customPromptInput').value.trim();
      if (customPrompt) {
        modal.remove();
        document.removeEventListener('keydown', onKeyDown);
        this.handleCustomPrompt(customPrompt, editorElement, anchorEl);
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

  showHoneInModal(editorElement, anchorEl = null) {
    // Capture current selection inside the editor BEFORE showing the modal
    let capturedRange = this._preSelectionRange ? this._preSelectionRange.cloneRange() : null;
    this._preSelectionRange = null;
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        // CAPTURE SELECTION ANYWHERE, not just inside editorElement
        if (!r.collapsed) {
          capturedRange = r.cloneRange();
          try {
            const tmp = r.cloneContents();
            const div = document.createElement('div');
            div.appendChild(tmp);
            const txt = (div.textContent || '').trim();
            console.log(`🎯 Hone-in: captured selection of ${txt.length} chars`);
          } catch (_) {}
        }
      }
    } catch (_) {}
    // Remove any existing modal
    const existingModal = document.querySelector('.kayako-ai-custom-prompt');
    if (existingModal) {
      existingModal.remove();
    }

    // Reuse custom prompt modal styling
    const modal = document.createElement('div');
    modal.className = 'kayako-ai-custom-prompt';
    
    modal.innerHTML = `
      <div class="ai-custom-prompt-header">
        <span class="ai-custom-prompt-title">🎯 Help me hone in</span>
        <button class="ai-custom-prompt-close" type="button">×</button>
      </div>
      <div class="ai-custom-prompt-content">
        <div class="ai-custom-prompt-input-group">
          <label for="honeInInput">What should we refine in this response?</label>
          <textarea id="honeInInput" placeholder="e.g., Be more assertive in the last paragraph; emphasize timeline." rows="3"></textarea>
          <small style="color: #6c757d; font-size: 11px; margin-top: 4px; display: block;">
            💡 Your instructions will refine the current response. Existing links and inline images will be preserved.
          </small>
        </div>
      </div>
      <div class="ai-custom-prompt-actions">
        <button class="ai-custom-prompt-btn ai-custom-prompt-cancel" type="button">Cancel</button>
        <button class="ai-custom-prompt-btn ai-custom-prompt-generate" type="button">Hone</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.makeDraggable(modal);
    
    setTimeout(() => {
      modal.querySelector('#honeInInput').focus();
    }, 100);
    
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    modal.querySelector('.ai-custom-prompt-close').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });
    modal.querySelector('.ai-custom-prompt-cancel').addEventListener('click', () => {
      modal.remove();
      document.removeEventListener('keydown', onKeyDown);
    });
    
    modal.querySelector('.ai-custom-prompt-generate').addEventListener('click', () => {
      const instructions = modal.querySelector('#honeInInput').value.trim();
      if (instructions) {
        modal.remove();
        document.removeEventListener('keydown', onKeyDown);
        this.handleHoneIn(instructions, editorElement, capturedRange, anchorEl);
      } else {
        this.showNotification('Please enter instructions', 'warning');
      }
    });
    
    modal.querySelector('#honeInInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        modal.querySelector('.ai-custom-prompt-generate').click();
      }
    });
  }

  async handleHoneIn(instructions, editorElement, preCapturedRange = null, anchorEl = null) {
    if (this.isProcessing) {
      this.showNotification('⏳ Already processing, please wait...', 'warning');
      return;
    }
    if (!this.config?.apiKey) {
      this.showNotification('❌ Please configure your AI API key in the extension settings', 'error');
      return;
    }

    // Prefer selection when present; else template area; else full editor
    let textData = null;
    try {
      const range = preCapturedRange;
      const hasRange = range && !range.collapsed;
      if (hasRange) {
        const cloned = range.cloneContents();
        const holder = document.createElement('div');
        holder.appendChild(cloned);
        const tmpExtraction = this.extractTextWithLinkPlaceholders(holder);
        const editorCtx = this.getEditorText(editorElement);
        textData = {
          hasTemplate: !!editorCtx?.hasTemplate,
          extractedText: (tmpExtraction.textWithPlaceholders || '').trim(),
          fullText: tmpExtraction.textWithPlaceholders || '',
          linkMap: tmpExtraction.linkMap || {},
          imgMap: tmpExtraction.imgMap || {},
          editorElement: editorElement
        };
        const dbgLen = (textData.extractedText || '').length;
        console.log(`🎯 Hone-in: operating on selection (${dbgLen} chars); target: ${textData.hasTemplate ? 'template placeholder' : 'editor body'}`);
      }
    } catch (_) {}
    if (!textData) {
      textData = this.getEditorText(editorElement);
      console.log(`🎯 Hone-in: operating on ${textData.hasTemplate ? 'template placeholder' : 'whole editor'} (${(textData.extractedText || textData.fullText || '').length} chars)`);
    }

    if (!textData.extractedText || textData.extractedText.trim().length === 0) {
      this.showNotification('❌ No response found to hone', 'error');
      return;
    }

    this.isProcessing = true;
    const processingNotification = this.showPersistentNotification('🤖 Honing in...', 'info', null, anchorEl || this.getAnchorForEditor(editorElement));
    
    try {
      // Optional ticket context (like other actions; skip would be fine too)
      let ticketContext = '';
      if (this.config?.useTicketContext) {
        const contextData = this.extractTicketContext();
        ticketContext = contextData.text || '';
      }

      const formatting = 'Use only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>. Keep [LINK#] and [IMG#] placeholders intact. No headings, tables, images, or Markdown. Return only the HTML.';
      const honePrompt = `Refine the following customer-facing response according to these instructions: "${instructions}". Preserve the meaning and keep the message customer-appropriate. Do not remove placeholders or content. ${formatting}`;

      let enhancedText = await this.callAI(honePrompt, textData.extractedText, ticketContext);
      if (!enhancedText || enhancedText.trim().length === 0) {
        console.warn('⚠️ Hone-in returned empty; falling back to showing original text for formatting-only path');
        enhancedText = textData.extractedText;
      }

      processingNotification.remove();

      if (enhancedText) {
        const cleanEnhancedText = this.normalizeHTMLForInsert(enhancedText.trim().replace(/^\s+/gm, ''));
        this.showAIPreview(editorElement, textData, cleanEnhancedText, 'Help me hone in');
      } else {
        this.showNotification('❌ No enhancement was generated', 'error');
      }
    } catch (error) {
      processingNotification.remove();
      console.error('Hone-in error:', error);
      this.showNotification(`❌ Hone-in failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  async handleCustomPrompt(customPrompt, editorElement, anchorEl = null) {
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
    const processingNotification = this.showPersistentNotification(`🤖 Generating content...`, 'info', null, anchorEl || this.getAnchorForEditor(editorElement));

    try {
      // For Help Me Write, ignore selections. Always use editor content as context.
      // If a template is detected, use everything after "Additional Context?".
      // Otherwise, use the entire editor text.
      const textData = this.getEditorText(editorElement);

      // Context for the model (template: use Additional Context; otherwise whole text)
      let contextText = '';
      if (textData.hasTemplate) {
        contextText = this.extractAdditionalContextSection(textData.fullText).trim();
        console.log(`📝 Editor context (from Additional Context section): ${contextText ? `"${contextText.slice(0, 100)}${contextText.length > 100 ? '...' : ''}" (${contextText.length} chars)` : '(empty)'}`);
      } else {
        contextText = (textData.fullText || '').trim();
        console.log(`📝 Editor context (full editor text): ${contextText ? `"${contextText.slice(0, 100)}${contextText.length > 100 ? '...' : ''}" (${contextText.length} chars)` : '(empty)'}`);
      }
      // Collect inline images referenced in context via [IMG#] placeholders and convert to data URLs
      const contextImages = await this.collectContextImagesAsDataUrls(contextText, textData.imgMap);
      // What the UI should show as "Current text" and what REPLACE operates on: PR placeholder (or whole text when no template)
      const currentResponseText = textData.hasTemplate ? (textData.extractedText || '').trim() : (textData.fullText || '').trim();
      
      // Enhanced prompt - let the model interpret user intent flexibly
      let enhancedPrompt = `USER INSTRUCTION: ${customPrompt}

CRITICAL: Follow the user's instruction EXACTLY. The user instruction tells you WHAT to write. The ticket context below tells you WHO you're writing to and what the conversation is about. Do NOT conflate old messages with recent ones - focus on the CURRENT STATE of the conversation (the most recent 1-2 messages).

By default, write a professional customer support response starting with "Dear [Customer Name]," unless the user's request clearly asks for something else.`;
      
      // If there's existing text, include it as context
      let fullPrompt = enhancedPrompt;
      if (contextText) {
        fullPrompt = `${enhancedPrompt}\n\n[AGENT WORK NOTES - FOR CONTEXT ONLY]\nThese are the agent's private investigation notes and questions to themselves while researching this ticket. They are NOT messages from the customer. Do NOT address or answer these notes. Use them only as background information about what the agent has already investigated.\n\n${contextText}\n\n[END AGENT NOTES]`;
      }

      // Get ticket context if enabled
      let ticketContext = '';
      let ticketContextText = '';
      let timelineImages = [];
      let productInfo = '';
      if (this.config?.useTicketContext) {
        const contextData = this.extractTicketContext();
        ticketContextText = contextData.text || '';
        timelineImages = contextData.images || [];
        ticketContext = ticketContextText; // For backward compatibility
        productInfo = this.extractProductInfo(ticketContextText);
        console.log('🎯 Extracted ticket context for custom prompt:', ticketContextText ? 'Found context' : 'No context found');
        console.log('🖼️ Timeline images found:', timelineImages.length);
        console.log('🏷️ Detected product:', productInfo || 'None detected');
        
        if (productInfo) {
          fullPrompt += `\n\nProduct context: We are supporting ${productInfo}. Please ensure the response and signature are relevant to this product.`;
        }
      }
      
      // Collect timeline images (from previous messages) and merge with editor images
      const timelineImageDataUrls = await this.collectTimelineImagesAsDataUrls(timelineImages, 5);
      const allContextImages = [...contextImages, ...timelineImageDataUrls];
      console.log(`🖼️ Total images for AI: ${allContextImages.length} (${contextImages.length} from editor, ${timelineImageDataUrls.length} from timeline)`);

      // Append formatting guidance for limited HTML output and placeholders
      fullPrompt += '\n\nWeigh the most recent customer message heavily when deciding tone and closure. If the latest customer response expresses thanks or confirms resolution, include a warm, succinct closure and next steps (if any). If not, propose a helpful next action.';
      fullPrompt += '\n\nFormatting requirements: Use only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>; organize into short paragraphs and bullet lists where helpful; no headings, tables, images, or Markdown. Keep [LINK#] and [IMG#] placeholders exactly as-is. Return only the HTML.';


      // Debug visibility: log the assembled prompt and context summary
      try {
        const dbg = {
          usingTicketContext: !!ticketContextText,
          editorImages: contextImages.length,
          timelineImages: timelineImageDataUrls.length,
          totalImages: allContextImages.length,
          promptPreview: fullPrompt.slice(0, 1500) + (fullPrompt.length > 1500 ? '... [truncated]' : '')
        };
        console.log('🧪 Help me write: composed prompt', dbg);
      } catch (_) {}

      // Run classification in PARALLEL with main AI call (only if template detected)
      const classificationPromise = textData.hasTemplate 
        ? this.classifyPromptAsEscalation(customPrompt)
        : Promise.resolve(false);

      // Send the user's prompt as the primary instruction; include our assembled details separately
      let generatedText = await this.callAI(customPrompt, fullPrompt, ticketContextText, allContextImages);
      
      // If empty and we had images, retry with fewer images (token limit mitigation)
      if ((!generatedText || generatedText.trim().length === 0) && allContextImages.length > 0) {
        console.warn(`⚠️ Empty response with ${allContextImages.length} images; retrying with reduced images`);
        const reducedImages = allContextImages.slice(0, Math.max(1, Math.floor(allContextImages.length / 2)));
        generatedText = await this.callAI(customPrompt, fullPrompt, ticketContextText, reducedImages);
      }
      
      // Get classification result (should be ready by now since it ran in parallel)
      const isEscalation = await classificationPromise;
      console.log(`🏷️ Content will be placed in: ${isEscalation ? 'ESCALATION section' : 'PR section'}`);
      
      // Remove processing notification before showing modal
      processingNotification.remove();
      
      if (generatedText) {
        // Clean up the generated text before showing preview
        const cleanGeneratedText = this.normalizeHTMLForInsert(generatedText.trim().replace(/^\s+/gm, ''));
        
        // For custom prompts, show preview with option to replace or append
        // Pass isEscalation flag to determine which section to target
        this.showCustomWritePreview(editorElement, textData, cleanGeneratedText, customPrompt, currentResponseText, isEscalation);
      } else {
        this.showNotification('❌ No content was generated', 'error');
      }
    } catch (error) {
      // Remove processing notification on error
      processingNotification.remove();
      console.error('Custom prompt error:', error);
      this.showNotification(`❌ Content generation failed: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  showCustomWritePreview(editorElement, originalTextData, generatedText, customPrompt, existingText, isEscalation = false) {
    // Remove any existing preview
    const existingPreview = document.querySelector('.kayako-ai-preview');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'kayako-ai-preview';
    
    const hasExistingText = existingText && existingText.length > 0;
    const targetSection = isEscalation ? 'escalation section' : 'PR section';
    const sectionBadge = originalTextData.hasTemplate 
      ? `<span class="ai-section-badge ${isEscalation ? 'escalation' : 'pr'}">${isEscalation ? '📋 → Escalation Section' : '💬 → PR Section'}</span>` 
      : '';

    preview.innerHTML = `
      <div class="ai-preview-header">
        <span class="ai-preview-title">✍️ Generated Content ${sectionBadge}</span>
        <button class="ai-preview-close" type="button">×</button>
      </div>
      <div class="ai-preview-content">
        <div class="ai-preview-section">
          <div class="ai-preview-label">Your request: "${customPrompt}"</div>
        </div>
        ${hasExistingText ? `
        <div class="ai-preview-section">
          <div class="ai-preview-label">Current text:</div>
          <div class="ai-preview-text ai-preview-original">${this.escapeHTML(this.cleanTemplateEdges(existingText))}</div>
        </div>` : ''}
        <div class="ai-preview-section">
          <div class="ai-preview-label">Generated content:</div>
          <button class="ai-preview-copy-btn" type="button" title="Copy text">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
            Copy
          </button>
          <div class="ai-preview-text ai-preview-enhanced">${generatedText.replace(/^\s+/gm, '').trim()}</div>
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
      document.removeEventListener('keydown', onKeyDown);
    });

    preview.querySelector('.ai-preview-cancel').addEventListener('click', () => {
      preview.remove();
      document.removeEventListener('keydown', onKeyDown);
    });

    // Handle insert/replace/append actions
    const insertBtn = preview.querySelector('.ai-preview-insert');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'insert', isEscalation);
        this.showNotification(`✅ Content inserted in ${targetSection}`, 'success');
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      });
    }

    const replaceBtn = preview.querySelector('.ai-preview-replace');
    if (replaceBtn) {
      replaceBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'replace', isEscalation);
        this.showNotification(`✅ Content replaced in ${targetSection}`, 'success');
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      });
    }

    const appendBtn = preview.querySelector('.ai-preview-append');
    if (appendBtn) {
      appendBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'append', isEscalation);
        this.showNotification(`✅ Content appended to ${targetSection}`, 'success');
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      });
    }

    // Copy button functionality for custom write preview
    const customCopyBtn = preview.querySelector('.ai-preview-copy-btn');
    if (customCopyBtn) {
      customCopyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          // Get clean text content (remove HTML but preserve line breaks)
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = generatedText;
          const cleanText = (tempDiv.textContent || tempDiv.innerText || generatedText).trim();
          
          await navigator.clipboard.writeText(cleanText);
          
          // Visual feedback - just change to checkmark
          const originalText = customCopyBtn.innerHTML;
          customCopyBtn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          `;
          customCopyBtn.style.color = '#28a745';
          
          setTimeout(() => {
            customCopyBtn.innerHTML = originalText;
            customCopyBtn.style.color = '';
          }, 1000);
          
        } catch (error) {
          console.error('Copy failed:', error);
          this.showNotification('❌ Copy failed', 'error');
        }
      });
    }
    // ESC to close
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  }

  makeDraggable(modal) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    const header = modal.querySelector('.ai-preview-header, .ai-custom-prompt-header');
    if (!header) return;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = modal.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      modal.style.transform = 'none';
      modal.style.left = initialX + 'px';
      modal.style.top = initialY + 'px';
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newX = initialX + deltaX;
      let newY = initialY + deltaY;
      
      // Keep modal within viewport bounds
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      const modalRect = {
        width: modal.offsetWidth,
        height: modal.offsetHeight
      };
      
      newX = Math.max(10, Math.min(newX, viewport.width - modalRect.width - 10));
      newY = Math.max(10, Math.min(newY, viewport.height - modalRect.height - 10));
      
      modal.style.left = newX + 'px';
      modal.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });
  }

  insertCustomText(editorElement, originalTextData, generatedText, action, isEscalation = false) {
    // If selection was captured, prefer replacing that selection
    if (originalTextData && originalTextData.selectionRange) {
      const range = originalTextData.selectionRange;
      const html = this.normalizeHTMLForInsert(
        this.restoreImagesInText(
          this.restoreLinksInText(generatedText, originalTextData.linkMap),
          originalTextData.imgMap
        )
      );
      const fragment = document.createDocumentFragment();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      while (wrapper.firstChild) {
        fragment.appendChild(wrapper.firstChild);
      }
      range.deleteContents();
      range.insertNode(fragment);
      // Collapse to end
      const selection = window.getSelection();
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Trigger change events
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      const changeEvent = new Event('fr-change', { bubbles: true });
      editorElement.dispatchEvent(changeEvent);
      
      // Highlight
      setTimeout(() => { this.highlightNewText(editorElement); }, 100);
      return;
    }

    if (action === 'insert' || !originalTextData.extractedText.trim()) {
      // Insert new content (for empty editor or explicit insert)
      if (originalTextData.hasTemplate) {
        const normalized = this.normalizePlaceholders(generatedText, originalTextData.linkMap, originalTextData.imgMap);
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(normalized, originalTextData.linkMap),
          originalTextData.imgMap
        );
        const htmlContent = this.normalizeHTMLForInsert(textWithRestored);
        
        // For escalations, use escalation section; otherwise use PR section
        if (isEscalation) {
          console.log('📋 Inserting into ESCALATION section');
          const inserted = this.replaceEscalationSection(editorElement, htmlContent);
          if (!inserted) {
            console.warn('⚠️ Escalation section not found, falling back to PR section');
            this.setEditorText(editorElement, originalTextData, generatedText);
          }
        } else {
          // Use the same surgical approach as regular text replacement
          this.setEditorText(editorElement, originalTextData, generatedText);
        }
      } else {
        const normalized = this.normalizePlaceholders(generatedText, originalTextData.linkMap, originalTextData.imgMap);
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(normalized, originalTextData.linkMap),
          originalTextData.imgMap
        );
        editorElement.innerHTML = this.normalizeHTMLForInsert(textWithRestored);
      }
    } else if (action === 'replace') {
      // Replace existing content - ALWAYS check for template first
      console.log('🔧 Help me write REPLACE: Checking for template...');
      
      // Re-extract text to check for template (since custom prompts might not have detected it)
      const currentTextData = this.getEditorText(editorElement);
      
      if (currentTextData.hasTemplate) {
        const normalized = this.normalizePlaceholders(generatedText, originalTextData.linkMap, originalTextData.imgMap);
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(normalized, originalTextData.linkMap),
          originalTextData.imgMap
        );
        const htmlContent = this.normalizeHTMLForInsert(textWithRestored);
        
        // For escalations, use escalation section; otherwise use PR section
        if (isEscalation) {
          console.log('🎯 Template detected! Using escalation section for replacement');
          const inserted = this.replaceEscalationSection(editorElement, htmlContent);
          if (!inserted) {
            console.warn('⚠️ Escalation section not found, falling back to PR section');
            this.setEditorText(editorElement, currentTextData, generatedText);
          }
        } else {
          console.log('🎯 Template detected! Using surgical replacement within PR section');
          this.setEditorText(editorElement, currentTextData, generatedText);
        }
      } else {
        console.log('📝 No template detected, replacing full content');
        const normalized = this.normalizePlaceholders(generatedText, originalTextData.linkMap, originalTextData.imgMap);
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(normalized, originalTextData.linkMap),
          originalTextData.imgMap
        );
        editorElement.innerHTML = this.normalizeHTMLForInsert(textWithRestored);
      }
    } else if (action === 'append') {
      // Append at cursor position, not at the end
      console.log('🔧 Help me write APPEND: Inserting at cursor position');
      
      // Try to insert at cursor position
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      
      if (range && editorElement.contains(range.commonAncestorContainer)) {
        // Insert at cursor position
        console.log('📍 Inserting at cursor position');
        const normalized = this.normalizePlaceholders(generatedText, originalTextData.linkMap, originalTextData.imgMap);
        const textWithRestoredLinks = this.restoreImagesInText(
          this.restoreLinksInText(normalized, originalTextData.linkMap),
          originalTextData.imgMap
        );
        
        // Create a document fragment with the new content
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('span');
        // Do not force line breaks; let the normalized HTML define structure
        wrapper.innerHTML = this.normalizeHTMLForInsert(textWithRestoredLinks);
        
        // Move all child nodes to the fragment
        while (wrapper.firstChild) {
          fragment.appendChild(wrapper.firstChild);
        }
        
        // Insert at cursor
        range.deleteContents();
        range.insertNode(fragment);
        
        // Move cursor to end of inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
      } else {
        // Fallback: append at end if no cursor position detected
        console.log('📍 No cursor detected, appending at end');
        if (originalTextData.hasTemplate) {
          const appendedContent = originalTextData.extractedText + '\n\n' + generatedText;
          const newTextData = { ...originalTextData, extractedText: appendedContent };
          this.setEditorText(editorElement, newTextData, appendedContent);
        } else {
          const currentHTML = editorElement.innerHTML;
          const textWithRestoredLinks = this.restoreLinksInText(generatedText, originalTextData.linkMap);
          const newContentHTML = this.normalizeHTMLForInsert(textWithRestoredLinks);
          // Append without forcing extra <br>, to avoid Froala expanding blanks
          const combined = this.stabilizeHTMLForEditor(currentHTML + newContentHTML);
          editorElement.innerHTML = combined;
        }
      }
    }
    
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

  extractTicketContext() {
    try {
      // Find all message/note items in the timeline
      const messageItems = document.querySelectorAll('.message-or-note .ko-timeline-2_list_item__post_1oksrd, .message-or-note .ko-timeline-2_list_item__note_1oksrd');
      
      console.log(`🔍 Found ${messageItems.length} messages/notes in timeline`);
      
      const messages = [];
      const timelineImages = []; // Collect images from timeline
      
      messageItems.forEach((item, index) => {
        try {
          // Extract author
          const authorElement = item.querySelector('.ko-timeline-2_list_item__creator_1oksrd');
          const author = authorElement ? authorElement.textContent.trim() : 'Unknown';
          
          // Extract content
          const contentElement = item.querySelector('.ko-timeline-2_list_item__html-content_1oksrd, .ko-timeline-2_list_item__content_1oksrd');
          let content = '';
          let hasImages = false;
          
          if (contentElement) {
            // Check for images in this message and collect them
            const images = contentElement.querySelectorAll('img');
            if (images.length > 0) {
              hasImages = true;
              images.forEach((img, imgIdx) => {
                const src = img.getAttribute('src');
                if (src) {
                  timelineImages.push({
                    src,
                    author,
                    messageIndex: index,
                    imgIndex: imgIdx
                  });
                }
              });
            }
            
            // Get clean text content, removing HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = contentElement.innerHTML;
            content = tempDiv.textContent || tempDiv.innerText || '';
            content = content.trim().replace(/\s+/g, ' '); // Normalize whitespace
          }
          
          // Extract time (optional)
          const timeElement = item.querySelector('.ko-timeline-2_list_item__time_1oksrd');
          const time = timeElement ? timeElement.textContent.trim() : '';
          
          if (content && content.length > 10) { // Only include substantial messages
            messages.push({
              author,
              content: content.substring(0, 500), // Limit length to manage tokens
              time,
              index,
              hasImages
            });
          }
        } catch (error) {
          console.warn('Error extracting message at index', index, error);
        }
      });
      
      console.log(`📋 Extracted ${messages.length} substantial messages for context`);
      console.log(`🖼️ Found ${timelineImages.length} images in timeline messages`);
      
      if (messages.length === 0) {
        return { text: '', images: timelineImages };
      }
      
      // Number messages chronologically (DOM order = oldest first in Kayako timeline)
      const numberedMessages = messages.map((msg, i) => {
        const recency = messages.length - i; // 1 = most recent
        const recencyLabel = recency === 1 ? '[MOST RECENT]' : recency === 2 ? '[2nd most recent]' : `[#${i + 1} of ${messages.length}]`;
        const imgNote = msg.hasImages ? ' [contains image(s)]' : '';
        return `${recencyLabel} ${msg.author}${msg.time ? ` (${msg.time})` : ''}${imgNote}: ${msg.content}`;
      });
      
      // Highlight the last 2 messages as THE current conversation state
      const last2 = messages.slice(-2);
      const currentExchangeLines = last2.map((msg, i) => {
        const label = i === last2.length - 1 ? '>>> [MOST RECENT MESSAGE]' : '>>> [PREVIOUS MESSAGE]';
        const imgNote = msg.hasImages ? ' [contains image(s) - see attached]' : '';
        return `${label} ${msg.author}${msg.time ? ` (${msg.time})` : ''}${imgNote}: ${msg.content}`;
      }).join('\n\n');

      const text = `[TICKET CONVERSATION - ${messages.length} messages, CHRONOLOGICAL ORDER]

=== CURRENT STATE - FOCUS HERE ===
These are the MOST RECENT messages. Your response should address THIS state of the conversation:

${currentExchangeLines}

=== FULL HISTORY (oldest → newest, for background only) ===
${numberedMessages.join('\n\n')}

[END TICKET CONTEXT]

---

`;
      
      return { text, images: timelineImages };
    } catch (error) {
      console.error('Error extracting ticket context:', error);
      return { text: '', images: [] };
    }
  }
  
  // Convert timeline image URLs to data URLs for API consumption
  async collectTimelineImagesAsDataUrls(timelineImages, maxImages = 5) {
    if (!timelineImages || timelineImages.length === 0) return [];
    
    // Prioritize most recent images (last messages first)
    const sortedImages = [...timelineImages].reverse().slice(0, maxImages);
    console.log(`🖼️ Processing ${sortedImages.length} timeline images (from ${timelineImages.length} total)`);
    
    const dataUrls = [];
    for (const imgInfo of sortedImages) {
      try {
        const src = imgInfo.src;
        let dataUrl = '';
        
        if (src.startsWith('data:')) {
          dataUrl = src;
        } else {
          const res = await fetch(src, { credentials: 'include' });
          const blob = await res.blob();
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        
        if (typeof dataUrl === 'string') {
          const compressed = await this.compressImageDataUrl(dataUrl);
          dataUrls.push(compressed);
          console.log(`🖼️ Timeline image from ${imgInfo.author}: ${Math.round(dataUrl.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
        }
      } catch (e) {
        console.warn(`⚠️ Could not fetch timeline image from ${imgInfo.author}:`, e?.message || e);
      }
    }
    
    console.log(`🖼️ Total timeline images loaded: ${dataUrls.length}`);
    return dataUrls;
  }

  extractProductInfo(ticketContext) {
    if (!ticketContext) return '';
    
    // Common product patterns to look for
    const productPatterns = [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\s+Support Team/gi,
      /{{case\.custom_fields\.Product\.value}}/gi,
      /supporting\s+([A-Z][a-zA-Z\s]+)/gi,
      /\b(Khoros|Meta|Telus|GFI|Aurea|Kayako|Salesforce|Microsoft|Google|Adobe)\b/gi,
      /\b([A-Z]{2,})\s+(Care|Support|Platform|Portal)/gi
    ];
    
    const detectedProducts = new Set();
    
    productPatterns.forEach(pattern => {
      const matches = ticketContext.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2) {
          detectedProducts.add(match[1].trim());
        }
      }
    });
    
    if (detectedProducts.size > 0) {
      return Array.from(detectedProducts).join(', ');
    }
    
    return '';
  }

  async callAI(prompt, text, ticketContext = '', images = []) {
    // Base system prompt
    let systemPrompt = 'You are a helpful assistant that enhances text for customer support communications. Always maintain a professional and helpful tone. Return only the enhanced text without any explanations or additional commentary. Be clear, concise and to the point in customer communication. Avoid promising specific timelines or solutions, and generally avoid suggesting jumping into a remote session to fix issues.';
    
    // Append custom instructions if provided (don't override)
    if (this.config.systemPrompt && this.config.systemPrompt.trim()) {
      systemPrompt += '\n\nAdditional instructions: ' + this.config.systemPrompt.trim();
    }
    
    const model = this.config.model || 'gpt-5-mini';
    
    // Clamp overly large inputs to avoid silently empty outputs
    const clamp = (s, max) => (s && s.length > max) ? (s.slice(0, max) + '\n…[truncated]') : (s || '');
    const MAX_TEXT = 8000; // characters
    const MAX_CTX = 8000;
    // Build user content with the user's instruction first, then details, then context
    let userContent = '';
    if (prompt) userContent += `${prompt}`;
    if (text) userContent += `\n\nDetails:\n${clamp(text, MAX_TEXT)}`;
    if (ticketContext) userContent += `\n\nTicket context:\n${clamp(ticketContext, MAX_CTX)}`;
    
    const userMessage = {
      role: 'user'
    };
    if (images && images.length > 0) {
      userMessage.content = [
        { type: 'text', text: userContent },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } }))
      ];
    } else {
      userMessage.content = userContent;
    }

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        userMessage
      ],
      max_completion_tokens: ticketContext ? 3000 : 2000 // More tokens when using context
    };

    // Only add temperature for models that support it (not GPT-5)
    if (!model.startsWith('gpt-5')) {
      requestBody.temperature = this.config.temperature || 0.7;
    }

    // Route to correct provider based on model name
    const provider = model.startsWith('claude-') ? 'anthropic' : 'openai';
    const action = provider === 'anthropic' ? 'anthropicChat' : 'openaiChat';
    console.log(`🔀 Routing to ${provider} for model ${model}`);
    
    const sendOnce = () => new Promise((resolve) => {
      try {
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve({ success: false, error: 'Extension context invalidated. Please reload the page.' });
          return;
        }
        chrome.runtime.sendMessage({ action, requestBody }, (resp) => {
          // Check callback error details
          if (chrome?.runtime?.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message || 'Message failed' });
            return;
          }
          resolve(resp || { success: false, error: 'No response from background' });
        });
      } catch (e) {
        resolve({ success: false, error: e?.message || 'Message failed' });
      }
    });

    // Try once, then one quick retry if the worker was reloaded
    let result = await sendOnce();
    if (!result?.success) {
      const msg = (result?.error || '').toLowerCase();
      const transient = msg.includes('invalidated') || msg.includes('receiving end does not exist') || msg.includes('the message port closed');
      if (transient) {
        try { console.warn('AI request failed, retrying shortly due to transient error:', result?.error); } catch (_) {}
        await new Promise(r => setTimeout(r, 400));
        result = await sendOnce();
      }
    }
    if (!result?.success) {
      try { console.error('AI request failed', { model, error: result?.error }); } catch (_) {}
      throw new Error(result?.error || 'AI request failed');
    }
    const data = result.data || {};
    const out = data.choices?.[0]?.message?.content?.trim() || '';
    if (!out) {
      console.warn('⚠️ AI responded with empty content');
    }
    return out;
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
    return this.showPersistentNotification(message, type, type === 'error' ? 5000 : 3000);
  }

  showPersistentNotification(message, type = 'info', autoRemoveDelay = null, anchorEl = null) {
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
      animation: slideInRight 0.2s ease-out;
      pointer-events: none;
    `;

    document.body.appendChild(notification);

    // Position near anchor element when provided
    const isVisible = (el) => {
      try {
        if (!el || typeof el.getBoundingClientRect !== 'function') return false;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
      } catch (_) { return false; }
    };

    let anchor = anchorEl;
    if (!isVisible(anchor)) {
      // Fallback: use nearest visible AI dropdown button
      const all = document.querySelectorAll('.kayako-ai-dropdown');
      for (const btn of all) {
        if (isVisible(btn)) { anchor = btn; break; }
      }
    }

    if (isVisible(anchor)) {
      const rect = anchor.getBoundingClientRect();
      const gap = 8;
      let top = rect.bottom + gap;
      let left = rect.left;

      // Clamp inside viewport after measuring size
      const { innerWidth, innerHeight } = window;
      const box = notification.getBoundingClientRect();
      if (left + box.width + 12 > innerWidth) {
        left = Math.max(12, innerWidth - box.width - 12);
      }
      if (top + box.height + 12 > innerHeight) {
        top = Math.max(12, rect.top - box.height - gap);
      }
      notification.style.left = `${left}px`;
      notification.style.top = `${top}px`;
    } else {
      // Default: top-right
      notification.style.top = '20px';
      notification.style.right = '20px';
    }

    // Auto remove after delay if specified
    if (autoRemoveDelay) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOutRight 0.3s ease-out';
          setTimeout(() => notification.remove(), 300);
        }
      }, autoRemoveDelay);
    }

    return notification; // Return reference so it can be manually removed
  }

  // Find the AI trigger button near the provided editor to anchor notifications
  getAnchorForEditor(editorElement) {
    try {
      const container = editorElement.closest('.ko-text-editor__container_1p5g6r') || document.body;
      // Prefer the visible AI button inside this editor container
      let aiBtn = container.querySelector('.kayako-ai-dropdown');
      if (!aiBtn) {
        // Fallback: find the closest visible AI button in the DOM
        const all = document.querySelectorAll('.kayako-ai-dropdown');
        for (const btn of all) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { aiBtn = btn; break; }
        }
      }
      return aiBtn || container;
    } catch (_) {
      return null;
    }
  }
}

// Initialize when the page is ready
// console.log('🤖 Kayako AI Content Script loaded on:', window.location.href);
// console.log('🤖 Document state:', document.readyState);

try {
  if (document.readyState === 'loading') {
    // console.log('🤖 Waiting for DOM to load...');
    document.addEventListener('DOMContentLoaded', () => {
      // console.log('🤖 DOM loaded, initializing...');
      new KayakoAIEnhancer();
    });
  } else {
    // console.log('🤖 DOM already ready, initializing immediately...');
    new KayakoAIEnhancer();
  }
} catch (error) {
  console.error('🤖 Critical error in content script initialization:', error);
}
