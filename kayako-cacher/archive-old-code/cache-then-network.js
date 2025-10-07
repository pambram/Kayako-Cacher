// Advanced caching strategy: Cache-then-network pattern
// Shows cached content immediately, refreshes in background

class KayakoCacheThenNetwork {
  constructor() {
    this.cachePrefix = 'kayako_posts_cache_';
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.refreshInProgress = new Set(); // Track ongoing refreshes
    
    this.init();
  }

  init() {
    console.log('🚀 Cache-then-network strategy initializing...');
    
    // Override XMLHttpRequest to implement cache-then-network
    this.interceptXHR();
    
    console.log('✅ Cache-then-network ready');
  }

  interceptXHR() {
    // Get the current XMLHttpRequest (which should already be overridden by pagination fixer)
    const CurrentXHR = window.XMLHttpRequest;
    const OriginalXHR = CurrentXHR.originalXHR || CurrentXHR;
    const self = this;
    
    console.log('🔄 Enhancing existing XHR override with caching...');
    
    // Enhance the existing XMLHttpRequest override
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...rest) {
        // First apply pagination fix (increase limit)
        if (typeof url === 'string' && url.includes('/posts') && url.includes('limit=30')) {
          url = url.replace('limit=30', 'limit=100');
          console.log('✅ Pagination: Increased limit to 100');
        }
        
        // Then apply cache-then-network strategy
        if (typeof url === 'string' && url.includes('/posts') && method === 'GET') {
          console.log('💾 Cache strategy: Checking for cached data...');
          
          const cacheKey = self.generateCacheKey(url);
          
          // Check cache asynchronously (don't block the request)
          self.getCachedData(cacheKey).then(cachedData => {
            if (cachedData && !self.isCacheExpired(cachedData.timestamp)) {
              console.log('✅ Cache found: Serving cached data first');
              
              // Create a fake "instant" response for cached data
              self.createInstantResponse(xhr, cachedData);
              
              // Start background refresh to update cache
              if (!self.refreshInProgress.has(cacheKey)) {
                console.log('🔄 Background: Starting fresh data fetch...');
                self.refreshInBackground(url, cacheKey);
              }
            }
          });
        }
        
        return originalOpen.apply(this, [method, url, ...rest]);
      };
      
      // Intercept response to cache it (SIMPLIFIED)
      const originalOnLoad = xhr.onload;
      xhr.onload = function() {
        // Only cache posts responses
        if (this.status === 200 && this.responseURL && this.responseURL.includes('/posts')) {
          try {
            const responseData = JSON.parse(this.responseText);
            const cacheKey = self.generateCacheKey(this.responseURL);
            self.setCachedData(cacheKey, responseData);
            console.log('💾 Response cached for future use');
          } catch (error) {
            console.warn('Could not cache response:', error);
          }
        }
        
        if (originalOnLoad) {
          originalOnLoad.apply(this, arguments);
        }
      };
      
      return xhr;
    };
    
    // Store reference to original
    window.XMLHttpRequest.originalXHR = OriginalXHR;
    
    // Copy properties
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
    Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  }

  async getCachedData(cacheKey) {
    try {
      const result = await chrome.storage.local.get([cacheKey]);
      return result[cacheKey] || null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async setCachedData(cacheKey, data) {
    try {
      const cacheEntry = {
        timestamp: Date.now(),
        data: data,
        size: JSON.stringify(data).length
      };
      
      await chrome.storage.local.set({
        [cacheKey]: cacheEntry
      });
      
      console.log('💾 Data cached for key:', cacheKey);
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  generateCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      const caseId = this.extractCaseId(urlObj.pathname);
      const afterId = urlObj.searchParams.get('after_id') || 'initial';
      const limit = urlObj.searchParams.get('limit') || '30';
      
      return `${this.cachePrefix}${caseId}_${afterId}_${limit}`;
    } catch (error) {
      console.error('Error generating cache key:', error);
      return url.replace(/[^a-zA-Z0-9]/g, '_');
    }
  }

  extractCaseId(pathname) {
    const match = pathname.match(/\/cases\/(\d+)\/posts/);
    return match ? match[1] : 'unknown';
  }

  isCacheExpired(timestamp) {
    return Date.now() - timestamp > this.cacheExpiry;
  }

  createInstantResponse(xhr, cachedData) {
    console.log('⚡ Creating instant response from cache...');
    
    // Clone the XHR to avoid interfering with the real request
    const fakeXHR = Object.create(xhr);
    
    // Set response properties
    fakeXHR.readyState = 4;
    fakeXHR.status = 200;
    fakeXHR.statusText = 'OK (Cached)';
    fakeXHR.responseText = JSON.stringify(cachedData.data);
    fakeXHR.response = JSON.stringify(cachedData.data);
    
    // Trigger success handlers immediately with cached data
    setTimeout(() => {
      if (xhr.onreadystatechange) {
        console.log('📤 Triggering cached response handlers...');
        xhr.onreadystatechange.call(fakeXHR);
      }
      if (xhr.onload) {
        xhr.onload.call(fakeXHR);
      }
    }, 0);
  }

  respondWithCache(xhr, cachedData) {
    // Legacy method - keeping for compatibility
    this.createInstantResponse(xhr, cachedData);
  }

  async refreshInBackground(url, cacheKey, originalXhr) {
    this.refreshInProgress.add(cacheKey);
    
    try {
      console.log('🔄 Making background request for fresh data...');
      
      const response = await fetch(url);
      if (response.ok) {
        const freshData = await response.json();
        console.log('✅ Fresh data received, updating cache');
        
        // Update cache with fresh data
        await this.setCachedData(cacheKey, freshData);
        
        // Optionally trigger UI update (could dispatch custom event)
        window.dispatchEvent(new CustomEvent('kayako-fresh-data', {
          detail: { cacheKey, data: freshData, url }
        }));
        
        console.log('🔄 Cache updated with fresh data');
      }
    } catch (error) {
      console.error('❌ Background refresh failed:', error);
    } finally {
      this.refreshInProgress.delete(cacheKey);
    }
  }
}

// Initialize cache-then-network
const cacheStrategy = new KayakoCacheThenNetwork();

// Listen for fresh data updates to show notifications
window.addEventListener('kayako-fresh-data', (event) => {
  console.log('🔄 Fresh data available for:', event.detail.cacheKey);
  
  // Could show a subtle notification that data was updated
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 20px;
    background: #17a2b8;
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    opacity: 0.9;
  `;
  notification.textContent = '🔄 Data refreshed in background';
  
  document.body?.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
});

console.log('✅ Cache-then-network strategy loaded');
