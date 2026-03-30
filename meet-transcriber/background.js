// Google Meet AI Transcriber - Background Service Worker

const DEFAULT_CONFIG = {
  provider: 'anthropic',
  openaiKey: '',
  anthropicKey: '',
  model: 'claude-haiku-4-5',
  summaryModel: 'claude-sonnet-4-6',
  tldrModel: 'claude-opus-4-6',
  storyArcModel: 'claude-opus-4-6',
  bulletPointsModel: 'claude-opus-4-6',
  enabled: true,
  captureInterval: 10, // seconds
  batchSize: 6, // screenshots (60 seconds worth at 10s interval)
  imageQuality: 0.5, // JPEG quality (0-1)
  imageFormat: 'jpeg', // 'jpeg' or 'webp'
  technicalMode: true, // Ultra-verbose technical documentation mode
  maxTokens: 4000, // Increased from 2000 for more detailed output
  // Meta-analysis settings
  enableMetaAnalysis: true, // Enable periodic summary generation
  metaAnalysisInterval: 5, // Generate summary every N batches
  metaAnalysisWindow: 5, // Minutes of transcript to analyze
  // S3 upload settings (serverless - no credentials needed)
  s3UploadEndpoint: 'https://623peylizt4pa4hjiwsfcvh56m0bwkgn.lambda-url.us-east-1.on.aws/',
  // KT screenshot classifier settings
  enableScreenshotClassifier: false,
  screenshotClassifierModel: 'claude-haiku-4-5',
  s3ScreenshotEndpoint: 'https://623peylizt4pa4hjiwsfcvh56m0bwkgn.lambda-url.us-east-1.on.aws/'
};

