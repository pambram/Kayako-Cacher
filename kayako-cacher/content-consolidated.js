// Consolidated content script - single approach to avoid loading conflicts
console.log('🚀 Kayako Image Optimizer starting...');
console.log('📍 URL:', window.location.href);

// Only handle image optimizer injection and live config updates
const supportedDomains = ['kayako.com/agent', '.gfi.com/agent', '.aurea.com/agent', '.ignitetech.com/agent', '.crossover.com/agent', '.totogi.com/agent', '.alpha.school/agent', '.cloudsense.com/agent', '.kandy.io/agent', 'dnnsupport.dnnsoftware.com/agent', 'csai.trilogy.com/agent'];

if (supportedDomains.some(domain => window.location.href.includes(domain))) {
  try {
    chrome.runtime.sendMessage({ action: 'getConfig' }, (resp) => {
      const enabled = !!(resp && resp.success && resp.config && resp.config.imageOptimizationEnabled);
      const cfg = (resp && resp.config) || {};
      const ensureLoaded = () => {
        const existing = document.getElementById('kayako-image-optimizer-script');
        if (enabled && !existing) {
          const imgScript = document.createElement('script');
          imgScript.id = 'kayako-image-optimizer-script';
          imgScript.src = chrome.runtime.getURL('image-upload-optimizer.js');
          imgScript.onload = () => {
            try {
              const ev = new CustomEvent('KAYAKO_IMAGE_OPT_CONFIG', {
                detail: {
                  enabled: true,
                  maxWidth: cfg.imageMaxWidth,
                  maxHeight: cfg.imageMaxHeight,
                  quality: cfg.imageQuality,
                  format: cfg.imageFormat
                }
              });
              window.dispatchEvent(ev);
            } catch (_) {}
          };
          imgScript.onerror = (e) => console.warn('❌ Image upload optimizer failed to load', e);
          (document.head || document.documentElement).appendChild(imgScript);
        } else if (!enabled && existing) {
          existing.remove();
        } else if (enabled && existing) {
          // push config to running optimizer
          try {
            const ev = new CustomEvent('KAYAKO_IMAGE_OPT_CONFIG', {
              detail: {
                enabled: true,
                maxWidth: cfg.imageMaxWidth,
                maxHeight: cfg.imageMaxHeight,
                quality: cfg.imageQuality,
                format: cfg.imageFormat
              }
            });
            window.dispatchEvent(ev);
          } catch (_) {}
        }
      };
      if (document.readyState === 'complete') {
        ensureLoaded();
      } else {
        window.addEventListener('load', ensureLoaded, { once: true });
      }
    });
  } catch (e) {
    console.warn('⚠️ Failed to inject image optimizer:', e);
  }

  // React to background config updates at runtime
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'configUpdated') {
      const enabled = !!(message.config && message.config.imageOptimizationEnabled);
      const existing = document.getElementById('kayako-image-optimizer-script');
      if (enabled && !existing) {
        try {
          const imgScript = document.createElement('script');
          imgScript.id = 'kayako-image-optimizer-script';
          imgScript.src = chrome.runtime.getURL('image-upload-optimizer.js');
          imgScript.onerror = (e) => console.warn('❌ Image upload optimizer failed to load', e);
          (document.head || document.documentElement).appendChild(imgScript);
        } catch (e) {
          console.warn('⚠️ Failed to enable image optimizer on config update:', e);
        }
      }
      if (!enabled && existing) {
        existing.remove();
      }
      // Push latest settings to optimizer regardless
      try {
        const cfg = message.config || {};
        const ev = new CustomEvent('KAYAKO_IMAGE_OPT_CONFIG', {
          detail: {
            enabled: !!cfg.imageOptimizationEnabled,
            maxWidth: cfg.imageMaxWidth,
            maxHeight: cfg.imageMaxHeight,
            quality: cfg.imageQuality,
            format: cfg.imageFormat
          }
        });
        window.dispatchEvent(ev);
      } catch (_) {}
    }
  });
} else {
  console.log('❌ Unsupported domain:', window.location.hostname);
}
