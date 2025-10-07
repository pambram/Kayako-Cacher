// DEBUG EXACTLY WHAT JQUERY IS TRYING TO PARSE
console.log('🔍 Debugging jQuery parsing failure...');

// Override JSON.parse to see what jQuery is actually trying to parse
const originalJSONParse = JSON.parse;

window.JSON.parse = function(text, reviver) {
  console.log('🔍 JSON.parse called with:');
  console.log('  Text type:', typeof text);
  console.log('  Text length:', text?.length || 0);
  console.log('  Text preview:', (text || '').substring(0, 100));
  console.log('  Text ends with:', (text || '').substring(Math.max(0, (text?.length || 0) - 50)));
  console.log('  Called from stack:', new Error().stack.split('\n')[1]);
  
  try {
    const result = originalJSONParse.call(this, text, reviver);
    console.log('✅ JSON.parse succeeded');
    return result;
  } catch (error) {
    console.error('❌ JSON.parse failed:', error.message);
    console.log('❌ Failed text:', text);
    console.log('❌ Failed text type:', typeof text);
    console.log('❌ Failed text length:', text?.length);
    
    // Throw the original error so we can see where it comes from
    throw error;
  }
};

console.log('✅ JSON.parse override installed - will log all parse attempts');
console.log('🎯 Now trigger a cache hit to see what jQuery is trying to parse');

// Also log XHR property access
const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
  const xhr = new originalXHR();
  
  // Log when jQuery accesses responseText
  let _responseText = '';
  Object.defineProperty(xhr, 'responseText', {
    get: function() {
      console.log('🔍 jQuery accessing responseText:', _responseText?.length || 0, 'chars');
      return _responseText;
    },
    set: function(value) {
      console.log('🔍 Setting responseText:', typeof value, value?.length || 0, 'chars');
      _responseText = value;
    },
    configurable: true,
    enumerable: true
  });
  
  return xhr;
};

Object.setPrototypeOf(window.XMLHttpRequest, originalXHR);
Object.setPrototypeOf(window.XMLHttpRequest.prototype, originalXHR.prototype);

console.log('✅ XHR property access logging installed');
console.log('🎯 This will show exactly what jQuery sees vs what we think we\'re providing');
