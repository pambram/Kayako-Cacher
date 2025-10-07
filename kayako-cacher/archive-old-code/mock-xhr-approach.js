// Mock XHR approach for cache delivery
console.log('🚀 Mock XHR cache approach starting...');

(function() {
  'use strict';
  
  const OriginalXHR = window.XMLHttpRequest;
  const memoryCache = new Map();
  const CACHE_PREFIX = 'kayako_cache_';
  const CACHE_EXPIRY = 30 * 60 * 1000;
  
  window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
  
  // Define cleanup function first
  function cleanupOldCacheEntries() {
    try {
      const cutoff = Date.now() - (10 * 60 * 1000); // Keep only last 10 minutes
      let cleaned = 0;
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.timestamp < cutoff) {
                localStorage.removeItem(key);
                cleaned++;
              }
            }
          } catch (e) {
            // Remove invalid entries
            localStorage.removeItem(key);
            cleaned++;
          }
        }
      }
      
      console.log('🗑️ Cleaned up', cleaned, 'old cache entries');
      
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
  
  // Clean up invalid cache entries on startup
  setTimeout(() => {
    console.log('🧹 Initial cache cleanup...');
    cleanupOldCacheEntries();
  }, 1000);
  
  // Mock XHR class for cached responses
  class MockXHR {
    constructor(responseData) {
      this.readyState = 4;
      this.status = 200;
      this.statusText = 'OK (Cached)';
      this.responseText = JSON.stringify(responseData);
      this.response = JSON.stringify(responseData);
      this.responseURL = '';
      this.onload = null;
      this.onreadystatechange = null;
      this.onerror = null;
      this.ontimeout = null;
    }
    
    open() { /* No-op for mock */ }
    
    send() {
      // Immediately trigger success handlers
      setTimeout(() => {
        console.log('📤 Mock XHR: Triggering cached response handlers');
        try {
          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onload) this.onload();
        } catch (error) {
          console.error('Mock XHR handler error:', error);
        }
      }, 1);
    }
    
    getAllResponseHeaders() {
      return 'content-type: application/json\r\ncache-control: no-cache\r\n';
    }
    
    getResponseHeader(name) {
      if (name.toLowerCase() === 'content-type') return 'application/json';
      return null;
    }
    
    abort() { /* No-op for mock */ }
    setRequestHeader() { /* No-op for mock */ }
  }
  
  // Enhanced XHR override
  window.XMLHttpRequest = function() {
    const originalXHR = new OriginalXHR();
    const originalOpen = originalXHR.open;
    const originalSend = originalXHR.send;
    let requestMethod = null;
    let requestUrl = null;
    let cacheHit = null;
    
    // Intercept open to check cache
    originalXHR.open = function(method, url, ...rest) {
      requestMethod = method;
      requestUrl = url;
      cacheHit = null;
      
      // Pagination fix
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // Cache check for posts requests
      if (method === 'GET' && url.includes('/posts')) {
        const cacheKey = generateCacheKey(url);
        console.log('🔍 Cache check for:', cacheKey);
        
        // Check memory cache
        if (memoryCache.has(cacheKey)) {
          const cached = memoryCache.get(cacheKey);
          if (!isCacheExpired(cached.timestamp)) {
            console.log('💾✅ MEMORY CACHE HIT!');
            cacheHit = cached;
          }
        }
        
        // Check localStorage with validation
        if (!cacheHit) {
          const storageKey = CACHE_PREFIX + cacheKey;
          const stored = localStorage.getItem(storageKey);
          
          if (stored && stored.length > 10 && stored.startsWith('{')) {
            try {
              const persistentCached = JSON.parse(stored);
              
              // Validate cache structure
              if (persistentCached && persistentCached.data && persistentCached.timestamp) {
                if (!isCacheExpired(persistentCached.timestamp)) {
                  console.log('💾✅ PERSISTENT CACHE HIT!');
                  memoryCache.set(cacheKey, persistentCached);
                  cacheHit = persistentCached;
                } else {
                  console.log('⏰ Cache expired, cleaning up');
                  localStorage.removeItem(storageKey);
                }
              } else {
                console.log('❌ Invalid cache structure, cleaning up');
                localStorage.removeItem(storageKey);
              }
            } catch (error) {
              console.log('❌ JSON parse error, cleaning up:', error.message);
              localStorage.removeItem(storageKey);
            }
          } else {
            if (stored) {
              console.log('❌ Invalid cache data, cleaning up');
              localStorage.removeItem(storageKey);
            }
          }
        }
        
        if (cacheHit) {
          window.kayakoCacheStats_live.hits++;
          console.log('⚡ Will return mock XHR with cached data');
        } else {
          console.log('💾❌ CACHE MISS');
          window.kayakoCacheStats_live.misses++;
        }
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    // Intercept send to return cached data or proceed normally
    originalXHR.send = function(data) {
      if (cacheHit) {
        console.log('⚡ Returning mock XHR with cached data');
        
        // Validate cached data before creating mock XHR
        if (!cacheHit.data || typeof cacheHit.data !== 'object') {
          console.error('❌ Invalid cached data, falling back to network');
          return originalSend.apply(this, [data]);
        }
        
        // Create mock XHR with cached data
        const mockXHR = new MockXHR(cacheHit.data);
        
        // Copy handlers from original XHR to mock
        mockXHR.onload = this.onload;
        mockXHR.onreadystatechange = this.onreadystatechange;
        mockXHR.onerror = this.onerror;
        
        // Trigger the mock response
        try {
          mockXHR.send();
        } catch (error) {
          console.error('❌ Mock XHR error, falling back to network:', error);
          return originalSend.apply(this, [data]);
        }
        
        // Start background refresh
        setTimeout(() => {
          console.log('🔄 Starting background refresh...');
          const backgroundXHR = new OriginalXHR();
          backgroundXHR.open(requestMethod, requestUrl, true);
          
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
                
                memoryCache.set(cacheKey, freshEntry);
                safeLocalStorageSet(CACHE_PREFIX + cacheKey, freshEntry);
                
                console.log('🔄 Background refresh completed');
                showNotification('🔄 Data refreshed', 'info');
                
              } catch (error) {
                console.warn('Background refresh error:', error);
              }
            }
          };
          
          backgroundXHR.send();
        }, 50);
        
        return; // Don't proceed with original send
      }
      
      // No cache hit - proceed with normal request and add storage
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
              safeLocalStorageSet(CACHE_PREFIX + cacheKey, cacheEntry);
              
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
    
    return originalXHR;
  };
  
  // Copy properties
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // === UTILITY FUNCTIONS ===
  function generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
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
  
  // Safe localStorage with quota management
  function safeLocalStorageSet(key, data) {
    try {
      // Reduce data size by keeping only essential fields
      const compactData = {
        data: {
          data: data.data?.data?.slice(0, 50) || [], // Limit to 50 posts max
          // Remove unnecessary fields to save space
        },
        timestamp: data.timestamp,
        url: data.url
      };
      
      const jsonString = JSON.stringify(compactData);
      
      // Check if we have space
      const testKey = 'quota_test_' + Date.now();
      try {
        localStorage.setItem(testKey, jsonString);
        localStorage.removeItem(testKey);
        
        // Storage succeeded, now store actual data
        localStorage.setItem(key, jsonString);
        console.log('💾 Safely stored to localStorage:', key);
        
      } catch (quotaError) {
        console.warn('📦 Storage quota exceeded, cleaning old entries...');
        
        // Clean up old entries to make space
        cleanupOldCacheEntries();
        
        // Try again after cleanup
        try {
          localStorage.setItem(key, jsonString);
          console.log('💾 Stored after cleanup:', key);
        } catch (stillFull) {
          console.warn('📦 Storage still full after cleanup, skipping cache storage');
        }
      }
      
    } catch (error) {
      console.warn('localStorage error (non-critical):', error.message);
    }
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
    console.log('🧪 Testing mock XHR pagination and cache...');
    
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
  
  console.log('✅ Mock XHR cache approach ready');
  
})();

console.log('🎯 Mock XHR approach should fix cache response delivery!');