const KT_SCREENSHOT_CLASSIFIER_PROMPT = `You are a screenshot classifier for Knowledge Transfer (KT) meeting documentation.
You receive a batch of screenshots from a screen-sharing session along with the transcript
of what was discussed during this batch.

DECIDE: Does any screenshot in this batch show something that should be saved for documentation?

SAVE a screenshot if it shows:
- A system interface, dashboard, or admin panel being demonstrated
- Architecture diagrams, workflow diagrams, or process flows
- Code being walked through or explained
- Configuration screens, settings, or infrastructure views
- Error messages, log outputs, or debugging sessions
- Database schemas, API responses, or data structures
- Any visual that would help someone understand the system being transferred

DO NOT SAVE if the batch only shows:
- Google Meet participant tiles / video feeds
- Generic web pages with no technical content
- The AI Transcriber panel itself
- Blurry, transitional, or duplicate views of already-captured content

Select at most ONE screenshot from the batch -- the clearest, most informative one.

Respond with JSON only: {"save": true/false, "index": N, "reason": "one line"}`;

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Google Meet AI Transcriber installed/updated');
  
  const result = await chrome.storage.local.get(['meetTranscriberConfig']);
  const existingConfig = result.meetTranscriberConfig;
  
  // Force update if old config exists with wrong model names or missing new fields
  const needsMigration = !existingConfig || 
      existingConfig.model === 'claude-3-5-sonnet-latest' || 
      existingConfig.model === 'claude-3-5-haiku-latest' ||
      existingConfig.model === 'claude-4-5-haiku' ||
      !existingConfig.summaryModel ||
      !existingConfig.tldrModel ||
      !existingConfig.storyArcModel ||
      !existingConfig.bulletPointsModel ||
      existingConfig.enableScreenshotClassifier === undefined ||
      !Object.prototype.hasOwnProperty.call(existingConfig, 'screenshotClassifierModel') ||
      !Object.prototype.hasOwnProperty.call(existingConfig, 's3ScreenshotEndpoint');

  if (needsMigration && existingConfig) {
    console.log('Updating configuration with new defaults');
    const modelFix = (existingConfig.model === 'claude-3-5-sonnet-latest' || 
                      existingConfig.model === 'claude-3-5-haiku-latest' ||
                      existingConfig.model === 'claude-4-5-haiku')
      ? { model: DEFAULT_CONFIG.model } : {};
    await chrome.storage.local.set({
      meetTranscriberConfig: { ...DEFAULT_CONFIG, ...existingConfig, ...modelFix }
    });
    console.log('Configuration migrated');
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
    
    case 'generateMetaSummary':
      handleGenerateMetaSummary(request.transcripts, request.timeWindow, sendResponse);
      return true;
    
    case 'uploadToS3':
      handleUploadToS3(request.transcript, request.meetUrl, sendResponse);
      return true;

    case 'classifyScreenshot':
      handleClassifyScreenshot(request, sendResponse);
      return true;

    case 'generateTldr':
      startTldrTask(request.sessionId, request.fullTranscript);
      sendResponse({ success: true, started: true });
      return true;

    case 'generateStoryArc':
      startStoryArcTask(request.sessionId, request.batches);
      sendResponse({ success: true, started: true });
      return true;

    case 'generateBulletPoints':
      startBulletPointsTask(request.sessionId, request.fullTranscript);
      sendResponse({ success: true, started: true });
      return true;

    case 'cancelTask':
      cancelTask(request.taskKey);
      sendResponse({ success: true });
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
    const cfgResult = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = cfgResult.meetTranscriberConfig || DEFAULT_CONFIG;
    const imageFormat = config.imageFormat === 'webp' ? 'png' : 'jpeg';
    const qualityPercent = Math.max(10, Math.min(100, Math.round((config.imageQuality ?? 0.5) * 100)));

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
    
    // ONLY capture if Meet tab is already active/visible
    // DO NOT switch tabs automatically
    if (!meetTab.active) {
      sendResponse({ 
        success: false, 
        error: 'Meet tab not currently visible - skipping capture',
        skipNotification: true // Don't show error to user
      });
      return;
    }
    
    // Capture the currently active Meet tab (no tab switching)
    const dataUrl = await chrome.tabs.captureVisibleTab(meetTab.windowId, {
      format: imageFormat,
      quality: qualityPercent
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
    `You are analyzing screenshots from a Google Meet call to document technical work.

CRITICAL RULES:
- IGNORE the AI Transcriber panel itself (the purple panel on the right) - DO NOT document it
- ONLY document the actual screen content being shared/viewed
- If nothing technical is visible, respond with "No significant technical activity visible"
- Be FACTUAL - no speculation, no narrative, no severity assessments
- Extract visible text, commands, metrics EXACTLY as shown

YOUR MISSION: Extract technical details with precision:

**TEXT EXTRACTION (OCR Focus):**
- IGNORE the AI Transcriber UI panel - focus on actual work being shown
- Read visible text in terminals, dashboards, browsers, IDEs
- Extract complete command lines verbatim
- Capture exact error messages word-for-word
- Read metric values, timestamps, percentages exactly as shown
- Extract URLs, file paths, hostnames completely
- Note visible JSON, YAML, code snippets verbatim
- If screen is mostly just Google Meet participant tiles, say "No screen share visible"

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

STRICT RULES:
- DO NOT document the AI Transcriber panel (purple panel with "Recording", "Screenshots", "Batches")
- DO NOT make up narratives about "critical incidents" or "escalations"
- DO NOT speculate about severity or impact
- ONLY report what is literally visible on screen
- If nothing interesting is visible, say "No significant technical activity"

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
    : `You are analyzing screenshots from a Google Meet call to document technical work.

STRICT RULES:
- IGNORE the AI Transcriber panel (purple/blue panel on screen) - DO NOT document it
- ONLY document actual work being shown (terminals, dashboards, code, browsers)
- If nothing technical is visible, say "No significant technical activity visible"
- Be factual - no speculation or narratives

FOCUS ON:
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

// Generate meta-analysis summary from recent transcripts
async function handleGenerateMetaSummary(transcripts, timeWindow, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = result.meetTranscriberConfig || DEFAULT_CONFIG;
    
    if (!config.enableMetaAnalysis) {
      sendResponse({ success: false, error: 'Meta-analysis is disabled' });
      return;
    }
    
    console.log(`📊 Generating meta-summary for ${transcripts.length} transcripts (${timeWindow}min window)`);
    
    const metaPrompt = `You are summarizing technical meeting activity from recent transcript logs.

TIME WINDOW: Last ${timeWindow} minutes

STRICT RULES:
- IGNORE anything about "AI Transcriber", "Batches", "Screenshots", "Recording status"
- ONLY extract actual technical work performed
- If nothing technical happened, say "No significant technical activity in this window"
- Be FACTUAL - no speculation, no severity assessments, no narratives

EXTRACT:
- Commands executed (verbatim)
- Metrics/values observed (exact numbers)
- Resources accessed (AWS accounts, services, specific IDs)
- Errors/logs investigated (actual error messages)
- Changes made (deployments, configs, etc.)
- Findings from investigations (what was discovered)

FORMAT:
**Last ${timeWindow} Minutes**

🔧 **Actions & Findings:**
• [HH:MM] - [Factual observation with specific details]
• [HH:MM] - [Command/metric/resource/error - be specific]

If nothing technical: "No significant technical activity in this window"

Recent Transcripts:
${transcripts.map((t, i) => `\n--- Batch ${i + 1} (${new Date(t.timestamp).toLocaleTimeString()}) ---\n${t.content}`).join('\n\n')}`;

    let summary;
    
    const summaryModel = config.summaryModel || 'claude-sonnet-4-6';

    if (config.provider === 'anthropic' && config.anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: summaryModel,
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: metaPrompt
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      summary = data.content?.[0]?.text || '';
    } else if (config.provider === 'openai' && config.openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o',
          messages: [{
            role: 'user',
            content: metaPrompt
          }],
          max_completion_tokens: 2000
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      summary = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error('No API key configured');
    }
    
    console.log('✅ Meta-summary generated');
    sendResponse({ success: true, summary });
  } catch (error) {
    console.error('❌ Error generating meta-summary:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// --- Background task management (survives popup close) ---

const activeTasks = {};
const MAX_SINGLE_SUMMARY_INPUT_TOKENS = 200000;
const MAP_REDUCE_CHUNK_TOKENS = 100000;

function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function chunkTranscriptByApproxTokens(text, chunkTokenBudget = MAP_REDUCE_CHUNK_TOKENS) {
  const lines = String(text || '').split('\n');
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokenCount(`${line}\n`);
    if (current.length && currentTokens + lineTokens > chunkTokenBudget) {
      chunks.push(current.join('\n'));
      current = [line];
      currentTokens = lineTokens;
    } else {
      current.push(line);
      currentTokens += lineTokens;
    }
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks.length ? chunks : [''];
}
const KEEPALIVE_ALARM = 'task-keepalive';

/** Start a periodic alarm to keep the service worker alive during long tasks */
function startKeepalive() {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
}

function stopKeepaliveIfIdle() {
  if (Object.keys(activeTasks).length === 0) {
    chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    console.log('⏰ Keepalive tick — active tasks:', Object.keys(activeTasks).length);
    if (Object.keys(activeTasks).length === 0) {
      resumeInterruptedTasks();
      stopKeepaliveIfIdle();
    }
  }
});

/** Update task progress in chrome.storage.local */
async function setTaskStatus(taskKey, status) {
  const result = await chrome.storage.local.get(['meetTranscriberTasks']);
  const tasks = result.meetTranscriberTasks || {};
  tasks[taskKey] = { ...tasks[taskKey], ...status, updatedAt: Date.now() };
  await chrome.storage.local.set({ meetTranscriberTasks: tasks });
}

async function clearTaskStatus(taskKey) {
  const result = await chrome.storage.local.get(['meetTranscriberTasks']);
  const tasks = result.meetTranscriberTasks || {};
  delete tasks[taskKey];
  await chrome.storage.local.set({ meetTranscriberTasks: tasks });
}

function cancelTask(taskKey) {
  if (activeTasks[taskKey]) {
    activeTasks[taskKey].cancelled = true;
    delete activeTasks[taskKey];
  }
  clearTaskStatus(taskKey);
  stopKeepaliveIfIdle();
  console.log(`🚫 Task cancelled: ${taskKey}`);
}

/** Fire-and-forget TL;DR generation */
function startTldrTask(sessionId, fullTranscript) {
  const taskKey = sessionId + ':tldr';
  const handle = { cancelled: false };
  activeTasks[taskKey] = handle;
  startKeepalive();
  runTldrTask(taskKey, sessionId, fullTranscript, handle);
}

async function runTldrTask(taskKey, sessionId, fullTranscript, handle) {
  try {
    const estimatedTokens = estimateTokenCount(fullTranscript);
    const useMapReduce = estimatedTokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS;
    const chunks = useMapReduce ? chunkTranscriptByApproxTokens(fullTranscript) : [fullTranscript];
    await setTaskStatus(taskKey, {
      type: 'tldr',
      sessionId,
      status: 'running',
      progress: 0,
      total: chunks.length,
      estimatedInputTokens: estimatedTokens,
      mode: useMapReduce ? 'map_reduce' : 'single_pass'
    });

    const cfgResult = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = cfgResult.meetTranscriberConfig || DEFAULT_CONFIG;

    if (!config.anthropicKey) throw new Error('Anthropic API key required');

    const tldrModel = config.tldrModel || 'claude-opus-4-6';
    console.log(`📝 TL;DR task started: ${taskKey} with ${tldrModel}`);

    let tldr = '';
    const tldrSystemPrompt = `You produce concise executive TL;DR summaries of technical meeting transcripts.

RULES:
- 3-5 bullet points maximum
- Cover the full timeline from start to finish: what happened, key decisions, action items, and any resolution or root cause identified
- If the issue was resolved, state who resolved it and how
- Be specific: use real resource names, commands, metrics from the transcript
- If nothing substantive happened, say so honestly
- No fluff, no filler, no repetition`;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const userPrompt = i === 0
        ? `Generate a TL;DR for this meeting transcript:\n\n${chunk}`
        : `<current_tldr>\n${tldr}\n</current_tldr>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the TL;DR by merging this new chunk. Ensure the final TL;DR reflects the complete resolution if one was found in later chunks. Do not drop resolution details when merging. Deduplicate; output only the updated TL;DR.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: tldrModel,
          max_tokens: 2000,
          system: tldrSystemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (handle.cancelled) return;

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      tldr = data.content?.[0]?.text || tldr;
      await setTaskStatus(taskKey, { progress: i + 1, total: chunks.length });
    }

    if (handle.cancelled) return;

    // Persist result into the session
    const sessResult = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = sessResult.meetTranscriptSessions || {};
    if (!sessions[sessionId]) sessions[sessionId] = {};
    sessions[sessionId].tldr = tldr;
    await chrome.storage.local.set({ meetTranscriptSessions: sessions });

    console.log(`✅ TL;DR task complete: ${taskKey}`);
  } catch (error) {
    if (handle.cancelled) return;
    console.error(`❌ TL;DR task failed: ${taskKey}`, error);
    await setTaskStatus(taskKey, { status: 'error', error: error.message });
    return;
  } finally {
    delete activeTasks[taskKey];
    stopKeepaliveIfIdle();
  }
  await clearTaskStatus(taskKey);
}

/** Fire-and-forget Bullet Points generation */
function startBulletPointsTask(sessionId, fullTranscript) {
  const taskKey = sessionId + ':bullets';
  const handle = { cancelled: false };
  activeTasks[taskKey] = handle;
  startKeepalive();
  runBulletPointsTask(taskKey, sessionId, fullTranscript, handle);
}

const BULLET_POINTS_PROMPT = `Convert this meeting transcript into a bulleted status update timeline.

FORMAT RULES:
- Group updates into 15-30 minute blocks. Do NOT create a separate block for every minute.
- Each block starts with a time range: "Update Time: ~HH:MM - HH:MM PM" (or a single approximate time if the block is short)
- Then the actual content as bullet points. Every content line MUST start with "- " (a dash and a space).
- Most recent updates appear first (reverse chronological)
- Each bullet: 1-2 lines, factual. Use specific names, resource IDs, error messages, commands, and technical details.
- Do not editorialize. No "interestingly" or "it's worth noting". Just facts.
- A 1-hour meeting should produce roughly 4-6 blocks, not 30+.
- Never repeat the same information across multiple time blocks. State each fact exactly once, at the time it first occurred. Consolidate and deduplicate.
- Ignore UI noise like meeting bot activity, transcription tool status, or modal popups.

<example>
Update Time: ~3:46 PM
- Started from an alarm monitor
- Robert Egglestone identified the root cause: daily certificate renewal cronjob on sslutil-rhel9-1.usw2.int.khorostech.com was not running
- Robert manually executed certbot renew; Nitin Manik confirmed the main domain certificate was restored
- Affected community URL: https://www.googlenestcommunity.com/
- Jira ticket: UA-17427
- Monitoring gap: multiple subdomains and stage instances not under certificate monitoring
- Nitin Manik committed to creating a TCR and a formal change request covering cron automation and monitoring expansion

Update Time: ~2:50 AM
- Ali Ahmad isolated the issue: the failure point is in message_dispatcher.Java where the "fire hose logic" creates messages for downstream services
- Last successful execution was 15 hours ago, aligning with the start of the outage

Update Time: ~12:15 AM
- Ingestion stoppage (~15 h) impacts only a subset of Khoros Community instances, originates upstream of the Gopher ECS service; ALBs confirmed healthy
- Applied four of five change requests under spread fast 15167
- Implemented rate-limiting WAF rules on Khoros Community endpoints
- Will escalate Community-to-Care ingestion investigation to DevOps (including Ranga)
</example>

Match this style precisely. Do not invent your own format.`;

async function runBulletPointsTask(taskKey, sessionId, fullTranscript, handle) {
  try {
    const estimatedTokens = estimateTokenCount(fullTranscript);
    const useMapReduce = estimatedTokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS;
    const chunks = useMapReduce ? chunkTranscriptByApproxTokens(fullTranscript) : [fullTranscript];
    await setTaskStatus(taskKey, {
      type: 'bullets',
      sessionId,
      status: 'running',
      progress: 0,
      total: chunks.length,
      estimatedInputTokens: estimatedTokens,
      mode: useMapReduce ? 'map_reduce' : 'single_pass'
    });

    const cfgResult = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = cfgResult.meetTranscriberConfig || DEFAULT_CONFIG;

    if (!config.anthropicKey) throw new Error('Anthropic API key required');

    const bpModel = config.bulletPointsModel || 'claude-opus-4-6';
    console.log(`📋 Bullet Points task started: ${taskKey} with ${bpModel}`);

    let bulletPoints = '';
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const userPrompt = i === 0
        ? `Convert this meeting transcript into status update bullet points:\n\n${chunk}`
        : `<current_bullets>\n${bulletPoints}\n</current_bullets>\n\n<new_chunk>\n${chunk}\n</new_chunk>\n\nUpdate the bullet-point status summary by incorporating new facts from the chunk while deduplicating repeated information. Output only the updated bullets.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: bpModel,
          max_tokens: 4000,
          system: BULLET_POINTS_PROMPT,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (handle.cancelled) return;

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      bulletPoints = data.content?.[0]?.text || bulletPoints;
      await setTaskStatus(taskKey, { progress: i + 1, total: chunks.length });
    }

    if (handle.cancelled) return;

    const sessResult = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = sessResult.meetTranscriptSessions || {};
    if (!sessions[sessionId]) sessions[sessionId] = {};
    sessions[sessionId].bulletPoints = bulletPoints;
    await chrome.storage.local.set({ meetTranscriptSessions: sessions });

    console.log(`✅ Bullet Points task complete: ${taskKey}`);
  } catch (error) {
    if (handle.cancelled) return;
    console.error(`❌ Bullet Points task failed: ${taskKey}`, error);
    await setTaskStatus(taskKey, { status: 'error', error: error.message });
    return;
  } finally {
    delete activeTasks[taskKey];
    stopKeepaliveIfIdle();
  }
  await clearTaskStatus(taskKey);
}

/** Fire-and-forget Story Arc generation (with pause/resume support) */
function startStoryArcTask(sessionId, batches) {
  const taskKey = sessionId + ':arc';
  if (activeTasks[taskKey]) return;
  const handle = { cancelled: false };
  activeTasks[taskKey] = handle;
  startKeepalive();
  runStoryArcTask(taskKey, sessionId, batches, handle);
}

const ARC_SYSTEM_PROMPT = `You write plain, direct recounts of meetings. Just what happened and why it mattered.

TARGET LENGTH:
- The final arc should have 6 to 10 sections total, regardless of meeting length.
- For a 30-minute meeting, that means broad sections. For a 2-hour meeting, each section covers more ground.
- Each section: 1-2 short paragraphs. The entire arc should fit on 1-2 pages.
- Section header format: "--- HH:MM AM/PM - HH:MM AM/PM ---" followed by a short bold title.

STYLE:
- Plain English. Short sentences. No em-dashes. No bullet lists. No italic asides.
- No "it's worth noting", "interestingly", "something to watch", or similar filler.
- Do not editorialize or speculate. State what happened.
- Paraphrase, do not quote verbatim. Exception: exact commands, error messages, resource IDs.
- Name people and tools only when relevant to the point being made.
- Do not list tools, apps, or recording software.

WHAT BELONGS: Decisions, problems found, ownership changes, pivots, technical specifics that matter.
WHAT DOES NOT BELONG: Meeting setup, small talk, tool inventories, screenshot metadata, filler.

PROGRESSIVE UPDATES:
- You will receive the arc so far inside <existing_arc> tags and new data inside <window> tags.
- As more data arrives, the arc should get DENSER, not longer. Fold new details into existing sections when the topic matches.
- Only start a new section when the meeting clearly shifts to a different subject.
- If the arc already has 8+ sections and new data fits an existing section, extend that section rather than adding another.
- Tighten or compress earlier sections if they are becoming too detailed relative to the whole.
- If the new window adds nothing, output the existing arc unchanged.
- Output ONLY the arc text. No XML tags, no labels, no meta-commentary.`;

/** Group raw batches into chunks by approximate token budget */
function groupBatchesIntoChunks(batches, chunkTokenBudget = MAP_REDUCE_CHUNK_TOKENS) {
  if (!batches || batches.length === 0) return [];
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;

  for (const batch of batches) {
    const batchText = `<window time="${new Date(batch.timestamp).toLocaleTimeString()}">\n${batch.content || ''}\n</window>\n`;
    const batchTokens = estimateTokenCount(batchText);
    if (currentChunk.length && currentTokens + batchTokens > chunkTokenBudget) {
      chunks.push(currentChunk);
      currentChunk = [batch];
      currentTokens = batchTokens;
    } else {
      currentChunk.push(batch);
      currentTokens += batchTokens;
    }
  }
  if (currentChunk.length) chunks.push(currentChunk);
  return chunks;
}

/** Format a chunk of batches into a single string for the LLM */
function formatChunk(chunk) {
  return chunk.map(b => {
    const t = new Date(b.timestamp).toLocaleTimeString();
    return `<window time="${t}">\n${b.content}\n</window>`;
  }).join('\n\n');
}

async function runStoryArcTask(taskKey, sessionId, batches, handle) {
  try {
    const chunks = groupBatchesIntoChunks(batches);
    const totalSteps = chunks.length;
    const estimatedInputTokens = estimateTokenCount(
      (batches || []).map((b) => `[${b.timestamp}]\n${b.content || ''}`).join('\n\n')
    );

    // Check for a checkpoint from a previous interrupted run
    const existingTaskResult = await chrome.storage.local.get(['meetTranscriberTasks']);
    const existingTask = (existingTaskResult.meetTranscriberTasks || {})[taskKey];
    let currentArc = '';
    let step = 0;

    if (existingTask?.checkpoint && existingTask.status === 'running') {
      currentArc = existingTask.checkpoint.currentArc || '';
      step = existingTask.checkpoint.nextChunkIndex || 0;
      console.log(`📖 Resuming story arc from chunk ${step}/${totalSteps}`);
    }

    await setTaskStatus(taskKey, {
      type: 'arc', sessionId, status: 'running',
      progress: step, total: totalSteps,
      estimatedInputTokens,
      mode: 'map_reduce',
      checkpoint: { currentArc, nextChunkIndex: step }
    });

    const cfgResult = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = cfgResult.meetTranscriberConfig || DEFAULT_CONFIG;

    if (!config.anthropicKey) throw new Error('Anthropic API key required');
    if (!batches || batches.length === 0) throw new Error('No batches available');

    const arcModel = config.storyArcModel || 'claude-opus-4-6';
    console.log(`📖 Story arc task ${step > 0 ? 'resumed' : 'started'}: ${taskKey} with ${arcModel}, ${batches.length} batches in ${totalSteps} chunks`);

    for (let c = step; c < totalSteps; c++) {
      if (handle.cancelled) return;

      const chunkWindows = formatChunk(chunks[c]);
      let userPrompt;

      if (c === 0) {
        userPrompt = `Write the opening of the story arc from these observation windows.\n\n${chunkWindows}`;
      } else {
        userPrompt = `<existing_arc>\n${currentArc}\n</existing_arc>\n\n${chunkWindows}\n\nOutput the updated arc. Fold new info into existing sections when the topic fits. Only add a new section if the subject clearly changed. Compress earlier sections if the arc is getting too long. Target: 6-10 sections total. Output only the arc text.`;
      }

      console.log(`📖 Story arc chunk ${c + 1}/${totalSteps} (${chunks[c].length} raw batches in this chunk)`);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: arcModel,
          max_tokens: 4000,
          system: ARC_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (handle.cancelled) return;

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      currentArc = data.content?.[0]?.text || currentArc;

      // Checkpoint after each chunk
      await setTaskStatus(taskKey, {
        progress: c + 1, total: totalSteps,
        checkpoint: { currentArc, nextChunkIndex: c + 1 }
      });
    }

    if (handle.cancelled) return;

    // Persist final result into the session
    const sessResult = await chrome.storage.local.get(['meetTranscriptSessions']);
    const sessions = sessResult.meetTranscriptSessions || {};
    if (!sessions[sessionId]) sessions[sessionId] = {};
    sessions[sessionId].storyArc = currentArc;
    await chrome.storage.local.set({ meetTranscriptSessions: sessions });

    console.log(`✅ Story arc task complete: ${taskKey}`);
  } catch (error) {
    if (handle.cancelled) return;
    console.error(`❌ Story arc task failed: ${taskKey}`, error);
    await setTaskStatus(taskKey, { status: 'error', error: error.message });
    return;
  } finally {
    delete activeTasks[taskKey];
    stopKeepaliveIfIdle();
  }
  await clearTaskStatus(taskKey);
}

/** Parse batches from a session's transcript text (fallback for resume) */
function parseBatchesFromTranscriptBg(transcript) {
  if (!transcript) return [];
  const batches = [];
  const lines = transcript.split('\n');
  let current = null;
  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]$/);
    if (match) {
      if (current && current.content.trim()) batches.push(current);
      current = { timestamp: match[1], content: '' };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line;
    }
  }
  if (current && current.content.trim()) batches.push(current);
  return batches;
}

