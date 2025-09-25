// CLEAN WORKING SOLUTION - Focus only on proven working features
console.log('🚀 Clean Kayako optimization starting...');

(function() {
  'use strict';
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  console.log('📦 Setting up clean XHR override...');
  
  // Ensure functions are created early and globally accessible
  window.clearKayakoCache = function() {
    console.log('🗑️ clearKayakoCache function called');
    return 'function working';
  };
  
  window.getKayakoCacheStats = function() {
    console.log('📊 getKayakoCacheStats function called');
    return { working: true };
  };
  
  window.kayakoCacheStats = function() {
    console.log('📊 kayakoCacheStats function called');
    return { working: true };
  };
  
  window.testKayakoPagination = function() {
    console.log('🧪 testKayakoPagination function called');
    return true;
  };
  
  console.log('✅ Basic functions created early');
  
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
    const originalSetRequestHeader = xhr.setRequestHeader;
    let requestUrl = null;
    let requestMethod = null;
    let cacheHit = null;
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      requestMethod = method;
      cacheHit = null;
      const intercept = (method === 'GET' && isPostsList(url));
      if (!intercept) {
        // Pass-through: ensure native send is used so our stack doesn't appear
        try { this.send = originalSend.bind(this); } catch (e) {}
        // For writes to posts endpoints, invalidate caches and pause cache simulation briefly
        try {
          const m = (method || '').toUpperCase();
          const u = typeof url === 'string' ? url : '';
          if ((m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') && isPostsWrite(u)) {
            this.addEventListener('load', function() {
              try {
                if (this.status >= 200 && this.status < 300) {
                  const cid = getCurrentCaseId();
                  if (cid) invalidateCaseCache(cid);
                  window.__kayako_blockCacheUntil = Date.now() + 5000;
                  console.log('🧹 Posts write detected → invalidated cache and paused cache simulation');
                }
              } catch (_) {}
            });
          }
        } catch (_) {}
      }
      
      // PAGINATION FIX (only for GET list endpoint /api/v1/cases/{id}/posts)
      if (intercept && typeof url === 'string' && url.includes('limit=30')) {
        url = url.replace('limit=30', 'limit=100');
        console.log('✅ Pagination: limit increased to 100');
      }
      
      // CACHE CHECK only for GET list endpoint
      if (intercept) {
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
    
    // Capture CSRF token from any page XHR headers
    xhr.setRequestHeader = function(name, value) {
      try {
        if (typeof name === 'string' && /^x[-_]csrf[-_]token$/i.test(name) && typeof value === 'string' && value.length > 16) {
          if (window.kayako_csrf_token !== value) {
            window.kayako_csrf_token = value;
            if (!window.__kayako_csrf_logged) {
              console.log('🔑 Captured CSRF token from XHR header');
              window.__kayako_csrf_logged = true;
            }
          }
        }
      } catch (e) {}
      return originalSetRequestHeader.apply(this, arguments);
    };

    xhr.send = function(data) {
      // Handle cache hit by simulating response
      if (cacheHit && cacheHit.responseText) {
        // Safety: bypass simulation if cached snapshot looks incomplete and not very fresh
        try {
          const freshnessFloorMs = Math.max(60000, Math.floor(CACHE_EXPIRY / 6)); // ~5 min for default expiry
          const ageMs = Date.now() - (cacheHit.timestamp || 0);
          const parsedProbe = JSON.parse(cacheHit.responseText);
          const probeCount = (parsedProbe && parsedProbe.data && Array.isArray(parsedProbe.data)) ? parsedProbe.data.length : 0;
          if (probeCount > 0 && probeCount < 5 && ageMs > freshnessFloorMs) {
            console.log('⚠️ Cached snapshot too small/stale (', probeCount, 'posts,', Math.round(ageMs/1000), 's old) → using network');
            return originalSend.apply(this, [data]);
          }
        } catch (_) {}
        try {
          if (window.__kayako_blockCacheUntil && Date.now() < window.__kayako_blockCacheUntil) {
            console.log('⏳ Cache simulation temporarily disabled');
            return originalSend.apply(this, [data]);
          }
        } catch (_) {}
        console.log('💾 Cache hit: Simulating XHR response with cached data');
        
        let cleanedResponseText = cacheHit.responseText;
        
         // Simulate successful response immediately
         setTimeout(() => {
           try {
             Object.defineProperty(this, 'status', { value: 200, configurable: true });
             Object.defineProperty(this, 'statusText', { value: 'OK (Cached)', configurable: true });
             Object.defineProperty(this, 'responseText', { value: cleanedResponseText, configurable: true });
             Object.defineProperty(this, 'response', { value: cleanedResponseText, configurable: true });
             Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
             try { Object.defineProperty(this, 'responseURL', { value: requestUrl, configurable: true }); } catch (_) {}
             try {
               this.getResponseHeader = (name) => null;
               this.getAllResponseHeaders = () => 'content-type: application/json\r\n';
             } catch (_) {}
             
             console.log('📤 Triggering cached response handlers');
             
             // Trigger the load event
             if (this.onload) {
               this.onload.call(this);
             }
             
             // Trigger readystatechange
             if (this.onreadystatechange) {
               this.onreadystatechange.call(this);
             }
             
             console.log('✅ Cached response delivered successfully');
             
           } catch (error) {
             console.error('❌ Cache response simulation failed:', error);
             // Fallback to network request
             originalSend.apply(this, [data]);
           }
         }, 0);
         
         // CACHE-THEN-NETWORK: Start background refresh for fresh data
         setTimeout(() => {
           console.log('🔄 Starting background refresh for fresh data...');
           
           // FIXED: Use modified URL with limit=100 for background refresh too
           let refreshURL = requestUrl;
           if (refreshURL.includes('limit=30')) {
             refreshURL = refreshURL.replace('limit=30', 'limit=100');
             console.log('🔧 Background refresh using limit=100');
           }
           
           console.log('📋 Background URL:', refreshURL.substring(refreshURL.indexOf('/api')));
           const refreshURLAbs = (() => { try { return new URL(refreshURL, window.location.origin).toString(); } catch(e){ return refreshURL; } })();
           
           const backgroundXHR = new OriginalXHR();
           backgroundXHR.open('GET', refreshURLAbs, true);
           try { backgroundXHR.withCredentials = true; } catch (e) {}
           try { backgroundXHR.setRequestHeader('Accept', 'application/json'); } catch (e) {}
           try { backgroundXHR.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); } catch (e) {}
          // Do not set Referer/Origin: browsers forbid these headers
           backgroundXHR.onreadystatechange = function() {
             try {
               if (this.readyState === 1) console.log('🔄 BG XHR opened');
               if (this.readyState === 2) console.log('🔄 BG XHR headers received');
               if (this.readyState === 3) {
                 let clen = null;
                 try { clen = this.getResponseHeader && this.getResponseHeader('content-length'); } catch (_) {}
                 console.log('🔄 BG XHR loading...', clen ? '(content-length ' + clen + ')' : '');
               }
               if (this.readyState === 4) console.log('🔄 BG XHR done. Status:', this.status, 'Len:', (this.responseText && this.responseText.length) || 0);
             } catch (e) {}
           };
           backgroundXHR.timeout = 15000;
           backgroundXHR.ontimeout = function() {
            console.warn('Background refresh timeout');
            try {
              fetch(refreshURLAbs, {
                credentials: 'include',
                headers: {
                  'Accept': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest'
                }
              }).then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              }).then(freshData => {
                try {
                  
                  const freshPostCount = freshData.data?.length || 0;
                  if (freshPostCount > 0) {
                    const cacheKey = generateCacheKey(requestUrl);
                    const freshEntry = { data: freshData, timestamp: Date.now(), url: requestUrl };
                    memoryCache.set(cacheKey, freshEntry);
                    try {
                      localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(freshEntry));
                      console.log(`🔄 Background refresh (fetch) completed: ${freshPostCount} fresh posts cached`);
                      showNotification('🔄 Data refreshed', 'info');
                      window.dispatchEvent(new CustomEvent('kayako-data-refreshed', { detail: { cacheKey, freshData, postCount: freshPostCount } }));
                    } catch (_) {
                      console.warn('📦 Background data (fetch): memory only');
                    }
                  } else {
                    console.log('🚫 Background refresh (fetch) returned empty data');
                  }
                } catch (e) {
                  console.warn('Background refresh (fetch) parse error:', e);
                }
              }).catch(err => console.warn('Background refresh (fetch) error:', err.message));
            } catch (e) {}
          };
          
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
                    
                    // Dispatch event for UI refresh if data is different
                    window.dispatchEvent(new CustomEvent('kayako-data-refreshed', {
                      detail: { cacheKey, freshData, postCount: freshPostCount }
                    }));
                    
                  } catch (quotaError) {
                    console.warn('📦 Background refresh quota exceeded, attempting cleanup...');
                    
                    // Try to free up space for background refresh
                    const freedSpace = freeUpLocalStorage();
                    
                    if (freedSpace > 0) {
                      try {
                        localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(freshEntry));
                        console.log(`🔄 Background refresh cached after cleanup: ${freshPostCount} posts`);
                        showNotification('🔄 Data refreshed (after cleanup)', 'info');
                      } catch (stillFullError) {
                        console.warn('📦 Background data: memory only, localStorage full');
                      }
                    } else {
                      console.warn('📦 Background data: memory only, could not free space');
                    }
                  }
                } else {
                  console.log('🚫 Background refresh returned empty data');
                }
                
              } catch (error) {
                console.warn('Background refresh parse error:', error);
              }
            } else {
              console.warn('Background refresh HTTP error:', this.status);
              try {
                if (!this.status || this.status === 0) {
                  fetch(refreshURLAbs, {
                    credentials: 'include',
                    headers: {
                      'Accept': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest'
                    }
                  }).then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                  }).then(freshData => {
                    try {
                      const freshPostCount = freshData.data?.length || 0;
                      if (freshPostCount > 0) {
                        const cacheKey = generateCacheKey(requestUrl);
                        const freshEntry = { data: freshData, timestamp: Date.now(), url: requestUrl };
                        memoryCache.set(cacheKey, freshEntry);
                        try {
                          localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(freshEntry));
                          console.log(`🔄 Background refresh (fetch) completed: ${freshPostCount} fresh posts cached`);
                          showNotification('🔄 Data refreshed', 'info');
                          window.dispatchEvent(new CustomEvent('kayako-data-refreshed', { detail: { cacheKey, freshData, postCount: freshPostCount } }));
                        } catch (_) {
                          console.warn('📦 Background data (fetch): memory only');
                        }
                      } else {
                        console.log('🚫 Background refresh (fetch) returned empty data');
                      }
                    } catch (e) {
                      console.warn('Background refresh (fetch) parse error:', e);
                    }
                  }).catch(err => console.warn('Background refresh (fetch) error:', err.message));
                }
              } catch (e) {}
            }
          };
           
           backgroundXHR.onerror = function() {
             console.warn('Background refresh network error');
           };
           
           backgroundXHR.send();
         }, 50); // Start background refresh after cached response
        
        return;
      }
      
      // CACHE STORAGE (WORKING LOGIC - RESTORED) - Only for actual network requests
      if (requestMethod === 'GET' && requestUrl && isPostsList(requestUrl)) {
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
                  console.warn('📦 Storage quota exceeded, attempting cleanup...');
                  
                  // Try to free up space
                  const freedSpace = freeUpLocalStorage();
                  
                  if (freedSpace > 0) {
                    try {
                      localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(cacheEntry));
                      console.log('💾📥 CACHED after cleanup:', cacheKey, `(${postCount} posts)`);
                      showNotification('💾 Cached (after cleanup)', 'info');
                      window.kayakoCacheStats_live.stored++;
                    } catch (stillFullError) {
                      console.warn('📦 Storage still full after cleanup, memory cache only');
                      window.kayakoCacheStats_live.stored++;
                    }
                  } else {
                    console.warn('📦 Could not free space, memory cache only');
                    window.kayakoCacheStats_live.stored++;
                  }
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
  function isPostsList(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/\d+\/posts$/.test(u.pathname);
    } catch (e) { return false; }
  }
  function isPostsWrite(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/posts(\/\d+)?$/.test(u.pathname);
    } catch (e) { return false; }
  }
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
  function getCurrentCaseId() {
    try {
      const href = window.location.href;
      let m = href.match(/\/conversations\/(\d+)/);
      if (m) return m[1];
      m = href.match(/\/cases\/(\d+)/);
      if (m) return m[1];
      return null;
    } catch (e) { return null; }
  }
  function invalidateCaseCache(caseId) {
    try {
      const needle = `posts_${caseId}_`;
      if (memoryCache && memoryCache.size) {
        for (const key of memoryCache.keys()) {
          try { if (String(key).includes(needle)) memoryCache.delete(key); } catch (_) {}
        }
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('kayako_cache_')) {
          const ck = k.replace('kayako_cache_', '');
          if (ck.includes(needle)) localStorage.removeItem(k);
        }
      }
      console.log(`🧹 Invalidated cache for case ${caseId}`);
    } catch (e) {
      console.warn('Cache invalidation error:', e);
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
  
  // Enhanced clear cache function (for popup) - OVERRIDE early stub
  window.clearKayakoCache = function() {
    console.log('🗑️ Clearing all Kayako cache...');
    let cleared = 0;
    
    // Clear memory cache
    if (typeof memoryCache !== 'undefined' && memoryCache.clear) {
      memoryCache.clear();
    }
    
    // Clear localStorage cache entries
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kayako_cache_')) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    
    // Reset stats
    if (typeof window.kayakoCacheStats_live === 'object') {
      window.kayakoCacheStats_live = { hits: 0, misses: 0, stored: 0 };
    }
    
    console.log(`✅ Cleared ${cleared} cache entries + reset memory cache`);
    return cleared;
  };
  
  // Free up localStorage space by pruning ONLY our own cache keys
  function freeUpLocalStorage() {
    try {
      console.log('🧹 Freeing up localStorage space...');
      let freedSpace = 0;
      
      // Remove old entries (keep only last hour)
      const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CACHE_PREFIX)) continue; // Only our cache keys
        try {
          const value = localStorage.getItem(key);
          if (!value) continue;
          
          // Parse our cache envelope: { data, timestamp, url }
          try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.timestamp && parsed.timestamp < cutoff) {
              localStorage.removeItem(key);
              freedSpace++;
              continue;
            }
          } catch (_) {}
          
          // Guardrail for oversized OUR entries only
          if (value.length > 100000) {
            localStorage.removeItem(key);
            freedSpace++;
          }
        } catch (_) {}
      }
      
      console.log(`🧹 Freed ${freedSpace} Kayako cache entries for space`);
      return freedSpace;
      
    } catch (error) {
      console.warn('localStorage cleanup error:', error);
      return 0;
    }
  }
  
  // Simple stats function (for popup) - OVERRIDE early stub
  window.getKayakoCacheStats = function() {
    console.log('📊 Getting cache stats...');
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
    
    const stats = {
      entries: entries,
      sizeKB: Math.round(totalSize / 1024),
      working: true
    };
    
    console.log('📊 Cache stats:', stats);
    return stats;
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
  
  // Simple test function (for popup compatibility) - OVERRIDE early stub
  window.testKayakoPagination = function() {
    console.log('🧪 Testing pagination...');
    
    try {
      const xhrModified = window.XMLHttpRequest.toString() !== OriginalXHR.toString();
      console.log('XMLHttpRequest modified:', xhrModified);
      
      if (typeof window.kayakoCacheStats_live === 'object') {
        console.log('Live stats:', window.kayakoCacheStats_live);
      }
      
      console.log('Memory cache available:', typeof memoryCache !== 'undefined');
      
      return xhrModified;
    } catch (error) {
      console.error('Test function error:', error);
      return false;
    }
  };
  
  // Debug function to test background refresh manually
  window.testBackgroundRefresh = function() {
    console.log('🧪 Testing background refresh manually...');
    
    const currentUrl = window.location.href;
    const caseMatch = currentUrl.match(/\/conversations\/(\d+)/);
    
    if (caseMatch) {
      const caseId = caseMatch[1];
      const testURL = `/api/v1/cases/${caseId}/posts?include=attachment,case_message,channel,post,user,identity_phone,identity_email,identity_twitter,identity_facebook,note,activity,chat_message,facebook_message,twitter_tweet,twitter_message,comment,event,action,trigger,monitor,engagement,sla_version,activity_object,rating,case_status,activity_actor&fields=%2Boriginal(%2Bobject(%2Boriginal(%2Bform(-fields))))%2C%2Boriginal(%2Bobject(%2Boriginal(-custom_fields)))&filters=all&include=*&limit=100`;
      
      console.log('📋 Testing URL:', testURL);
      
      const testXHR = new OriginalXHR();
      testXHR.open('GET', testURL, true);
      
      testXHR.onload = function() {
        console.log('📥 Test background response:');
        console.log('  Status:', this.status);
        console.log('  Response length:', this.responseText?.length || 0);
        
        if (this.status === 200) {
          try {
            const data = JSON.parse(this.responseText);
            console.log('  Posts found:', data.data?.length || 0);
            console.log('  Response structure:', Object.keys(data));
            
            if (data.data && data.data.length > 0) {
              console.log('✅ Background refresh would work with this response');
            } else {
              console.log('❌ Background refresh getting empty data - this is the problem');
              console.log('  Raw data:', data.data);
            }
          } catch (error) {
            console.error('❌ Background response parse error:', error);
          }
        }
      };
      
      testXHR.send();
      
    } else {
      console.log('❌ Not on a conversation page');
    }
  };
  
  console.log('✅ Clean Kayako optimization ready');
  console.log('🎯 Features: Pagination (100 posts/request) + Working cache detection + Clean management');
  
  // Debug: Verify functions are actually created
  console.log('🔍 Verifying functions created:');
  console.log('  clearKayakoCache:', typeof window.clearKayakoCache);
  console.log('  getKayakoCacheStats:', typeof window.getKayakoCacheStats);
  console.log('  kayakoCacheStats:', typeof window.kayakoCacheStats);
  console.log('  testKayakoPagination:', typeof window.testKayakoPagination);
  console.log('  testBackgroundRefresh:', typeof window.testBackgroundRefresh);
  
  // ONLY clean up very old cache entries on startup (not recent cache!)
  setTimeout(() => {
    console.log('🧹 Checking for very old cache entries...');
    try {
      let veryOldCleaned = 0;
      const veryOldCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours old
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('kayako_cache_')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              // Only remove cache older than 24 hours
              if (parsed.timestamp && parsed.timestamp < veryOldCutoff) {
                localStorage.removeItem(key);
                veryOldCleaned++;
              }
            } catch (e) {
              // Remove truly corrupted entries
              localStorage.removeItem(key);
              veryOldCleaned++;
            }
          }
        }
      }
      
      if (veryOldCleaned > 0) {
        console.log(`🧹 Cleaned ${veryOldCleaned} very old cache entries (24h+)`);
      } else {
        console.log('✅ No old cache cleanup needed');
      }
    } catch (error) {
      console.warn('Startup cleanup error:', error);
    }
  }, 2000);
  
})();

// Signal that script has completed execution
console.log('📡 Signaling script completion...');
window.postMessage({ type: 'KAYAKO_SCRIPT_LOADED', timestamp: Date.now() }, '*');

// Clean visual indicator
setTimeout(() => {
  try { const existing = document.getElementById('kayako-opt'); if (existing) existing.remove(); } catch (_) {}
  const indicator = document.createElement('div');
  indicator.id = 'kayako-opt';
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
  
  // Auto-remove after ~3 seconds
  setTimeout(() => {
    try {
      if (indicator && indicator.parentNode) {
        indicator.style.opacity = '0';
        setTimeout(() => { try { indicator.remove(); } catch(_) {} }, 250);
      }
    } catch (_) {}
  }, 3000);
  
}, 1000);

console.log('🎉 Clean solution loaded - focus on proven working features!');
