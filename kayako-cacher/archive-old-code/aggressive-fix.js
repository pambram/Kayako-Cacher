// AGGRESSIVE fetch override - inject this manually if current approach fails
// Copy/paste this directly in F12 console to test

(function() {
  console.log('🔥 AGGRESSIVE PAGINATION FIX - Manual Test');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Aggressive override with extensive logging
  window.fetch = function(url, options) {
    console.log('🔍 FETCH CALLED:', typeof url, url);
    
    if (typeof url === 'string') {
      console.log('📝 URL analysis:');
      console.log('  Contains /posts:', url.includes('/posts'));
      console.log('  Contains /api/v1/cases:', url.includes('/api/v1/cases'));
      console.log('  Contains limit=30:', url.includes('limit=30'));
      
      // Very broad matching - catch ANY posts call
      if (url.includes('/posts') && url.includes('limit=30')) {
        console.log('🎯 MATCHED for modification');
        const newUrl = url.replace('limit=30', 'limit=100');
        console.log('📝 Original:', url);
        console.log('📝 Modified:', newUrl);
        
        // Call with modified URL
        return originalFetch.call(this, newUrl, options);
      } else {
        console.log('❌ No match for modification');
      }
    }
    
    // Default behavior
    return originalFetch.call(this, url, options);
  };
  
  console.log('✅ AGGRESSIVE override installed');
  
  // Test function
  window.testAggressiveFix = function() {
    return window.fetch.toString().includes('MATCHED for modification');
  };
  
  console.log('🧪 Test with: window.testAggressiveFix()');
})();

console.log('🎯 Now scroll up to load posts and watch for FETCH CALLED messages');
