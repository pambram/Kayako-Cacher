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
      this.config = result.kayakoAIConfig || {
        apiKey: '',
        provider: 'openai', // openai, anthropic, etc
        model: 'gpt-5-mini',
        enabled: true,
        useTicketContext: false
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
        prompt: 'Polish and improve the following text while maintaining its original meaning and tone: ' + formatHint,
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
          this.showCustomPromptModal(editorElement);
        } else if (action.id === 'hone_in') {
          this.showHoneInModal(editorElement);
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
    const processingNotification = this.showPersistentNotification(`🤖 ${action.title}...`, 'info', null, this.getAnchorForEditor(editorElement));

    try {
      // Get ticket context if enabled (skip for Beautify to keep it fast)
      let ticketContext = '';
      if (this.config?.useTicketContext && action.id !== 'beautify') {
        ticketContext = this.extractTicketContext();
        console.log('🎯 Extracted ticket context:', ticketContext ? 'Found context' : 'No context found');
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
      /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Best\s+regards,/i,
      /What is the PR to the customer\?\s*([\s\S]*?)\s*Best regards,/i,
      /PR\s+to\s+the\s+customer\?\s*([\s\S]*?)\s*Best\s+regards,/i
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      console.log(`🔍 Pattern ${i + 1} match result:`, match ? 'FOUND' : 'NOT FOUND');
      
      if (match) {
        // Extract the content between the markers (can be empty/whitespace)
        const extractedText = match[1] ? match[1].trim() : '';
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
      const idx = text.search(/Additional\s*Context\?/i);
      if (idx === -1) {
        return '';
      }
      let after = text.slice(idx + 'Additional Context?'.length);
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
    // Restore links in the enhanced text
    const textWithRestoredLinks = this.restoreLinksInText(newText, textData.linkMap);
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
        // Use innerHTML replacement with regex to preserve HTML structure
        console.log('🔧 Performing HTML-based surgical replacement (fallback)');
        console.log('🔍 Looking for text to replace:', JSON.stringify(textData.extractedText));
        console.log('🔍 New text with links restored:', JSON.stringify(textWithRestoredLinks));
        const escapedOriginalText = textData.extractedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const newHTML = textData.originalHTML.replace(
          new RegExp(escapedOriginalText, 'g'),
          this.normalizeHTMLForInsert(textWithRestoredMedia)
        );
        editorElement.innerHTML = newHTML;
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

  // Replace content between PR template markers when placeholder is empty
  replaceTemplatePlaceholder(editorElement, newTextHTML) {
    try {
      const startRe = /What\s+is\s+the\s+PR\s+to\s+the\s+customer\?/i;
      const endRe = /Best\s+regards,/i;
      
      const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null, false);
      let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const val = node.nodeValue;
        if (!startNode) {
          const m = val.match(startRe);
          if (m) {
            startNode = node;
            startOffset = m.index + m[0].length;
          }
        } else {
          const m2 = val.match(endRe);
          if (m2) {
            endNode = node;
            endOffset = m2.index;
            break;
          }
        }
      }
      
      if (!startNode || !endNode) {
        console.warn('⚠️ Could not find both template markers for insertion');
        return false;
      }
      
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      
      // Delete existing (empty/whitespace) content between markers
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

  showHoneInModal(editorElement) {
    // Capture current selection inside the editor BEFORE showing the modal
    let capturedRange = null;
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (!r.collapsed && editorElement.contains(r.commonAncestorContainer)) {
          capturedRange = r.cloneRange();
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
        this.handleHoneIn(instructions, editorElement, capturedRange);
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

  async handleHoneIn(instructions, editorElement, preCapturedRange = null) {
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
          imgMap: tmpExtraction.imgMap || {},
          selectionRange: range,
          editorElement: editorElement
        };
      }
    } catch (_) {}
    if (!textData) {
      textData = this.getEditorText(editorElement);
    }

    if (!textData.extractedText || textData.extractedText.trim().length === 0) {
      this.showNotification('❌ No response found to hone', 'error');
      return;
    }

    this.isProcessing = true;
    const processingNotification = this.showPersistentNotification('🤖 Honing in...', 'info', null, this.getAnchorForEditor(editorElement));
    
    try {
      // Optional ticket context (like other actions; skip would be fine too)
      let ticketContext = '';
      if (this.config?.useTicketContext) {
        ticketContext = this.extractTicketContext();
      }

      const formatting = 'Use only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>. Keep [LINK#] and [IMG#] placeholders intact. No headings, tables, images, or Markdown. Return only the HTML.';
      const honePrompt = `Refine the following customer-facing response according to these instructions: "${instructions}". Preserve the meaning and keep the message customer-appropriate. Do not remove placeholders or content. ${formatting}`;

      let enhancedText = await this.callAI(honePrompt, textData.extractedText, ticketContext);

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
    const processingNotification = this.showPersistentNotification(`🤖 Generating content...`, 'info', null, this.getAnchorForEditor(editorElement));

    try {
      // For Help Me Write, ignore selections. Always use editor content as context.
      // If a template is detected, use everything after "Additional Context?".
      // Otherwise, use the entire editor text.
      const textData = this.getEditorText(editorElement);

      // Context for the model (template: use Additional Context; otherwise whole text)
      let contextText = '';
      if (textData.hasTemplate) {
        contextText = this.extractAdditionalContextSection(textData.fullText).trim();
      } else {
        contextText = (textData.fullText || '').trim();
      }
      // What the UI should show as "Current text" and what REPLACE operates on: PR placeholder (or whole text when no template)
      const currentResponseText = textData.hasTemplate ? (textData.extractedText || '').trim() : (textData.fullText || '').trim();
      
      // Enhanced prompt with customer context and product detection
      let enhancedPrompt = customPrompt;
      
      // Add DEAR customer context
      if (!customPrompt.toLowerCase().includes('dear')) {
        enhancedPrompt = `Write a professional customer support response starting with "Dear [Customer Name]," for the following request: ${customPrompt}`;
      }
      
      // If there's existing text, include it as context
      let fullPrompt = enhancedPrompt;
      if (contextText) {
        fullPrompt = `${enhancedPrompt}\n\nCurrent text for context (not to rewrite directly):\n${contextText}`;
      }

      // Get ticket context if enabled
      let ticketContext = '';
      let productInfo = '';
      if (this.config?.useTicketContext) {
        ticketContext = this.extractTicketContext();
        productInfo = this.extractProductInfo(ticketContext);
        console.log('🎯 Extracted ticket context for custom prompt:', ticketContext ? 'Found context' : 'No context found');
        console.log('🏷️ Detected product:', productInfo || 'None detected');
        
        if (productInfo) {
          fullPrompt += `\n\nProduct context: We are supporting ${productInfo}. Please ensure the response and signature are relevant to this product.`;
        }
      }

      // Append formatting guidance for limited HTML output
      fullPrompt += '\n\nFormatting requirements: Use only simple HTML: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>; organize into short paragraphs and bullet lists where helpful; no headings, tables, images, or Markdown. Return only the HTML.';

      const generatedText = await this.callAI('Generate a customer facing response (i.e. a public response, or "PR") based on the following request:', fullPrompt, ticketContext);
      
      // Remove processing notification before showing modal
      processingNotification.remove();
      
      if (generatedText) {
        // Clean up the generated text before showing preview
        const cleanGeneratedText = this.normalizeHTMLForInsert(generatedText.trim().replace(/^\s+/gm, ''));
        
        // For custom prompts, show preview with option to replace or append
        this.showCustomWritePreview(editorElement, textData, cleanGeneratedText, customPrompt, currentResponseText);
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
        this.insertCustomText(editorElement, originalTextData, generatedText, 'insert');
        this.showNotification(`✅ Content inserted successfully`, 'success');
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      });
    }

    const replaceBtn = preview.querySelector('.ai-preview-replace');
    if (replaceBtn) {
      replaceBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'replace');
        this.showNotification(`✅ Content replaced successfully`, 'success');
        preview.remove();
        document.removeEventListener('keydown', onKeyDown);
      });
    }

    const appendBtn = preview.querySelector('.ai-preview-append');
    if (appendBtn) {
      appendBtn.addEventListener('click', () => {
        this.insertCustomText(editorElement, originalTextData, generatedText, 'append');
        this.showNotification(`✅ Content appended successfully`, 'success');
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

  insertCustomText(editorElement, originalTextData, generatedText, action) {
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
        // Use the same surgical approach as regular text replacement
        this.setEditorText(editorElement, originalTextData, generatedText);
      } else {
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(generatedText, originalTextData.linkMap),
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
        console.log('🎯 Template detected! Using surgical replacement within template');
        this.setEditorText(editorElement, currentTextData, generatedText);
      } else {
        console.log('📝 No template detected, replacing full content');
        const textWithRestored = this.restoreImagesInText(
          this.restoreLinksInText(generatedText, originalTextData.linkMap),
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
        const textWithRestoredLinks = this.restoreImagesInText(
          this.restoreLinksInText(generatedText, originalTextData.linkMap),
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
      
      messageItems.forEach((item, index) => {
        try {
          // Extract author
          const authorElement = item.querySelector('.ko-timeline-2_list_item__creator_1oksrd');
          const author = authorElement ? authorElement.textContent.trim() : 'Unknown';
          
          // Extract content
          const contentElement = item.querySelector('.ko-timeline-2_list_item__html-content_1oksrd, .ko-timeline-2_list_item__content_1oksrd');
          let content = '';
          
          if (contentElement) {
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
              index
            });
          }
        } catch (error) {
          console.warn('Error extracting message at index', index, error);
        }
      });
      
      console.log(`📋 Extracted ${messages.length} substantial messages for context`);
      
      if (messages.length === 0) {
        return '';
      }
      
      // Format as conversation context
      const contextLines = messages.map(msg => 
        `${msg.author} (${msg.time}): ${msg.content}`
      );
      
      return `TICKET CONVERSATION HISTORY:\n${contextLines.join('\n\n')}\n\n---\n\n`;
      
    } catch (error) {
      console.error('Error extracting ticket context:', error);
      return '';
    }
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

  async callAI(prompt, text, ticketContext = '') {
    // Base system prompt
    let systemPrompt = 'You are a helpful assistant that enhances text for customer support communications. Always maintain a professional and helpful tone. Return only the enhanced text without any explanations or additional commentary. Be clear, concise and to the point in customer communication. Avoid promising specific timelines or solutions.';
    
    // Append custom instructions if provided (don't override)
    if (this.config.systemPrompt && this.config.systemPrompt.trim()) {
      systemPrompt += '\n\nAdditional instructions: ' + this.config.systemPrompt.trim();
    }
    
    const model = this.config.model || 'gpt-5-mini';
    
    let userContent = `${prompt}\n\nText to enhance:\n${text}`;
    
    // Add ticket context if provided
    if (ticketContext) {
      userContent = `${ticketContext}${userContent}`;
    }
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_completion_tokens: ticketContext ? 3000 : 2000 // More tokens when using context
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
    if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
      const rect = anchorEl.getBoundingClientRect();
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
      const aiBtn = container.querySelector('.kayako-ai-dropdown');
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
