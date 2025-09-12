// Injected script to intercept fetch calls in the page context
// This script runs in the page's context and can intercept native fetch calls

(function() {
  'use strict';
  
  console.log('Kayako Pagination Interceptor injected');
  
  // Store original fetch function
  const originalFetch = window.fetch;
  const originalXMLHttpRequest = window.XMLHttpRequest;
  
  // Configuration (will be updated by content script)
  let config = {
    paginationLimit: 100,
    cacheEnabled: true
  };
  
  // Cache storage (in-memory for this page session)
  const responseCache = new Map();
  
  // Listen for configuration updates from content script
  window.addEventListener('KAYAKO_CONFIG_UPDATE', (event) => {
    config = event.detail;
    console.log('Updated Kayako interceptor config:', config);
  });
  
  // Listen for cache data from content script
  window.addEventListener('KAYAKO_CACHE_RESPONSE', (event) => {
    const { cacheKey, data } = event.detail;
    responseCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  });
  
  // Intercept fetch calls
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Check if this is a posts API call
    if (typeof url === 'string' && isPostsApiCall(url)) {
      console.log('Intercepted posts API call:', url);
      
      const modifiedUrl = modifyPostsUrl(url);
      const cacheKey = generateCacheKey(modifiedUrl);
      
      // Check cache first if enabled
      if (config.cacheEnabled && responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        console.log('Returning cached response for:', url);
        
        // Notify content script about cache hit
        window.postMessage({
          type: 'KAYAKO_CACHE_HIT',
          url: modifiedUrl,
          originalUrl: url
        }, '*');
        
        // Return cached response
        return Promise.resolve(new Response(JSON.stringify(cached.data), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      
      // If not cached, make the request with modified URL
      args[0] = modifiedUrl;
      
      // Notify content script about the request
      window.postMessage({
        type: 'KAYAKO_API_REQUEST',
        url: modifiedUrl,
        originalUrl: url,
        method: options.method || 'GET'
      }, '*');
      
      try {
        const response = await originalFetch.apply(this, args);
        
        // Clone response for caching
        const clonedResponse = response.clone();
        
        // Cache the response if it's successful
        if (response.ok && config.cacheEnabled) {
          clonedResponse.json().then(data => {
            window.postMessage({
              type: 'KAYAKO_API_RESPONSE',
              url: modifiedUrl,
              originalUrl: url,
              data: data,
              cacheKey: cacheKey
            }, '*');
          }).catch(err => {
            console.warn('Failed to parse response for caching:', err);
          });
        }
        
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    }
    
    // For non-posts API calls, use original fetch
    return originalFetch.apply(this, args);
  };
  
  // Also intercept XMLHttpRequest for complete coverage
  window.XMLHttpRequest = function() {
    const xhr = new originalXMLHttpRequest();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, ...rest) {
      if (typeof url === 'string' && isPostsApiCall(url)) {
        console.log('Intercepted XHR posts API call:', url);
        url = modifyPostsUrl(url);
        
        window.postMessage({
          type: 'KAYAKO_API_REQUEST',
          url: url,
          method: method
        }, '*');
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    return xhr;
  };
  
  // Copy static properties
  Object.setPrototypeOf(window.XMLHttpRequest, originalXMLHttpRequest);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, originalXMLHttpRequest.prototype);
  
  // Utility functions
  function isPostsApiCall(url) {
    return url.includes('/api/v1/cases/') && url.includes('/posts');
  }
  
  function modifyPostsUrl(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Modify the limit parameter
      if (urlObj.searchParams.has('limit')) {
        const currentLimit = parseInt(urlObj.searchParams.get('limit'));
        if (currentLimit <= 30) { // Only modify if it's the default small limit
          urlObj.searchParams.set('limit', config.paginationLimit.toString());
          console.log(`Modified limit from ${currentLimit} to ${config.paginationLimit}`);
        }
      } else {
        // Add limit if not present
        urlObj.searchParams.set('limit', config.paginationLimit.toString());
      }
      
      return urlObj.toString();
    } catch (error) {
      console.error('Error modifying URL:', error);
      return url;
    }
  }
  
  function generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Extract relevant parameters for cache key
      const caseId = extractCaseId(urlObj.pathname);
      const afterId = urlObj.searchParams.get('after_id') || 'initial';
      const limit = urlObj.searchParams.get('limit') || '30';
      
      return `posts_${caseId}_${afterId}_${limit}`;
    } catch (error) {
      console.error('Error generating cache key:', error);
      return url;
    }
  }
  
  function extractCaseId(pathname) {
    const match = pathname.match(/\/cases\/(\d+)\/posts/);
    return match ? match[1] : 'unknown';
  }
  
  // Expose configuration update function
  window.updateKayakoConfig = function(newConfig) {
    config = { ...config, ...newConfig };
    console.log('Kayako interceptor config updated:', config);
  };
  
  console.log('Kayako fetch interceptor initialized');
})();
