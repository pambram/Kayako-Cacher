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
   * Create a post element by cloning an existing template
   */
  function createPostElement(postData) {
    // Try to find a real message post to use as a template
    const existingMessages = Array.from(document.querySelectorAll('[data-id]')).filter(el => {
      return el.classList.contains('ko-timeline-2_list_item__post_1oksrd') || 
             el.querySelector('.ko-timeline-2_list_item__content_1oksrd');
    });
    
    let template = null;
    if (existingMessages.length > 0) {
      // Clone the first real message as a template
      template = existingMessages[0].cloneNode(true);
      
      // Update data-id
      template.setAttribute('data-id', postData.id);
      
      // Update the content
      const contentDiv = template.querySelector('.ko-timeline-2_list_item__content_1oksrd');
      if (contentDiv) {
        contentDiv.textContent = postData.contents || postData.subject || 'Post #' + postData.id;
      }
      
      // Update creator name if present
      const creatorEl = template.querySelector('.ko-timeline-2_list_item__creator_1oksrd');
      if (creatorEl && postData.creator) {
        creatorEl.textContent = postData.creator.full_name || 'User';
      }
      
      // Update timestamp
      const timeEl = template.querySelector('.ko-timeline-2_list_item__time_1oksrd');
      if (timeEl && postData.created_at) {
        const date = new Date(postData.created_at);
        timeEl.textContent = 'on ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      
      return template;
    }
    
    // Fallback: create simple div
    const div = document.createElement('div');
    div.setAttribute('data-id', postData.id);
    div.className = 'ko-timeline-2_list_post__item_1nm4l4';
    div.innerHTML = `
      <div class="ko-timeline-2_list_item__body_1oksrd">
        <div class="ko-timeline-2_list_item__content_1oksrd">
          ${postData.contents || postData.subject || 'Post #' + postData.id}
        </div>
      </div>
    `;
    
    return div;
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
      let totalFetched = 0;
      
      // Fetch all remaining pages
      while (currentUrl && totalFetched < 1000) { // Safety limit
        console.log('[Kayako Paginator] 📥 Fetching background page...');
        
        const response = await OriginalFetch(currentUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) {
          console.warn('[Kayako Paginator] Background fetch failed:', response.status);
          break;
        }
        
        const data = await response.json();
        const posts = data.data || [];
        
        stats.backgroundPages++;
        totalFetched += posts.length;
        
        console.log('[Kayako Paginator] ✅ Background page', stats.backgroundPages, ':', posts.length, 'posts (total:', totalFetched, ')');
        
        // Try to append posts to DOM
        try {
          const appended = appendPostsToDOM(posts);
          console.log('[Kayako Paginator] 📌 Appended', appended, 'posts to DOM');
        } catch (e) {
          console.warn('[Kayako Paginator] Failed to append to DOM:', e);
        }
        
        // Check if there's more
        if (posts.length < CONFIG.LIMIT) {
          console.log('[Kayako Paginator] 🏁 Reached end (partial page)');
          break;
        }
        
        // Construct next URL
        const nextMinId = Math.min(...posts.map(p => parseInt(p.id)));
        const nextUrlObj = new URL(currentUrl, window.location.origin);
        nextUrlObj.searchParams.set('after_id', String(nextMinId - 1));
        currentUrl = nextUrlObj.toString();
        
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
