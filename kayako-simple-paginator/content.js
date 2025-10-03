/**
 * Content Script - Kayako Simple Paginator
 * 
 * Single responsibility: Inject the XHR interceptor into the page context
 */

(function() {
  'use strict';
  
  console.log('[Kayako Paginator] Content script initializing...');
  
  // Inject the XHR interceptor script into the page context
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      console.log('[Kayako Paginator] Injected script loaded successfully');
      this.remove();
    };
    script.onerror = function() {
      console.error('[Kayako Paginator] Failed to load injected script');
    };
    
    (document.head || document.documentElement).appendChild(script);
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
  } else {
    injectScript();
  }
  
  console.log('[Kayako Paginator] Content script ready');
})();

