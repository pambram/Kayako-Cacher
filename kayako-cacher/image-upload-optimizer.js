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
      format: 'jpeg'
    };
    this.disabled = false;
    
    this.init();
  }

  init() {
    console.log('🖼️ Image upload optimizer initializing...');
    
    // Defer until DOM is ready to avoid MutationObserver target issues
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.optimizeImageUploads(), { once: true });
    } else {
      this.optimizeImageUploads();
    }
    
    console.log('✅ Image upload optimizer ready');
  }

  optimizeImageUploads() {
    // Find and enhance the dropzone
    const observer = new MutationObserver(() => {
      const dropzones = document.querySelectorAll('.ko-text-editor_draggable-dropzone__dropzone_m415o0');
      
      dropzones.forEach(dropzone => {
        if (!dropzone.dataset.optimized) {
          console.log('🔧 Optimizing dropzone:', dropzone);
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
      
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        console.log(`🖼️ Processing ${imageFiles.length} image(s) for optimization...`);
        
        // Process images in background with progress
        this.processImagesOptimized(imageFiles);
        
        // Prevent default slow handling
        e.stopImmediatePropagation();
      }
    }, true); // Use capture to intercept before slow handlers
    
    // Add paste optimization
    dropzone.addEventListener('paste', (e) => {
      if (this.disabled) { return; }
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length > 0) {
        console.log('📋 Optimizing pasted images...');
        
        // Visual confirmation that optimized path is active
        try {
          this.showUploadProgress(imageItems.length);
        } catch (_) {}
        
        e.preventDefault();
        e.stopImmediatePropagation();
        
        imageItems.forEach(item => {
          const file = item.getAsFile();
          if (file) {
            this.processImagesOptimized([file]);
          }
        });
      }
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
        const { maxWidth, maxHeight } = this.compressionSettings;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        const mime = this.compressionSettings.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        canvas.toBlob((blob) => {
          // Create new file with compressed data
          const compressedFile = new File([blob], file.name, {
            type: mime,
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, mime, this.compressionSettings.format === 'jpeg' ? this.compressionSettings.quality : undefined);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  async uploadOptimized(file, current, total) {
    console.log(`📤 Uploading optimized image ${current}/${total}`);
    
    // Use FormData for direct upload
    const formData = new FormData();
    formData.append('files', file);
    
    // Get CSRF token from the page
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ||
                     window.csrfToken || 
                     this.extractCSRFFromDOM();
    
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
        const url = attachment && (attachment.contentUrl || attachment.url || attachment.link || attachment.downloadUrl || (attachment.data && attachment.data[0] && attachment.data[0].contentUrl));
        if (url) {
          $editor.froalaEditor('image.insert', url, true, null, null, null);
          $editor.froalaEditor('events.trigger', 'contentChanged');
          try {
            const html = $editor.froalaEditor('html.get');
            $editor.froalaEditor('html.set', html);
          } catch (_) {}
        } else {
          console.warn('⚠️ No contentUrl on attachment; skipping insert');
        }
      }
    }

    // Fallback: Kayako custom editor (visible contenteditable or textbox)
    const url = attachment && (attachment.contentUrl || attachment.url || attachment.link || attachment.downloadUrl || (attachment.data && attachment.data[0] && attachment.data[0].contentUrl));
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

  extractCSRFFromDOM() {
    // Try multiple methods to get CSRF token (case-insensitive and cookie-based)
    const methods = [
      () => document.querySelector('meta[name="csrf-token" i]')?.content,
      () => document.querySelector('meta[name="x-csrf-token" i]')?.content,
      () => document.querySelector('input[name="_token" i]')?.value,
      () => window._token,
      () => window.kayako_csrf_token,
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
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
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

console.log('✅ Image upload optimizer loaded');
