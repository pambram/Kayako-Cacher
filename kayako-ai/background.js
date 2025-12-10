// Kayako AI Text Enhancer - Background Service Worker

// Default configuration
const DEFAULT_CONFIG = {
  provider: 'openai',
  openaiKey: '',
  anthropicKey: '',
  apiKey: '', // Kept for backward compatibility
  model: 'gpt-5-mini',
  enabled: true,
  useTicketContext: false,
  systemPrompt: '',
  temperature: 0.7,
  // Escalation templates library - default template is extracted from screen
  escalationTemplates: [
    {
      id: 'academics-quicksight',
      name: 'Academics QuickSight',
      template: `Proposed Team: Academics QuickSight
Affected student(s):
Affected date(s):
Dashboard/Report affected:
Data discrepancy description:
Expected vs Actual data:
Screenshots/links:`
    },
    {
      id: 'superbuilders-adapters',
      name: 'Superbuilders Adapters',
      template: `Proposed Team: Superbuilders Adapters
Affected app: 
Affected metrics: e.g. Accuracy/Time/Mastered units/XP/Other
Affected student(s):
Affected date(s):
Technical issue description:
Impact on student:
Investigation carried out:`
    },
    {
      id: 'engineering-defect',
      name: 'Engineering Defect',
      template: `Proposed Team: Engineering
Issue Type: Defect
Affected component:
Steps to reproduce:
Expected behavior:
Actual behavior:
Error messages/logs:
Browser/device info:`
    }
  ]
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
    
    case 'openaiChat':
      handleOpenAIChat(request.requestBody, sendResponse);
      return true;
    
    case 'anthropicChat':
      handleAnthropicChat(request.requestBody, sendResponse);
      return true;
    
    case 'classifyPrompt':
      handleClassifyPrompt(request.prompt, sendResponse);
      return true;
    
    case 'getTemplates':
      handleGetTemplates(sendResponse);
      return true;
    
    case 'saveTemplates':
      handleSaveTemplates(request.templates, sendResponse);
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

async function handleOpenAIChat(requestBody, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    const model = requestBody?.model || config.model || 'gpt-5-mini';
    const body = {
      model,
      messages: requestBody?.messages || [],
      max_completion_tokens: requestBody?.max_completion_tokens || (config.useTicketContext ? 3000 : 2000)
    };
    if (!model.startsWith('gpt-5')) {
      body.temperature = requestBody?.temperature ?? config.temperature ?? 0.7;
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let errText = `HTTP ${resp.status}`;
      let errDetails = null;
      try {
        const errJson = await resp.json();
        errText = errJson.error?.message || errText;
        errDetails = errJson.error;
      } catch (_) {}
      console.error('❌ OpenAI API error:', { status: resp.status, message: errText, details: errDetails });
      throw new Error(errText);
    }

    const data = await resp.json();
    console.log('✅ OpenAI response received:', { model: data.model, usage: data.usage });
    sendResponse({ success: true, data });
  } catch (error) {
    console.error('openaiChat failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAnthropicChat(requestBody, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    const apiKey = config.anthropicKey || config.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    const model = requestBody?.model || 'claude-3-5-sonnet-latest';
    
    // Convert OpenAI-style messages to Anthropic format
    const messages = requestBody?.messages || [];
    let systemPrompt = '';
    const anthropicMessages = [];
    
    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        // Convert image_url format to Anthropic's image format
        let content = msg.content;
        if (Array.isArray(content)) {
          content = content.map(part => {
            if (part.type === 'image_url') {
              // Extract base64 data from data URL
              const dataUrl = part.image_url?.url || '';
              const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2]
                  }
                };
              }
            }
            return part;
          });
        }
        anthropicMessages.push({ ...msg, content });
      }
    });
    
    const body = {
      model: model,
      max_tokens: requestBody?.max_completion_tokens || 8192,
      messages: anthropicMessages,
      temperature: requestBody?.temperature || 1
    };
    
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let errText = `HTTP ${resp.status}`;
      let errDetails = null;
      try {
        const errJson = await resp.json();
        errText = errJson.error?.message || errText;
        errDetails = errJson.error;
      } catch (_) {}
      console.error('❌ Anthropic API error:', { status: resp.status, message: errText, details: errDetails });
      throw new Error(errText);
    }

    const data = await resp.json();
    console.log('✅ Anthropic response received:', { model: data.model, usage: data.usage });
    
    // Convert Anthropic response to OpenAI format for compatibility
    const openaiFormat = {
      model: data.model,
      usage: data.usage,
      choices: [{
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || ''
        }
      }]
    };
    
    sendResponse({ success: true, data: openaiFormat });
  } catch (error) {
    console.error('anthropicChat failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fast classification using Haiku (or fallback to configured model)
// Now supports identifying specific escalation templates
async function handleClassifyPrompt(prompt, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    const templates = config.escalationTemplates || [];
    
    // Build template options for classification
    const templateList = templates.map(t => `- ${t.id}: ${t.name}`).join('\n');
    
    const classificationPrompt = `Classify this support agent request. The key distinction is:

- CUSTOMER = Writing a reply TO the customer (even if the reply MENTIONS an escalation, e.g., "tell customer we escalated")
- ESCALATION = Actually WRITING/FILLING OUT an escalation document/template to send to an internal team

Request: "${prompt}"

IMPORTANT: If the request says things like "reply to customer", "draft response", "tell them we escalated", "inform customer" - that's CUSTOMER even if escalation is mentioned.
ESCALATION is ONLY when explicitly asking to "write an escalation", "fill the escalation template", "create escalation to [team]".

If ESCALATION, which team template matches best?
Available templates:
${templateList}
- default: Use the on-screen template (no specific match)

Reply with ONLY: "CUSTOMER" or "ESCALATION:template-id"`;

    let responseText = '';
    
    // Prefer Anthropic Haiku for fast classification if available
    if (config.anthropicKey) {
      console.log('🏷️ Using Haiku for template classification');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 50,
          messages: [{ role: 'user', content: classificationPrompt }]
        })
      });
      
      if (resp.ok) {
        const data = await resp.json();
        responseText = data.content?.[0]?.text || '';
      }
    }
    
    // Fallback to OpenAI if Anthropic not available or failed
    if (!responseText && (config.openaiKey || config.apiKey)) {
      console.log('🏷️ Falling back to OpenAI for template classification');
      const apiKey = config.openaiKey || config.apiKey;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_completion_tokens: 50,
          messages: [{ role: 'user', content: classificationPrompt }]
        })
      });
      
      if (resp.ok) {
        const data = await resp.json();
        responseText = data.choices?.[0]?.message?.content || '';
      }
    }
    
    if (responseText) {
      sendResponse({ success: true, result: responseText.trim() });
    } else {
      sendResponse({ success: false, error: 'No API key configured for classification' });
    }
  } catch (error) {
    console.error('classifyPrompt failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get escalation templates - merge with defaults if not present
async function handleGetTemplates(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || {};
    
    // If no templates saved, use defaults
    let templates = config.escalationTemplates;
    if (!templates || templates.length === 0) {
      templates = DEFAULT_CONFIG.escalationTemplates;
      // Save the defaults so they persist
      config.escalationTemplates = templates;
      await chrome.storage.local.set({ kayakoAIConfig: { ...DEFAULT_CONFIG, ...config } });
    }
    
    sendResponse({ success: true, templates: templates || [] });
  } catch (error) {
    console.error('getTemplates failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Save escalation templates
async function handleSaveTemplates(templates, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    config.escalationTemplates = templates;
    await chrome.storage.local.set({ kayakoAIConfig: config });
    sendResponse({ success: true });
  } catch (error) {
    console.error('saveTemplates failed:', error);
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
