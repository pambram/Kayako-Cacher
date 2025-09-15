// Step-by-step debugging for pagination issue
// Run this in F12 Console on your Kayako page

console.log('🔍 STEP-BY-STEP PAGINATION DEBUG');
console.log('====================================');

// Step 1: Basic environment check
console.log('\n📋 STEP 1: Environment Check');
console.log('Current URL:', window.location.href);
console.log('Domain matches kayako.com:', window.location.href.includes('kayako.com'));
console.log('Is agent page:', window.location.href.includes('/agent/'));
console.log('Chrome extension available:', typeof chrome !== 'undefined');

// Step 2: Check if our scripts loaded
console.log('\n📋 STEP 2: Script Loading Check');
console.log('testKayakoPagination function:', typeof window.testKayakoPagination === 'function');
console.log('updateKayakoConfig function:', typeof window.updateKayakoConfig === 'function');

// Step 3: Check fetch function
console.log('\n📋 STEP 3: Fetch Function Analysis');
const fetchString = window.fetch.toString();
console.log('Original fetch length:', fetchString.length);
console.log('Contains "SIMPLE INTERCEPT":', fetchString.includes('SIMPLE INTERCEPT'));
console.log('Contains "posts":', fetchString.includes('posts'));
console.log('Contains "limit=30":', fetchString.includes('limit=30'));

// Show part of fetch function
console.log('Fetch function preview:');
console.log(fetchString.substring(0, 300) + '...');

// Step 4: Test manual interception
console.log('\n📋 STEP 4: Manual Interception Test');
if (typeof window.testKayakoPagination === 'function') {
  const testResult = window.testKayakoPagination();
  console.log('Manual test result:', testResult);
} else {
  console.log('❌ Test function not available');
}

// Step 5: Test with actual API call
console.log('\n📋 STEP 5: API Call Test');
const caseMatch = window.location.href.match(/\/cases\/(\d+)/);
if (caseMatch) {
  const caseId = caseMatch[1];
  const testUrl = window.location.origin + '/api/v1/cases/' + caseId + '/posts?limit=30&filters=all&include=*';
  
  console.log('Test URL:', testUrl);
  console.log('Making test fetch call...');
  
  // This should trigger our interception if it's working
  fetch(testUrl)
    .then(response => {
      console.log('✅ Test fetch completed');
      console.log('Response status:', response.status);
      console.log('Response URL:', response.url);
      
      // Check if URL was modified
      if (response.url.includes('limit=100')) {
        console.log('🎉 SUCCESS: URL was modified to limit=100');
      } else if (response.url.includes('limit=30')) {
        console.log('❌ FAILED: URL still has limit=30');
      } else {
        console.log('❓ UNKNOWN: No limit parameter found');
      }
    })
    .catch(error => {
      console.log('❌ Test fetch failed:', error);
    });
} else {
  console.log('❌ Cannot extract case ID for test');
}

// Step 6: Check for conflicting scripts
console.log('\n📋 STEP 6: Conflict Detection');
const allScripts = Array.from(document.scripts);
const extensionScripts = allScripts.filter(s => s.src.includes('extension'));
console.log('Extension scripts found:', extensionScripts.length);
extensionScripts.forEach(s => console.log('  - ' + s.src));

console.log('\n🎯 DEBUG COMPLETE - Check results above');
