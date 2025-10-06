/**
 * Injected Script - Kayako Simple Paginator v5.0
 * 
 * THE TRUTH: Kayako uses DOM rendering, NOT Ember store!
 * 
 * Strategy:
 * 1. Let Kayako load first 100 posts (limit=100)
 * 2. Fetch remaining posts in background
 * 3. Clone existing post DIVs as templates
 * 4. Append them to the timeline DOM
 * 
 * Simple. Direct. No Ember complexity.
 */

(function() {
  'use strict';
  
  console.log('[Kayako Paginator] 🚀 DOM Strategy starting...');
  
  const CONFIG = {
    LIMIT: 100,
    AUTO_LOAD_ALL: true,
    DEBUG: true
  };
  
  const OriginalFetch = window.fetch;
  const OriginalXHR = window.XMLHttpRequest;
  
  const stats = {
    postsLoaded: 0,
    backgroundPages: 0,
    domsAppended: 0
  };
  
  let backgroundLoadStarted = false;
  
  /**
   * Check if a URL is a posts list request
   */
  function isPostsListRequest(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return /\/api\/v1\/cases\/\d+\/posts$/.test(urlObj.pathname);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Check if URL is initial request (no after_id)
   */
  function isInitialRequest(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return !urlObj.searchParams.has('after_id');
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Strip include param from detail requests to prevent 400 errors
   */
  function isDetailRequest(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return /\/api\/v1\/(activities|messages|attachments)\/\d+$/.test(urlObj.pathname);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Get case ID from URL
   */
  function getCaseId(url) {
    try {
      const match = url.match(/\/cases\/(\d+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Find the timeline container in the DOM
   */
  function getTimelineContainer() {
    // Look for the timeline container
    const selectors = [
      '[class*="timeline"]',
      '[class*="ko-agent-content_layout_timeline"]',
      '.conversation-timeline',
      '#timeline'
    ];
    
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log('[Kayako Paginator] 📍 Found timeline:', selector);
        return el;
      }
    }
    
    return null;
  }
  
  /**
   * Find where post divs are located
   */
  function getPostsContainer() {
    // Find existing posts
    const existingPosts = document.querySelectorAll('[class*="post"]');
    if (existingPosts.length > 0) {
      const parent = existingPosts[0].parentElement;
      console.log('[Kayako Paginator] 📍 Found posts container, has', existingPosts.length, 'posts');
      return parent;
    }
    
    return null;
  }
  
  /**
   * Get existing post IDs from DOM
   */
  function getExistingPostIds() {
    const posts = document.querySelectorAll('[data-id]');
    const ids = new Set();
    posts.forEach(post => {
      const id = post.getAttribute('data-id');
      if (id) ids.add(id);
    });
    return ids;
  }
  
  /**
   * Determine post type from API data
   */
  function getPostType(postData) {
    try {
      const originalType = postData.original?.resource_type?.toLowerCase();
      
      if (originalType === 'note') return 'note';
      if (originalType === 'activity') return 'activity';
      if (originalType === 'case_message' || originalType === 'message') return 'message';
      
      return 'message'; // Default
    } catch (e) {
      return 'message';
    }
  }
  
  /**
   * Find a template element of the given type
   */
  function findTemplate(type) {
    if (type === 'note') {
      // Find a note (has yellow background, class contains 'note')
      return document.querySelector('[class*="note"][data-id]');
    } else if (type === 'activity') {
      // Find an activity (has activity classes)
      return document.querySelector('[class*="activity"][data-id]');
    } else {
      // Find a message (class contains 'post' or 'message')
      return document.querySelector('[class*="post"][data-id], [class*="message"][data-id]');
    }
  }
  
  /**
   * Create a post element by cloning an existing template
   */
  function createPostElement(postData) {
    const postType = getPostType(postData);
    let template = findTemplate(postType);
    
    if (!template) {
      // Fallback to any post
      template = document.querySelector('[data-id]');
    }
    
    if (!template) {
      // Last resort: create basic div
      const div = document.createElement('div');
      div.setAttribute('data-id', postData.id);
      div.innerHTML = `<div>${postData.contents || postData.subject || 'Post #' + postData.id}</div>`;
      return div;
    }
    
    // Clone the template
    const cloned = template.cloneNode(true);
    
    // Update data-id
    cloned.setAttribute('data-id', postData.id);
    
    // Update the content (preserve HTML formatting!)
    const contentDiv = cloned.querySelector('.ko-timeline-2_list_item__content_1oksrd');
    if (contentDiv && (postData.contents || postData.subject)) {
      contentDiv.innerHTML = postData.contents || postData.subject || '';
    }
    
    // Update creator name
    const creatorEl = cloned.querySelector('.ko-timeline-2_list_item__creator_1oksrd');
    if (creatorEl) {
      const creatorName = postData.creator?.full_name || postData.identity?.name || 'User';
      if (creatorEl.tagName === 'A') {
        creatorEl.textContent = creatorName;
        // Update href if we have user ID
        if (postData.creator?.id) {
          creatorEl.href = `/agent/users/${postData.creator.id}`;
        }
      } else {
        creatorEl.textContent = creatorName;
      }
    }
    
    // Update timestamp
    const timeEl = cloned.querySelector('[class*="time"]');
    if (timeEl && postData.created_at) {
      try {
        const date = new Date(postData.created_at);
        const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        timeEl.textContent = 'on ' + formatted;
      } catch (e) {}
    }
    
    // Update avatar if present
    const avatarImg = cloned.querySelector('.ko-user-avatar_image__image_kpxzg');
    if (avatarImg && postData.creator?.avatar) {
      avatarImg.src = postData.creator.avatar;
    }
    
    return cloned;
  }
  
  /**
   * Append posts to the DOM (prepend to show oldest first)
   */
  function appendPostsToDOM(posts) {
    const container = getPostsContainer();
    if (!container) {
      console.warn('[Kayako Paginator] No posts container found');
      return 0;
    }
    
    const existingIds = getExistingPostIds();
    let appended = 0;
    
    // Sort posts by ID ascending (oldest first)
    const sorted = [...posts].sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    // Prepend to container (so oldest posts go at the top)
    sorted.forEach(post => {
      if (!existingIds.has(String(post.id))) {
        const element = createPostElement(post);
        // Insert at the beginning
        container.insertBefore(element, container.firstChild);
        appended++;
      }
    });
    
    return appended;
  }
  
  /**
   * Background load all remaining posts
   */
  async function loadAllPostsInBackground(initialUrl, firstResponseText) {
    if (backgroundLoadStarted) {
      console.log('[Kayako Paginator] ⚠️ Background load already started');
      return;
    }
    
    backgroundLoadStarted = true;
    
    console.log('[Kayako Paginator] 🔄 Starting background load...');
    
    try {
      // Parse first response to determine if there's more
      const firstData = JSON.parse(firstResponseText);
      const firstPosts = firstData.data || [];
      
      console.log('[Kayako Paginator] 📊 First response:', firstPosts.length, 'posts');
      
      // Check if we need to load more
      if (firstPosts.length < CONFIG.LIMIT) {
        console.log('[Kayako Paginator] ✅ All posts already loaded (< 100)');
        return;
      }
      
      // Construct next URL
      const minId = Math.min(...firstPosts.map(p => parseInt(p.id)));
      const urlObj = new URL(initialUrl, window.location.origin);
      urlObj.searchParams.set('after_id', String(minId - 1));
      urlObj.searchParams.set('limit', String(CONFIG.LIMIT));
      
      let currentUrl = urlObj.toString();
      
      console.log('[Kayako Paginator] 🔗 First background URL:', currentUrl.substring(0, 200));
      
      let totalFetched = 0;
      
      // Fetch all remaining pages - use CACHER's approach (which works!)
      while (currentUrl && totalFetched < 1000) { // Safety limit
        console.log('[Kayako Paginator] 📥 Fetching page via direct OriginalXHR...');
        
        const { text, status } = await new Promise((resolve, reject) => {
          // Create XHR using Reflect to bypass constructor wrapper
          const bg = Reflect.construct(OriginalXHR, []);
          
          bg.open('GET', currentUrl, true);
          
          try { bg.responseType = 'json'; } catch (_) {}
          try { bg.withCredentials = true; } catch (_) {}
          try { bg.setRequestHeader('Accept', 'application/json'); } catch (_) {}
          try { bg.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); } catch (_) {}
          
          bg.onload = function() {
            console.log('[Kayako Paginator] 🎉 Background XHR loaded, status:', this.status);
            
            if (this.status !== 200) {
              reject(new Error('HTTP ' + this.status));
              return;
            }
            
            // Try to get parsed JSON response first
            let text = null;
            if (this.response && typeof this.response === 'object') {
              try {
                text = JSON.stringify(this.response);
              } catch (_) {}
            }
            
            // Fallback to responseText
            if (!text) {
              text = this.responseText || '{}';
            }
            
            resolve({ text: text, status: this.status });
          };
          
          bg.onerror = function() {
            console.error('[Kayako Paginator] ❌ Network error');
            reject(new Error('Network error'));
          };
          
          console.log('[Kayako Paginator] 📤 Sending background XHR...');
          bg.send();
        });
        
        console.log('[Kayako Paginator] 📡 XHR Response:', status, 'bytes:', text.length);
        
        if (status !== 200) {
          console.warn('[Kayako Paginator] Background request failed:', status);
          break;
        }
        
        // Parse response with sanitization fallback
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonError) {
          console.warn('[Kayako Paginator] ⚠️ JSON parse failed, trying to sanitize...', jsonError.message);
          
          try {
            const sanitized = text
              .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
              .replace(/,(\s*[}\]])/g, '$1');
            
            data = JSON.parse(sanitized);
            console.log('[Kayako Paginator] ✅ Sanitization worked!');
          } catch (sanitizeError) {
            console.error('[Kayako Paginator] ❌ Sanitization failed too, skipping page');
            stats.backgroundPages++;
            continue;
          }
        }
        
        console.log('[Kayako Paginator] 📦 Parsed response, data.data exists:', !!data.data, 'length:', data.data?.length || 0);
        const posts = data.data || [];
        
        stats.backgroundPages++;
        totalFetched += posts.length;
        
        console.log('[Kayako Paginator] ✅ Background page', stats.backgroundPages, ':', posts.length, 'posts (total:', totalFetched, ')');
        
        // Check if there's more BEFORE appending (so we know whether to continue)
        const isLastPage = posts.length < CONFIG.LIMIT;
        
        // Try to append posts to DOM
        try {
          const appended = appendPostsToDOM(posts);
          console.log('[Kayako Paginator] 📌 Appended', appended, 'posts to DOM');
          stats.domsAppended = (stats.domsAppended || 0) + appended;
        } catch (e) {
          console.warn('[Kayako Paginator] Failed to append to DOM:', e);
        }
        
        // Check if this was the last page
        if (isLastPage) {
          console.log('[Kayako Paginator] 🏁 Reached end (got', posts.length, 'posts, less than limit', CONFIG.LIMIT, ')');
          break;
        }
        
        console.log('[Kayako Paginator] ➡️  More posts available, continuing...');
        
        // Construct next URL - preserve the full path and params
        const nextMinId = Math.min(...posts.map(p => parseInt(p.id)));
        const nextUrlObj = new URL(currentUrl, window.location.origin);
        nextUrlObj.searchParams.set('after_id', String(nextMinId - 1));
        currentUrl = nextUrlObj.toString();
        
        console.log('[Kayako Paginator] 🔗 Next URL:', currentUrl.substring(currentUrl.indexOf('/api'), currentUrl.indexOf('/api') + 100));
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('[Kayako Paginator] ✅ Background load complete!', stats.backgroundPages, 'pages,', totalFetched, 'posts');
      
    } catch (e) {
      console.error('[Kayako Paginator] ❌ Background load failed:', e);
    }
  }
  
  /**
   * Override XMLHttpRequest
   */
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    let requestUrl = null;
    let requestMethod = null;
    let shouldTriggerBackground = false;
    
    xhr.open = function(method, url, ...rest) {
      // Skip our interception for internal background requests
      if (this.__internal_kayako_paginator) {
        console.log('[Kayako Paginator] 🔓 Bypassing wrapper for internal request');
        return originalOpen.apply(this, [method, url, ...rest]);
      }
      
      requestUrl = url;
      requestMethod = method;
      shouldTriggerBackground = false;
      
      if (method !== 'GET') {
        return originalOpen.apply(this, [method, url, ...rest]);
      }
      
      let modifiedUrl = url;
      
      // Fix 1: Increase posts limit to 100
      if (isPostsListRequest(url)) {
        try {
          const urlObj = new URL(url, window.location.origin);
          urlObj.searchParams.set('limit', String(CONFIG.LIMIT));
          modifiedUrl = urlObj.toString();
          stats.postsLoaded++;
          
          // Trigger background load on initial request
          if (isInitialRequest(url) && CONFIG.AUTO_LOAD_ALL) {
            shouldTriggerBackground = true;
          }
          
          if (CONFIG.DEBUG) {
            console.log('[Kayako Paginator] 📝 Set limit=100');
          }
        } catch (e) {}
      }
      
      // Fix 2: Strip include=* from detail requests (prevents 400 errors)
      if (isDetailRequest(url)) {
        try {
          const urlObj = new URL(url, window.location.origin);
          if (urlObj.searchParams.has('include')) {
            urlObj.searchParams.delete('include');
            modifiedUrl = urlObj.toString();
            
            if (CONFIG.DEBUG) {
              console.log('[Kayako Paginator] 🛡️ Stripped include from detail request');
            }
          }
        } catch (e) {}
      }
      
      return originalOpen.apply(this, [method, modifiedUrl, ...rest]);
    };
    
    xhr.send = function(...args) {
      // Skip our interception for internal background requests
      if (this.__internal_kayako_paginator) {
        console.log('[Kayako Paginator] 🔓 Bypassing send wrapper for internal request');
        return originalSend.apply(this, args);
      }
      
      if (shouldTriggerBackground) {
        const originalOnLoad = xhr.onload;
        
        xhr.onload = function() {
          if (xhr.status === 200 && xhr.responseText) {
            setTimeout(() => {
              loadAllPostsInBackground(requestUrl, xhr.responseText);
            }, 200);
          }
          
          if (originalOnLoad) {
            originalOnLoad.apply(this, arguments);
          }
        };
      }
      
      return originalSend.apply(xhr, args);
    };
    
    return xhr;
  };
  
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, OriginalXHR.prototype);
  
  window.__KayakoPaginator__ = {
    stats: () => stats,
    config: () => CONFIG,
    
    findTimeline: () => {
      const timeline = getTimelineContainer();
      const postsContainer = getPostsContainer();
      return {
        timeline: timeline,
        postsContainer: postsContainer,
        postCount: document.querySelectorAll('[class*="post"]').length
      };
    }
  };
  
  console.log('[Kayako Paginator] ✅ Ready - will load first 100, then fetch rest in background');
  console.log('[Kayako Paginator] 🔍 Debug: window.__KayakoPaginator__.findTimeline()');
  
})();
