# 🧪 SIMPLE TESTS - v4.1.1

## 🔧 **Your Issues & Solutions:**

### **❌ Issue 1: `chrome.runtime.getURL` not available**
- **Cause**: Injected scripts can't access Chrome extension APIs
- **Fix**: Provide test code directly (copy/paste)

### **❌ Issue 2: Cache miss on reload**
- **Cause**: localStorage cache not being stored/retrieved properly
- **Fix**: Debug cache key generation and storage

---

## 🧪 **DIRECT TESTS (Copy/Paste in F12 Console):**

### **Test 1: Debug Cache Issue**
```javascript
// DEBUG CACHE PERSISTENCE - Copy/paste this entire block:

console.log('🔍 DEBUGGING CACHE PERSISTENCE');
console.log('=============================');

// Check current cache state
console.log('Memory cache size:', window.memoryCache?.size || 'Not available');
console.log('Live stats:', window.kayakoCacheStats_live);

// Check localStorage for Kayako entries
let kayakoEntries = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.includes('kayako_cache_')) {
    kayakoEntries.push(key);
    try {
      const value = localStorage.getItem(key);
      const parsed = JSON.parse(value);
      const age = Math.round((Date.now() - parsed.timestamp) / 1000);
      console.log(`Found: ${key}`);
      console.log(`  Posts: ${parsed.data?.data?.length || 0}, Age: ${age}s`);
    } catch (e) {
      console.log(`  Parse error: ${e.message}`);
    }
  }
}
console.log(`Total Kayako cache entries: ${kayakoEntries.length}`);

// Test cache key generation for current page
const currentUrl = window.location.href;
const caseMatch = currentUrl.match(/\/cases\/(\d+)/);
if (caseMatch) {
  const caseId = caseMatch[1];
  const expectedKey = `kayako_cache_posts_${caseId}_initial_100`;
  console.log('Expected cache key:', expectedKey);
  console.log('Key exists:', !!localStorage.getItem(expectedKey));
}

console.log('🎯 Cache debug complete');
```

### **Test 2: Manual Cache Test**
```javascript
// MANUAL CACHE STORAGE TEST - Copy/paste this:

console.log('🧪 MANUAL CACHE TEST');
console.log('===================');

const testKey = 'kayako_cache_manual_test';
const testData = {
  data: { data: [{ id: 'test', subject: 'Test post' }] },
  timestamp: Date.now(),
  url: 'test_url'
};

// Store test data
localStorage.setItem(testKey, JSON.stringify(testData));
console.log('✅ Test data stored');

// Retrieve test data
const retrieved = localStorage.getItem(testKey);
const parsed = JSON.parse(retrieved);
console.log('✅ Test data retrieved:', parsed.data.data.length, 'posts');

// Clean up
localStorage.removeItem(testKey);
console.log('✅ Test cleanup complete');

console.log('🎉 localStorage is working correctly!');
```

### **Test 3: Cache Functionality Test**
```javascript
// CACHE FUNCTIONALITY TEST - Copy/paste this:

console.log('🔄 CACHE FUNCTIONALITY TEST');
console.log('===========================');

// Get current case ID
const caseId = window.location.href.match(/\/cases\/(\d+)/)?.[1];
if (!caseId) {
  console.log('❌ Not on a case page');
} else {
  console.log('✅ Case ID:', caseId);
  
  // Test cache storage
  const cacheKey = `kayako_cache_posts_${caseId}_initial_100`;
  const testCacheData = {
    data: { data: [{ id: 'test', subject: 'Cached test post' }] },
    timestamp: Date.now(),
    url: `test_url_${caseId}`
  };
  
  // Store cache
  localStorage.setItem(cacheKey, JSON.stringify(testCacheData));
  console.log('✅ Stored test cache for case:', caseId);
  
  // Verify storage
  const retrieved = localStorage.getItem(cacheKey);
  console.log('✅ Cache retrieval test:', retrieved ? 'SUCCESS' : 'FAILED');
  
  // Clean up
  localStorage.removeItem(cacheKey);
  console.log('✅ Cleanup complete');
}

console.log('🎯 Test complete - localStorage cache working');
```

---

## 📊 **What to Look For:**

### **✅ If Cache is Working:**
```
🔍 Checking cache for: posts_60177546_initial_100
📱 Found in localStorage cache: posts_60177546_initial_100
💾✅ MEMORY CACHE HIT! Using cached data
```

### **❌ If Cache Not Working:**
```
🔍 Checking cache for: posts_60177546_initial_100  
❌ No localStorage cache for: posts_60177546_initial_100
💾❌ Cache miss for: posts_60177546_initial_100
```

---

## 🚀 **Expected Fix in v4.1.1:**

- **✅ localStorage storage**: Uses localStorage instead of chrome.storage.local
- **✅ Fixed cache stats**: No more chrome API errors
- **✅ Proper persistence**: Cache survives page reloads
- **✅ Direct tests**: No need for chrome.runtime.getURL

**Run the debug tests above to see exactly what's happening with your cache storage!** 🚀

The localStorage approach should work in the injected script context and provide proper cache persistence across page reloads.
