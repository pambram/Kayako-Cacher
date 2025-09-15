// Simple, safe caching that won't interfere with Kayako
console.log('💾 Simple cache strategy initializing...');

// Use Chrome storage for persistence across page reloads
const CACHE_PREFIX = 'kayako_simple_cache_';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// In-memory cache for quick access
const memoryCache = new Map();

// Store the ORIGINAL XMLHttpRequest before any modifications
const TrueOriginalXHR = window.XMLHttpRequest.originalXHR || window.XMLHttpRequest;

// Get the current XMLHttpRequest (which might already be modified by pagination fixer)  
const CurrentXHR = window.XMLHttpRequest;

console.log('🔧 Setting up cache enhancement...');

// Enhance XHR to add simple response caching
window.XMLHttpRequest = function() {
  // Use the true original XHR to avoid conflicts
  const xhr = new TrueOriginalXHR();
  const originalOpen = xhr.open;
  let requestUrl = null;
  
  xhr.open = function(method, url, ...rest) {
    requestUrl = url;
    
    // Apply pagination fix first (if not already done)
    if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
      url = url.replace('limit=30', 'limit=100');
      console.log('✅ Pagination: limit increased to 100');
    }
    
    // Check cache for GET posts requests
    if (method === 'GET' && url.includes('/posts')) {
      const cacheKey = generateSimpleCacheKey(url);
      console.log('🔍 Checking cache for:', cacheKey, 'URL:', url);
      
      // Check persistent cache
      checkPersistentCache(cacheKey).then(cached => {
        if (cached && !isCacheExpired(cached.timestamp)) {
          console.log('💾✅ CACHE HIT! Using cached data for:', cacheKey);
          showCacheNotification('💾 Cache Hit - Instant Load!');
          
          // Return cached response immediately (create new XHR for cached response)
          setTimeout(() => {
            try {
              const fakeXHR = Object.create(xhr);
              fakeXHR.readyState = 4;
              fakeXHR.status = 200;
              fakeXHR.statusText = 'OK (Cached)';
              fakeXHR.responseText = JSON.stringify(cached.data);
              fakeXHR.response = JSON.stringify(cached.data);
              
              if (xhr.onreadystatechange) xhr.onreadystatechange.call(fakeXHR);
              if (xhr.onload) xhr.onload.call(fakeXHR);
            } catch (error) {
              console.warn('Cache hit error, falling back to network:', error);
            }
          }, 0);
          
          // Don't make the network request for cache hits
          return;
        } else {
          console.log('💾❌ Cache miss for:', cacheKey);
          showCacheNotification('🌐 Cache Miss - Loading from network...');
        }
      }).catch(error => {
        console.log('💾❌ Cache check error:', error);
        showCacheNotification('🌐 Cache Miss - Loading from network...');
      });
    }
    
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  // Add simple response caching
  const originalOnLoad = xhr.onload;
  xhr.onload = function() {
    // Cache successful posts responses
    if (this.status === 200 && requestUrl && requestUrl.includes('/posts')) {
      try {
        const data = JSON.parse(this.responseText);
        const cacheKey = generateSimpleCacheKey(requestUrl);
        
        const cacheEntry = {
          data: data,
          timestamp: Date.now(),
          url: requestUrl
        };
        
        // Store in both memory and persistent storage
        memoryCache.set(cacheKey, cacheEntry);
        storePersistentCache(cacheKey, cacheEntry);
        
        console.log('💾📥 CACHED RESPONSE for:', cacheKey, `(${data.data?.length || 0} posts)`);
        showCacheNotification('💾 Response cached for future use');
        
      } catch (error) {
        console.warn('Cache storage error (non-critical):', error);
      }
    }
    
    if (originalOnLoad) {
      originalOnLoad.apply(this, arguments);
    }
  };
  
  return xhr;
};

// Store reference to original for other scripts
window.XMLHttpRequest.originalXHR = TrueOriginalXHR;

// Copy properties safely
Object.setPrototypeOf(window.XMLHttpRequest, TrueOriginalXHR);
Object.setPrototypeOf(window.XMLHttpRequest.prototype, TrueOriginalXHR.prototype);

function generateSimpleCacheKey(url) {
  try {
    const urlObj = new URL(url, window.location.origin);
    
    // More robust case ID extraction
    const caseMatch = urlObj.pathname.match(/\/cases\/(\d+)/);
    const caseId = caseMatch ? caseMatch[1] : 'unknown';
    
    const afterId = urlObj.searchParams.get('after_id') || 'initial';
    const limit = urlObj.searchParams.get('limit') || '100'; // Default to 100 now
    const filters = urlObj.searchParams.get('filters') || 'all';
    
    const key = `posts_${caseId}_${afterId}_${limit}_${filters}`;
    console.log('🔑 Generated cache key:', key, 'from URL:', url);
    
    return key;
  } catch (error) {
    console.error('Cache key generation error:', error);
    const fallback = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    console.log('🔑 Fallback cache key:', fallback);
    return fallback;
  }
}