/** Resume any interrupted story arc tasks on service worker startup */
async function resumeInterruptedTasks() {
  try {
    const [taskResult, sessResult] = await Promise.all([
      chrome.storage.local.get(['meetTranscriberTasks']),
      chrome.storage.local.get(['meetTranscriptSessions'])
    ]);
    const tasks = taskResult.meetTranscriberTasks || {};
    const sessions = sessResult.meetTranscriptSessions || {};

    for (const [taskKey, task] of Object.entries(tasks)) {
      if (task.status === 'running' && task.type === 'arc' && task.checkpoint && !activeTasks[taskKey]) {
        const session = sessions[task.sessionId];
        if (!session) { clearTaskStatus(taskKey); continue; }
        const batches = session.batches && session.batches.length > 0
          ? session.batches
          : parseBatchesFromTranscriptBg(session.transcript);
        if (batches.length === 0) { clearTaskStatus(taskKey); continue; }

        console.log(`📖 Auto-resuming interrupted task: ${taskKey}`);
        const handle = { cancelled: false };
        activeTasks[taskKey] = handle;
        startKeepalive();
        runStoryArcTask(taskKey, task.sessionId, batches, handle);
      }
    }
  } catch (error) {
    console.error('Error checking for interrupted tasks:', error);
  }
}

