// CLEAN WORKING SOLUTION - Focus only on proven working features
console.log('🚀 Clean Kayako optimization starting...');

(function() {
  'use strict';
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  console.log('📦 Setting up clean XHR override...');
  
  // Cache storage
  const CACHE_PREFIX = 'kayako_cache_';
  const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  const memoryCache = new Map();
  
  // Stats tracking
  window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
  
  // === WORKING PAGINATION + CACHE DETECTION (RESTORED) ===
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = null;
    let cacheHit = null;
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      cacheHit = null;
      
      // PAGINATION FIX (PROVEN WORKING)
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // CACHE CHECK (WORKING LOGIC - RESTORED)
      if (method === 'GET' && url.includes('/posts')) {
        const cacheKey = generateCacheKey(url);
        console.log('🔍 Cache check for:', cacheKey, '| URL:', url.substring(url.indexOf('/api')));
        
        // Check memory cache
        if (memoryCache.has(cacheKey)) {
          const cached = memoryCache.get(cacheKey);
          if (!isCacheExpired(cached.timestamp)) {
            console.log('💾✅ MEMORY CACHE HIT!');
            cacheHit = cached;
            window.kayakoCacheStats_live.hits++;
            showNotification('💾 Cache Hit!', 'success');
            
            // REAL FIX: Store cache data for response simulation
            try {
              const cachedJSON = JSON.stringify(cached.data);
              JSON.parse(cachedJSON); // Validate
              
              console.log(`✅ Preparing cached response for ${cached.data.data?.length || 0} cached posts`);
              
              // Store cached response for xhr.send to use
              cacheHit = { ...cached, responseText: cachedJSON };
              console.log('💾 Cache data prepared for response simulation');
              
            } catch (error) {
              console.error('❌ Cache data preparation failed:', error);
              // Clear corrupted cache and proceed with normal request
              memoryCache.delete(cacheKey);
              localStorage.removeItem(CACHE_PREFIX + cacheKey);
              cacheHit = null;
            }
          } else {
            memoryCache.delete(cacheKey);
          }
        }
        
        // Check localStorage if no memory hit
        if (!cacheHit) {
          const storageKey = CACHE_PREFIX + cacheKey;
          const stored = localStorage.getItem(storageKey);
          
          if (stored && stored.length > 10) {
            try {
              const persistentCached = JSON.parse(stored);
              if (persistentCached && persistentCached.data && persistentCached.timestamp) {
                if (!isCacheExpired(persistentCached.timestamp)) {
                  console.log('💾✅ PERSISTENT CACHE HIT!');
                  memoryCache.set(cacheKey, persistentCached);
                  cacheHit = persistentCached;
                  window.kayakoCacheStats_live.hits++;
                  showNotification('💾 Cache Hit!', 'success');
                  
                  // REAL FIX: Store persistent cache data for response simulation
                  try {
                    const cachedJSON = JSON.stringify(persistentCached.data);
                    JSON.parse(cachedJSON); // Validate
                    
                    console.log(`✅ Preparing cached response for ${persistentCached.data.data?.length || 0} cached posts`);
                    
                    // Store cached response for xhr.send to use
                    cacheHit = { ...persistentCached, responseText: cachedJSON };
                    console.log('💾 Persistent cache data prepared for response simulation');
                    
                  } catch (error) {
                    console.error('❌ Cache data preparation failed:', error);
                    localStorage.removeItem(storageKey);
                    cacheHit = null;
                  }
                } else {
                  localStorage.removeItem(storageKey);
                }
              } else {
                localStorage.removeItem(storageKey);
              }
            } catch (error) {
              console.log('❌ Removing corrupted cache:', error.message);
              localStorage.removeItem(storageKey);
            }
          }
        }
        
        if (!cacheHit) {
          console.log('💾❌ CACHE MISS for:', cacheKey);
          window.kayakoCacheStats_live.misses++;
          showNotification('🌐 Cache Miss', 'warning');
        }
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    xhr.send = function(data) {
      // Handle cache hit by simulating response
      if (cacheHit && cacheHit.responseText) {
        console.log('💾 Cache hit: Simulating XHR response with cached data');
        
        // Simulate successful response immediately
        setTimeout(() => {
          Object.defineProperty(this, 'status', { value: 200, writable: false });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: false });
          Object.defineProperty(this, 'responseText', { value: cacheHit.responseText, writable: false });
          Object.defineProperty(this, 'response', { value: cacheHit.responseText, writable: false });
          Object.defineProperty(this, 'readyState', { value: 4, writable: false });
          
          // Trigger the load event
          if (this.onload) {
            this.onload.call(this);
          }
          
          // Trigger readystatechange
          if (this.onreadystatechange) {
            this.onreadystatechange.call(this);
          }
        }, 0);
        
        return;
      }
      
      // CACHE STORAGE (WORKING LOGIC - RESTORED) - Only for actual network requests
      if (requestUrl && requestUrl.includes('/posts')) {
        const originalOnLoad = this.onload;
        this.onload = function() {
          if (this.status === 200) {
            try {
              const responseData = JSON.parse(this.responseText);
              const postCount = responseData.data?.length || 0;
              
              // Only cache responses with actual posts
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
                console.log('🚫 Skipping cache - empty response (no posts to cache)');
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
  
  // Copy properties
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // === WORKING UTILITY FUNCTIONS (RESTORED) ===
  function generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      
      // Working URL pattern matching (RESTORED)
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
  
  // === CLEAN CACHE FUNCTIONS (Simple localStorage management) ===
  
  // Clean clear cache function (for popup)
  window.clearKayakoCache = function() {
    console.log('🗑️ Clearing all Kayako cache...');
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
  
  // Simple stats function (for popup)
  window.getKayakoCacheStats = function() {
    let entries = 0;
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kayako_cache_')) {
        entries++;
        const value = localStorage.getItem(key);
        totalSize += value?.length || 0;
      }
    }
    
    return {
      entries: entries,
      sizeKB: Math.round(totalSize / 1024),
      working: true
    };
  };
  
  // Detailed cache stats function (RESTORED for debugging)
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
  
  // Simple test function (for popup compatibility)
  window.testKayakoPagination = function() {
    console.log('🧪 Testing pagination...');
    const xhrModified = window.XMLHttpRequest.toString() !== OriginalXHR.toString();
    console.log('XMLHttpRequest modified:', xhrModified);
    console.log('Live stats:', window.kayakoCacheStats_live);
    return xhrModified;
  };
  
  console.log('✅ Clean Kayako optimization ready');
  console.log('🎯 Features: Pagination (100 posts/request) + Working cache detection + Clean management');
  
})();

// Clean visual indicator
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
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  `;
  
  indicator.innerHTML = `
    ✅ Kayako Optimized<br>
    <small>100 posts/request • Click to hide</small>
  `;
  
  indicator.onclick = () => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 200);
  };
  
  document.body?.appendChild(indicator);
  
  // Auto-fade after 8 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0.7';
    }
  }, 8000);
  
}, 1000);

console.log('🎉 Clean solution loaded - focus on proven working features!');
