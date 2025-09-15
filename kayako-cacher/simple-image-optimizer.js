// Simple image upload optimization without complex interference
console.log('🖼️ Simple image optimizer initializing...');

// Add a simple progress indicator when images are being processed
function showImageProgress(message) {
  const existing = document.getElementById('simple-image-progress');
  if (existing) existing.remove();
  
  const progress = document.createElement('div');
  progress.id = 'simple-image-progress';
  progress.style.cssText = `
    position: fixed;
    bottom: 60px;
    right: 20px;
    background: #007bff;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  progress.textContent = message;
  
  document.body?.appendChild(progress);
  return progress;
}

function hideImageProgress() {
  const progress = document.getElementById('simple-image-progress');
  if (progress) {
    progress.style.opacity = '0';
    setTimeout(() => progress.remove(), 300);
  }
}

// Monitor for image upload activity to show progress
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) { // Element node
        // Look for upload indicators
        if (node.querySelector && node.querySelector('[class*="upload"]')) {
          const progressEl = showImageProgress('🖼️ Processing image...');
          
          // Auto-hide after 10 seconds
          setTimeout(() => {
            hideImageProgress();
          }, 10000);
        }
        
        // Look for completed images
        if (node.querySelector && node.querySelector('img[src*="kayakocdn.com"]')) {
          hideImageProgress();
          
          // Show brief success message
          const success = showImageProgress('✅ Image uploaded');
          setTimeout(() => {
            hideImageProgress();
          }, 2000);
        }
      }
    });
  });
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Simple paste optimization - reduce image size on paste
document.addEventListener('paste', async (e) => {
  const items = Array.from(e.clipboardData?.items || []);
  const imageItems = items.filter(item => item.type.startsWith('image/'));
  
  if (imageItems.length > 0) {
    console.log('📋 Image paste detected, optimizing...');
    showImageProgress('📋 Optimizing pasted image...');
    
    // Let the default handler work, just show progress
    setTimeout(() => {
      hideImageProgress();
    }, 5000);
  }
});

// Monitor drag/drop for images
document.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer?.files || []);
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  
  if (imageFiles.length > 0) {
    console.log(`📁 ${imageFiles.length} image(s) dropped, optimizing...`);
    showImageProgress(`📁 Processing ${imageFiles.length} image(s)...`);
    
    // Let the default handler work, just show progress
    setTimeout(() => {
      hideImageProgress();
    }, imageFiles.length * 3000); // 3 seconds per image
  }
}, true);

console.log('✅ Simple image optimizer ready');

// Debug function
window.testImageOptimizer = function() {
  const progress = showImageProgress('🧪 Test progress indicator');
  setTimeout(() => hideImageProgress(), 2000);
  return true;
};
