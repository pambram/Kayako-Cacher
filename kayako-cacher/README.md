# Kayako Pagination Cacher

A Chrome extension that intercepts Kayako's API requests to increase pagination limits and cache responses for better performance.

## Features

### 🚀 **Enhanced Pagination**
- Automatically increases the pagination limit from 30 to 100+ posts per request
- Reduces the number of API calls when scrolling through ticket history
- Configurable limit settings (30, 50, 100, 200, or 500 posts per request)

### 💾 **Intelligent Caching**
- Caches API responses to avoid redundant network requests
- Persists cache across page reloads
- Configurable cache expiry (5 minutes to 24 hours)
- Automatic cleanup of expired cache entries

### ⚡ **Quick Actions**
- **Load All Posts**: Fetches and caches all posts for a ticket at once
- **Cache Management**: View cache statistics and clear cache when needed
- **Auto-preload**: Optionally preload all posts when visiting a ticket

### 📊 **Performance Monitoring**
- Real-time cache hit/miss statistics
- Cache size and entry count tracking
- Visual indicator showing extension activity

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the `kayako-cacher` folder
5. The extension icon will appear in your Chrome toolbar

## Usage

### Basic Operation
1. Navigate to any Kayako agent page with tickets
2. The extension automatically intercepts API requests and applies the configured settings
3. A small green indicator appears briefly to show the extension is active

### Configuration
1. Click the extension icon in Chrome toolbar
2. Adjust settings in the popup:
   - **Pagination limit**: Choose how many posts to fetch per request
   - **Enable caching**: Toggle response caching on/off
   - **Cache duration**: Set how long to keep cached data
   - **Auto-preload**: Automatically fetch all posts when visiting a ticket

### Manual Actions
- **Load All Posts**: Click this button to immediately fetch and cache all posts for the current ticket
- **Clear Cache**: Remove all cached data
- **View Statistics**: See cache performance metrics

## How It Works

### Request Interception
The extension injects a script into Kayako pages that intercepts `fetch()` calls to the posts API:
- Modifies the `limit` parameter from 30 to your configured value
- Checks cache before making network requests
- Stores successful responses for future use

### Caching Strategy
- **Cache Key**: Generated from case ID, pagination cursor, and request parameters
- **Storage**: Uses Chrome's local storage API for persistence
- **Expiry**: Time-based expiration with automatic cleanup
- **Size Management**: Configurable maximum cache size with LRU eviction

### Performance Benefits
- **Fewer API Calls**: Higher pagination limits mean fewer requests
- **Instant Loading**: Cached responses load instantly on page refresh
- **Bulk Loading**: Option to preload entire ticket history at once
- **Reduced Bandwidth**: Cached responses don't use network bandwidth

## Technical Details

### Files Structure
```
kayako-cacher/
├── manifest.json          # Extension manifest
├── background.js          # Service worker for configuration
├── content.js            # Main content script
├── inject.js             # Injected fetch interceptor
├── popup.html/css/js     # Extension popup interface
└── README.md             # This file
```

### Permissions
- `storage`: For caching responses and configuration
- `activeTab`: To inject scripts into active Kayako pages
- `scripting`: To inject the fetch interceptor
- `*://*.kayako.com/*`: Host permissions for all Kayako domains

### Compatibility
- **Chrome Version**: 88+ (Manifest V3)
- **Kayako**: All modern Kayako instances
- **URLs**: Works on `*://*.kayako.com/agent/*` pages

## Troubleshooting & Debugging

### 🐛 **Debug Console Access**

#### **Popup Console** (Settings not saving, button issues)
```bash
# Right-click extension icon → "Inspect popup" → Console tab
debugPopup.runAll()           # Test all popup functions
debugPopup.testConfigLoad()   # Test loading settings
debugPopup.testConfigSave()   # Test saving settings
```

#### **Content Script Console** (Load all posts stuck, caching issues)
```bash
# On Kayako page → Press F12 → Console tab
debugContent.runAll()         # Test all content functions  
debugContent.checkContentScript() # Check if extension loaded
window.kayakoLoadAllPosts()   # Manually trigger load all posts
```

#### **Background Script Console** (Extension not starting)
```bash
# chrome://extensions → Details → "Inspect views: service worker"
debugBackground.checkStorage() # Check configuration storage
chrome.storage.local.get('kayako_config', console.log) # Quick config check
```

### 🔧 **Common Issues**

#### **Settings Reset on Popup Close**
- **Symptom**: Options revert to default when reopening popup
- **Debug**: Open popup console, run `debugPopup.testConfigSave()`
- **Fix**: Check background script console for save errors

#### **"Load All Posts" Stuck in "Checking..."**
- **Symptom**: Button shows "⏳ Loading..." indefinitely  
- **Debug**: 
  1. Check you're on `*.kayako.com/agent/*/cases/*` page
  2. Content console: `debugContent.checkContentScript()`
  3. Popup console: `debugPopup.testLoadAllPosts()`
- **Common causes**: Not on ticket page, content script not loaded, permissions issue

#### **Extension Not Intercepting Requests**
- **Symptom**: Still seeing 30 posts per request instead of 100+
- **Debug**: Content console should show "Intercepted posts API call" messages
- **Fix**: Refresh the Kayako page, check content script loaded

#### **Cache Not Working**
- **Symptom**: No performance improvement on page reload
- **Debug**: `debugContent.checkStorage()` should show cache entries  
- **Fix**: Enable caching in popup settings, check storage permissions

### Extension Not Working
1. Check that you're on a Kayako agent page (`*.kayako.com/agent/*`)
2. Look for the green activity indicator (appears briefly)
3. Open browser console to check for error messages
4. Use debug utilities: Load `debug-test.js` in appropriate console

### Performance Issues
1. Reduce pagination limit if requests are timing out
2. Lower cache duration to free up storage
3. Use "Load All Posts" sparingly on very large tickets

## Development

### Local Development
1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon next to the extension
4. Test on a Kayako page

### Debug Console
- Background script: Go to extension details → "Inspect views: background page"
- Content script: Use browser DevTools on any Kayako page
- Popup: Right-click extension icon → "Inspect popup"

## Support

For issues, questions, or feature requests, please check:
1. Browser console for error messages
2. Extension popup for status information
3. The "Debug Info" section in Advanced Settings

---

**Made for better Kayako experience** 🎯

*This extension is not affiliated with or endorsed by Kayako.*
