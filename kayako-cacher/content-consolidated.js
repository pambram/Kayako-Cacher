// Consolidated content script - single approach to avoid loading conflicts
console.log('🚀 CONSOLIDATED Kayako optimizer starting...');
console.log('📍 URL:', window.location.href);

// Check if we're on a supported domain
const supportedDomains = ['kayako.com/agent', '.gfi.com/agent', '.aurea.com/agent', '.ignitetech.com/agent', '.crossover.com/agent', '.totogi.com/agent', '.alpha.school/agent', '.cloudsense.com/agent', '.kandy.io/agent', 'dnnsupport.dnnsoftware.com/agent', 'csai.trilogy.com/agent'];

if (supportedDomains.some(domain => window.location.href.includes(domain))) {
  console.log('✅ Supported domain detected');
  
  // Load the consolidated fix immediately
  (function loadConsolidated() {
    console.log('💉 Loading consolidated optimization...');
    
    try {
      // Inject consolidated script as text (most reliable)
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('simple-working-solution.js');
      
      script.onload = () => {
        console.log('✅ Consolidated optimization loaded');
        
        // Test if it worked
        setTimeout(() => {
          if (typeof window.testKayakoPagination === 'function') {
            const result = window.testKayakoPagination();
            console.log('🧪 Self-test result:', result);
            
            if (result) {
              showSuccessIndicator();
            } else {
              showErrorIndicator('Test failed');
            }
          } else {
            console.error('❌ Test function not created');
            showErrorIndicator('Test function missing');
          }
        }, 1000);
        
        script.remove();
      };
      
      script.onerror = (error) => {
        console.error('❌ Failed to load consolidated script:', error);
        showErrorIndicator('Script load failed');
      };
      
      (document.head || document.documentElement).appendChild(script);
      
    } catch (error) {
      console.error('❌ Injection error:', error);
      showErrorIndicator('Injection failed');
    }
  })();
  
} else {
  console.log('❌ Unsupported domain:', window.location.hostname);
}

// Add message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message.action);
  
  switch (message.action) {
    case 'clearCache':
      if (typeof window.clearKayakoCache === 'function') {
        try {
          const count = window.clearKayakoCache();
          console.log('🗑️ Cache cleared via content script:', count, 'entries');
          sendResponse({ success: true, clearedCount: count });
        } catch (error) {
          console.error('❌ Clear cache error:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        console.log('❌ clearKayakoCache function not available');
        sendResponse({ success: false, error: 'Clear function not available' });
      }
      break;
      
    case 'executeScript':
      try {
        eval(message.script);
        sendResponse({ success: true });
      } catch (error) {
        console.error('❌ Script execution error:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'testPagination':
      if (typeof window.testKayakoPagination === 'function') {
        try {
          const result = window.testKayakoPagination();
          sendResponse({ success: true, result: result });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      } else {
        sendResponse({ success: false, error: 'Test function not available' });
      }
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep message channel open
});

function showSuccessIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #28a745;
    color: white;
    padding: 10px 15px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  
  indicator.innerHTML = `
    ✅ Kayako Optimizer Active<br>
    💾 Pagination: 100 posts/request<br>
    <span id="cache-display">Cache: Initializing...</span><br>
    <small style="opacity: 0.7;">Click: dismiss • Double-click: debug</small>
  `;
  
  // Click to dismiss
  indicator.onclick = () => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  };
  
  // Double-click for debug
  indicator.ondblclick = async () => {
    if (typeof window.kayakoCacheStats === 'function') {
      const stats = await window.kayakoCacheStats();
      alert(`Cache Debug:
• Memory: ${stats.memorySize} entries
• Persistent: ${stats.persistentSize} entries  
• Hits: ${stats.liveStats.hits}
• Misses: ${stats.liveStats.misses}
• Stored: ${stats.liveStats.stored}`);
    } else {
      alert('Debug functions not ready yet');
    }
  };
  
  document.body?.appendChild(indicator);
  
  // Update cache display periodically
  const updateDisplay = async () => {
    const display = document.getElementById('cache-display');
    if (display && typeof window.kayakoCacheStats === 'function') {
      try {
        const stats = await window.kayakoCacheStats();
        display.textContent = `Cache: ${stats.persistentSize}P + ${stats.memorySize}M (${stats.liveStats.hits}H/${stats.liveStats.misses}M)`;
      } catch (error) {
        display.textContent = 'Cache: Ready';
      }
    }
  };
  
  // Update every 3 seconds
  setInterval(updateDisplay, 3000);
  
  // Update after initial load
  setTimeout(updateDisplay, 2000);
  
  // Auto-fade after 15 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0.7';
    }
  }, 15000);
}

function showErrorIndicator(error) {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #dc3545;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    cursor: pointer;
  `;
  
  indicator.innerHTML = `❌ Kayako Optimizer Failed<br><small>${error}</small>`;
  indicator.onclick = () => indicator.remove();
  
  document.body?.appendChild(indicator);
  
  setTimeout(() => indicator.remove(), 10000);
}
