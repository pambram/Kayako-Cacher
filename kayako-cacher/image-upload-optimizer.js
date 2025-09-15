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
    
    this.init();
  }

  init() {
    console.log('🖼️ Image upload optimizer initializing...');
    
    // Override the slow image upload process
    this.optimizeImageUploads();
    
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
    
    observer.observe(document.body, { childList: true, subtree: true });
    
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
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length > 0) {
        console.log('📋 Optimizing pasted images...');
        
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
        
        canvas.toBlob((blob) => {
          // Create new file with compressed data
          const compressedFile = new File([blob], file.name, {
            type: this.compressionSettings.format === 'jpeg' ? 'image/jpeg' : file.type,
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, this.compressionSettings.format === 'jpeg' ? 'image/jpeg' : file.type, this.compressionSettings.quality);
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
      const response = await fetch('/api/v1/media?include=*', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Upload ${current}/${total} successful`);
        
        // Insert into editor using Kayako's method
        this.insertImageIntoEditor(result.data[0]);
        
        this.updateUploadProgress(current, total);
      } else {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Upload ${current}/${total} failed:`, error);
      throw error;
    }
  }

  insertImageIntoEditor(attachment) {
    // Find the active editor and insert image
    const editors = document.querySelectorAll('.froala-editor-instance');
    const activeEditor = Array.from(editors).find(editor => {
      return editor.offsetParent !== null; // Visible editor
    });
    
    if (activeEditor && window.jQuery) {
      const $editor = window.jQuery(activeEditor);
      if ($editor.data('froala.editor')) {
        console.log('📝 Inserting image into active editor');
        $editor.froalaEditor('image.insert', attachment.contentUrl, true, '', null, null);
        $editor.froalaEditor('events.trigger', 'contentChanged');
      }
    }
  }

  extractCSRFFromDOM() {
    // Try multiple methods to get CSRF token
    const methods = [
      () => document.querySelector('meta[name="csrf-token"]')?.content,
      () => document.querySelector('input[name="_token"]')?.value,
      () => window._token,
      () => {
        const scripts = document.scripts;
        for (let script of scripts) {
          const content = script.textContent;
          const match = content.match(/csrfToken["']?\s*:\s*["']([^"']+)["']/);
          if (match) return match[1];
        }
        return null;
      }
    ];
    
    for (let method of methods) {
      try {
        const token = method();
        if (token) {
          console.log('🔑 Found CSRF token via method');
          return token;
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    console.warn('⚠️ Could not find CSRF token');
    return '';
  }

  showUploadProgress(totalFiles) {
    const progress = document.createElement('div');
    progress.id = 'kayako-upload-progress';
    progress.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      text-align: center;
      min-width: 300px;
    `;
    
    progress.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 10px;">📤 Uploading Images</div>
      <div id="upload-status">Compressing images...</div>
      <div style="background: #333; height: 4px; border-radius: 2px; margin: 10px 0; overflow: hidden;">
        <div id="upload-bar" style="background: #28a745; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div style="font-size: 12px; opacity: 0.8;">Optimizing for faster upload...</div>
    `;
    
    document.body.appendChild(progress);
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
    const progress = document.getElementById('kayako-upload-progress');
    if (progress) {
      progress.style.opacity = '0';
      setTimeout(() => progress.remove(), 300);
    }
  }

  showUploadError(filename, error) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      z-index: 10001;
      max-width: 350px;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold;">❌ Upload Failed</div>
      <div style="font-size: 12px; margin-top: 4px;">${filename}: ${error}</div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Initialize image optimizer
const imageOptimizer = new KayakoImageOptimizer();

console.log('✅ Image upload optimizer loaded');
