// Image Upload Performance Optimizer
// Optimizes the slow inline image upload/paste process

class KayakoImageOptimizer {
  constructor() {
    this.uploadQueue = [];
    this.processingUploads = false;
    this.compressionSettings = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8,
      format: 'auto' // auto → preserve PNG for crisp UI/screenshot; JPEG for photos
    };
    this.disabled = false;
    this.caretMarkerId = null;
    
    this.init();
  }

  init() {
    // console.log('🖼️ Image upload optimizer initializing...');
    
    // Defer until DOM is ready to avoid MutationObserver target issues
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.optimizeImageUploads(), { once: true });
    } else {
      this.optimizeImageUploads();
    }
    
    // console.log('✅ Image upload optimizer ready');
  }

  optimizeImageUploads() {
    // Find and enhance the dropzone
    const observer = new MutationObserver(() => {
      const dropzones = document.querySelectorAll('.ko-text-editor_draggable-dropzone__dropzone_m415o0');
      
      dropzones.forEach(dropzone => {
        if (!dropzone.dataset.optimized) {
          // console.log('🔧 Optimizing dropzone:', dropzone);
          this.enhanceDropzone(dropzone);
          dropzone.dataset.optimized = 'true';
        }
      });
    });
    
    try {
      const target = document.body || document.documentElement;
      observer.observe(target, { childList: true, subtree: true });
    } catch (e) {
      console.warn('⚠️ Could not start observer immediately, retrying on DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => {
        const target = document.body || document.documentElement;
        try { observer.observe(target, { childList: true, subtree: true }); } catch (_) {}
      }, { once: true });
    }
    
    // Also check existing dropzones
    setTimeout(() => {
      const existingDropzones = document.querySelectorAll('.ko-text-editor_draggable-dropzone__dropzone_m415o0');
      existingDropzones.forEach(dropzone => {
        if (!dropzone.dataset.optimized) {
          this.enhanceDropzone(dropzone);
          dropzone.dataset.optimized = 'true';
        }
      });
    }, 1000);
  }

  enhanceDropzone(dropzone) {
    console.log('🚀 Enhancing dropzone with optimizations...');
    
    // Add optimized drop handler
    dropzone.addEventListener('drop', (e) => {
      if (this.disabled) { return; }
      console.log('📁 Optimized drop handler triggered');
      const files = Array.from(e.dataTransfer.files || []);
      const imageFiles = files.filter(file => file.type && file.type.startsWith('image/'));
      // Skip if only GIFs (let native handler deal with them)
      const nonGifImages = imageFiles.filter(f => (f.type !== 'image/gif') && !(f.name || '').toLowerCase().endsWith('.gif'));
      if (!nonGifImages.length) {
        return; // allow native flow for GIFs
      }
      // Remember caret and block native only when we will handle
      try { this.saveCaretPosition(); } catch (_) {}
      try { e.preventDefault(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
      
      console.log(`🖼️ Processing ${nonGifImages.length} image(s) for optimization...`);
      this.processImagesOptimized(nonGifImages);
      e.stopImmediatePropagation();
    }, true); // Use capture to intercept before slow handlers
    
    // Add paste optimization
    dropzone.addEventListener('paste', (e) => {
      if (this.disabled) { return; }
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const imageItems = items.filter(item => item.type && item.type.startsWith('image/'));
      // Filter out GIFs; if nothing left, let native handler run
      const nonGifItems = imageItems.filter(item => item.type !== 'image/gif');
      if (nonGifItems.length === 0) { return; }
      
      console.log('📋 Optimizing pasted images...');
      // Save caret so we can insert at exact cursor position after upload
      try { this.saveCaretPosition(); } catch (_) {}
      
      // Visual confirmation that optimized path is active
      try { this.showUploadProgress(nonGifItems.length); } catch (_) {}
      
      try { e.preventDefault(); } catch (_) {}
      try { e.stopImmediatePropagation(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
      
      nonGifItems.forEach(item => {
        try {
          const file = item.getAsFile();
          if (file) this.processImagesOptimized([file]);
        } catch (_) {}
      });
    }, true);
  }

  async processImagesOptimized(files) {
    console.log('🔄 Starting optimized image processing...');
    
    // Show progress indicator
    this.showUploadProgress(files.length);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📸 Processing image ${i + 1}/${files.length}: ${file.name}`);
      
      try {
        // Compress image for better performance
        const optimizedFile = await this.compressImage(file);
        console.log(`✅ Compressed ${file.name}: ${file.size} → ${optimizedFile.size} bytes`);
        
        // Upload using optimized process
        await this.uploadOptimized(optimizedFile, i + 1, files.length);
        
      } catch (error) {
        console.error(`❌ Failed to process ${file.name}:`, error);
        this.showUploadError(file.name, error.message);
      }
    }
    
    this.hideUploadProgress();
    console.log('🎉 All images processed');
  }

  async compressImage(file) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate optimal dimensions
        let { width, height } = img;
        const { maxWidth, maxHeight, quality } = this.compressionSettings;
        
        // If quality is 1.0, skip resizing entirely (preserve original dimensions)
        const skipResize = (quality >= 1.0);
        
        if (!skipResize && (width > maxWidth || height > maxHeight)) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
          try { console.log(`🧩 Image resize → ${Math.round(width)}x${Math.round(height)} (max ${maxWidth}x${maxHeight})`); } catch (_) {}
        } else if (skipResize) {
          try { console.log(`🧩 Quality=1.0: preserving original size ${width}x${height} (no resize)`); } catch (_) {}
        } else {
          try { console.log(`🧩 Image within limits: ${width}x${height} (no resize needed)`); } catch (_) {}
        }
        
        // Ensure highest quality resampling
        try {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        } catch (_) {}

        const targetW = Math.max(1, Math.round(width));
        const targetH = Math.max(1, Math.round(height));
        
        // If no resize needed (original size preserved), draw directly
        if (skipResize || (targetW === img.width && targetH === img.height)) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        } else {
          // Progressive downscale to preserve detail when shrinking
          let workCanvas = document.createElement('canvas');
          let workCtx = workCanvas.getContext('2d');
          try { workCtx.imageSmoothingEnabled = true; workCtx.imageSmoothingQuality = 'high'; } catch (_) {}
          workCanvas.width = img.naturalWidth || img.width;
          workCanvas.height = img.naturalHeight || img.height;
          workCtx.drawImage(img, 0, 0, workCanvas.width, workCanvas.height);

          // If large downscale, reduce by halves until close to target
          while (workCanvas.width / 2 > targetW && workCanvas.height / 2 > targetH) {
            const halfCanvas = document.createElement('canvas');
            const halfCtx = halfCanvas.getContext('2d');
            try { halfCtx.imageSmoothingEnabled = true; halfCtx.imageSmoothingQuality = 'high'; } catch (_) {}
            halfCanvas.width = Math.max(targetW, Math.round(workCanvas.width / 2));
            halfCanvas.height = Math.max(targetH, Math.round(workCanvas.height / 2));
            halfCtx.clearRect(0, 0, halfCanvas.width, halfCanvas.height);
            halfCtx.drawImage(workCanvas, 0, 0, halfCanvas.width, halfCanvas.height);
            workCanvas = halfCanvas;
          }

          // Final draw to target canvas
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(workCanvas, 0, 0, targetW, targetH);
        }
        
        // Decide output format
        const requested = (this.compressionSettings.format || 'auto').toLowerCase();
        let outFormat = requested;
        if (requested === 'auto') {
          const srcType = (file && file.type || '').toLowerCase();
          const likelyScreenshot = srcType === 'image/png' || (Math.max(targetW, targetH) <= 1200);
          outFormat = likelyScreenshot ? 'png' : (srcType === 'image/jpeg' ? 'jpeg' : 'png');
        }
        const mime = outFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        const q = (outFormat === 'jpeg') ? Math.max(0, Math.min(1, this.compressionSettings.quality || 0.8)) : undefined;
        try { console.log(`🎛️ Output format: ${outFormat} @ quality ${q !== undefined ? q : 'lossless'}`); } catch (_) {}
        canvas.toBlob((blob) => {
          // Create new file with compressed data
          const compressedFile = new File([blob], file.name, {
            type: mime,
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, mime, q);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  async uploadOptimized(file, current, total) {
    console.log(`📤 Uploading optimized image ${current}/${total}`);
    
    // Wait for CSRF token to be captured (up to 5 seconds)
    if (!window.kayako_csrf_token) {
      console.log('⏳ Waiting for CSRF token to be captured...');
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (window.kayako_csrf_token) {
          console.log('✅ CSRF token captured after', (i + 1) * 100, 'ms');
          break;
        }
      }
    }
    
    // Use FormData for direct upload
    const formData = new FormData();
    formData.append('files', file);
    
    // Get CSRF token - try captured token first (from XHR headers), then DOM extraction
    let csrfToken = window.kayako_csrf_token ||
                     document.querySelector('meta[name="csrf-token"]')?.content ||
                     window.csrfToken || 
                     this.extractCSRFFromDOM();
    
    console.log('🔑 CSRF token status:', csrfToken ? 'Found (' + csrfToken.substring(0, 10) + '...)' : 'NOT FOUND');
    
    try {
      const headers = { 'X-Requested-With': 'XMLHttpRequest' };
      if (csrfToken && csrfToken.length > 0) {
        headers['X-CSRF-Token'] = csrfToken;
        headers['X-Csrf-Token'] = csrfToken;
        headers['x-csrf-token'] = csrfToken;
      } else {
        console.warn('⚠️ No CSRF header set (token not found) – relying on same-origin cookies');
      }

      // Prefer jQuery.ajax if available so Kayako's global prefilters add any required CSRF headers
      if (window.jQuery && typeof window.jQuery.ajax === 'function') {
        await new Promise((resolve, reject) => {
          window.jQuery.ajax({
            url: '/api/v1/media?include=*',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhrFields: { withCredentials: true },
            headers: headers,
            beforeSend: function(xhr) {
              // Ensure header casing one more time
              if (csrfToken) {
                try { xhr.setRequestHeader('X-Csrf-Token', csrfToken); } catch (_) {}
              }
            },
            success: function(data) { resolve({ ok: true, json: () => data }); },
            error: function(xhr) {
              reject(new Error('HTTP ' + xhr.status));
            }
          });
        }).then(async (res) => {
          const result = res.ok ? res : null;
          if (!result) throw new Error('Upload failed');
          // Emulate fetch-like flow for the rest of the method
          const data = await result.json();
          console.log(`✅ Upload ${current}/${total} successful`);
          const urlResolved = await this.resolveImageUrl(data);
          await this.insertImageIntoEditor(urlResolved || (data.data && data.data[0] ? data.data[0] : data));
          this.updateUploadProgress(current, total);
          this.hideUploadProgress();
          return; // Early return, skip fetch path
        });
        return;
      }

      const response = await fetch('/api/v1/media?include=*', {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        referrer: window.location.href,
        referrerPolicy: 'strict-origin-when-cross-origin',
        mode: 'cors',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Upload ${current}/${total} successful`);
        
        // Insert into editor using Kayako's method
        const urlResolved = await this.resolveImageUrl(result);
        await this.insertImageIntoEditor(urlResolved || (result.data && result.data[0] ? result.data[0] : result));
        
        this.updateUploadProgress(current, total);
        this.hideUploadProgress();
      } else {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Upload ${current}/${total} failed:`, error);
      throw error;
    }
  }

  async resolveImageUrl(uploadResponse) {
    try {
      const candidate = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const common = obj.data && Array.isArray(obj.data) ? obj.data[0] : obj;
        const keys = ['contentUrl', 'content_url', 'content_url_https', 'url', 'link', 'downloadUrl', 'download_url'];
        for (const k of keys) {
          if (common && typeof common[k] === 'string' && /^https?:\/\//.test(common[k])) return common[k];
        }
        return null;
      };
      let url = candidate(uploadResponse);
      if (url) return url;
      // Otherwise, search any string URL
      const allStrings = [];
      (function walk(node){
        if (node && typeof node === 'object') {
          for (const v of Object.values(node)) walk(v);
        } else if (typeof node === 'string') {
          allStrings.push(node);
        }
      })(uploadResponse);
      url = allStrings.find(s => /^https?:\/\//.test(s));
      if (url) return url;
      // Try token → GET /media/url/{token} → blob URL
      const token = allStrings.find(s => /^[A-Za-z0-9_-]{20,}$/.test(s));
      if (token) {
        const res = await fetch(`/media/url/${token}`, { credentials: 'include' });
        if (res.ok) {
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        }
      }
      return null;
    } catch (e) {
      console.warn('⚠️ resolveImageUrl failed:', e);
      return null;
    }
  }

  async insertImageIntoEditor(attachment) {
    // Find the active editor and insert image
    const editors = document.querySelectorAll('.froala-editor-instance');
    const activeEditor = Array.from(editors).find(editor => {
      return editor.offsetParent !== null; // Visible editor
    });
    
    if (activeEditor && window.jQuery) {
      const $editor = window.jQuery(activeEditor);
      if ($editor.data('froala.editor')) {
        console.log('📝 Inserting image into active editor');
        let url = null;
        if (typeof attachment === 'string') {
          url = attachment;
        } else if (attachment && typeof attachment === 'object') {
          url = attachment.contentUrl || attachment.content_url || attachment.content_url_https ||
                attachment.url_download || attachment.url || attachment.downloadUrl || attachment.download_url ||
                (attachment.data && Array.isArray(attachment.data) && attachment.data[0] && (attachment.data[0].contentUrl || attachment.data[0].url));
          if (!url && typeof this.resolveImageUrl === 'function') {
            try { url = await this.resolveImageUrl(attachment); } catch (_) {}
          }
        }
        if (url) {
          // First try to insert exactly at saved caret marker
          const placed = this.tryInsertAtCaretMarker(url);
          if (placed) {
            // Use Froala's API to ensure cursor is positioned correctly after our insert
            try {
              const editor = $editor.data('froala.editor');
              
              // Force focus
              $editor.froalaEditor('events.focus');
              
              // Try to find the image we just inserted and move cursor after it
              const imgs = activeEditor.querySelectorAll('img');
              const lastImg = imgs[imgs.length - 1];
              if (lastImg && lastImg.src === url) {
                // Use Froala's selection API to position cursor after image
                $editor.froalaEditor('selection.setAfter', lastImg);
                $editor.froalaEditor('selection.restore');
              }
              
              console.log('✅ Froala cursor positioned after image');
            } catch (e) {
              console.warn('Froala cursor positioning failed:', e);
            }
          } else {
            $editor.froalaEditor('image.insert', url, true, null, null, null);
            // Froala's insert already positions cursor correctly
          }
          $editor.froalaEditor('events.trigger', 'contentChanged');
          return; // Avoid fallback duplicating insertion
        } else {
          console.warn('⚠️ No contentUrl on attachment; skipping insert');
          return; // Do not fall back when Froala editor is present
        }
      }
    }

    // Fallback: Kayako custom editor (visible contenteditable or textbox)
    const url = (typeof attachment === 'string') ? attachment : (attachment && (attachment.contentUrl || attachment.content_url || attachment.content_url_https || attachment.url_download || attachment.url || attachment.downloadUrl || attachment.download_url || (attachment.data && Array.isArray(attachment.data) && attachment.data[0] && (attachment.data[0].contentUrl || attachment.data[0].url))));
    if (!url) return;
    const selectors = ['[contenteditable="true"]', 'div[role="textbox"]', '.ko-text-editor_textarea', '.ko-composer [contenteditable="true"]'];
    let editable = null;
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const node of nodes) {
        if (node && node.offsetParent !== null) { editable = node; break; }
      }
      if (editable) break;
    }
    if (editable) {
      try {
        editable.focus();
        // Try to use saved caret marker first
        if (this.tryInsertAtCaretMarker(url)) {
          return;
        }
        // Try execCommand insertImage
        const inserted = document.execCommand && document.execCommand('insertImage', false, url);
        if (!inserted) {
          // Fallback: insert HTML
          document.execCommand && document.execCommand('insertHTML', false, `<img src="${url}">`);
        }
        // Fire change events so Kayako updates state
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.dispatchEvent(new Event('keyup', { bubbles: true }));
        console.log('📝 Inserted image into Kayako editor');
      } catch (e) {
        console.warn('⚠️ Fallback insert failed:', e);
      }
    }
  }

  saveCaretPosition() {
    try {
      const selection = window.getSelection && window.getSelection();
      if (!selection || selection.rangeCount === 0) { return; }
      const range = selection.getRangeAt(0).cloneRange();
      const marker = document.createElement('span');
      this.caretMarkerId = 'kayako-caret-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      marker.id = this.caretMarkerId;
      marker.style.cssText = 'display:inline-block;width:0;height:0;line-height:0;';
      range.collapse(true);
      range.insertNode(marker);
      // Move caret after marker
      selection.removeAllRanges();
      const after = document.createRange();
      after.setStartAfter(marker);
      after.collapse(true);
      selection.addRange(after);
      console.log('📍 Saved caret position');
    } catch (_) {}
  }

  tryInsertAtCaretMarker(url) {
    try {
      if (!this.caretMarkerId) return false;
      const marker = document.getElementById(this.caretMarkerId);
      if (!marker) { this.caretMarkerId = null; return false; }
      
      // Get the editable container before we modify DOM
      const editable = this.findEditableContainer(marker);
      
      const img = document.createElement('img');
      img.src = url;
      
      // Insert image before marker
      marker.parentNode.insertBefore(img, marker);
      
      // Create a space after image for cursor positioning
      const space = document.createTextNode('\u00A0'); // non-breaking space
      marker.parentNode.insertBefore(space, marker);
      
      // Remove marker (no longer needed)
      marker.remove();
      this.caretMarkerId = null;
      
      // Ensure editor has focus
      if (editable) {
        editable.focus();
      }
      
      // Place cursor AFTER the image and space
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        
        // Set cursor after the space
        range.setStartAfter(space);
        range.collapse(true);
        selection.addRange(range);
        
        // Force focus again to ensure it sticks
        if (editable) {
          editable.focus();
        }
      }
      
      // Bubble change signals
      if (editable) {
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.dispatchEvent(new Event('keyup', { bubbles: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      console.log('📍 Inserted image at caret, focus restored, cursor positioned after');
      return true;
    } catch (e) {
      console.warn('Cursor positioning failed:', e);
      return false;
    }
  }

  findEditableContainer(node) {
    try {
      let current = node;
      while (current) {
        if (current.nodeType === 1 && (current.getAttribute && current.getAttribute('contenteditable') === 'true')) {
          return current;
        }
        current = current.parentNode;
      }
    } catch (_) {}
    return null;
  }

  extractCSRFFromDOM() {
    // Try multiple methods to get CSRF token (case-insensitive and cookie-based)
    const methods = [
      () => window.kayako_csrf_token, // Try captured token first
      () => document.querySelector('meta[name="csrf-token" i]')?.content,
      () => document.querySelector('meta[name="x-csrf-token" i]')?.content,
      () => document.querySelector('input[name="_token" i]')?.value,
      () => window._token,
      () => {
        // Search inline scripts for common patterns
        for (let script of document.scripts) {
          const content = script.textContent || '';
          const m1 = content.match(/csrfToken["']?\s*:\s*["']([^"']+)["']/i);
          if (m1) return m1[1];
          const m2 = content.match(/x[-_]csrf[-_]token["']?\s*[:=]\s*["']([^"']+)["']/i);
          if (m2) return m2[1];
        }
        return null;
      },
      () => {
        // Look in cookies (XSRF-TOKEN, X-CSRF-Token, x-csrf-token)
        const map = Object.fromEntries(document.cookie.split(';').map(s => {
          const i = s.indexOf('=');
          const k = s.slice(0, i).trim();
          const v = s.slice(i + 1).trim();
          return [k, decodeURIComponent(v)];
        }));
        return map['XSRF-TOKEN'] || map['x-csrf-token'] || map['X-CSRF-Token'] || null;
      },
      () => {
        // Try to extract from any recent XHR request headers in the network tab
        // Look for X-CSRF-Token in any fetch/XHR headers that might have been set
        if (typeof PerformanceObserver !== 'undefined') {
          try {
            const entries = performance.getEntriesByType('resource');
            // This won't give us headers, but worth trying other approaches
          } catch (_) {}
        }
        return null;
      }
    ];
    
    for (let method of methods) {
      try {
        const token = method();
        if (token) {
          console.log('🔑 Found CSRF token');
          return token;
        }
      } catch (e) {}
    }
    
    console.warn('⚠️ Could not find CSRF token');
    return '';
  }

  showUploadProgress(totalFiles) {
    const toast = document.createElement('div');
    toast.id = 'kayako-upload-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 20px;
      background: #28a745;
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    toast.innerHTML = `📤 Optimizing upload... <span id="upload-status">Starting</span>
      <div style="background: rgba(255,255,255,0.3); height: 3px; border-radius: 2px; margin-top: 6px; overflow: hidden;">
        <div id="upload-bar" style="background: #fff; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>`;
    document.body.appendChild(toast);
    toast.onclick = () => this.hideUploadProgress();
    // Auto-dismiss in case some path misses hide
    setTimeout(() => this.hideUploadProgress(), 4000);
  }

  updateUploadProgress(current, total) {
    const status = document.getElementById('upload-status');
    const bar = document.getElementById('upload-bar');
    
    if (status) {
      status.textContent = `Uploading ${current}/${total}...`;
    }
    
    if (bar) {
      const percentage = (current / total) * 100;
      bar.style.width = percentage + '%';
    }
  }

  hideUploadProgress() {
    const toast = document.getElementById('kayako-upload-toast');
    if (toast && toast.dataset.hiding !== '1') {
      toast.dataset.hiding = '1';
      toast.style.opacity = '0';
      setTimeout(() => { try { toast.remove(); } catch(_) {} }, 300);
    }
  }

  showUploadError(filename, error) {
    this.hideUploadProgress();
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 20px;
      background: #dc3545;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      z-index: 10001;
      font-size: 11px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    notification.textContent = `❌ Upload failed: ${filename} – ${error}`;
    notification.onclick = () => notification.remove();
    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 4000);
  }
}

// Initialize image optimizer
const imageOptimizer = new KayakoImageOptimizer();

// Listen for config updates from content script
window.addEventListener('KAYAKO_IMAGE_OPT_CONFIG', (event) => {
  try {
    const cfg = event && event.detail ? event.detail : {};
    if (typeof cfg.enabled === 'boolean') {
      imageOptimizer.disabled = !cfg.enabled;
      console.log(`🖼️ Image optimizer ${imageOptimizer.disabled ? 'disabled' : 'enabled'} via config`);
    }
    if (typeof cfg.maxWidth === 'number') imageOptimizer.compressionSettings.maxWidth = cfg.maxWidth;
    if (typeof cfg.maxHeight === 'number') imageOptimizer.compressionSettings.maxHeight = cfg.maxHeight;
    if (typeof cfg.quality === 'number') imageOptimizer.compressionSettings.quality = cfg.quality;
    if (typeof cfg.format === 'string') imageOptimizer.compressionSettings.format = cfg.format;
    console.log('🛠️ Applied image optimization settings:', imageOptimizer.compressionSettings);
  } catch (e) {
    console.warn('⚠️ Failed to apply image optimization settings:', e);
  }
});

// console.log('✅ Image upload optimizer loaded');
