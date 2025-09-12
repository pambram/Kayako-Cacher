// Content script for Kayako Pagination Cacher
// Manages cache storage, injects interceptor, and handles communication

class KayakoPaginationCacher {
  constructor() {
    this.config = null;
    this.cacheStats = { hits: 0, misses: 0 };
    this.injected = false;
    
    this.init();
  }

  async init() {
    console.log('🚀 Kayako Pagination Cacher initialized on:', window.location.href);
    
    // Load configuration
    await this.loadConfig();
    console.log('✅ Config loaded:', this.config);
    
    // Inject the interceptor script
    this.injectInterceptor();
    console.log('✅ Interceptor injected');
    
    // Set up message listeners
    this.setupMessageListeners();
    console.log('✅ Message listeners set up');
    
    // Set up page listeners for intercepted requests
    this.setupPageListeners();
    console.log('✅ Page listeners set up');
    
    // Add visual indicator
    this.addVisualIndicator();
    console.log('✅ Visual indicator added');
    
    console.log('🎉 Kayako Pagination Cacher fully initialized');
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response.success) {
        this.config = response.config;
        console.log('Loaded config:', this.config);
      } else {
        console.error('Failed to load config:', response.error);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  injectInterceptor() {
    if (this.injected) return;
    
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = () => {
        console.log('Interceptor script loaded');
        
        // Send initial configuration to injected script
        if (this.config) {
          this.updateInjectedConfig();
        }
        
        script.remove();
      };
      
      (document.head || document.documentElement).appendChild(script);
      this.injected = true;
    } catch (error) {
      console.error('Failed to inject interceptor script:', error);
    }
  }

  updateInjectedConfig() {
    const event = new CustomEvent('KAYAKO_CONFIG_UPDATE', {
      detail: this.config
    });
    window.dispatchEvent(event);
  }

