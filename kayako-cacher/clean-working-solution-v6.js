/**
 * Kayako Cacher v6.0 - GUTTED & SIMPLIFIED
 * 
 * What this does:
 * 1. Prevents 400 errors on detail requests (strips include=*)
 * 2. Suppresses problematic markAsSeen/PUT requests
 * 3. Provides safe stubs for activity/attachment details
 * 4. Integrates with image upload optimizer
 * 
 * What this DOESN'T do anymore:
 * - Pagination modification (Kayako now loads all posts automatically!)
 * - Background backfill (not needed)
 * - Ember store manipulation (never worked)
 * - DOM append (not needed)
 * - Caching (removed for now, can add back if needed)
 */

(function() {
  'use strict';
  
  console.log('🚀 Kayako Cacher v6 starting...');
  
  // Store original XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  
  // Stats tracking
  window.kayakoCacheStats_live = { 
    detailRequestsFixed: 0,
    seenRequestsSuppressed: 0,
    putRequestsSuppressed: 0
  };
  
  /**
   * Helper: Check if URL is a posts list request
   */
  function isPostsList(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/\d+\/posts$/.test(u.pathname);
    } catch (e) { return false; }
  }
  
  /**
   * Helper: Check if URL is an activity detail request
   */
  function isActivityDetail(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/activities\/\d+$/.test(u.pathname);
    } catch (e) { return false; }
  }
  
  /**
   * Helper: Check if URL is a message detail request
   */
  function isMessageDetail(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/messages\/\d+$/.test(u.pathname);
    } catch (e) { return false; }
  }
  
  /**
   * Helper: Check if URL is an attachment detail request
   */
  function isAttachmentDetail(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/attachments\/\d+$/.test(u.pathname);
    } catch (e) { return false; }
  }
  
  /**
   * Helper: Check if URL is a write to posts endpoint
   */
  function isPostsWrite(url) {
    try {
      const u = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/posts(?:\/[0-9]+)?\/?$/.test(u.pathname);
    } catch (e) { return false; }
  }
  
  /**
   * Override XMLHttpRequest to fix issues
   */
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    const originalSetRequestHeader = xhr.setRequestHeader;
    
    let requestUrl = null;
    let requestMethod = null;
    
    // Capture CSRF token from any page XHR headers
    xhr.setRequestHeader = function(name, value) {
      try {
        if (typeof name === 'string' && /^x[-_]csrf[-_]token$/i.test(name) && typeof value === 'string' && value.length > 16) {
          if (window.kayako_csrf_token !== value) {
            window.kayako_csrf_token = value;
            console.log('🔑 Captured CSRF token from XHR header');
          }
        }
      } catch (e) {}
      return originalSetRequestHeader.apply(this, arguments);
    };
    
    xhr.open = function(method, url, ...rest) {
      requestUrl = url;
      requestMethod = method;
      
      // Strip include=* from activity/message/attachment detail requests to avoid server 400
      if (method === 'GET' && typeof url === 'string') {
        if (isActivityDetail(url) || isMessageDetail(url) || isAttachmentDetail(url)) {
          try {
            const u = new URL(url, window.location.origin);
            if (u.searchParams.has('include')) {
              u.searchParams.delete('include');
              url = u.toString();
              window.kayakoCacheStats_live.detailRequestsFixed++;
              console.log('🛡️ Stripped include from detail request');
            }
          } catch (_) {}
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
            console.log('🔑 Captured CSRF token');
          }
        }
      } catch (e) {}
      return originalSetRequestHeader.apply(this, arguments);
    };
    
    xhr.send = function(data) {
      // Suppress markAsSeen (SEEN/DELIVERED) writes to avoid server 400s breaking UI
      try {
        if (requestMethod && /^(PUT|POST|PATCH)$/i.test(requestMethod) && requestUrl && isPostsWrite(requestUrl)) {
          const u = new URL(requestUrl, window.location.origin);
          const idStr = (u.pathname.match(/\/posts\/(\d+)/) || [])[1] || null;
          let isMarkSeen = false;
          
          // Detect SEEN/DELIVERED in query params
          try {
            const qsStatus = String((u.searchParams.get('post_status') || u.searchParams.get('status') || '')).toUpperCase();
            if (qsStatus === 'SEEN' || qsStatus === 'DELIVERED') isMarkSeen = true;
          } catch(_) {}
          
          // Detect SEEN/DELIVERED in body
          try {
            if (typeof data === 'string') {
              const mStatus = /(post_status|status|delivery_status)\s*[:=]\s*"?(SEEN|DELIVERED)"?/i.exec(data);
              isMarkSeen = !!mStatus;
            }
          } catch (_) {}
          
          if (idStr && isMarkSeen) {
            const ok = JSON.stringify({ status: 200, success: true });
            setTimeout(() => {
              try {
                Object.defineProperty(this, 'status', { value: 200, configurable: true });
                Object.defineProperty(this, 'statusText', { value: 'OK', configurable: true });
                Object.defineProperty(this, 'responseText', { value: ok, configurable: true });
                Object.defineProperty(this, 'response', { value: ok, configurable: true });
                Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                if (this.onload) this.onload.call(this);
                if (this.onreadystatechange) this.onreadystatechange.call(this);
              } catch (_) {}
            }, 0);
            window.kayakoCacheStats_live.seenRequestsSuppressed++;
            console.log('🛡️ Suppressed markAsSeen for post', idStr);
            return;
          }
          
          // Fail-safe: suppress any PUT to posts/:id to avoid UI-breaking 400s
          if (idStr && /^(PUT)$/i.test(requestMethod)) {
            const ok = JSON.stringify({ status: 200, success: true });
            setTimeout(() => {
              try {
                Object.defineProperty(this, 'status', { value: 200, configurable: true });
                Object.defineProperty(this, 'statusText', { value: 'OK', configurable: true });
                Object.defineProperty(this, 'responseText', { value: ok, configurable: true });
                Object.defineProperty(this, 'response', { value: ok, configurable: true });
                Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                if (this.onload) this.onload.call(this);
                if (this.onreadystatechange) this.onreadystatechange.call(this);
              } catch (_) {}
            }, 0);
            window.kayakoCacheStats_live.putRequestsSuppressed++;
            console.log('🛡️ Suppressed PUT to posts/', idStr);
            return;
          }
        }
      } catch (_) {}
      
      // Stub problematic activity/attachment detail requests with safe payloads
      try {
        if (requestMethod === 'GET' && requestUrl && (isActivityDetail(requestUrl) || isAttachmentDetail(requestUrl))) {
          let stubPayload = null;
          if (isAttachmentDetail(requestUrl)) {
            try {
              const u = new URL(requestUrl, window.location.origin);
              const id = u.pathname.split('/').pop();
              stubPayload = { data: { id: Number(id), resource_type: 'attachment' } };
            } catch (_) {
              stubPayload = { data: { id: null, resource_type: 'attachment' } };
            }
          } else {
            stubPayload = { data: [] };
          }
          const text = JSON.stringify(stubPayload);
          setTimeout(() => {
            try {
              Object.defineProperty(this, 'status', { value: 200, configurable: true });
              Object.defineProperty(this, 'statusText', { value: 'OK', configurable: true });
              Object.defineProperty(this, 'responseText', { value: text, configurable: true });
              Object.defineProperty(this, 'response', { value: text, configurable: true });
              Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
              if (this.onload) this.onload.call(this);
              if (this.onreadystatechange) this.onreadystatechange.call(this);
            } catch (_) {}
          }, 0);
          return;
        }
      } catch (_) {}
      
      return originalSend.apply(this, [data]);
    };
    
    return xhr;
  };
  
  // Copy properties
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  /**
   * Utility: Clear cache (for popup compatibility)
   */
  window.clearKayakoCache = function() {
    console.log('🗑️ Cache cleared (no-op in v6, caching removed)');
    return 0;
  };
  
  /**
   * Utility: Get cache stats (for popup compatibility)
   */
  window.getKayakoCacheStats = function() {
    return {
      entries: 0,
      sizeKB: 0,
      working: true,
      v6: true
    };
  };
  
  /**
   * Utility: Detailed stats
   */
  window.kayakoCacheStats = function() {
    console.log('📊 Kayako Cacher v6 Stats:');
    console.log('  Detail requests fixed:', window.kayakoCacheStats_live.detailRequestsFixed);
    console.log('  SEEN requests suppressed:', window.kayakoCacheStats_live.seenRequestsSuppressed);
    console.log('  PUT requests suppressed:', window.kayakoCacheStats_live.putRequestsSuppressed);
    return window.kayakoCacheStats_live;
  };
  
  console.log('✅ Kayako Cacher v6 ready - error prevention active');
  console.log('🎯 Image optimization will be loaded separately');
  
})();

// Signal completion
window.postMessage({ type: 'KAYAKO_SCRIPT_LOADED', timestamp: Date.now() }, '*');

