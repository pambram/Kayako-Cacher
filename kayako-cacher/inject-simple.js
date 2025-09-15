// Ultra-simple inject script focused ONLY on pagination
console.log('🔧 SIMPLE: Kayako pagination interceptor starting');

(function() {
  'use strict';
  
  // Store original fetch immediately
  const originalFetch = window.fetch;
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  // Override XMLHttpRequest (this is what Kayako actually uses!)
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    
    xhr.open = function(method, url, ...rest) {
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        console.log('🎯 XHR POSTS INTERCEPT:', url);
        
        const newUrl = url.replace('limit=30', 'limit=100');
        console.log('✅ XHR MODIFIED:', newUrl);
        
        return originalOpen.apply(this, [method, newUrl, ...rest]);
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    return xhr;
  };
  
  // Copy static properties to maintain XHR functionality
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // Keep fetch override too (for completeness)
  window.fetch = function(url, options) {
    
    // Only touch posts API calls with limit=30
    if (typeof url === 'string' && 
        url.includes('/api/v1/cases/') && 
        url.includes('/posts') && 
        url.includes('limit=30')) {
      
      console.log('🎯 FETCH INTERCEPT:', url);
      
      // Simple string replacement
      const newUrl = url.replace('limit=30', 'limit=100');
      console.log('✅ FETCH MODIFIED:', newUrl);
      
      // Call original fetch with modified URL
      return originalFetch.call(this, newUrl, options);
    }
    
    // For everything else, use original fetch unchanged
    return originalFetch.call(this, url, options);
  };
  
  console.log('✅ SIMPLE: Fetch override installed');
  
  // Test function
  window.testKayakoPagination = function() {
    console.log('🧪 Testing pagination override...');
    const fetchModified = window.fetch.toString().includes('FETCH INTERCEPT');
    const xhrModified = window.XMLHttpRequest.toString().includes('XHR') || 
                       window.XMLHttpRequest.toString() !== OriginalXHR.toString();
    console.log('Fetch function modified:', fetchModified);
    console.log('XMLHttpRequest modified:', xhrModified);
    return fetchModified || xhrModified;
  };
  
})();

console.log('🎉 SIMPLE: Kayako pagination interceptor ready');
