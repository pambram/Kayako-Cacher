// FIX JSON CORRUPTION - Address the root cause instead of removing features
console.log('🔧 Fixing JSON corruption issue properly...');

(function() {
  'use strict';
  
  // STEP 1: Debug what's causing the JSON corruption
  function debugCachedData(cacheKey) {
    console.log('🔍 DEBUGGING CACHED DATA for:', cacheKey);
    
    const storageKey = 'kayako_cache_' + cacheKey;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      console.log('📋 Raw stored data length:', stored.length);
      console.log('📋 First 100 chars:', stored.substring(0, 100));
      console.log('📋 Last 100 chars:', stored.substring(stored.length - 100));
      
      try {
        const parsed = JSON.parse(stored);
        console.log('✅ JSON parsing successful');
        console.log('📋 Data structure:', Object.keys(parsed));
        console.log('📋 Data.data exists:', !!parsed.data);
        console.log('📋 Data.data.data exists:', !!parsed.data?.data);
        console.log('📋 Posts count:', parsed.data?.data?.length || 0);
        
        // Check if the data structure is what jQuery expects
        if (parsed.data && parsed.data.data && Array.isArray(parsed.data.data)) {
          console.log('✅ Data structure looks valid for jQuery');
          return parsed;
        } else {
          console.log('❌ Data structure invalid for jQuery');
          return null;
        }
      } catch (error) {
        console.log('❌ JSON parsing failed:', error.message);
        console.log('📋 Corrupted data:', stored.substring(0, 200));
        return null;
      }
    }
    
    return null;
  }
  
  // STEP 2: Create safe JSON response that jQuery can handle
  function createSafeJSONResponse(cachedData) {
    try {
      // Ensure the cached data matches jQuery's expected structure
      const safeData = {
        status: 200,
        data: cachedData.data?.data || [],
        meta: cachedData.data?.meta || {},
        links: cachedData.data?.links || {},
        included: cachedData.data?.included || []
      };
      
      // Test that this can be safely stringified and parsed
      const jsonString = JSON.stringify(safeData);
      const reparsed = JSON.parse(jsonString);
      
      console.log('✅ Safe JSON response created:', reparsed.data.length, 'posts');
      return jsonString;
      
    } catch (error) {
      console.error('❌ Cannot create safe JSON response:', error);
      return null;
    }
  }
  
  // STEP 3: Create response object that jQuery expects
  function createCompatibleXHRResponse(jsonString) {
    // Create response object with ALL properties jQuery might access
    const response = {
      readyState: 4,
      status: 200,
      statusText: 'OK',
      responseText: jsonString,
      response: jsonString,
      responseType: '',
      responseURL: '',
      responseXML: null,
      timeout: 0,
      upload: {},
      withCredentials: false,
      
      // jQuery-specific methods
      getAllResponseHeaders: function() {
        return 'content-type: application/json\r\ncache-control: no-cache\r\n';
      },
      
      getResponseHeader: function(name) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'content-type') return 'application/json';
        if (lowerName === 'cache-control') return 'no-cache';
        return null;
      },
      
      // Event target methods
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
    
    return response;
  }
  
  // STEP 4: Test the fix with actual cached data
  window.testJSONFix = function() {
    console.log('🧪 TESTING JSON CORRUPTION FIX');
    
    // Get a cache entry to test
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kayako_cache_posts_')) {
        const cacheKey = key.replace('kayako_cache_', '');
        console.log('🔍 Testing with cache key:', cacheKey);
        
        const cachedData = debugCachedData(cacheKey);
        if (cachedData) {
          const safeJSON = createSafeJSONResponse(cachedData);
          if (safeJSON) {
            const response = createCompatibleXHRResponse(safeJSON);
            console.log('✅ Compatible XHR response created');
            console.log('📋 Response has responseText:', !!response.responseText);
            console.log('📋 ResponseText length:', response.responseText.length);
            
            // Test if jQuery can parse it
            try {
              const parsed = JSON.parse(response.responseText);
              console.log('✅ jQuery should be able to parse this safely');
              console.log('📋 Parsed posts:', parsed.data?.length || 0);
              return true;
            } catch (error) {
              console.log('❌ jQuery parsing would still fail:', error.message);
              return false;
            }
          }
        }
        break;
      }
    }
    
    console.log('❌ No cache data available to test');
    return false;
  };
  
  console.log('✅ JSON corruption debugging tools ready');
  console.log('🧪 Test with: window.testJSONFix()');
  
})();

console.log('🎯 Now we can properly diagnose and fix the JSON corruption!');
