# 🚨 FORCE CHROME TO RELOAD EXTENSION (Fix onAlarm Error)

Chrome is stubbornly caching the old service worker. Here's how to FORCE a complete reload:

## Step 1: Nuclear Option - Complete Removal

### 1A: Remove Extension Completely
```bash
1. Go to chrome://extensions/
2. Find "Kayako Pagination Cacher" (or "Kayako Pagination Cacher v2")
3. Click "Remove" - DELETE IT COMPLETELY
4. Close ALL Chrome windows
5. Reopen Chrome
```

### 1B: Clear Extension Cache (Optional but Recommended)
```bash
1. Type in address bar: chrome://settings/content/all
2. Search for: "chrome-extension://"
3. Delete any entries related to Kayako
4. Or just clear all browsing data: chrome://settings/clearBrowserData
```

## Step 2: Fresh Install
```bash
1. Go to chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select your kayako-cacher folder
5. You should see "Kayako Pagination Cacher v2" (version 2.0.0)
```

## Step 3: Verify Success
```bash
1. Go to chrome://extensions/
2. Find "Kayako Pagination Cacher v2"
3. Click "Details" → "Inspect views: service worker"
4. In console, you should see:
   "🚀 Kayako Pagination Cacher v2.0 service worker started - FRESH INSTALL"
5. NO ERRORS should appear!
```

## If Still Getting onAlarm Error:

### Last Resort - Service Worker Reset
```bash
1. Open: chrome://serviceworker-internals/
2. Find any entries with "kayako" or "chrome-extension"
3. Click "Unregister" on all of them
4. Close Chrome completely
5. Reopen and reload extension
```

### Alternative - Try Different Browser Profile
```bash
1. Create new Chrome profile: chrome://settings/people
2. Install extension in fresh profile
3. Test there first
```

## What Changed in v2.0:
- ✅ Changed extension name to "Kayako Pagination Cacher v2"
- ✅ Version bumped to 2.0.0 (forces Chrome to see it as new)
- ✅ Clear startup message indicating fresh install
- ✅ Zero alarms API references anywhere in code

## Expected Success Message:
```
🚀 Kayako Pagination Cacher v2.0 service worker started - FRESH INSTALL
📦 Kayako Pagination Cacher extension installed
✅ Default configuration set
✅ Background script loaded successfully
```

This SHOULD eliminate the onAlarm error completely!