// Resume interrupted tasks when the service worker starts
resumeInterruptedTasks();

function extractMeetCodeFromUrl(meetUrl) {
  if (!meetUrl) return 'unknown';
  try {
    const parsed = new URL(meetUrl);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment || 'unknown';
  } catch (_error) {
    const parts = String(meetUrl).split('/');
    return (parts[parts.length - 1] || 'unknown').split('?')[0];
  }
}

function stripMarkdownCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function handleClassifyScreenshot(request, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = result.meetTranscriberConfig || DEFAULT_CONFIG;
    const screenshots = Array.isArray(request.screenshots) ? request.screenshots : [];
    const batchNumber = request.batchNumber || 0;
    console.log(
      `🧠 KT classifier start: batch #${batchNumber}, screenshots=${screenshots.length}, model=${config.screenshotClassifierModel || DEFAULT_CONFIG.screenshotClassifierModel}`
    );

    if (!config.enableScreenshotClassifier) {
      console.log(`🧠 KT classifier disabled. Skipping batch #${batchNumber}`);
      sendResponse({ success: true, selected: false, reason: 'Classifier disabled' });
      return;
    }
    const resolvedScreenshotEndpoint = config.s3ScreenshotEndpoint || config.s3UploadEndpoint || DEFAULT_CONFIG.s3ScreenshotEndpoint;
    if (!resolvedScreenshotEndpoint) {
      console.log(`🧠 KT classifier missing screenshot/upload endpoint. Skipping batch #${batchNumber}`);
      sendResponse({ success: true, selected: false, reason: 'Screenshot endpoint not configured' });
      return;
    }
    if (!config.anthropicKey) {
      sendResponse({ success: false, error: 'Anthropic API key required for screenshot classifier' });
      return;
    }

    if (!screenshots.length) {
      sendResponse({ success: true, selected: false, reason: 'No screenshots in batch' });
      return;
    }

    const messageContent = [];
    const userLines = [];
    if (request.meetingObjective) {
      userLines.push(`Meeting objective: ${request.meetingObjective}`);
      userLines.push('');
    }
    userLines.push(`Batch transcript:\n${request.transcript || ''}`);
    userLines.push('');
    userLines.push(`Batch number: ${request.batchNumber || 0}`);
    userLines.push(`Screenshot count: ${screenshots.length}`);
    userLines.push('Return JSON only.');

    messageContent.push({
      type: 'text',
      text: userLines.join('\n')
    });

    screenshots.forEach((screenshot, idx) => {
      const match = screenshot.dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        messageContent.push({
          type: 'text',
          text: `Screenshot index ${idx}`
        });
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.anthropicKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: config.screenshotClassifierModel || DEFAULT_CONFIG.screenshotClassifierModel,
        max_tokens: 300,
        system: KT_SCREENSHOT_CLASSIFIER_PROMPT,
        messages: [{
          role: 'user',
          content: messageContent
        }]
      })
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch (_e) {}
      throw new Error(errorData?.error?.message || `Classifier HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.find((item) => item.type === 'text')?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(stripMarkdownCodeFence(rawText));
    } catch (_error) {
      console.warn('Classifier returned non-JSON output:', rawText);
      sendResponse({ success: true, selected: false, reason: 'Classifier returned invalid JSON' });
      return;
    }

    const save = Boolean(parsed?.save);
    const index = Number(parsed?.index);
    const reason = parsed?.reason ? String(parsed.reason) : '';
    console.log(
      `🧠 KT classifier decision: batch #${batchNumber}, save=${save}, index=${index}, reason="${reason || 'n/a'}"`
    );
    if (!save || !Number.isInteger(index) || index < 0 || index >= screenshots.length) {
      sendResponse({ success: true, selected: false, reason: reason || 'No suitable screenshot' });
      return;
    }

    const imageUrl = await uploadScreenshotToS3(
      screenshots[index].dataUrl,
      extractMeetCodeFromUrl(request.meetUrl),
      request.batchNumber,
      config
    );
    console.log(`☁️ KT classifier uploaded screenshot: batch #${batchNumber}, index=${index}, url=${imageUrl}`);

    sendResponse({
      success: true,
      selected: true,
      imageUrl,
      reason,
      selectedIndex: index
    });
  } catch (error) {
    console.error('❌ Screenshot classifier failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function uploadScreenshotToS3(dataUrl, meetCode, batchNumber, config) {
  const endpoint = config.s3ScreenshotEndpoint || config.s3UploadEndpoint || DEFAULT_CONFIG.s3ScreenshotEndpoint;
  if (!endpoint) {
    throw new Error('Missing screenshot S3 endpoint');
  }
  console.log(`☁️ Requesting screenshot presigned URL: meetCode=${meetCode}, batch=${batchNumber}`);

  const tryPayloads = [
    { action: 'getImageUploadUrl', meetCode, batchNumber },
    { action: 'getUploadUrl', meetCode, batchNumber, fileType: 'image' }
  ];
  let uploadUrl = '';
  let downloadUrl = '';
  let lastError = null;
  for (const payload of tryPayloads) {
    try {
      const presignResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!presignResponse.ok) {
        const text = await presignResponse.text();
        throw new Error(`HTTP ${presignResponse.status} - ${text}`);
      }
      const parsed = await presignResponse.json();
      if (parsed?.uploadUrl && parsed?.downloadUrl) {
        uploadUrl = parsed.uploadUrl;
        downloadUrl = parsed.downloadUrl;
        break;
      }
      throw new Error('Response missing uploadUrl/downloadUrl');
    } catch (error) {
      lastError = error;
      console.warn(`Screenshot presign fallback failed for action=${payload.action}:`, error.message);
    }
  }
  if (!uploadUrl || !downloadUrl) {
    throw new Error(`Failed to get image upload URL: ${lastError?.message || 'unknown error'}`);
  }

  if (!uploadUrl || !downloadUrl) {
    throw new Error('Invalid screenshot upload response');
  }

  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid screenshot data URL');
  }

  const mime = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime || 'image/jpeg' });

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Image upload failed: ${uploadResponse.status} - ${text}`);
  }
  console.log(`☁️ Screenshot uploaded to S3 for batch ${batchNumber}`);

  return downloadUrl;
}

/** Upload transcript to S3 via serverless endpoint and return presigned URL */
async function handleUploadToS3(transcript, meetUrl, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['meetTranscriberConfig']);
    const config = result.meetTranscriberConfig || DEFAULT_CONFIG;
    
    const endpoint = config.s3UploadEndpoint || DEFAULT_CONFIG.s3UploadEndpoint;
    const meetCode = meetUrl ? meetUrl.split('/').pop().split('?')[0] : 'unknown';
    
    // Step 1: Get presigned URLs from Lambda
    console.log('☁️ Requesting presigned URLs from Lambda...');
    const presignResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetCode, action: 'getUploadUrl' })
    });
    
    if (!presignResponse.ok) {
      const errorText = await presignResponse.text();
      throw new Error(`Failed to get presigned URL: ${presignResponse.status} - ${errorText}`);
    }
    
    const { uploadUrl, downloadUrl, key } = await presignResponse.json();
    
    // Step 2: Upload directly to S3 using presigned PUT URL
    const content = `Google Meet AI Transcription\n============================\n\nMeet URL: ${meetUrl || 'N/A'}\nUploaded: ${new Date().toISOString()}\n\n${transcript}`;
    
    console.log('☁️ Uploading to S3...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`S3 upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    console.log('✅ Uploaded to S3:', key);
    sendResponse({ success: true, url: downloadUrl, key });
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    sendResponse({ success: false, error: error.message });
  }
}