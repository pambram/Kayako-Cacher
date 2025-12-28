# 🧪 Experimental Features - URL Fetching & Web Search

## Overview

Version 1.6.0 introduces two powerful experimental features to enhance the AI's capabilities:

1. **🔗 URL Fetching** - Automatically fetch and analyze content from URLs in your prompts
2. **🔍 Web Search** - Search the web using Tavily API when you need current information

## How It Works

### Intent Classification

When you submit a prompt, the AI automatically classifies it into one of four categories:

1. **CUSTOMER** - Standard customer reply
2. **ESCALATION** - Filling out escalation templates
3. **URL_FETCH** - Your prompt contains URLs that need to be analyzed
4. **WEB_SEARCH** - You're asking to search for information online

### URL Fetching

**When it activates:**
- You include URLs in your prompt
- The AI detects you need information FROM those URLs

**What happens:**
1. Chrome fetches the URL content
2. AI extracts relevant information based on your prompt (not the whole page!)
3. Extracted content is added to the context
4. Main AI call uses this enriched context

**Example prompts:**
- "Based on this documentation https://example.com/docs/api, write a reply"
- "Check this error log https://pastebin.com/xyz and help me troubleshoot"
- "Using the information from these URLs [url1, url2], create a summary"

### Web Search

**When it activates:**
- You explicitly ask to search, look up, or find information online
- Keywords: "search", "look up", "find information about", "search the web"

**What happens:**
1. Your prompt is sent to Tavily search API
2. Top 5 relevant results are fetched
3. Results include a quick answer + detailed snippets
4. Search results are added to the AI context
5. Main AI call uses this information to generate your response

**Example prompts:**
- "Search for the latest information about Python 3.12 features"
- "Look up troubleshooting steps for MySQL connection timeout"
- "Find documentation about JWT authentication best practices"

## Setup

### 1. Enable Features

Open the extension popup and expand **🧪 Experimental Features**:

- ✅ **Enable URL Fetching** - Toggle on to allow URL content retrieval
- ✅ **Enable Web Search** - Toggle on to allow web searches

### 2. Configure Tavily API (for Web Search only)

1. Get your free API key from [Tavily](https://tavily.com/)
2. Paste it in the "Tavily API Key" field
3. Click "Save Configuration"

**Note:** The current API key is pre-configured: `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`

## Technical Details

### Architecture

- **Direct API Calls** - No agent SDK, just direct HTTP fetch
- **AI-Guided Extraction** - Uses Haiku 4.5 or GPT-4o-mini to extract relevant content from fetched URLs
- **Prefetch Pattern** - Content is fetched BEFORE the main AI call
- **Smart Classification** - Haiku 4.5 performs fast intent classification

### Message Flow

```
User Prompt
    ↓
Classification (Haiku 4.5)
    ↓
[If URL_FETCH] → Fetch URLs → AI Extract Relevant Content
    ↓
[If WEB_SEARCH] → Tavily Search → Format Results
    ↓
Enrich Main Prompt with Prefetched Context
    ↓
Main AI Call (with enriched context)
    ↓
Display Result
```

### Performance Considerations

- **URL Fetching**: Adds ~1-3 seconds per URL (parallel fetching)
- **Web Search**: Adds ~2-4 seconds for Tavily API call
- **Token Usage**: Can significantly increase token usage depending on content length
- **Rate Limits**: Subject to Tavily API rate limits (check your plan)

## Limitations

### URL Fetching
- Limited to 10,000 characters per URL (truncated if longer)
- HTML content is stripped to text (no styling preserved)
- May fail on sites with anti-scraping measures
- CORS restrictions may apply
- No authentication support for protected URLs

### Web Search
- Limited to top 5 results
- Subject to Tavily API availability and limits
- Search quality depends on Tavily's algorithms
- No real-time data sources (stock prices, live scores, etc.)

## Troubleshooting

### URL Fetch Not Working

**Check:**
1. Is "Enable URL Fetching" toggled on?
2. Does your prompt actually contain a URL?
3. Is the URL publicly accessible?
4. Check browser console for fetch errors

**Common issues:**
- CORS blocked: Some sites block cross-origin requests
- 404/403 errors: URL not accessible or requires auth
- Timeout: Large pages may timeout

### Web Search Not Working

**Check:**
1. Is "Enable Web Search" toggled on?
2. Is Tavily API key configured?
3. Does your prompt explicitly ask to "search"?
4. Check browser console for API errors

**Common issues:**
- Invalid API key
- API rate limit exceeded
- Tavily service down
- Classification didn't detect search intent

## Examples

### Example 1: URL Analysis
```
Prompt: "Based on https://docs.python.org/3/library/asyncio.html, 
explain to the customer how to fix their async timeout issue"

Result: AI fetches Python docs → extracts async/timeout info → 
generates customer-friendly explanation
```

### Example 2: Web Search
```
Prompt: "Search for the latest Kubernetes security best practices 
and create a checklist for our customer"

Result: Tavily searches → finds top 5 articles → 
AI synthesizes into actionable checklist
```

### Example 3: Combined with Escalation
```
Prompt: "Search for known issues with MySQL 8.0.35 and create 
an escalation to Engineering"

Result: Web search → finds known bugs → 
fills escalation template with findings
```

## Best Practices

### For URL Fetching
- ✅ Use when you need specific info from a known URL
- ✅ Provide context in your prompt about WHAT to extract
- ✅ Keep URLs to publicly accessible pages
- ❌ Don't use for very long documents (will be truncated)
- ❌ Don't use for pages requiring login

### For Web Search
- ✅ Use for current information not in AI training data
- ✅ Be specific in your search query
- ✅ Use when you need multiple perspectives/sources
- ❌ Don't use for simple factual questions AI already knows
- ❌ Don't use for real-time data (use specialized APIs)

## Privacy & Security

- **URL Content**: Fetched through Chrome extension, not sent to third parties except AI for extraction
- **Search Queries**: Sent to Tavily API (see their privacy policy)
- **API Keys**: Stored locally in Chrome extension storage
- **No Logging**: Extension doesn't log URLs or search queries

## Future Enhancements

Potential improvements for future versions:
- [ ] Support for authenticated URLs
- [ ] PDF content extraction
- [ ] Image OCR from fetched pages
- [ ] Caching of fetched content
- [ ] Multiple search provider support (Google, Brave, etc.)
- [ ] Search result filtering/ranking
- [ ] Configurable max results count
- [ ] Parallel URL fetching optimization




