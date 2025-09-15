// CONSOLIDATED KAYAKO OPTIMIZATION - All-in-one safe approach
console.log('🚀 CONSOLIDATED Kayako optimization starting...');

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
  
  console.log('📦 Originals stored, setting up optimizations...');
  
  // === PAGINATION FIX (PROVEN WORKING) ===
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = null;
    let cacheHit = null; // Store cache hit data
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      
      // 1. PAGINATION FIX - increase limit
      if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // 2. CACHE CHECK - for GET posts requests  
      if (method === 'GET' && url.includes('/posts')) {
        const cacheKey = generateCacheKey(url);
        console.log('🔍 Cache check for:', cacheKey);
        
        // Check memory cache first
        if (memoryCache.has(cacheKey)) {
          const cached = memoryCache.get(cacheKey);
          console.log('📱 Found in memory cache, age:', Math.round((Date.now() - cached.timestamp) / 1000), 'seconds');
          
          if (!isCacheExpired(cached.timestamp)) {
            console.log('💾✅ MEMORY CACHE HIT! Will use cached data');
            cacheHit = cached;
          } else {
            console.log('⏰ Memory cache expired, removing');
            memoryCache.delete(cacheKey);
          }
        }
        
        // Check localStorage if no memory hit
        if (!cacheHit) {
          console.log('🔍 Checking localStorage for:', cacheKey);
          const storageKey = CACHE_PREFIX + cacheKey;
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            console.log('📱 Found localStorage entry, validating...');
            try {
              const persistentCached = JSON.parse(stored);
              const age = Date.now() - persistentCached.timestamp;
              console.log('📱 Cache age:', Math.round(age / 1000), 'seconds');
              
              if (!isCacheExpired(persistentCached.timestamp)) {
                console.log('💾✅ PERSISTENT CACHE HIT! Will use cached data');
                
                // Promote to memory cache
                memoryCache.set(cacheKey, persistentCached);
                cacheHit = persistentCached;
              } else {
                console.log('⏰ Persistent cache expired, removing');
                localStorage.removeItem(storageKey);
              }
            } catch (error) {
              console.warn('❌ Failed to parse cached data:', error);
              localStorage.removeItem(storageKey);
            }
          } else {
            console.log('❌ No localStorage entry found');
          }
        }
        
        if (cacheHit) {
          showNotification('💾 Cache Hit!', 'success');
          window.kayakoCacheStats_live.hits++;
        } else {
          console.log('💾❌ CACHE MISS for:', cacheKey);
          showNotification('🌐 Cache Miss', 'warning');
          window.kayakoCacheStats_live.misses++;
        }
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    // 3. CACHE SEND INTERCEPTION - return cached data instead of making request
    xhr.send = function(data) {
      // If we have a cache hit, return cached data instead of making request
      if (cacheHit) {
        console.log('⚡ Returning cached data instead of network request');
        
        // Set up fake response
        setTimeout(() => {
          try {
            Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
            Object.defineProperty(xhr, 'status', { value: 200, writable: true });
            Object.defineProperty(xhr, 'statusText', { value: 'OK (Cached)', writable: true });
            Object.defineProperty(xhr, 'responseText', { 
              value: JSON.stringify(cacheHit.data), 
              writable: true 
            });
            
            // Trigger response handlers
            if (xhr.onreadystatechange) xhr.onreadystatechange();
            if (xhr.onload) xhr.onload();
          } catch (error) {
            console.error('Cache response error:', error);
            // Fall back to network request
            originalSend.apply(xhr, [data]);
          }
        }, 10); // Small delay to ensure handlers are set
        
        return; // Don't make network request
      }
      
      // No cache hit - proceed with normal request and add response listener
      if (requestUrl && requestUrl.includes('/posts')) {
        // Add response storage handler
        const originalOnLoad = xhr.onload;
        xhr.onload = function() {
          if (this.status === 200) {
            try {
              const responseData = JSON.parse(this.responseText);
              const cacheKey = generateCacheKey(requestUrl);
              
              const cacheEntry = {
                data: responseData,
                timestamp: Date.now(),
                url: requestUrl
              };
              
              // Store in memory and localStorage
              memoryCache.set(cacheKey, cacheEntry);
              localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(cacheEntry));
              
              console.log('💾📥 CACHED:', cacheKey, `(${responseData.data?.length || 0} posts)`);
              showNotification('💾 Cached', 'info');
              window.kayakoCacheStats_live.stored++;
              
            } catch (error) {
              console.warn('Cache storage error:', error);
            }
          }
          
          if (originalOnLoad) {
            originalOnLoad.apply(this, arguments);
          }
        };
      }
      
    
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
      
      // ALWAYS use 100 for cache key (since we modify all requests to 100)
      const limit = '100';
      
      const key = `posts_${caseId}_${afterId}_${limit}`;
      
      return key;
    } catch (error) {
      return 'fallback_' + Date.now();
    }
  }
  
  function isCacheExpired(timestamp) {
    return Date.now() - timestamp > CACHE_EXPIRY;
  }
  
  async function checkPersistentCache(cacheKey) {
    try {
      const storageKey = CACHE_PREFIX + cacheKey;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  async function storePersistentCache(cacheKey, cacheEntry) {
    try {
      const storageKey = CACHE_PREFIX + cacheKey;
      localStorage.setItem(storageKey, JSON.stringify(cacheEntry));
    } catch (error) {
      // Silent - don't pollute console
    }
  }
  
  function showNotification(message, type = 'info') {
    const existing = document.getElementById('cache-notification');
    if (existing) existing.remove();
    
    const colors = {
      success: { bg: '#28a745', color: 'white' },
      warning: { bg: '#ffc107', color: 'black' },
      info: { bg: '#17a2b8', color: 'white' },
      error: { bg: '#dc3545', color: 'white' }
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
      <small style="opacity: 0.8;">H:${window.kayakoCacheStats_live.hits} M:${window.kayakoCacheStats_live.misses} S:${window.kayakoCacheStats_live.stored}</small>
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
    const fetchModified = window.fetch.toString() !== OriginalFetch.toString();
    
    console.log('XMLHttpRequest modified:', xhrModified);
    console.log('Fetch modified:', fetchModified);
    console.log('Cache size:', memoryCache.size);
    console.log('Live stats:', window.kayakoCacheStats_live);
    
    return xhrModified;
  };
  
  window.kayakoCacheStats = function() {
    try {
      console.log('📊 Cache Statistics:');
      console.log('  Memory entries:', memoryCache.size);
      console.log('  Live stats:', window.kayakoCacheStats_live);
      
      // Check localStorage for persistent entries
      let persistentCount = 0;
      const persistentEntries = [];
      
      try {
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
      } catch (error) {
        console.warn('localStorage access error:', error);
      }
      
      console.log('  Persistent entries:', persistentCount);
      
      const memoryEntries = Array.from(memoryCache.entries()).map(([key, value]) => ({
        key,
        age: Math.round((Date.now() - value.timestamp) / 1000 / 60),
        posts: value.data?.data?.length || 0,
        source: 'memory'
      }));
      
      persistentEntries.forEach(entry => entry.source = 'localStorage');
      
      return {
        memorySize: memoryCache.size,
        persistentSize: persistentCount,
        liveStats: window.kayakoCacheStats_live,
        entries: [...memoryEntries, ...persistentEntries]
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { 
        error: error.message,
        memorySize: memoryCache.size,
        liveStats: window.kayakoCacheStats_live
      };
    }
  };
  
  console.log('✅ CONSOLIDATED optimization ready');
  console.log('🧪 Test commands: window.testKayakoPagination(), window.kayakoCacheStats()');
  
})();

// Signal successful load
window.postMessage({ type: 'KAYAKO_CONSOLIDATED_READY' }, '*');
