// Kayako AI Text Enhancer - Background Service Worker

// Default configuration
const DEFAULT_CONFIG = {
  apiKey: '',
  provider: 'openai',
  model: 'gpt-5-mini',
  enabled: true
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Kayako AI Text Enhancer installed/updated');
  
  // Set default configuration if not exists
  const result = await chrome.storage.local.get(['kayakoAIConfig']);
  if (!result.kayakoAIConfig) {
    await chrome.storage.local.set({
      kayakoAIConfig: DEFAULT_CONFIG
    });
    console.log('Default configuration set');
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case 'getConfig':
      handleGetConfig(sendResponse);
      return true; // Keep message channel open for async response
      
    case 'updateConfig':
      handleUpdateConfig(request.config, sendResponse);
      return true;
      
    case 'testConnection':
      handleTestConnection(request.config, sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

async function handleGetConfig(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    sendResponse({ success: true, config });
  } catch (error) {
    console.error('Error getting config:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateConfig(newConfig, sendResponse) {
  try {
    await chrome.storage.local.set({
      kayakoAIConfig: { ...DEFAULT_CONFIG, ...newConfig }
    });
    
    // Notify all content scripts about the config update
    const tabs = await chrome.tabs.query({
      url: [
        "*://*.kayako.com/agent/*",
        "*://*.gfi.com/agent/*", 
        "*://*.aurea.com/agent/*",
        "*://*.ignitetech.com/agent/*",
        "*://*.crossover.com/agent/*",
        "*://*.totogi.com/agent/*",
        "*://*.alpha.school/agent/*",
        "*://*.cloudsense.com/agent/*",
        "*://*.kandy.io/agent/*",
        "*://dnnsupport.dnnsoftware.com/agent/*",
        "*://csai.trilogy.com/agent/*"
      ]
    });
    
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'configUpdated',
        config: { ...DEFAULT_CONFIG, ...newConfig }
      }).catch(error => {
        // Ignore errors for tabs that don't have the content script loaded
        console.log('Could not send message to tab:', tab.id, error.message);
      });
    });
    
    console.log('Config updated and broadcasted to content scripts');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error updating config:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleTestConnection(config, sendResponse) {
  try {
    console.log('Testing AI API connection...');
    
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    
    const model = config.model || 'gpt-5-mini';
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: 'Test message - respond with just "OK"'
        }
      ],
      max_completion_tokens: 5
    };

    // Only add temperature for models that support it (not GPT-5)
    if (!model.startsWith('gpt-5')) {
      requestBody.temperature = 0.3;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API test successful');
    sendResponse({ 
      success: true, 
      message: 'Connection successful!',
      model: data.model
    });
    
  } catch (error) {
    console.error('API test failed:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}
