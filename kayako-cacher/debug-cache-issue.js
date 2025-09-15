// Debug why cache isn't persisting
console.log('🔍 DEBUGGING CACHE PERSISTENCE ISSUE');

// Step 1: Test localStorage directly
console.log('\n📋 Step 1: Testing localStorage directly');

try {
  // Test basic localStorage
  localStorage.setItem('test_cache', 'test_value');
  const retrieved = localStorage.getItem('test_cache');
  console.log('Basic localStorage test:', retrieved === 'test_value' ? '✅ WORKS' : '❌ FAILED');
  localStorage.removeItem('test_cache');
  
  // Test JSON storage
  const testData = { data: [{ id: 1, subject: 'test' }], timestamp: Date.now() };
  localStorage.setItem('kayako_cache_test', JSON.stringify(testData));
  const retrievedData = JSON.parse(localStorage.getItem('kayako_cache_test'));
  console.log('JSON localStorage test:', retrievedData ? '✅ WORKS' : '❌ FAILED');
  localStorage.removeItem('kayako_cache_test');
  
} catch (error) {
  console.error('❌ localStorage basic test failed:', error);
}

// Step 2: Check what's actually in localStorage
console.log('\n📋 Step 2: Current localStorage Contents');
let kayakoEntries = 0;
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('kayako')) {
      kayakoEntries++;
      console.log(`Found: ${key}`);
      
      // Try to parse it
      try {
        const value = localStorage.getItem(key);
        const parsed = JSON.parse(value);
        console.log(`  Data: ${parsed.data?.data?.length || 0} posts, age: ${Math.round((Date.now() - parsed.timestamp) / 1000)}s`);
      } catch (e) {
        console.log(`  Parse error: ${e.message}`);
      }
    }
  }
  console.log(`Total Kayako localStorage entries: ${kayakoEntries}`);
} catch (error) {
  console.error('localStorage enumeration error:', error);
}

// Step 3: Test manual cache key generation
console.log('\n📋 Step 3: Cache Key Generation Test');
const currentUrl = window.location.href;
console.log('Current URL:', currentUrl);

const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
if (caseMatch) {
  const caseId = caseMatch[1];
  console.log('Extracted case ID:', caseId);
  
  // Generate test cache key
  const testKey = `kayako_cache_posts_${caseId}_initial_100`;
  console.log('Expected cache key:', testKey);
  
  // Check if this key exists
  const exists = localStorage.getItem(testKey);
  console.log('Key exists in localStorage:', !!exists);
  
  if (exists) {
    try {
      const data = JSON.parse(exists);
      console.log('✅ Found cached data:', data.data?.data?.length || 0, 'posts');
    } catch (e) {
      console.log('❌ Failed to parse cached data:', e.message);
    }
  }
} else {
  console.log('❌ Could not extract case ID from URL');
}

// Step 4: Test cache storage manually
console.log('\n📋 Step 4: Manual Cache Storage Test');
const manualTestKey = 'kayako_cache_manual_test';
const manualTestData = {
  data: { data: [{ id: 'test', subject: 'Manual test' }] },
  timestamp: Date.now(),
  url: 'manual_test'
};

try {
  localStorage.setItem(manualTestKey, JSON.stringify(manualTestData));
  console.log('✅ Manual storage successful');
  
  const retrieved = localStorage.getItem(manualTestKey);
  const parsed = JSON.parse(retrieved);
  console.log('✅ Manual retrieval successful');
  
  // Clean up
  localStorage.removeItem(manualTestKey);
  console.log('✅ Manual cleanup successful');
  
  console.log('🎉 localStorage working correctly for cache');
} catch (error) {
  console.error('❌ Manual cache test failed:', error);
}

console.log('\n🎯 CACHE DEBUG COMPLETE');
console.log('======================');
