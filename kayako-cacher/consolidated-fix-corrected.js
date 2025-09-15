// CORRECTED CONSOLIDATED KAYAKO OPTIMIZATION
console.log('🚀 CORRECTED consolidated optimization starting...');

(function() {
  'use strict';
  
  // Store originals immediately
  const OriginalXHR = window.XMLHttpRequest;
  const OriginalFetch = window.fetch;
  
  // Cache storage
  const CACHE_PREFIX = 'kayako_cache_';
  const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  const memoryCache = new Map();
  
  // Stats tracking
  window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
  
  console.log('📦 Setting up XHR override...');
  
  // === CORRECTED XHR OVERRIDE ===
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = null;
    let cacheHit = null;
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      cacheHit = null; // Reset cache hit flag
      
      // 1. PAGINATION FIX
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // 2. CACHE CHECK (but don't return yet)
      if (method === 'GET' && url.includes('/posts')) {
        const cacheKey = generateCacheKey(url);
        console.log('🔍 Cache check for:', cacheKey);
        
        // Check memory cache first
        if (memoryCache.has(cacheKey)) {
          const cached = memoryCache.get(cacheKey);
          if (!isCacheExpired(cached.timestamp)) {
            console.log('💾✅ MEMORY CACHE HIT!');
            cacheHit = cached;
          } else {
            memoryCache.delete(cacheKey);
          }
        }
        
        // Check localStorage if no memory hit
        if (!cacheHit) {
          const storageKey = CACHE_PREFIX + cacheKey;
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            try {
              const persistentCached = JSON.parse(stored);
              if (!isCacheExpired(persistentCached.timestamp)) {
                console.log('💾✅ PERSISTENT CACHE HIT!');
                memoryCache.set(cacheKey, persistentCached);
                cacheHit = persistentCached;
              } else {
                localStorage.removeItem(storageKey);
              }
            } catch (error) {
              localStorage.removeItem(storageKey);
            }
          }
        }
        
        if (cacheHit) {
          window.kayakoCacheStats_live.hits++;
          showNotification('💾 Cache Hit!', 'success');
        } else {
          console.log('💾❌ CACHE MISS for:', cacheKey);
          window.kayakoCacheStats_live.misses++;
          showNotification('🌐 Cache Miss', 'warning');
        }
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    xhr.send = function(data) {
      // If cache hit, return cached data AND make background request
      if (cacheHit) {
        console.log('⚡ Cache-then-network: Returning cached data immediately');
        
        // Return cached response immediately using proxy object
        setTimeout(() => {
          try {
            console.log('📤 Creating proxy XHR response with cached data');
            
            // Create a proxy object that simulates successful response
            const proxyResponse = {
              readyState: 4,
              status: 200,
              statusText: 'OK (Cached)',
              responseText: JSON.stringify(cacheHit.data),
              response: JSON.stringify(cacheHit.data),
              responseURL: requestUrl,
              // Copy other xhr properties that might be needed
              getAllResponseHeaders: () => 'content-type: application/json',
              getResponseHeader: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
            };
            
            // Trigger handlers with proxy object as 'this' context
            if (xhr.onreadystatechange) {
              console.log('📤 Triggering onreadystatechange with cached data');
              xhr.onreadystatechange.call(proxyResponse);
            }
            if (xhr.onload) {
              console.log('📤 Triggering onload with cached data');
              xhr.onload.call(proxyResponse);
            }
            
            console.log('✅ Cached response delivered successfully');
            
          } catch (error) {
            console.error('❌ Cache response error:', error);
            // Fallback to network request
            console.log('🔄 Falling back to network request');
            originalSend.apply(xhr, [data]);
          }
        }, 5); // Small delay to ensure handlers are set
        
        // CACHE-THEN-NETWORK: Also make background request for fresh data
        setTimeout(() => {
          console.log('🔄 Making background request for fresh data...');
          
          const backgroundXHR = new OriginalXHR();
          backgroundXHR.open('GET', requestUrl, true);
          
          backgroundXHR.onload = function() {
            if (this.status === 200) {
              try {
                const freshData = JSON.parse(this.responseText);
                const cacheKey = generateCacheKey(requestUrl);
                
                const freshEntry = {
                  data: freshData,
                  timestamp: Date.now(),
                  url: requestUrl
                };
                
                // Update cache with fresh data
                memoryCache.set(cacheKey, freshEntry);
                localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(freshEntry));
                
                console.log('🔄 Background refresh completed:', cacheKey);
                showNotification('🔄 Data refreshed', 'info');
                
                // Could dispatch event to UI for optional refresh
                window.dispatchEvent(new CustomEvent('kayako-data-refreshed', {
                  detail: { cacheKey, data: freshData }
                }));
                
              } catch (error) {
                console.warn('Background refresh error:', error);
              }
            }
          };
          
          backgroundXHR.send();
        }, 100); // Start background request after cached response
        
        return;
      }
      
      // No cache hit - make network request and add storage handler
      if (requestUrl && requestUrl.includes('/posts')) {
        const originalOnLoad = this.onload;
        this.onload = function() {
          if (this.status === 200) {
            try {
              const responseData = JSON.parse(this.responseText);
              const cacheKey = generateCacheKey(requestUrl);
              
              const cacheEntry = {
                data: responseData,
                timestamp: Date.now(),
                url: requestUrl
              };
              
              memoryCache.set(cacheKey, cacheEntry);
              localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(cacheEntry));
              
              console.log('💾📥 CACHED:', cacheKey, `(${responseData.data?.length || 0} posts)`);
              showNotification('💾 Cached', 'info');
              window.kayakoCacheStats_live.stored++;
              
            } catch (error) {
              // Silent
            }
          }
          
          if (originalOnLoad) {
            originalOnLoad.apply(this, arguments);
          }
        };
      }
      
      return originalSend.apply(this, [data]);
    };
    
    return xhr;
  };
  
  // Copy properties
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // === UTILITY FUNCTIONS ===
  function generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Extract case ID from URL or current page  
      let caseMatch = urlObj.pathname.match(/\/cases\/(\d+)/);
      if (!caseMatch) {
        caseMatch = window.location.href.match(/\/conversations\/(\d+)/);
      }
      if (!caseMatch) {
        caseMatch = window.location.href.match(/\/cases\/(\d+)/);
      }
      
      const caseId = caseMatch ? caseMatch[1] : 'unknown';
      const afterId = urlObj.searchParams.get('after_id') || 'initial';
      const limit = '100'; // Always use 100 for consistent keys
      
      return `posts_${caseId}_${afterId}_${limit}`;
    } catch (error) {
      return 'fallback_' + Date.now();
    }
  }
  
  function isCacheExpired(timestamp) {
    return Date.now() - timestamp > CACHE_EXPIRY;
  }
  
  function showNotification(message, type = 'info') {
    const existing = document.getElementById('cache-notification');
    if (existing) existing.remove();
    
    const colors = {
      success: { bg: '#28a745', color: 'white' },
      warning: { bg: '#ffc107', color: 'black' },
      info: { bg: '#17a2b8', color: 'white' }
    };
    
    const style = colors[type] || colors.info;
    
    const notification = document.createElement('div');
    notification.id = 'cache-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 20px;
      background: ${style.bg};
      color: ${style.color};
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    
    notification.innerHTML = `
      ${message}<br>
      <small>H:${window.kayakoCacheStats_live.hits} M:${window.kayakoCacheStats_live.misses} S:${window.kayakoCacheStats_live.stored}</small>
    `;
    
    document.body?.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 2500);
  }
  
  // === TEST FUNCTIONS ===
  window.testKayakoPagination = function() {
    console.log('🧪 Testing pagination and cache...');
    
    const xhrModified = window.XMLHttpRequest.toString() !== OriginalXHR.toString();
    console.log('XMLHttpRequest modified:', xhrModified);
    console.log('Memory cache size:', memoryCache.size);
    console.log('Live stats:', window.kayakoCacheStats_live);
    
    return xhrModified;
  };
  
  window.kayakoCacheStats = function() {
    try {
      console.log('📊 Cache Statistics:');
      console.log('  Memory entries:', memoryCache.size);
      console.log('  Live stats:', window.kayakoCacheStats_live);
      
      // Check localStorage entries
      let persistentCount = 0;
      const persistentEntries = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          persistentCount++;
          try {
            const value = JSON.parse(localStorage.getItem(key));
            persistentEntries.push({
              key: key.replace(CACHE_PREFIX, ''),
              age: Math.round((Date.now() - value.timestamp) / 1000 / 60),
              posts: value.data?.data?.length || 0
            });
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
      
      console.log('  Persistent entries:', persistentCount);
      
      return {
        memorySize: memoryCache.size,
        persistentSize: persistentCount,
        liveStats: window.kayakoCacheStats_live,
        entries: persistentEntries
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: error.message };
    }
  };
  
  console.log('✅ CORRECTED optimization ready');
  
})();

console.log('🎯 Cache should now work! Test: scroll posts → reload → should see cache hit');
