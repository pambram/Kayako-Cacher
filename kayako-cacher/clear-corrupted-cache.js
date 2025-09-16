// Clear corrupted cache to start fresh with v5.3.0
console.log('🗑️ Clearing potentially corrupted cache for fresh start...');

let cleared = 0;
const corruptedKeys = [];

// Find and remove all Kayako cache entries
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (key && key.startsWith('kayako_cache_')) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        // Test if the data is valid JSON
        const parsed = JSON.parse(value);
        
        // Test if the structure is valid
        if (!parsed.data || !parsed.timestamp) {
          corruptedKeys.push(key);
          localStorage.removeItem(key);
          cleared++;
        }
      } else {
        // Empty value
        localStorage.removeItem(key);
        cleared++;
      }
    } catch (error) {
      // Corrupted JSON
      corruptedKeys.push(key);
      localStorage.removeItem(key);
      cleared++;
    }
  }
}

console.log(`✅ Cleared ${cleared} cache entries`);
if (corruptedKeys.length > 0) {
  console.log('🔧 Corrupted entries removed:', corruptedKeys.slice(0, 5));
}

console.log('🎯 Cache cleared - ready for v5.3.0 fresh start!');

// Return stats
({ cleared, corrupted: corruptedKeys.length });
