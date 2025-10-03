/**
 * Injected Script - Kayako Simple Paginator
 * 
 * Phase 1: Pagination Only
 * - Intercepts XHR requests to /cases/:id/posts
 * - Changes limit from 30 to 100
 * - That's it. No caching, no backfill, no Ember manipulation.
 * 
 * Philosophy: Do one thing perfectly before adding complexity.
 */

(function() {
  'use strict';
  
  console.log('[Kayako Paginator] Injected script starting...');
  
  // Configuration
  const CONFIG = {
    DEFAULT_LIMIT: 100,
    DEBUG: true
  };
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  // Stats for debugging
  const stats = {
    intercepted: 0,
    modified: 0,
    total: 0
  };
  
  /**
   * Check if a URL is a posts list request
   */
  function isPostsListRequest(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/\d+\/posts$/.test(urlObj.pathname);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Check if a URL is an activities list request
   */
  function isActivitiesListRequest(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/\d+\/activities$/.test(urlObj.pathname);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Modify URL to increase pagination limit
   */
  function modifyPaginationLimit(url, newLimit) {
    try {
      const urlObj = new URL(url, window.location.origin);
      const currentLimit = urlObj.searchParams.get('limit');
      
      if (currentLimit && parseInt(currentLimit) >= newLimit) {
        // Already has a good limit, don't touch it
        return url;
      }
      
      urlObj.searchParams.set('limit', String(newLimit));
      return urlObj.toString();
    } catch (e) {
      if (CONFIG.DEBUG) {
        console.warn('[Kayako Paginator] Failed to modify URL:', e);
      }
      return url;
    }
  }
  
  /**
   * Override XMLHttpRequest
   */
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    
    let requestUrl = null;
    let requestMethod = null;
    let wasModified = false;
    
    // Override open() to intercept the URL
    xhr.open = function(method, url, ...rest) {
      stats.total++;
      requestUrl = url;
      requestMethod = method;
      wasModified = false;
      
      // Check if this is a request we should modify
      const shouldModify = (
        method === 'GET' && 
        (isPostsListRequest(url) || isActivitiesListRequest(url))
      );
      
      if (shouldModify) {
        stats.intercepted++;
        
        const modifiedUrl = modifyPaginationLimit(url, CONFIG.DEFAULT_LIMIT);
        
        if (modifiedUrl !== url) {
          stats.modified++;
          wasModified = true;
          
          if (CONFIG.DEBUG) {
            console.log('[Kayako Paginator] Modified request:', {
              original: url.substring(url.indexOf('/api')),
              modified: modifiedUrl.substring(modifiedUrl.indexOf('/api'))
            });
          }
          
          url = modifiedUrl;
        }
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    return xhr;
  };
  
  // Copy properties and prototype
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  // Expose stats for debugging
  window.__KayakoPaginator__ = {
    stats: function() {
      return {
        ...stats,
        config: CONFIG
      };
    },
    
    setLimit: function(limit) {
      const newLimit = parseInt(limit);
      if (isNaN(newLimit) || newLimit < 1) {
        console.error('[Kayako Paginator] Invalid limit:', limit);
        return false;
      }
      CONFIG.DEFAULT_LIMIT = newLimit;
      console.log('[Kayako Paginator] Limit updated to:', newLimit);
      return true;
    },
    
    toggleDebug: function() {
      CONFIG.DEBUG = !CONFIG.DEBUG;
      console.log('[Kayako Paginator] Debug mode:', CONFIG.DEBUG ? 'ON' : 'OFF');
      return CONFIG.DEBUG;
    }
  };
  
  console.log('[Kayako Paginator] ✅ Ready - pagination limit set to', CONFIG.DEFAULT_LIMIT);
  console.log('[Kayako Paginator] Debug commands: window.__KayakoPaginator__.stats()');
  
})();

