// RESTORE WORKING PARTS + Fix Only Broken MockXHR Response
console.log('🚀 Restoring working cache system with surgical fixes...');

(function() {
  'use strict';
  
  // Store originals immediately
  const OriginalXHR = window.XMLHttpRequest;
  const OriginalFetch = window.fetch;
  
  // Cache storage (WORKING PARTS RESTORED)
  const CACHE_PREFIX = 'kayako_cache_';
  const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  const memoryCache = new Map();
  
  // Stats tracking (WORKING PART RESTORED)
  window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
  
  console.log('📦 Originals stored, setting up optimizations...');
  
  // === WORKING PAGINATION + CACHE LOGIC (RESTORED) ===
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = null;
    let cacheHit = null; // Store cache hit data
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      cacheHit = null; // Reset cache hit flag
      
      // 1. PAGINATION FIX (WORKING - RESTORED)
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // 2. CACHE CHECK (WORKING LOGIC - RESTORED)
      if (method === 'GET' && url.includes('/posts')) {
        const cacheKey = generateCacheKey(url);
        console.log('🔍 Cache check for:', cacheKey);
        
        // Check memory cache first (WORKING - RESTORED)
        if (memoryCache.has(cacheKey)) {
          const cached = memoryCache.get(cacheKey);
          if (!isCacheExpired(cached.timestamp)) {
            console.log('💾✅ MEMORY CACHE HIT!');
            cacheHit = cached;
          } else {
            memoryCache.delete(cacheKey);
          }
        }
        
        // Check localStorage (WORKING LOGIC - RESTORED)
        if (!cacheHit) {
          const storageKey = CACHE_PREFIX + cacheKey;
          const stored = localStorage.getItem(storageKey);
          
          if (stored && stored.length > 10 && stored.startsWith('{')) {
            try {
              const persistentCached = JSON.parse(stored);
              if (persistentCached && persistentCached.data && persistentCached.timestamp) {
                if (!isCacheExpired(persistentCached.timestamp)) {
                  console.log('💾✅ PERSISTENT CACHE HIT!');
                  memoryCache.set(cacheKey, persistentCached);
                  cacheHit = persistentCached;
                } else {
                  localStorage.removeItem(storageKey);
                }
              } else {
                localStorage.removeItem(storageKey);
              }
            } catch (error) {
              console.log('❌ Removing corrupted cache entry');
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
      // CACHE HIT: Return cached data immediately
      if (cacheHit && cacheHit.data?.data?.length > 0) {
        console.log(`⚡ CACHE HIT - Returning ${cacheHit.data.data.length} cached posts instantly`);
        showNotification('💾 Cache Hit!', 'success');
        
        // SIMPLEST FIX: Create fake successful response object
        setTimeout(() => {
          try {
            const cachedJSON = JSON.stringify(cacheHit.data);
            
            // Create simple response object (no XHR property modification)
            const fakeResponse = {
              readyState: 4,
              status: 200,
              statusText: 'OK (Cached)',
              responseText: cachedJSON,
              response: cachedJSON,
              responseURL: requestUrl,
              getAllResponseHeaders: () => 'content-type: application/json',
              getResponseHeader: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
            };
            
            console.log('📤 Triggering handlers with cached response object');
            
            // Call handlers with fake response as 'this' context
            if (xhr.onreadystatechange) {
              xhr.onreadystatechange.call(fakeResponse);
            }
            if (xhr.onload) {
              xhr.onload.call(fakeResponse);
            }
            
            console.log('✅ Cached response delivered successfully');
            
          } catch (error) {
            console.error('❌ Cache response failed:', error);
            // Clear bad cache and fallback to network
            const cacheKey = generateCacheKey(requestUrl);
            memoryCache.delete(cacheKey);
            localStorage.removeItem(CACHE_PREFIX + cacheKey);
            console.log('🔄 Falling back to network request');
            originalSend.apply(xhr, [data]);
          }
        }, 1);
        
        // CACHE-THEN-NETWORK: Also start background refresh for fresh data
        setTimeout(() => {
          console.log('🔄 Starting background refresh for fresh data...');
          
          const backgroundXHR = new OriginalXHR();
          backgroundXHR.open('GET', requestUrl, true);
          
          backgroundXHR.onload = function() {
            if (this.status === 200) {
              try {
                const freshData = JSON.parse(this.responseText);
                const freshPostCount = freshData.data?.length || 0;
                
                if (freshPostCount > 0) {
                  const cacheKey = generateCacheKey(requestUrl);
                  
                  const freshEntry = {
                    data: freshData,
                    timestamp: Date.now(),
                    url: requestUrl
                  };
                  
                  // Update cache with fresh data
                  memoryCache.set(cacheKey, freshEntry);
                  
                  try {
                    localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(freshEntry));
                    console.log(`🔄 Background refresh completed: ${freshPostCount} fresh posts cached`);
                    showNotification('🔄 Data refreshed', 'info');
                  } catch (quotaError) {
                    console.warn('📦 Fresh data cached in memory only (quota exceeded)');
                  }
                } else {
                  console.log('🚫 Background refresh returned empty, keeping cached data');
                }
                
              } catch (error) {
                console.warn('Background refresh error:', error);
              }
            }
          };
          
          backgroundXHR.send();
        }, 100);
        
        return; // Don't proceed with original network request
      }
      
      // NO CACHE HIT: Make network request and store response
      if (requestUrl && requestUrl.includes('/posts')) {
        const originalOnLoad = this.onload;
        this.onload = function() {
          if (this.status === 200) {
            try {
              const responseData = JSON.parse(this.responseText);
              const postCount = responseData.data?.length || 0;
              
              // FIXED: Only cache responses with actual posts
              if (postCount > 0) {
                const cacheKey = generateCacheKey(requestUrl);
                
                const cacheEntry = {
                  data: responseData,
                  timestamp: Date.now(),
                  url: requestUrl
                };
                
                // Store in memory and localStorage
                memoryCache.set(cacheKey, cacheEntry);
                
                try {
                  localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(cacheEntry));
                  console.log('💾📥 CACHED:', cacheKey, `(${postCount} posts)`);
                  showNotification('💾 Cached', 'info');
                  window.kayakoCacheStats_live.stored++;
                } catch (quotaError) {
                  console.warn('📦 Storage quota exceeded, cached in memory only');
                  window.kayakoCacheStats_live.stored++;
                }
              } else {
                console.log('🚫 Skipping cache - empty response (0 posts)');
              }
              
            } catch (error) {
              console.warn('Response storage error:', error);
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
  
  // Copy properties (WORKING - RESTORED)
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // === WORKING UTILITY FUNCTIONS (RESTORED) ===
  function generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // WORKING URL pattern matching (RESTORED)
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
  
  // === WORKING TEST FUNCTIONS (RESTORED) ===
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
  
  // WORKING CLEAR CACHE FUNCTION (RESTORED)
  window.clearKayakoCache = function() {
    console.log('🗑️ Clearing all cache...');
    let cleared = 0;
    
    // Clear memory cache
    memoryCache.clear();
    
    // Clear localStorage cache
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    
    // Reset stats
    window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
    
    console.log(`✅ Cleared ${cleared} cache entries`);
    showNotification(`🗑️ Cleared ${cleared} entries`, 'info');
    
    return cleared;
  };
  
  console.log('✅ RESTORED cache system with surgical fixes ready');
  console.log('🧪 Test commands: window.testKayakoPagination(), window.kayakoCacheStats()');
  
})();

// Signal successful load
window.postMessage({ type: 'KAYAKO_RESTORED_READY' }, '*');
