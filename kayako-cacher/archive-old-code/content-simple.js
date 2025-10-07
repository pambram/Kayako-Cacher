// Simplified Kayako Pagination Fixer v3.2.0
// Focus ONLY on pagination, no complex caching for now

console.log('🚀 SIMPLE Kayako Pagination Fixer starting...');
console.log('📍 URL:', window.location.href);
console.log('📍 readyState:', document.readyState);
console.log('📍 Chrome available:', typeof chrome !== 'undefined');

// Immediately inject script before anything else happens
(function injectImmediately() {
  console.log('💉 Immediate injection starting...');
  
  const injectScript = `
    (function() {
      console.log('🔧 INLINE: Kayako pagination interceptor starting');
      
      // Store originals
      const originalFetch = window.fetch;
      const OriginalXHR = window.XMLHttpRequest;
      
      // Override XMLHttpRequest (what Kayako actually uses!)
      window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        
        xhr.open = function(method, url, ...rest) {
          if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
            console.log('🎯 INLINE XHR INTERCEPTED:', url);
            
            const newUrl = url.replace('limit=30', 'limit=100');
            console.log('✅ INLINE XHR MODIFIED:', newUrl);
            
            return originalOpen.apply(this, [method, newUrl, ...rest]);
          }
          
          return originalOpen.apply(this, [method, url, ...rest]);
        };
        
        return xhr;
      };
      
      // Copy XHR properties
      Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
      Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
      
      // Override fetch too (backup method)
      window.fetch = function(url, options) {
        if (typeof url === 'string' && 
            url.includes('/api/v1/cases/') && 
            url.includes('/posts') && 
            url.includes('limit=30')) {
          
          console.log('🎯 INLINE FETCH INTERCEPTED:', url);
          
          const newUrl = url.replace('limit=30', 'limit=100');
          console.log('✅ INLINE FETCH MODIFIED:', newUrl);
          
          return originalFetch.call(this, newUrl, options);
        }
        
        return originalFetch.call(this, url, options);
      };
      
      console.log('✅ INLINE: XHR + Fetch override complete');
    })();
  `;
  
  // Create and inject script element
  const script = document.createElement('script');
  script.textContent = injectScript;
  
  // Inject as early as possible
  if (document.head) {
    document.head.appendChild(script);
  } else if (document.documentElement) {
    document.documentElement.appendChild(script);
  }
  
  script.remove();
  console.log('💉 Inline script injected');
})();

// Add backup method with detailed debugging
setTimeout(() => {
  console.log('📦 Loading backup inject-simple.js...');
  
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject-simple.js');
    
    script.onload = () => {
      console.log('✅ Backup inject-simple.js loaded successfully');
      
      // Test if it's working
      setTimeout(() => {
        if (typeof window.testKayakoPagination === 'function') {
          const working = window.testKayakoPagination();
          console.log('🧪 Pagination test result:', working);
          
          if (working) {
            console.log('🎉 SUCCESS: Pagination override is working!');
          } else {
            console.log('❌ FAILED: Pagination override not detected');
          }
        } else {
          console.log('❌ Test function not available');
        }
      }, 100);
      
      script.remove();
    };
    
    script.onerror = (error) => {
      console.error('❌ Backup inject-simple.js failed to load:', error);
    };
    
    const target = document.head || document.documentElement || document.body;
    if (target) {
      target.appendChild(script);
      console.log('📦 Script element added to:', target.tagName);
    } else {
      console.error('❌ No target element found for script injection');
    }
  } catch (error) {
    console.error('❌ Error creating backup script:', error);
  }
}, 100);

