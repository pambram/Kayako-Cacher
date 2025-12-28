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
  // Experimental features
  tavilyKey: '',
  enableUrlFetch: false,
  enableWebSearch: false,
  // Escalation templates library - default template is extracted from screen
  escalationTemplates: [
    {
      id: 'academics-high-school',
      name: 'Academics High School',
      template: `Proposed Team:\tAcademics High School
Affected students:\t 
Affected apps:\t 
Presumed DRI:\tCheck this sheet
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-k-8-general',
      name: 'Academics K-8 (General)',
      template: `Proposed Team:\tAcademics (General)
Affected students:\t 
Affected apps:\t 
Presumed DRI:\tCheck the subject specific knowledge grade for the student(s) in their learning hub.

Then check this sheet to find the corresponding Academics DRI
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-language',
      name: 'Academics Language',
      template: `Proposed Team:\tAcademics Language
Affected apps:\t 
Affected students:\t 
Student Knowledge Grade:\tCheck the subject specific knowledge grade (not age grade) for the student(s) in their learning hub. In Dash, this will be on the "Student App Roster". In Timeback, this till be in the "My Learning Report".
Presumed DRI:\tCheck this sheet to find the corresponding Academics DRI for the Knowledge Grade of the student(s).
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-math',
      name: 'Academics Math',
      template: `Proposed Team:\tAcademics Math
Affected apps:\t 
Affected students:\t 
Student Knowledge Grade:\tCheck the subject specific knowledge grade (not age grade) for the student(s) in their learning hub. In Dash, this will be on the "Student App Roster". In Timeback, this till be in the "My Learning Report".
Presumed DRI:\tCheck this sheet to find the corresponding Academics DRI for the Knowledge Grade of the student(s).
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-quicksight',
      name: 'Academics QuickSight',
      template: `Proposed Team:\tAcademics Quicksight
Affected student(s):\t 
Affected dashboard:\t 
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, and a summary of the assessment]
What is requested of Academics Quicksight?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-reading',
      name: 'Academics Reading',
      template: `Proposed Team:\tAcademics Reading
Affected apps:\t 
Affected students:\t 
Student Knowledge Grade:\tCheck the subject specific knowledge grade (not age grade) for the student(s) in their learning hub. In Dash, this will be on the "Student App Roster". In Timeback, this till be in the "My Learning Report".
Presumed DRI:\tCheck this sheet to find the corresponding Academics DRI for the Knowledge Grade of the student(s).
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-science',
      name: 'Academics Science',
      template: `Proposed Team:\tAcademics Science
Affected apps:\t 
Affected students:\t 
Student Knowledge Grade:\tCheck the subject specific knowledge grade (not age grade) for the student(s) in their learning hub. In Dash, this will be on the "Student App Roster". In Timeback, this till be in the "My Learning Report".
Presumed DRI:\tCheck this sheet to find the corresponding Academics DRI for the Knowledge Grade of the student(s).
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-social-science',
      name: 'Academics Social Science',
      template: `Proposed Team:\tAcademics Social Science
Affected apps:\t 
Affected students:\t 
Student Knowledge Grade:\tCheck the subject specific knowledge grade (not age grade) for the student(s) in their learning hub. In Dash, this will be on the "Student App Roster". In Timeback, this till be in the "My Learning Report".
Presumed DRI:\tCheck this sheet to find the corresponding Academics DRI for the Knowledge Grade of the student(s).
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'academics-testing',
      name: 'Academics Testing',
      template: `Proposed Team:\tAcademics Testing
Affected student(s):\t 
Test name:\t 
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'alpha-eigen',
      name: 'Alpha Eigen',
      template: `Proposed Team:\tAlpha Eigen
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected student email(s):\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:`
    },
    {
      id: 'coachbot',
      name: 'Coachbot',
      template: `Proposed Team:\tCoachbot
Affected app:\t 
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected students:\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
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
    },
    {
      id: 'sis',
      name: 'SIS',
      template: `Proposed Team:\tSIS
Affected students:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
    },
    {
      id: 'superbuilders-100-for-100',
      name: 'Superbuilders 100 for 100',
      template: `Proposed Team:\tSuperbuilders 100 for 100
Affected app:\t 
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected students:\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
    },
    {
      id: 'superbuilders-adapters',
      name: 'Superbuilders Adapters',
      template: `Proposed Team:\tSuperbuilders Adapters
Affected app:\t 
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected students:\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
    },
    {
      id: 'superbuilders-nice-academy',
      name: 'Superbuilders Nice Academy',
      template: `Proposed Team:\tSuperbuilders NiceAcademy
Affected app:\t 
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected students:\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
    },
    {
      id: 'superbuilders-timeback-app',
      name: 'Superbuilders Timeback (App)',
      template: `Proposed Team:\tTimeback
Affected students:\t 
Affected apps:\t 
Subject, skill, and course:\t 
What is the issue reported?

How does this affect the student? :\t[Explain the issue from a technical point of view, as well as the impact the issue has on the student]
What investigation did CS carry out? :\t[Include evidence, links to any DDs performed, and a summary of the assessment]
What is requested of Academics?\t[Share your proposed action and the reason for escalation]
Other notes:`
    },
    {
      id: 'superbuilders-timeback-dash',
      name: 'Superbuilders Timeback Dash',
      template: `Proposed Team:\tSuperbuilders Timeback Dash
Affected app:\t 
Affected metrics:\tAccuracy/Time/Mastered units/XP
Affected students:\t 
Affected dates:\t 
Evidence:\t[Include screenshots and recordings, where available]
Reason for Escalation:\t 
Other notes:`
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
    
    case 'fetchUrl':
      handleFetchUrl(request.url, request.prompt, sendResponse);
      return true;
    
    case 'tavilySearch':
      handleTavilySearch(request.query, sendResponse);
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
    
    const model = requestBody?.model || 'claude-sonnet-4-5';
    
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
// Now supports identifying: escalation templates, URL fetch, web search
async function handleClassifyPrompt(prompt, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    const templates = config.escalationTemplates || [];
    
    // Extract URLs from prompt
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = prompt.match(urlRegex) || [];
    
    // Build template options for classification
    const templateList = templates.map(t => `- ${t.id}: ${t.name}`).join('\n');
    
    const classificationPrompt = `Classify this support agent request and detect if special actions are needed:

Request: "${prompt}"

Classify into ONE of these categories:

1. CUSTOMER = Writing a reply TO the customer (even if the reply MENTIONS an escalation)
2. ESCALATION = Actually WRITING/FILLING OUT an escalation document/template to send to an internal team
3. WEB_SEARCH = User explicitly asks to "search", "look up", "find information online", "search the internet/web"
4. URL_FETCH = Contains URLs and needs information FROM those URLs to answer

IMPORTANT Rules:
- If request says "reply to customer", "draft response", "tell them we escalated" - that's CUSTOMER
- ESCALATION is ONLY when explicitly asking to "write an escalation", "fill the escalation template"
- WEB_SEARCH is when user says "search for", "look up online", "find information about" 
- URL_FETCH is when URLs are present AND user needs info from them (not just mentioning URLs)

URLs found: ${urls.length > 0 ? urls.join(', ') : 'none'}

If ESCALATION, which team template?
${templateList}
- default: Use the on-screen template (no specific match)

Reply format:
- "CUSTOMER" 
- "ESCALATION:template-id"
- "WEB_SEARCH"
- "URL_FETCH:url1,url2" (comma-separated URLs)

Reply with ONLY ONE of the above formats:`;

    let responseText = '';
    
    // Prefer Anthropic Haiku for fast classification if available
    if (config.anthropicKey) {
      console.log('🏷️ Using Haiku for intent classification');
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
          max_tokens: 100,
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
      console.log('🏷️ Falling back to OpenAI for intent classification');
      const apiKey = config.openaiKey || config.apiKey;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_completion_tokens: 100,
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

// Fetch URL and extract relevant content using AI
async function handleFetchUrl(url, userPrompt, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    
    if (!config.enableUrlFetch) {
      sendResponse({ success: false, error: 'URL fetching is not enabled. Enable it in settings.' });
      return;
    }
    
    console.log(`🔗 Fetching URL: ${url}`);
    
    // Fetch the URL content
    const fetchResp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KayakoAI/1.0)'
      }
    });
    
    if (!fetchResp.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${fetchResp.status}`);
    }
    
    const contentType = fetchResp.headers.get('content-type') || '';
    let rawContent = '';
    
    if (contentType.includes('text/html')) {
      rawContent = await fetchResp.text();
      // Strip HTML tags for basic text extraction
      rawContent = rawContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } else if (contentType.includes('application/json')) {
      const jsonData = await fetchResp.json();
      rawContent = JSON.stringify(jsonData, null, 2);
    } else {
      rawContent = await fetchResp.text();
    }
    
    // Truncate if too long (keep first 10000 chars for context)
    if (rawContent.length > 10000) {
      rawContent = rawContent.substring(0, 10000) + '\n\n[Content truncated...]';
    }
    
    console.log(`📄 Fetched ${rawContent.length} characters from ${url}`);
    
    // Use AI to extract relevant information based on user's prompt
    const extractionPrompt = `You are helping a support agent. They asked: "${userPrompt}"

Here is content fetched from ${url}:

${rawContent}

Extract and summarize ONLY the information relevant to answering the user's question. Be concise but complete. Focus on facts, solutions, steps, or specific details they need.`;
    
    let extractedContent = '';
    
    // Use Anthropic Haiku for fast extraction if available
    if (config.anthropicKey) {
      console.log('🤖 Using Haiku for content extraction');
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
          max_tokens: 1500,
          messages: [{ role: 'user', content: extractionPrompt }]
        })
      });
      
      if (resp.ok) {
        const data = await resp.json();
        extractedContent = data.content?.[0]?.text || rawContent;
      } else {
        extractedContent = rawContent; // Fallback to raw content
      }
    } else if (config.openaiKey || config.apiKey) {
      console.log('🤖 Using OpenAI for content extraction');
      const apiKey = config.openaiKey || config.apiKey;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_completion_tokens: 1500,
          messages: [{ role: 'user', content: extractionPrompt }]
        })
      });
      
      if (resp.ok) {
        const data = await resp.json();
        extractedContent = data.choices?.[0]?.message?.content || rawContent;
      } else {
        extractedContent = rawContent; // Fallback to raw content
      }
    } else {
      // No AI available, return raw content
      extractedContent = rawContent;
    }
    
    console.log(`✅ Extracted ${extractedContent.length} characters of relevant content`);
    
    sendResponse({ 
      success: true, 
      url: url,
      content: extractedContent,
      rawLength: rawContent.length
    });
  } catch (error) {
    console.error('fetchUrl failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Perform web search using Tavily API
async function handleTavilySearch(query, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['kayakoAIConfig']);
    const config = result.kayakoAIConfig || DEFAULT_CONFIG;
    
    if (!config.enableWebSearch) {
      sendResponse({ success: false, error: 'Web search is not enabled. Enable it in settings.' });
      return;
    }
    
    if (!config.tavilyKey) {
      sendResponse({ success: false, error: 'Tavily API key is required for web search' });
      return;
    }
    
    console.log(`🔍 Searching with Tavily: ${query}`);
    
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: config.tavilyKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false
      })
    });
    
    if (!resp.ok) {
      let errText = `HTTP ${resp.status}`;
      try {
        const errJson = await resp.json();
        errText = errJson.error || errText;
      } catch (_) {}
      throw new Error(`Tavily search failed: ${errText}`);
    }
    
    const data = await resp.json();
    console.log(`✅ Tavily found ${data.results?.length || 0} results`);
    
    // Format results for AI consumption
    let formattedResults = '';
    
    if (data.answer) {
      formattedResults += `Quick Answer: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      formattedResults += 'Search Results:\n\n';
      data.results.forEach((result, idx) => {
        formattedResults += `${idx + 1}. ${result.title}\n`;
        formattedResults += `   URL: ${result.url}\n`;
        formattedResults += `   ${result.content}\n\n`;
      });
    }
    
    sendResponse({ 
      success: true, 
      query: query,
      answer: data.answer,
      results: data.results,
      formattedContent: formattedResults
    });
  } catch (error) {
    console.error('tavilySearch failed:', error);
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
