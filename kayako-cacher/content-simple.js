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
    <small style="opacity: 0.7;">Click to dismiss</small>
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
  
  // Double-click for test
  indicator.ondblclick = () => {
    console.log('🧪 MANUAL TEST: Running pagination test...');
    if (typeof window.testKayakoPagination === 'function') {
      const result = window.testKayakoPagination();
      console.log('🧪 Manual test result:', result);
      alert('Pagination test: ' + (result ? 'WORKING ✅' : 'FAILED ❌'));
    } else {
      alert('Test function not available ❌');
    }
  };
  
  if (document.body) {
    document.body.appendChild(indicator);
    console.log('✅ Visual indicator added to page (bottom-left, dismissible)');
  } else {
    console.log('❌ Could not add visual indicator - no body element');
  }
  
  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0.6';
      indicator.style.transform = 'scale(0.9)';
    }
  }, 8000);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }, 30000);
  
  console.log('🎉 SIMPLE PAGINATION FIXER READY! Look for network requests with limit=100 when scrolling.');
}, 2000);
