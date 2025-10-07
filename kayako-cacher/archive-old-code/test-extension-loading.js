// Ultra-simple test to verify extension is loading
console.log('🧪 TESTING: Extension loading verification');

// Test 1: Check if we're on the right page
console.log('📍 Current URL:', window.location.href);
console.log('📍 URL matches agent pattern:', window.location.href.includes('kayako.com/agent'));

// Test 2: Check content script basic loading
console.log('📦 Document ready state:', document.readyState);
console.log('📦 Extension context available:', typeof chrome !== 'undefined');

// Test 3: Try to verify if content script ran
setTimeout(() => {
  console.log('🔍 Checking for extension evidence...');
  
  // Look for any of our console messages
  console.log('🔍 Console messages should show extension loading above this line');
  
  // Check if fetch was modified
  const fetchString = window.fetch.toString();
  console.log('🔍 Fetch function modified:', fetchString.includes('SIMPLE INTERCEPT') || fetchString.includes('posts'));
  
  // Check for test function
  console.log('🔍 Test function available:', typeof window.testKayakoPagination === 'function');
  
  if (typeof window.testKayakoPagination === 'function') {
    console.log('🧪 Running pagination test...');
    const result = window.testKayakoPagination();
    console.log('🧪 Test result:', result);
  }
  
  // Check for visual indicator
  const indicator = document.querySelector('[style*="Simple Pagination Fixer"]');
  console.log('🔍 Visual indicator present:', !!indicator);
  
  console.log('🎯 EXTENSION DIAGNOSIS COMPLETE');
}, 3000);

// Also test manual fetch interception
window.manualTestFetch = function() {
  console.log('🧪 Manual fetch test...');
  
  // Try to make a test posts request
  const testUrl = window.location.origin + '/api/v1/cases/123/posts?limit=30&filters=all';
  
  console.log('📤 Testing URL:', testUrl);
  console.log('📤 Fetch function:', window.fetch.toString().substring(0, 200) + '...');
  
  return testUrl;
};

console.log('🎉 Extension loading test ready. Wait 3 seconds for full diagnosis.');