// Test after a delay to see if it's working
setTimeout(() => {
  console.log('🧪 FINAL TEST: Checking if everything is working...');
  console.log('🧪 Fetch function modified:', window.fetch.toString().includes('SIMPLE INTERCEPT'));
  console.log('🧪 Test function available:', typeof window.testKayakoPagination === 'function');
  
  if (typeof window.testKayakoPagination === 'function') {
    const working = window.testKayakoPagination();
    console.log('🧪 Pagination test result:', working);
  }
  
  // Show visual indicator (non-intrusive)
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #28a745;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: all 0.3s ease;
    max-width: 200px;
  `;
  indicator.innerHTML = `
    ✅ Pagination Fixed (100 posts)<br>
    💾 Cache: <span id="cache-stats-display">Loading...</span><br>
    <small style="opacity: 0.7;">Click to dismiss • Double-click for debug</small>
  `;
  
  // Click to dismiss completely
  indicator.onclick = () => {
    indicator.style.opacity = '0';
    indicator.style.transform = 'scale(0.8)';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 300);
  };
  
  // Double-click for debug info
  indicator.ondblclick = () => {
    console.log('🧪 CACHE DEBUG INFO:');
    if (typeof window.kayakoCacheStats === 'function') {
      const stats = window.kayakoCacheStats();
      const summary = `Cache Debug:
• Entries: ${stats.size}
• Memory: ${Math.round(JSON.stringify(stats.entries).length / 1024)}KB
• Recent entries: ${stats.entries.slice(0, 3).map(e => `${e.key} (${e.age}m old)`).join(', ')}`;
      alert(summary);
    } else {
      console.log('🧪 PAGINATION TEST: Running pagination test...');
      if (typeof window.testKayakoPagination === 'function') {
        const result = window.testKayakoPagination();
        console.log('🧪 Manual test result:', result);
        alert('Pagination test: ' + (result ? 'WORKING ✅' : 'FAILED ❌'));
      } else {
        alert('Debug functions not available ❌');
      }
    }
  };
  
  if (document.body) {
    document.body.appendChild(indicator);
    console.log('✅ Visual indicator added to page (bottom-left, dismissible)');
  } else {
    console.log('❌ Could not add visual indicator - no body element');
  }
  
  // Auto-fade after 10 seconds (but keep visible for cache stats)
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0.7';
      indicator.style.transform = 'scale(0.95)';
    }
  }, 10000);
  
  // Update cache stats display periodically
  const updateCacheDisplay = () => {
    const display = document.getElementById('cache-stats-display');
    if (display && typeof window.kayakoCacheStats === 'function') {
      try {
        const stats = window.kayakoCacheStats();
        display.textContent = `${stats.size} entries (${window.kayakoCacheStats_live?.hits || 0} hits, ${window.kayakoCacheStats_live?.misses || 0} misses)`;
      } catch (error) {
        display.textContent = 'Available after first cache activity';
      }
    }
  };
  
  // Update stats every 5 seconds
  const statsInterval = setInterval(updateCacheDisplay, 5000);
  
  // Also update when indicator is clicked
  indicator.onclick = (e) => {
    updateCacheDisplay();
    e.currentTarget.style.opacity = '0';
    e.currentTarget.style.transform = 'scale(0.8)';
    setTimeout(() => {
      if (e.currentTarget.parentNode) {
        e.currentTarget.remove();
        clearInterval(statsInterval);
      }
    }, 300);
  };
  
  // Auto-remove after 60 seconds (longer time since it's useful)
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        indicator.remove();
        clearInterval(statsInterval);
      }, 300);
    }
  }, 60000);
  
  console.log('🎉 SIMPLE PAGINATION FIXER READY! Look for network requests with limit=100 when scrolling.');
  
  // Load safe optimizations
  setTimeout(() => {
    console.log('🚀 Loading safe optimizations...');
    
    // Load simple cache strategy (safer)
    const cacheScript = document.createElement('script');
    cacheScript.src = chrome.runtime.getURL('simple-cache.js');
    cacheScript.onload = () => {
      console.log('✅ Simple cache strategy loaded');
      
      // Update cache display after cache system loads
      setTimeout(() => {
        const display = document.getElementById('cache-stats-display');
        if (display) {
          display.textContent = '0 entries (ready)';
        }
      }, 500);
      
      cacheScript.remove();
    };
    cacheScript.onerror = () => {
      console.log('❌ Cache script failed to load');
    };
    
    // Load simple image optimizer (safer)
    const imageScript = document.createElement('script');
    imageScript.src = chrome.runtime.getURL('simple-image-optimizer.js');
    imageScript.onload = () => {
      console.log('✅ Simple image optimizer loaded');
      imageScript.remove();
    };
    imageScript.onerror = () => {
      console.log('❌ Image script failed to load');
    };
    
    (document.head || document.documentElement).appendChild(cacheScript);
    setTimeout(() => {
      (document.head || document.documentElement).appendChild(imageScript);
    }, 1000);
    
  }, 2000); // Load after pagination is stable
  
}, 2000);
