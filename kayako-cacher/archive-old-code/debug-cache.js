// Debug script for cache issues
// Run this in F12 console to diagnose cache problems

console.log('🔍 CACHE DEBUG STARTING...');

async function debugCache() {
  console.log('\n🧪 CACHE DEBUGGING TOOL');
  console.log('========================');
  
  // Step 1: Check if cache system is loaded
  console.log('\n📋 Step 1: Cache System Check');
  console.log('Cache stats function available:', typeof window.kayakoCacheStats === 'function');
  console.log('Cache lookup function available:', typeof window.kayakoGetCached === 'function');
  console.log('Live stats available:', !!window.kayakoCacheStats_live);
  
  if (window.kayakoCacheStats_live) {
    console.log('Current hits/misses:', window.kayakoCacheStats_live);
  }
  
  // Step 2: Check current storage
  console.log('\n📋 Step 2: Storage Check');
  try {
    const allStorage = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allStorage).filter(k => k.startsWith('kayako_simple_cache_'));
    console.log('Persistent cache entries found:', cacheKeys.length);
    
    if (cacheKeys.length > 0) {
      console.log('Cache keys:', cacheKeys);
      cacheKeys.forEach(key => {
        const entry = allStorage[key];
        const age = Math.round((Date.now() - entry.timestamp) / 1000 / 60);
        console.log(`  ${key}: ${age}m old, ${entry.data?.data?.length || 0} posts`);
      });
    } else {
      console.log('⚠️ No persistent cache entries found');
    }
  } catch (error) {
    console.error('Storage check error:', error);
  }
  
  // Step 3: Check current URL and expected cache key
  console.log('\n📋 Step 3: URL Analysis');
  const currentUrl = window.location.href;
  console.log('Current URL:', currentUrl);
  
  const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
  if (caseMatch) {
    const caseId = caseMatch[1];
    console.log('Extracted case ID:', caseId);
    
    // Test cache lookup for this case
    const expectedKey = `posts_${caseId}_initial_100_all`;
    console.log('Expected cache key:', expectedKey);
    
    try {
      const cached = await window.kayakoGetCached(caseId);
      console.log('Cache lookup result:', cached ? 'FOUND' : 'NOT FOUND');
      if (cached) {
        console.log('Cached posts count:', cached.data?.length || 0);
      }
    } catch (error) {
      console.error('Cache lookup error:', error);
    }
  } else {
    console.log('⚠️ Could not extract case ID from URL');
  }
  
  // Step 4: Test manual cache operation
  console.log('\n📋 Step 4: Manual Cache Test');
  const testData = { data: [{ id: 'test', subject: 'Test post' }] };
  const testKey = 'test_cache_entry';
  
  try {
    // Store test data
    await chrome.storage.local.set({
      [`kayako_simple_cache_${testKey}`]: {
        data: testData,
        timestamp: Date.now(),
        url: 'test'
      }
    });
    
    console.log('✅ Test data stored');
    
    // Retrieve test data
    const result = await chrome.storage.local.get([`kayako_simple_cache_${testKey}`]);
    if (result[`kayako_simple_cache_${testKey}`]) {
      console.log('✅ Test data retrieved');
      
      // Clean up test data
      await chrome.storage.local.remove([`kayako_simple_cache_${testKey}`]);
      console.log('✅ Test data cleaned up');
      
      console.log('🎉 Cache storage is working correctly!');
    } else {
      console.log('❌ Test data retrieval failed');
    }
  } catch (error) {
    console.error('❌ Cache storage test failed:', error);
  }
  
  console.log('\n🎯 CACHE DEBUG COMPLETE');
  console.log('=====================');
}

// Run the debug automatically
debugCache();

// Make it available for manual use
window.debugCache = debugCache;

console.log('\n🧪 Cache debug completed. Run window.debugCache() to repeat.');
