// Debug exactly why cache is missing
// Copy/paste this in F12 console

console.log('🔍 DEBUGGING CACHE MISS ISSUE');
console.log('============================');

// Step 1: Check what's actually in localStorage right now
console.log('\n📋 Step 1: localStorage Inventory');
let allKayakoEntries = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.startsWith('kayako_cache_')) {
    allKayakoEntries.push(key);
    const value = localStorage.getItem(key);
    console.log(`Found: ${key}`);
    console.log(`  Length: ${value?.length || 0} chars`);
    
    try {
      const parsed = JSON.parse(value);
      const age = Math.round((Date.now() - parsed.timestamp) / 1000);
      console.log(`  Posts: ${parsed.data?.data?.length || 0}, Age: ${age}s`);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
}
console.log(`Total entries: ${allKayakoEntries.length}`);

// Step 2: Test cache key generation for current page
console.log('\n📋 Step 2: Cache Key Generation');
const currentUrl = window.location.href;
const caseMatch = currentUrl.match(/\/conversations\/(\d+)/);

console.log('Current URL:', currentUrl);
console.log('Case match:', caseMatch);

if (caseMatch) {
  const caseId = caseMatch[1];
  console.log('Case ID:', caseId);
  
  // Generate the key that SHOULD be used
  const expectedKey = `posts_${caseId}_initial_100`;
  const storageKey = `kayako_cache_${expectedKey}`;
  
  console.log('Expected cache key:', expectedKey);
  console.log('Expected storage key:', storageKey);
  
  // Check if this EXACT key exists
  const stored = localStorage.getItem(storageKey);
  console.log('Key exists:', !!stored);
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('✅ CACHE SHOULD HIT! Data available:', parsed.data?.data?.length || 0, 'posts');
    } catch (e) {
      console.log('❌ Data corrupted:', e.message);
    }
  } else {
    console.log('❌ Exact key not found');
    
    // Check for similar keys
    const similarKeys = allKayakoEntries.filter(k => k.includes(caseId));
    console.log('Similar keys with same case ID:', similarKeys);
  }
}

// Step 3: Test what happens during cache check
console.log('\n📋 Step 3: Manual Cache Check Test');
if (caseMatch) {
  const caseId = caseMatch[1];
  const testUrl = `/api/v1/cases/${caseId}/posts?limit=100&filters=all&include=*`;
  
  console.log('Test URL:', testUrl);
  
  // Simulate cache key generation from our function
  const urlObj = new URL(testUrl, window.location.origin);
  let caseFromUrl = urlObj.pathname.match(/\/cases\/(\d+)/);
  if (!caseFromUrl) {
    caseFromUrl = window.location.href.match(/\/conversations\/(\d+)/);
  }
  
  const caseIdFromFunction = caseFromUrl ? caseFromUrl[1] : 'unknown';
  const afterId = urlObj.searchParams.get('after_id') || 'initial';
  const limit = '100'; // Always 100
  
  const functionKey = `posts_${caseIdFromFunction}_${afterId}_${limit}`;
  const functionStorageKey = `kayako_cache_${functionKey}`;
  
  console.log('Function would generate key:', functionKey);
  console.log('Function storage key:', functionStorageKey);
  
  const functionResult = localStorage.getItem(functionStorageKey);
  console.log('Function key exists:', !!functionResult);
  
  if (functionResult) {
    console.log('🎉 CACHE SHOULD WORK with function key!');
  } else {
    console.log('❌ Function key doesn\'t match stored keys');
  }
}

console.log('\n🎯 DEBUG COMPLETE - Check results above');
console.log('The issue should be clear from the key matching tests.');
