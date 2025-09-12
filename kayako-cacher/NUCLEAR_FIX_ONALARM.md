# 🚨 NUCLEAR FIX for onAlarm Error

Chrome's service worker cache is EXTREMELY stubborn. Here's the nuclear approach:

## 🔥 STEP 1: Manual Service Worker Cleanup

### 1A: Clear Service Workers Manually
```bash
1. Open: chrome://serviceworker-internals/
2. Look for ANY entries containing:
   - "kayako"
   - "pagination"  
   - "cacher"
   - Or ANY chrome-extension URLs
3. Click "Unregister" on ALL of them
4. Click "Stop" on any running ones
5. Refresh the page and verify they're gone
```

### 1B: Clear All Extension Data
```bash
1. Go to: chrome://settings/content/all
2. Search for: "chrome-extension"
3. Delete ALL extension-related entries
4. Go to: chrome://settings/clearBrowserData
5. Select "Advanced" → "All time" 
6. Check: Cookies, Cache, Site data
7. Click "Clear data"
```

## 🔥 STEP 2: Complete Chrome Restart
```bash
1. Close ALL Chrome windows completely
2. On Mac: Quit Chrome (Cmd+Q)
3. On Windows: End all chrome.exe processes in Task Manager
4. Wait 10 seconds
5. Restart Chrome
```

## 🔥 STEP 3: Install v3 (New Filename)
```bash
1. Go to chrome://extensions/
2. Remove ANY existing Kayako extensions
3. Load unpacked → select kayako-cacher folder
4. You should see "Kayako Pagination Cacher v3" (version 3.0.0)
5. The service worker file is now "background-v3.js" (new filename!)
```

## 🔥 STEP 4: Verify Nuclear Success
```bash
1. Click "Inspect views: service worker" on the v3 extension
2. Console should show:
   "🚀 Kayako Pagination Cacher v3.0 service worker started - NUCLEAR CLEAN INSTALL"
3. ZERO errors should appear!
```

## 🆘 If STILL Getting onAlarm Error:

### Last Resort Options:

#### Option A: Different Chrome Profile
```bash
1. Create completely new Chrome profile
2. Install extension there
3. Test if it works in fresh profile
```

#### Option B: Chrome Canary/Dev Channel
```bash
1. Install Chrome Canary or Chrome Dev
2. Test extension there
```

#### Option C: Manual Code Inspection
```bash
1. Open: chrome://extensions/
2. Click "Details" on v3 extension
3. Click "Inspect views: service worker"
4. Go to "Sources" tab
5. Look at the loaded background-v3.js
6. Verify it contains v3.0 code and NO alarms references
```

## What Changed in v3.0:
- ✅ **New filename**: `background-v3.js` (forces new file load)
- ✅ **Version 3.0.0**: Even more aggressive version bump
- ✅ **New extension name**: "Kayako Pagination Cacher v3"
- ✅ **Nuclear clean message**: Clear indication of fresh start

## Expected Success:
```
🚀 Kayako Pagination Cacher v3.0 service worker started - NUCLEAR CLEAN INSTALL
📦 Kayako Pagination Cacher extension installed
✅ Default configuration set
✅ Background script loaded successfully
```

**This combination of service worker cleanup + new filename + version bump + Chrome restart should eliminate the onAlarm error!**

If this doesn't work, the issue might be deeper in Chrome's internals and we may need to investigate other approaches.
