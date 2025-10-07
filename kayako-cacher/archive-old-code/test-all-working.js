// Simple test to verify everything is working
console.log('🧪 TESTING ALL KAYAKO OPTIMIZATIONS');
console.log('==================================');

async function testEverything() {
  const results = {};
  
  // Test 1: Functions available
  console.log('\n📋 Test 1: Function Availability');
  results.testFunction = typeof window.testKayakoPagination === 'function';
  results.statsFunction = typeof window.kayakoCacheStats === 'function';
  console.log('✅ testKayakoPagination available:', results.testFunction);
  console.log('✅ kayakoCacheStats available:', results.statsFunction);
  
  // Test 2: XMLHttpRequest modification
  console.log('\n📋 Test 2: XMLHttpRequest Override');
  if (results.testFunction) {
    const testResult = window.testKayakoPagination();
    results.xhrWorking = testResult;
    console.log('✅ Pagination test result:', testResult);
  }
  
  // Test 3: Cache statistics (fixed localStorage version)
  console.log('\n📋 Test 3: Cache System');
  if (results.statsFunction) {
    try {
      const stats = window.kayakoCacheStats();
      results.cacheWorking = !stats.error;
      console.log('✅ Cache stats working:', results.cacheWorking);
      console.log('📊 Current stats:', stats);
    } catch (error) {
      results.cacheWorking = false;
      console.log('❌ Cache stats error:', error);
    }
  }
  
  // Test 4: Visual indicators
  console.log('\n📋 Test 4: Visual Elements');
  const indicator = document.querySelector('[style*="Kayako Optimizer Active"]');
  results.visualIndicator = !!indicator;
  console.log('✅ Visual indicator present:', results.visualIndicator);
  
  // Test 5: Live stats
  console.log('\n📋 Test 5: Live Statistics');
  const liveStats = window.kayakoCacheStats_live;
  results.liveStats = !!liveStats;
  console.log('✅ Live stats available:', results.liveStats);
  if (liveStats) {
    console.log('📊 Current live stats:', liveStats);
  }
  
  // Summary
  console.log('\n🎯 TEST RESULTS SUMMARY');
  console.log('======================');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${test}:`, passed ? '✅ PASS' : '❌ FAIL');
  });
  
  console.log(`\n🏆 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Extension working perfectly.');
  } else {
    console.log('⚠️ Some tests failed. Check logs above.');
  }
  
  return results;
}

// Run tests automatically
testEverything();

// Make available for manual use
window.testEverything = testEverything;

console.log('\n🧪 Test complete. Run window.testEverything() to repeat.');
console.log('🎯 To test caching: scroll to load posts, then reload page.');