// Persistent storage functions
async function checkPersistentCache(cacheKey) {
  try {
    // Check memory first (faster)
    if (memoryCache.has(cacheKey)) {
      console.log('⚡ Memory cache hit for:', cacheKey);
      return memoryCache.get(cacheKey);
    }
    
    // Check Chrome storage
    const storageKey = CACHE_PREFIX + cacheKey;
    const result = await chrome.storage.local.get([storageKey]);
    const cached = result[storageKey];
    
    if (cached) {
      console.log('📱 Storage cache hit for:', cacheKey);
      // Add to memory cache for faster future access
      memoryCache.set(cacheKey, cached);
      return cached;
    }
    
    console.log('❌ No cache found for:', cacheKey);
    return null;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

async function storePersistentCache(cacheKey, cacheEntry) {
  try {
    // Store in Chrome storage for persistence
    const storageKey = CACHE_PREFIX + cacheKey;
    await chrome.storage.local.set({
      [storageKey]: cacheEntry
    });
    
    console.log('💾 Stored in persistent cache:', cacheKey);
  } catch (error) {
    console.warn('Persistent storage error (non-critical):', error);
  }
}

function isCacheExpired(timestamp) {
  return Date.now() - timestamp > CACHE_EXPIRY;
}

async function cleanOldEntries() {
  try {
    const cutoff = Date.now() - CACHE_EXPIRY;
    const allStorage = await chrome.storage.local.get();
    const expiredKeys = [];
    
    Object.entries(allStorage).forEach(([key, value]) => {
      if (key.startsWith(CACHE_PREFIX) && value.timestamp && value.timestamp < cutoff) {
        expiredKeys.push(key);
      }
    });
    
    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove(expiredKeys);
      console.log('🗑️ Cleaned expired cache entries:', expiredKeys.length);
    }
    
    // Also clean memory cache
    for (const [key, value] of memoryCache.entries()) {
      if (value.timestamp < cutoff) {
        memoryCache.delete(key);
      }
    }
  } catch (error) {
    console.warn('Cache cleanup error (non-critical):', error);
  }
}

// Visual cache feedback - make it global for access from other scripts
window.kayakoCacheStats_live = { hits: 0, misses: 0 };

function showCacheNotification(message) {
  // Update stats
  if (message.includes('Hit')) {
    window.kayakoCacheStats_live.hits++;
  } else if (message.includes('Miss')) {
    window.kayakoCacheStats_live.misses++;
  }
  
  // Remove existing notification
  const existing = document.getElementById('cache-notification');
  if (existing) existing.remove();
  
  // Create notification
  const notification = document.createElement('div');
  notification.id = 'cache-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 20px;
    background: ${message.includes('Hit') ? '#28a745' : '#ffc107'};
    color: ${message.includes('Hit') ? 'white' : '#000'};
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;
  
  notification.innerHTML = `
    ${message}<br>
    <small style="opacity: 0.8;">Total: ${window.kayakoCacheStats_live.hits} hits, ${window.kayakoCacheStats_live.misses} misses</small>
  `;
  
  document.body?.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Expose cache stats for debugging
window.kayakoCacheStats = async function() {
  try {
    // Get all cache entries from Chrome storage
    const allStorage = await chrome.storage.local.get();
    const cacheEntries = Object.entries(allStorage).filter(([key]) => 
      key.startsWith(CACHE_PREFIX)
    );
    
    console.log('📊 Cache Statistics:');
    console.log('  Persistent entries:', cacheEntries.length);
    console.log('  Memory entries:', memoryCache.size);
    
    const stats = [];
    cacheEntries.forEach(([key, value]) => {
      const cleanKey = key.replace(CACHE_PREFIX, '');
      const age = Math.round((Date.now() - value.timestamp) / 1000 / 60);
      console.log(`  ${cleanKey}: ${age} minutes old (${value.data?.data?.length || 0} posts)`);
      stats.push({ key: cleanKey, age, url: value.url, posts: value.data?.data?.length || 0 });
    });
    
    return {
      size: cacheEntries.length,
      memorySize: memoryCache.size,
      entries: stats,
      liveStats: window.kayakoCacheStats_live
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      size: memoryCache.size,
      entries: Array.from(memoryCache.entries()).map(([key, value]) => ({
        key,
        age: Math.round((Date.now() - value.timestamp) / 1000 / 60),
        url: value.url
      }))
    };
  }
};

// Simple cache lookup (manual use)
window.kayakoGetCached = async function(caseId, afterId = 'initial', limit = '100', filters = 'all') {
  const key = `posts_${caseId}_${afterId}_${limit}_${filters}`;
  
  try {
    const cached = await checkPersistentCache(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      console.log(`💾 Found cached data (${Math.round(age/1000)}s old):`, cached.data);
      return cached.data;
    } else {
      console.log('❌ No cached data found for:', key);
      return null;
    }
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
};

console.log('✅ Simple cache strategy ready');
console.log('🧪 Debug commands: window.kayakoCacheStats(), window.kayakoGetCached(caseId)');
