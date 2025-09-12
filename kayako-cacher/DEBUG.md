# Debugging Kayako Pagination Cacher

## Console Access Points

### 1. **Background Script (Service Worker) Console**
- Go to `chrome://extensions/`
- Find "Kayako Pagination Cacher"
- Click "Details"
- Click "Inspect views: background page" (or "service worker")
- This opens DevTools for the background script

### 2. **Content Script Console**
- Open any Kayako page (`*.kayako.com/agent/*`)
- Press F12 to open DevTools
- Go to "Console" tab
- Content script logs appear here mixed with page logs

### 3. **Popup Script Console**
- Right-click the extension icon in Chrome toolbar
- Select "Inspect popup"
- This opens DevTools specifically for the popup

### 4. **Injected Script Console**
- Same as Content Script (on the Kayako page)
- Look for logs prefixed with "Kayako" or "Intercepted"

## What to Look For

### Background Script Logs:
```
Kayako Pagination Cacher service worker started
Configuration updated: {...}
Cleared X cache entries
```

### Content Script Logs:
```
Kayako Pagination Cacher initialized
Loaded config: {...}
API Request intercepted: ...
Cache hit for: ...
```

### Popup Logs:
```
Initializing Kayako Cacher popup
Loaded config: {...}
Settings saved
```

### Injected Script Logs:
```
Kayako Pagination Interceptor injected
Intercepted posts API call: ...
Modified limit from 30 to 100
```

## Common Debug Commands

### Check Extension State:
```javascript
// In popup console:
chrome.storage.local.get(null, console.log);

// In content script console:
window.kayakoLoadAllPosts();
```
