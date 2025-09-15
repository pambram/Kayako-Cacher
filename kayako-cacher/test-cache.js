// Test script for Kayako Caching functionality
// Run this in the console on a Kayako ticket page

console.log('🧪 Starting Kayako Cache Tests...');

const cacheTests = {
  // Test 1: Check if extension is loaded
  testExtensionLoaded() {
    console.log('\n📋 Test 1: Extension Loading');
    
    const contentLoaded = typeof window.kayakoLoadAllPosts === 'function';
    console.log('Content script loaded:', contentLoaded ? '✅' : '❌');
    
    const interceptorLoaded = window.fetch.toString().includes('Kayako');
    console.log('Fetch interceptor active:', interceptorLoaded ? '✅' : '❌');
    
    return contentLoaded && interceptorLoaded;
  },

  // Test 2: Check cache storage
  async testCacheStorage() {
    console.log('\n📋 Test 2: Cache Storage');
    
    try {
      const storage = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(storage).filter(k => k.startsWith('kayako_cache_'));
      const configExists = !!storage.kayako_config;
      
      console.log('Configuration exists:', configExists ? '✅' : '❌');
      console.log('Cache entries found:', cacheKeys.length);
      
      if (cacheKeys.length > 0) {
        console.log('Cache keys:', cacheKeys.slice(0, 3));
        
        // Check a cache entry
        const firstEntry = storage[cacheKeys[0]];
        console.log('Sample cache entry has data:', !!firstEntry?.data ? '✅' : '❌');
        console.log('Sample cache timestamp:', new Date(firstEntry?.timestamp).toLocaleString());
      }
      
      return configExists;
    } catch (error) {
      console.error('❌ Cannot access storage:', error);
      return false;
    }
  },

  // Test 3: Manual API call to test interception
  async testApiInterception() {
    console.log('\n📋 Test 3: API Interception');
    
    const currentUrl = window.location.href;
    const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
    
    if (!caseMatch) {
      console.error('❌ Not on a ticket page - cannot test API');
      return false;
    }
    
    const caseId = caseMatch[1];
    const testUrl = `${window.location.origin}/api/v1/cases/${caseId}/posts?limit=30&filters=all&include=*`;
    
    console.log('Testing URL:', testUrl);
    
    try {
      const startTime = Date.now();
      const response = await fetch(testUrl);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('Response status:', response.status);
      console.log('Response time:', responseTime + 'ms');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Posts returned:', data.data?.length || 0);
        
        // Fast response likely means cache hit
        const likelyFromCache = responseTime < 100;
        console.log('Likely from cache:', likelyFromCache ? '✅' : '❓ (>100ms)');
        
        return true;
      } else {
        console.error('❌ API request failed');
        return false;
      }
    } catch (error) {
      console.error('❌ API test error:', error);
      return false;
    }
  },

  // Test 4: Cache hit test (make same request twice)
  async testCacheHit() {
    console.log('\n📋 Test 4: Cache Hit Detection');
    
    const currentUrl = window.location.href;
    const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
    
    if (!caseMatch) {
      console.error('❌ Not on a ticket page');
      return false;
    }
    
    const caseId = caseMatch[1];
    const testUrl = `${window.location.origin}/api/v1/cases/${caseId}/posts?limit=30&filters=all&include=*`;
    
    try {
      // First request
      console.log('🔄 Making first request...');
      const start1 = Date.now();
      const response1 = await fetch(testUrl);
      const time1 = Date.now() - start1;
      
      if (!response1.ok) throw new Error('First request failed');
      
      await response1.json();
      console.log('First request:', time1 + 'ms');
      
      // Second request (should be cached)
      console.log('🔄 Making second request...');
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      
      const start2 = Date.now();
      const response2 = await fetch(testUrl);
      const time2 = Date.now() - start2;
      
      if (!response2.ok) throw new Error('Second request failed');
      
      await response2.json();
      console.log('Second request:', time2 + 'ms');
      
      // Cache hit if second request is significantly faster
      const speedImprovement = time1 - time2;
      const cacheHit = time2 < 50 && speedImprovement > 50;
      
      console.log('Speed improvement:', speedImprovement + 'ms');
      console.log('Cache hit detected:', cacheHit ? '✅' : '❌');
      
      return cacheHit;
    } catch (error) {
      console.error('❌ Cache hit test error:', error);
      return false;
    }
  },

  // Test 5: Check visual indicator
  testVisualIndicator() {
    console.log('\n📋 Test 5: Visual Indicator');
    
    const indicator = document.getElementById('kayako-cache-indicator');
    const indicatorExists = !!indicator;
    
    console.log('Visual indicator present:', indicatorExists ? '✅' : '❌');
    
    if (indicatorExists) {
      const statsEl = document.getElementById('cache-stats');
      const actionEl = document.getElementById('last-action');
      
      console.log('Stats element:', !!statsEl ? '✅' : '❌');
      console.log('Action element:', !!actionEl ? '✅' : '❌');
      
      if (statsEl) {
        console.log('Current stats:', statsEl.textContent);
      }
      if (actionEl) {
        console.log('Last action:', actionEl.textContent);
      }
    }
    
    return indicatorExists;
  },

  // Run all tests
  async runAll() {
    console.log('🚀 Running Kayako Cache Tests...\n');
    
    const results = {
      extensionLoaded: this.testExtensionLoaded(),
      cacheStorage: await this.testCacheStorage(),
      apiInterception: await this.testApiInterception(),
      cacheHit: await this.testCacheHit(),
      visualIndicator: this.testVisualIndicator()
    };
    
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${test}:`, passed ? '✅ PASS' : '❌ FAIL');
    });
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\n🏆 Overall: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Caching should be working.');
    } else {
      console.log('⚠️  Some tests failed. Check the logs above for details.');
    }
    
    return results;
  }
};

// Auto-run tests
cacheTests.runAll();

// Make available globally
window.cacheTests = cacheTests;
