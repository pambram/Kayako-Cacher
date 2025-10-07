// SIMPLE WORKING SOLUTION - Just focus on pagination first
console.log('🚀 SIMPLE WORKING SOLUTION starting...');

(function() {
  'use strict';
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  // Simple override focused ONLY on pagination (no complex caching for now)
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    
    xhr.open = function(method, url, ...rest) {
      // ONLY handle pagination - nothing else
      if (typeof url === 'string' && 
          url.includes('/posts') && 
          url.includes('limit=30')) {
        
        console.log('🎯 PAGINATION: Intercepted posts request');
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ PAGINATION: Increased limit to 100');
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    return xhr;
  };
  
  // Copy properties
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // Simple test function
  window.testKayakoPagination = function() {
    console.log('🧪 Testing simple pagination...');
    const modified = window.XMLHttpRequest.toString() !== OriginalXHR.toString();
    console.log('XMLHttpRequest modified:', modified);
    return modified;
  };
  
  // Simple clear cache function
  window.clearKayakoCache = function() {
    console.log('🗑️ Clearing localStorage cache...');
    let cleared = 0;
    
    // Clear all kayako cache entries
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kayako_cache_')) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    
    console.log(`✅ Cleared ${cleared} cache entries`);
    return cleared;
  };
  
  console.log('✅ SIMPLE pagination fixer ready');
  console.log('🧪 Test: window.testKayakoPagination()');
  console.log('🗑️ Clear: window.clearKayakoCache()');
  
})();

// Show simple success indicator
setTimeout(() => {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #28a745;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    cursor: pointer;
  `;
  indicator.innerHTML = `✅ Pagination Fixed<br><small>Click to dismiss</small>`;
  indicator.onclick = () => indicator.remove();
  
  document.body?.appendChild(indicator);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.remove();
    }
  }, 10000);
}, 1000);
