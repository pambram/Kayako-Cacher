// Google Meet AI Transcriber - Background Service Worker

const DEFAULT_CONFIG = {
  provider: 'anthropic',
  openaiKey: '',
  anthropicKey: '',
  model: 'claude-haiku-4-5',
  enabled: true,
  captureInterval: 10, // seconds
  batchSize: 6, // screenshots (60 seconds worth at 10s interval)
  imageQuality: 0.5, // JPEG quality (0-1)
  imageFormat: 'jpeg', // 'jpeg' or 'webp'
  technicalMode: true, // Ultra-verbose technical documentation mode
  maxTokens: 4000 // Increased from 2000 for more detailed output
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Google Meet AI Transcriber installed/updated');
  
  const result = await chrome.storage.local.get(['meetTranscriberConfig']);
  const existingConfig = result.meetTranscriberConfig;
  
  // Force update if old config exists with wrong model names
  if (!existingConfig || 
      existingConfig.model === 'claude-3-5-sonnet-latest' || 
      existingConfig.model === 'claude-3-5-haiku-latest' ||
      existingConfig.model === 'claude-4-5-haiku') {
    console.log('Updating configuration with new defaults');
    await chrome.storage.local.set({
      meetTranscriberConfig: { ...DEFAULT_CONFIG, ...existingConfig, model: DEFAULT_CONFIG.model }
    });
    console.log('Configuration updated to:', DEFAULT_CONFIG.model);
  } else if (!existingConfig) {
    await chrome.storage.local.set({
      meetTranscriberConfig: DEFAULT_CONFIG
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
      return true;
      
    case 'updateConfig':
      handleUpdateConfig(request.config, sendResponse);
      return true;
      
    case 'analyzeScreenshots':
      handleAnalyzeScreenshots(request.screenshots, request.previousContext, sendResponse);
      return true;
    
    case 'captureTab':
      handleCaptureTab(request.tabId, sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

async function handleGetConfig(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = result.meetTranscriberConfig || DEFAULT_CONFIG;
    sendResponse({ success: true, config });
  } catch (error) {
    console.error('Error getting config:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateConfig(newConfig, sendResponse) {
  try {
    await chrome.storage.local.set({
      meetTranscriberConfig: { ...DEFAULT_CONFIG, ...newConfig }
    });
    
    // Notify all content scripts about the config update
    const tabs = await chrome.tabs.query({
      url: ["https://meet.google.com/*"]
    });
    
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'configUpdated',
        config: { ...DEFAULT_CONFIG, ...newConfig }
      }).catch(error => {
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

async function handleCaptureTab(tabId, sendResponse) {
  try {
    // Find the Meet tab
    const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    
    if (tabs.length === 0) {
      sendResponse({ 
        success: false, 
        error: 'No Google Meet tab found' 
      });
      return;
    }
    
    // Get the first Meet tab (or the one that's active if multiple)
    const meetTab = tabs.find(t => t.active) || tabs[0];
    
    // If Meet tab is not active, temporarily activate it
    if (!meetTab.active) {
      await chrome.tabs.update(meetTab.id, { active: true });
      // Small delay to ensure tab is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Capture the Meet tab
    const dataUrl = await chrome.tabs.captureVisibleTab(meetTab.windowId, {
      format: 'jpeg',
      quality: 50
    });
    
    sendResponse({ success: true, dataUrl });
  } catch (error) {
    console.error('Error capturing tab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAnalyzeScreenshots(screenshots, previousContext, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = result.meetTranscriberConfig || DEFAULT_CONFIG;
    
    if (!config.enabled) {
      throw new Error('Transcriber is disabled');
    }

    console.log(`📊 Starting analysis with ${config.provider}, ${screenshots.length} screenshots`);
    
    let analysisResult;
    
    if (config.provider === 'anthropic' && config.anthropicKey) {
      analysisResult = await analyzeWithAnthropic(screenshots, previousContext, config);
    } else if (config.provider === 'openai' && config.openaiKey) {
      analysisResult = await analyzeWithOpenAI(screenshots, previousContext, config);
    } else {
      throw new Error('No API key configured. Please configure your API key in the extension settings.');
    }
    
    console.log('✅ Analysis complete:', analysisResult);
    sendResponse({ success: true, ...analysisResult });
  } catch (error) {
    console.error('❌ Error analyzing screenshots:', error);
    console.error('Error stack:', error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function analyzeWithAnthropic(screenshots, previousContext, config) {
  console.log(`🤖 Analyzing ${screenshots.length} screenshots with Anthropic Claude (Technical Mode: ${config.technicalMode})`);
  
  // Build message content with multiple images
  const messageContent = [];
  
  // Build system prompt based on technical mode
  const systemPrompt = config.technicalMode ? 
    `You are a highly detail-oriented technical documentation AI analyzing screenshots from a Google Meet call where engineers are doing infrastructure work, debugging, deployments, or technical discussions.

YOUR MISSION: Extract EVERY visible technical detail with extreme precision. Be obsessive about:

**TEXT EXTRACTION (OCR Focus):**
- Read ALL visible text in terminals, dashboards, browsers, IDEs
- Extract complete command lines, not summaries (e.g., "aws logs tail /aws/lambda/payment-processor --follow --filter-pattern ERROR")
- Capture exact error messages word-for-word
- Read metric values, timestamps, percentages exactly as shown
- Extract URLs, file paths, and hostnames completely
- Note any visible JSON, YAML, code snippets verbatim

**TOOLS & APPLICATIONS:**
- Identify every visible application/tool/dashboard
- Note which specific AWS Console page (not just "AWS Console" but "CloudWatch Logs > Log Group: /aws/lambda/payment-processor")
- Identify monitoring tools and which dashboard/view is open
- Note terminal emulators, shells (bash/zsh/fish), and working directories
- Identify IDE/editors and which files are open

**INFRASTRUCTURE DEEP DIVE:**
- AWS Account IDs, names, or any visible account identifiers
- Complete resource ARNs or IDs (e.g., "i-0a1b2c3d4e5f6g7h8")
- Specific AWS regions visible (us-east-1, eu-west-1, etc.)
- Environment indicators (prod, staging, dev, qa, etc.)
- IP addresses, both public and private
- Domain names, subdomains, DNS entries
- VPC IDs, subnet IDs, security group IDs if visible
- Database identifiers, cluster names, instance types

**COMMANDS & CODE:**
- Complete command lines with all flags and arguments
- Any visible kubectl, docker, aws-cli, terraform commands
- SQL queries (SELECT, UPDATE, INSERT statements)
- git commands (branch names, commit hashes if visible)
- Script names, function names being executed
- API calls with endpoints and methods (GET/POST/PUT/DELETE)
- Environment variables being set or used

**METRICS, LOGS & ALERTS:**
- Exact metric values (not "high CPU" but "CPU: 87.3%")
- Time ranges on graphs (last 15m, 1h, 24h, custom ranges)
- Log levels (ERROR, WARN, INFO, DEBUG) and counts
- Alert names exactly as shown
- Severity levels (critical, high, medium, low)
- Threshold values for alerts
- Trace IDs, request IDs, correlation IDs
- HTTP status codes, response times, latency percentiles

**WORKFLOW & ACTIONS:**
- Exactly which logs/files are being tailed or viewed
- Search queries being executed (in Datadog, Splunk, CloudWatch)
- Filter patterns applied
- Time windows being investigated
- Tabs/windows being switched between
- Copy-paste actions if visible
- Any deployments, rollbacks, or infrastructure changes being made

**CONTEXT & DECISIONS:**
- Technical discussions from captions
- Questions asked and answers given
- Hypotheses being tested
- Root causes identified
- Action items decided
- Runbooks or documentation referenced

Be EXTREMELY LITERAL - if you see "Error rate: 15.7%" write exactly that, not "error rate increased".
If you see a command, write it EXACTLY: \`aws ec2 describe-instances --region us-east-1 --instance-ids i-1234567890abcdef0\`

Format your response as:
**🛠 Tools/Applications:**
- [Every visible app, dashboard, terminal, browser tab]

**💻 Commands & Code:**
\`\`\`
[Exact commands, queries, code snippets - use code blocks]
\`\`\`

**☁️ Infrastructure:**
- Accounts: [Account IDs or names]
- Regions: [AWS regions]
- Resources: [Specific resource IDs/ARNs]
- Environments: [prod/staging/dev]
- Network: [IPs, domains, hostnames]

**📊 Metrics & Alerts:**
- [Exact metric names and values]
- [Alert names and severities]
- [Log counts, error rates, latencies]

**🔍 Current Activity:**
[Detailed description of what's being investigated/debugged/deployed]

**💬 Technical Discussion:**
[Key points from captions/dialogue]

**📝 Summary:**
[Concise technical summary of the work being performed]`
    : `You are analyzing screenshots from a technical Google Meet call to document infrastructure work, debugging sessions, and technical activities.

FOCUS ON TECHNICAL DETAILS:
1. **Tools & Applications**: Identify ALL visible tools, dashboards, terminals, IDEs, browsers
   - Which AWS Console pages (EC2, RDS, CloudWatch, Lambda, etc.)
   - Which monitoring tools (Datadog, Grafana, New Relic, PagerDuty, etc.)
   - Which development tools (VS Code, terminals, Docker, Kubernetes dashboards)
   - Which collaboration tools (Jira, Confluence, Slack, GitHub)

2. **Commands & Code**: Extract any visible commands, queries, or code
   - Terminal commands (ssh, kubectl, aws cli, docker, etc.)
   - SQL queries or database operations
   - API endpoints or URLs being accessed
   - Error messages or stack traces
   - Configuration files or YAML/JSON visible

3. **Infrastructure Details**: Document specific resources and identifiers
   - AWS account IDs or account names visible
   - Resource IDs (instance IDs, RDS identifiers, Lambda names, etc.)
   - IP addresses, hostnames, domain names
   - Environment names (prod, staging, dev, etc.)
   - Region information (us-east-1, eu-west-1, etc.)

4. **Metrics & Data**: Capture visible numbers, graphs, alerts
   - Dashboard metrics (CPU, memory, latency, error rates)
   - Alert names and severity
   - Log entries or error counts
   - Performance graphs or trends
   - Time ranges being investigated

5. **Workflow & Actions**: Note what people are actually doing
   - Which files/logs are being viewed
   - What debugging steps are being taken
   - What deployments or changes are being made
   - What investigations or troubleshooting is happening

6. **Captions/Dialogue**: Include any visible captions for context
   - Technical discussions visible in captions
   - Questions being asked
   - Decisions being made

Format your response as:
**Technical Activity:**
- Tools/Apps: [List all visible applications and what they're showing]
- Commands/Queries: [Any visible commands, code, or queries - be specific]
- Infrastructure: [AWS accounts, resources, regions, environments]
- Metrics/Alerts: [Any visible numbers, graphs, alerts]
- Actions: [What the team is actively doing]

**Context/Dialogue:**
[Any visible captions or spoken context that explains the technical work]

**Summary:**
[Brief technical summary of what's being worked on, investigated, or deployed]`;

  const userPrompt = previousContext 
    ? `Previous context:\n${previousContext}\n\nAnalyze these new screenshots. Focus on NEW technical details, commands, resources, or changes not mentioned in previous context:`
    : `This is the first batch of screenshots. Perform a detailed technical analysis of this Google Meet call:`;
  
  messageContent.push({
    type: 'text',
    text: userPrompt
  });
  
  // Add all screenshot images
  screenshots.forEach((screenshot, idx) => {
    const match = screenshot.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2]
        }
      });
    }
  });
  
  const requestBody = {
      model: config.model || 'claude-haiku-4-5',
      max_tokens: config.maxTokens || 4000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    };
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      throw new Error(`Anthropic API error: HTTP ${response.status} - ${response.statusText}`);
    }
    const errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
    console.error('❌ Anthropic API Error Details:', {
      status: response.status,
      statusText: response.statusText,
      errorData: errorData
    });
    throw new Error(`Anthropic API: ${errorMessage}`);
  }
  
  const data = await response.json();
  const transcription = data.content?.[0]?.text || '';
  
  console.log('✅ Anthropic analysis complete:', {
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens
  });
  
  return {
    transcription,
    usage: data.usage,
    provider: 'anthropic',
    model: data.model
  };
}

async function analyzeWithOpenAI(screenshots, previousContext, config) {
  console.log(`🤖 Analyzing ${screenshots.length} screenshots with OpenAI`);
  
  const systemPrompt = `You are analyzing screenshots from a technical Google Meet call to document infrastructure work, debugging sessions, and technical activities.

FOCUS ON TECHNICAL DETAILS:
1. **Tools & Applications**: Identify ALL visible tools, dashboards, terminals, IDEs, browsers
   - Which AWS Console pages (EC2, RDS, CloudWatch, Lambda, etc.)
   - Which monitoring tools (Datadog, Grafana, New Relic, PagerDuty, etc.)
   - Which development tools (VS Code, terminals, Docker, Kubernetes dashboards)
   - Which collaboration tools (Jira, Confluence, Slack, GitHub)

2. **Commands & Code**: Extract any visible commands, queries, or code
   - Terminal commands (ssh, kubectl, aws cli, docker, etc.)
   - SQL queries or database operations
   - API endpoints or URLs being accessed
   - Error messages or stack traces
   - Configuration files or YAML/JSON visible

3. **Infrastructure Details**: Document specific resources and identifiers
   - AWS account IDs or account names visible
   - Resource IDs (instance IDs, RDS identifiers, Lambda names, etc.)
   - IP addresses, hostnames, domain names
   - Environment names (prod, staging, dev, etc.)
   - Region information (us-east-1, eu-west-1, etc.)

4. **Metrics & Data**: Capture visible numbers, graphs, alerts
   - Dashboard metrics (CPU, memory, latency, error rates)
   - Alert names and severity
   - Log entries or error counts
   - Performance graphs or trends
   - Time ranges being investigated

5. **Workflow & Actions**: Note what people are actually doing
   - Which files/logs are being viewed
   - What debugging steps are being taken
   - What deployments or changes are being made
   - What investigations or troubleshooting is happening

6. **Captions/Dialogue**: Include any visible captions for context
   - Technical discussions visible in captions
   - Questions being asked
   - Decisions being made

Format your response as:
**Technical Activity:**
- Tools/Apps: [List all visible applications and what they're showing]
- Commands/Queries: [Any visible commands, code, or queries - be specific]
- Infrastructure: [AWS accounts, resources, regions, environments]
- Metrics/Alerts: [Any visible numbers, graphs, alerts]
- Actions: [What the team is actively doing]

**Context/Dialogue:**
[Any visible captions or spoken context that explains the technical work]

**Summary:**
[Brief technical summary of what's being worked on, investigated, or deployed]`;

  const userPrompt = previousContext 
    ? `Previous context:\n${previousContext}\n\nAnalyze these new screenshots. Focus on NEW technical details, commands, resources, or changes not mentioned in previous context:`
    : `This is the first batch of screenshots. Perform a detailed technical analysis of this Google Meet call:`;
  
  // Build message content with multiple images
  const messageContent = [
    {
      type: 'text',
      text: userPrompt
    }
  ];
  
  // Add all screenshot images
  screenshots.forEach(screenshot => {
    messageContent.push({
      type: 'image_url',
      image_url: {
        url: screenshot.dataUrl,
        detail: 'low' // Use low detail for faster processing and lower cost
      }
    });
  });
  
  const requestBody = {
    model: config.model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: messageContent }
    ],
    max_completion_tokens: config.maxTokens || 4000
  };
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `OpenAI API error: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  const transcription = data.choices?.[0]?.message?.content || '';
  
  console.log('✅ OpenAI analysis complete:', {
    usage: data.usage
  });
  
  return {
    transcription,
    usage: data.usage,
    provider: 'openai',
    model: data.model
  };
}