  setupMessageListeners() {
    // Listen for messages from background script and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received message:', message.action, message);
      
      switch (message.action) {
        case 'configUpdated':
          this.config = message.config;
          this.updateInjectedConfig();
          console.log('✅ Config updated in content script:', this.config);
          sendResponse({ success: true });
          break;
        case 'loadAllPosts':
          console.log('🚀 Starting loadAllPosts from popup request...');
          this.loadAllPosts().then((result) => {
            console.log('✅ loadAllPosts completed successfully');
            sendResponse({ success: true, result });
          }).catch(error => {
            console.error('❌ loadAllPosts failed:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true; // Keep message channel open for async response
        default:
          console.log('❓ Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
    
    console.log('✅ Message listener registered');
  }

  setupPageListeners() {
    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      switch (event.data.type) {
        case 'KAYAKO_API_REQUEST':
          this.handleApiRequest(event.data);
          break;
        case 'KAYAKO_API_RESPONSE':
          this.handleApiResponse(event.data);
          break;
        case 'KAYAKO_CACHE_HIT':
          this.handleCacheHit(event.data);
          break;
      }
    });
  }

  async handleApiRequest(data) {
    console.log('API Request intercepted:', data.url);
    
    // Track performance
    chrome.runtime.sendMessage({
      action: 'trackPerformance',
      data: {
        url: data.url,
        fromCache: false,
        timestamp: Date.now()
      }
    });
    
    // Check if we have this in persistent cache
    if (this.config?.cacheEnabled) {
      const cached = await this.getFromPersistentCache(data.url);
      if (cached && !this.isCacheExpired(cached.timestamp)) {
        // Send cached data to injected script
        const event = new CustomEvent('KAYAKO_CACHE_RESPONSE', {
          detail: {
            cacheKey: this.generateCacheKey(data.url),
            data: cached.data
          }
        });
        window.dispatchEvent(event);
      }
    }
  }

  async handleApiResponse(data) {
    console.log('API Response intercepted:', data.url);
    
    if (this.config?.cacheEnabled && data.data) {
      // Store in persistent cache
      await this.storeToPersistentCache(data.url, data.data);
      
      // Update visual indicator
      this.updateIndicatorStats('response');
    }
  }

  handleCacheHit(data) {
    console.log('Cache hit for:', data.url);
    this.cacheStats.hits++;
    
    // Track performance
    chrome.runtime.sendMessage({
      action: 'trackPerformance',
      data: {
        url: data.url,
        fromCache: true,
        timestamp: Date.now()
      }
    });
    
    // Update visual indicator
    this.updateIndicatorStats('cache_hit');
  }

  async getFromPersistentCache(url) {
    try {
      const cacheKey = this.generateCacheKey(url);
      const storageKey = `kayako_cache_${cacheKey}`;
      
      const result = await chrome.storage.local.get([storageKey]);
      return result[storageKey] || null;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  async storeToPersistentCache(url, data) {
    try {
      const cacheKey = this.generateCacheKey(url);
      const storageKey = `kayako_cache_${cacheKey}`;
      
      const cacheEntry = {
        timestamp: Date.now(),
        data: data,
        url: url,
        size: JSON.stringify(data).length
      };
      
      await chrome.storage.local.set({
        [storageKey]: cacheEntry
      });
      
      console.log(`Cached response for key: ${cacheKey}`);
      
      // Periodically clean up expired cache (every 10th store operation)
      if (Math.random() < 0.1) {
        this.cleanupExpiredCacheEntries();
      }
    } catch (error) {
      console.error('Error storing to cache:', error);
    }
  }

  generateCacheKey(url) {
    try {
      const urlObj = new URL(url);
      
      // Extract relevant parameters for cache key
      const caseId = this.extractCaseId(urlObj.pathname);
      const afterId = urlObj.searchParams.get('after_id') || 'initial';
      const limit = urlObj.searchParams.get('limit') || '30';
      const filters = urlObj.searchParams.get('filters') || 'all';
      
      return `${caseId}_${afterId}_${limit}_${filters}`;
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
    const expiry = this.config?.cacheExpiry || 30 * 60 * 1000; // 30 minutes default
    return Date.now() - timestamp > expiry;
  }

  async cleanupExpiredCacheEntries() {
    try {
      const expiry = this.config?.cacheExpiry || 30 * 60 * 1000;
      const cutoffTime = Date.now() - expiry;
      
      const allItems = await chrome.storage.local.get();
      const expiredKeys = [];
      
      Object.entries(allItems).forEach(([key, value]) => {
        if ((key.startsWith('kayako_cache_') || key.startsWith('kayako_posts_')) && 
            value && value.timestamp && value.timestamp < cutoffTime) {
          expiredKeys.push(key);
        }
      });
      
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        console.log(`Content script cleaned up ${expiredKeys.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
    }
  }

  addVisualIndicator() {
    // Create a small indicator to show the extension is active
    const indicator = document.createElement('div');
    indicator.id = 'kayako-cache-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: #28a745;
        color: white;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 12px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        cursor: pointer;
      " onclick="this.style.display='none'">
        📄 Kayako Cacher Active
        <div id="cache-stats" style="font-size: 10px; margin-top: 2px;">
          Cache: ${this.cacheStats.hits} hits
        </div>
      </div>
    `;
    
    document.body?.appendChild(indicator) || 
    document.documentElement?.appendChild(indicator);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      const el = document.getElementById('kayako-cache-indicator');
      if (el) el.style.opacity = '0.7';
    }, 5000);
  }

  updateIndicatorStats(type) {
    const statsEl = document.getElementById('cache-stats');
    if (statsEl) {
      if (type === 'cache_hit') this.cacheStats.hits++;
      if (type === 'response') this.cacheStats.misses++;
      
      statsEl.textContent = `Cache: ${this.cacheStats.hits} hits`;
    }
  }

  // Bulk load all posts for current case
  async loadAllPosts() {
    console.log('📥 loadAllPosts function called');
    const currentUrl = window.location.href;
    console.log('🔍 Current URL:', currentUrl);
    
    const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
    console.log('🔍 Case match result:', caseMatch);
    
    if (!caseMatch) {
      const error = 'Could not extract case ID from URL: ' + currentUrl;
      console.error('❌', error);
      throw new Error(error);
    }
    
    const caseId = caseMatch[1];
    console.log('📋 Loading all posts for case:', caseId);
    
    try {
      let allPosts = [];
      let afterId = null;
      let totalLoaded = 0;
      
      do {
        const apiUrl = this.buildPostsUrl(caseId, afterId, this.config.paginationLimit);
        console.log('Fetching batch:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const posts = data.data || [];
        
        allPosts = allPosts.concat(posts);
        totalLoaded += posts.length;
        
        // Update afterId for next batch (cursor-based pagination)
        afterId = posts.length > 0 ? posts[posts.length - 1].id : null;
        
        console.log(`Loaded batch: ${posts.length} posts, total: ${totalLoaded}`);
        
        // Cache this batch
        if (this.config?.cacheEnabled) {
          await this.storeToPersistentCache(apiUrl, data);
        }
        
        // Break if no more posts or we hit a reasonable limit
        if (posts.length === 0 || totalLoaded > 10000) {
          break;
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } while (afterId);
      
      console.log(`Finished loading all posts. Total: ${totalLoaded}`);
      
      // Notify user
      this.showNotification(`Loaded ${totalLoaded} posts and cached them for faster access`);
      
      return allPosts;
    } catch (error) {
      console.error('Error loading all posts:', error);
      this.showNotification(`Error loading posts: ${error.message}`, 'error');
    }
  }

  buildPostsUrl(caseId, afterId, limit) {
    const baseUrl = `${window.location.origin}/api/v1/cases/${caseId}/posts`;
    const params = new URLSearchParams({
      include: 'attachment,case_message,channel,post,user,identity_phone,identity_email,identity_twitter,identity_facebook,note,activity,chat_message,facebook_message,twitter_tweet,twitter_message,comment,event,action,trigger,monitor,engagement,sla_version,activity_object,rating,case_status,activity_actor',
      fields: '+original(+object(+original(+form(-fields)))),+original(+object(+original(-custom_fields)))',
      filters: 'all',
      limit: limit
    });
    
    if (afterId) {
      params.set('after_id', afterId);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      background: ${type === 'error' ? '#dc3545' : '#28a745'};
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 10001;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

// Initialize the cacher when the page loads
if (window.location.href.includes('kayako.com/agent')) {
  const cacher = new KayakoPaginationCacher();
  
  // Expose loadAllPosts function globally for manual triggering
  window.kayakoLoadAllPosts = () => cacher.loadAllPosts();
}
