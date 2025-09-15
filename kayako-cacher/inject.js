// Injected script to intercept fetch calls in the page context
// This script runs in the page's context and can intercept native fetch calls

(function() {
  'use strict';
  
  console.log('💉 Kayako Pagination Interceptor injected');
  
  // Check for conflicts
  if (window.fetch.toString().includes('article-login')) {
    console.warn('⚠️ Detected another Kayako extension (article-login) - may cause conflicts!');
  }
  
  // Store original fetch function
  const originalFetch = window.fetch;
  const originalXMLHttpRequest = window.XMLHttpRequest;
  
  console.log('📦 Original fetch stored, setting up interception...');
  
  // Configuration (will be updated by content script)
  let config = {
    paginationLimit: 100,
    cacheEnabled: true
  };
  
  // Cache storage (in-memory for this page session)
  const responseCache = new Map();
  
  // Cache request tracking for persistent cache checks
  const pendingCacheChecks = new Map();
  
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
  
  // Listen for persistent cache responses
  window.addEventListener('KAYAKO_PERSISTENT_CACHE_RESPONSE', (event) => {
    const { cacheKey, data, found } = event.detail;
    console.log('🔄 Received persistent cache response:', { cacheKey, found: !!found });
    
    const resolver = pendingCacheChecks.get(cacheKey);
    if (resolver) {
      resolver(found ? data : null);
      pendingCacheChecks.delete(cacheKey);
    }
  });
  
  // Function to check persistent cache via content script
  async function checkPersistentCache(url) {
    const cacheKey = generateCacheKey(url);
    
    return new Promise((resolve) => {
      // Store resolver for when response comes back
      pendingCacheChecks.set(cacheKey, resolve);
      
      // Request cache check from content script
      window.postMessage({
        type: 'KAYAKO_CHECK_PERSISTENT_CACHE',
        url: url,
        cacheKey: cacheKey
      }, '*');
      
      // Timeout after 100ms to avoid blocking too long
      setTimeout(() => {
        if (pendingCacheChecks.has(cacheKey)) {
          pendingCacheChecks.delete(cacheKey);
          console.log('⏰ Persistent cache check timeout for:', cacheKey);
          resolve(null);
        }
      }, 100);
    });
  }
  
  // Intercept fetch calls
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Only intercept posts API calls, avoid auth/session endpoints
    if (typeof url === 'string' && isPostsApiCall(url) && !isAuthRelatedCall(url)) {
      console.log('🔍 Intercepted posts API call:', url);
      
      const modifiedUrl = modifyPostsUrl(url);
      const cacheKey = generateCacheKey(modifiedUrl);
      
      // Check in-memory cache first
      if (config.cacheEnabled && responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        console.log('💾 Returning in-memory cached response for:', url);
        
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
      
      // Check persistent cache before making network request
      if (config.cacheEnabled) {
        console.log('🔍 Checking persistent cache for:', cacheKey);
        const persistentCached = await checkPersistentCache(modifiedUrl);
        if (persistentCached) {
          console.log('💾✅ CACHE HIT! Returning persistent cached response for:', url);
          
          // Add to in-memory cache for faster future access
          responseCache.set(cacheKey, {
            data: persistentCached,
            timestamp: Date.now()
          });
          
          // Notify content script about cache hit
          window.postMessage({
            type: 'KAYAKO_CACHE_HIT',
            url: modifiedUrl,
            originalUrl: url
          }, '*');
          
          // Return cached response
          return Promise.resolve(new Response(JSON.stringify(persistentCached), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
          }));
        } else {
          console.log('💾❌ Cache miss - no valid cached data found');
        }
      }
      
      // If not cached, make the request with modified URL
      args[0] = modifiedUrl;
      console.log('🌐 Making network request for:', modifiedUrl);
      
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
    
    xhr.open = function(method, url, ...rest) {
      if (typeof url === 'string' && isPostsApiCall(url) && !isAuthRelatedCall(url)) {
        console.log('🔍 Intercepted XHR posts API call:', url);
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
  
  // Utility functions - MUCH more specific to avoid interfering with auth
  function isPostsApiCall(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      const isPostsEndpoint = urlObj.pathname.includes('/api/v1/cases/') && urlObj.pathname.endsWith('/posts');
      const hasRelevantParams = urlObj.searchParams.has('limit') || urlObj.searchParams.has('include');
      
      // Only intercept if it's definitely a posts pagination call
      const shouldIntercept = isPostsEndpoint && hasRelevantParams;
      
      if (shouldIntercept) {
        console.log('🎯 Targeting posts API call:', url);
      }
      
      return shouldIntercept;
    } catch (error) {
      console.error('Error checking if posts API call:', error);
      return false;
    }
  }
  
  // Check if this is an auth/session related call that we should NOT intercept
  function isAuthRelatedCall(url) {
    const authPatterns = [
      '/auth',
      '/login',
      '/logout', 
      '/session',
      '/user',
      '/token',
      '/devices',
      '/timetracking',
      '/me',
      '/current_user'
    ];
    
    const isAuth = authPatterns.some(pattern => url.includes(pattern));
    
    if (isAuth) {
      console.log('🔒 Skipping auth-related call:', url);
    }
    
    return isAuth;
  }
  
  function modifyPostsUrl(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      const originalLimit = urlObj.searchParams.get('limit');
      
      console.log(`🔧 Modifying URL - Original limit: ${originalLimit}, Target: ${config.paginationLimit}`);
      
      // Modify the limit parameter
      if (urlObj.searchParams.has('limit')) {
        const currentLimit = parseInt(urlObj.searchParams.get('limit'));
        if (currentLimit <= 30) { // Only modify if it's the default small limit
          urlObj.searchParams.set('limit', config.paginationLimit.toString());
          console.log(`✅ Modified limit from ${currentLimit} to ${config.paginationLimit}`);
        } else {
          console.log(`ℹ️ Limit ${currentLimit} already higher than 30, leaving unchanged`);
        }
      } else {
        // Add limit if not present
        urlObj.searchParams.set('limit', config.paginationLimit.toString());
        console.log(`✅ Added limit parameter: ${config.paginationLimit}`);
      }
      
      const finalUrl = urlObj.toString();
      console.log(`🔗 Final URL: ${finalUrl}`);
      return finalUrl;
    } catch (error) {
      console.error('❌ Error modifying URL:', error);
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
  
  console.log('✅ Kayako fetch interceptor initialized');
  
  // Signal successful injection to content script
  window.postMessage({
    type: 'KAYAKO_INJECTION_SUCCESS',
    timestamp: Date.now()
  }, '*');
})();
