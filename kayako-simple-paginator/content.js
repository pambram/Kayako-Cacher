/**
 * Content Script - Kayako Simple Paginator
 * 
 * Single responsibility: Inject the XHR interceptor into the page context
 * CRITICAL: Runs at document_start to intercept BEFORE Kayako's code
 */

(function() {
  'use strict';
  
  console.log('[Kayako Paginator] Content script initializing at document_start...');
  
  // Inject IMMEDIATELY - don't wait for DOM
  // This ensures we capture the original fetch/XHR before Kayako wraps them
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
    
    // Inject into documentElement directly (available before head/body)
    (document.head || document.documentElement).appendChild(script);
  }
  
  // Inject IMMEDIATELY - no waiting
  injectScript();
  
  console.log('[Kayako Paginator] Content script injected immediately');
})();

