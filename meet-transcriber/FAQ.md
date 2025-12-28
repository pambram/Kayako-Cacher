# Frequently Asked Questions (FAQ)

## 📸 Where are screenshots stored?

**Short answer: Nowhere permanently!**

Screenshots are **only stored in browser memory** temporarily:

1. **During capture**: Held in a JavaScript array (`screenshotBuffer`)
2. **During processing**: Sent to AI API via HTTPS
3. **After processing**: Immediately deleted to free memory

**Location in code:**
```javascript
// In content.js, line ~239
this.screenshotBuffer.push(screenshot);

// After successful API call, line ~299
this.screenshotBuffer = [];  // Cleared immediately
```

**What this means:**
- ✅ No files saved to disk
- ✅ No permanent storage
- ✅ Privacy-friendly
- ✅ Minimal memory usage
- ❌ Can't review screenshots later (only the transcript)

**If you want to verify:**
Open Chrome DevTools (F12) → Console → Type:
```javascript
// This won't work because screenshotBuffer is private to the extension
// But you can check browser memory usage in Chrome Task Manager (Shift+Esc)
```

---

## 📝 Where do I see the transcript?

The transcript appears in **three places**:

### 1. 🎮 Live Panel (Primary View)

When you're on a Google Meet page, look for the **floating purple panel** in the top-right corner:

```
┌─────────────────────────────┐
│ 🎥 AI Transcriber        [−]│
├─────────────────────────────┤
│ ● Recording...              │
│ ▶ Start  ⏹ Stop  🗑 Clear  │
│ Screenshots: 3              │
│ Batches: 2                  │
├─────────────────────────────┤
│ Live Transcript         📋💾│
│ ───────────────────────────│
│ [10:30 AM]                  │
│ **Summary:** Meeting about  │
│ Q4 planning...              │
│                             │
│ [10:31 AM]                  │
│ **Summary:** Discussion of  │
│ budget allocation...        │
└─────────────────────────────┘
```

### 2. 📋 Clipboard (Copy Button)

Click the **📋 Copy** button to copy formatted transcript:
```
[10:30:00 AM]
**Summary:** Meeting about Q4 planning...

[10:31:00 AM]  
**Summary:** Discussion of budget allocation...
```

### 3. 💾 Downloaded File (Download Button)

Click the **💾 Download** button to save as `.txt` file:
- Saved to your browser's Downloads folder
- Filename: `meet-transcript-YYYY-MM-DD.txt`
- Contains full formatted transcript with timestamps

**Example file content:**
```
Google Meet AI Transcription
============================

Generated: 12/28/2024, 10:35:00 AM

[10:30:00 AM]
**Summary:** Meeting about Q4 planning with the team discussing key objectives and deliverables for the quarter.

[10:31:00 AM]
**Summary:** Discussion of budget allocation and resource planning for upcoming projects.
```

---

## ▶️ How do I manually start/stop?

**Yes! The extension requires manual start/stop.**

### How to Use Controls:

1. **Join a Google Meet call**
   - Navigate to any `https://meet.google.com/*` URL
   - The floating panel appears automatically

2. **Start Recording**
   - Click the **"▶ Start"** button
   - Status changes to "● Recording..."
   - Screenshots begin capturing every 10 seconds
   - Transcript appears after first batch (60 seconds)

3. **Stop Recording**
   - Click the **"⏹ Stop"** button
   - Processing stops
   - Any remaining screenshots in buffer are processed
   - Status changes to "Stopped"

4. **Clear Transcript** (Optional)
   - Click the **"🗑 Clear"** button
   - Removes all transcript entries
   - Resets batch counter
   - Does NOT stop recording

### Button States:

| State | Start Button | Stop Button |
|-------|--------------|-------------|
| Initial | ✅ Enabled | ❌ Disabled |
| Recording | ❌ Disabled | ✅ Enabled |
| Stopped | ✅ Enabled | ❌ Disabled |

### What Happens Automatically:

- ✅ Panel appears when you load Google Meet
- ✅ Screenshots capture at interval (after you click Start)
- ✅ Batches process when size reached
- ✅ Transcript updates in real-time
- ❌ Does NOT auto-start recording
- ❌ Does NOT auto-stop recording

---

## 🎯 How do I choose which tab to monitor?

**Current Limitation: Only the active/visible tab is captured.**

### How It Currently Works:

The extension uses `chrome.tabs.captureVisibleTab()` which means:

**✅ WILL WORK:**
- Google Meet tab is the **active tab** (currently viewing it)
- Tab is **visible** (not minimized, not covered)
- Tab is in the **foreground**

**❌ WON'T WORK:**
- Meet tab is in background (another tab selected)
- Browser window is minimized
- Tab is covered by another window
- Meet is in different Chrome window (not active)

### Workaround #1: Single Meet Tab

**Best practice for now:**
1. Keep only ONE Google Meet tab open
2. Keep that tab **active and visible**
3. Don't switch tabs while recording
4. Use a second monitor if you need to work while recording

### Workaround #2: Multiple Windows

If you need to work while recording:
1. Open Meet in **Window 1** (keep visible)
2. Open your work in **Window 2**
3. Position windows side-by-side
4. Record continues as long as Meet window stays visible

### Workaround #3: Use Picture-in-Picture

1. In Google Meet, click the three dots (⋮)
2. Select "Picture in Picture"
3. Float the Meet window on top
4. Work in other tabs (Meet stays visible)

**Note:** Extension will still capture the full Meet tab, not just PiP window.

### Future Enhancement: Tab Selection

To properly support multiple tabs, we would need to add:

**Option A: Tab Picker (User Selection)**
```
┌─────────────────────────────┐
│ Select Google Meet Tab:     │
│ ○ Tab 1: Daily Standup      │
│ ● Tab 2: Client Meeting     │ ← User selects this
│ ○ Tab 3: Team Review        │
│ [Select Tab]                │
└─────────────────────────────┘
```

**Option B: This Tab Only (Automatic)**
```javascript
// Record ONLY the current tab (where panel is shown)
// Even if you switch to another tab
// Would require tracking tab ID and using chrome.tabs.captureTab(tabId)
```

### Why This Limitation Exists:

Chrome's security model:
- `captureVisibleTab()` = Easy to use, only captures what user sees
- `captureTab(tabId)` = Requires additional permissions, can capture background tabs
- We chose simplicity + security over flexibility

### Request Enhancement:

If you need multi-tab support, I can add it! Would you like me to:
1. Add a tab selector dropdown to the control panel?
2. Make it capture "this tab only" regardless of visibility?
3. Support multiple concurrent recordings?

---

## 🔍 How do I know it's working?

### Visual Indicators:

1. **Status Dot:**
   - ⚪ Gray = Idle/Stopped
   - 🔴 Red (pulsing) = Recording
   - 🟠 Orange (pulsing) = Processing/Analyzing

2. **Screenshot Counter:**
   - Increments: 0 → 1 → 2 → 3 → 4 → 5 → 6
   - Then resets to 0 after batch processes

3. **Batch Counter:**
   - Increments after each successful AI analysis
   - Shows how many batches have been processed

4. **Transcript Appears:**
   - After ~60 seconds (first batch)
   - New entries appear every 60 seconds
   - Auto-scrolls to latest

### Console Verification:

Open Chrome DevTools (F12) → Console tab:

```
✅ Meet Transcriber initialized successfully
▶️ Recording started
📸 Screenshot captured (1/6)
📸 Screenshot captured (2/6)
...
📸 Screenshot captured (6/6)
🤖 Analyzing 6 screenshots with Anthropic Claude
✅ Screenshots analyzed successfully
```

**If you see errors:**
```
❌ Error capturing screenshot: ...
❌ Analysis failed: ...
```
Check your API key and network connection.

---

## 🤔 Common Issues

### Issue: Panel doesn't appear

**Solutions:**
1. Verify you're on `https://meet.google.com/*` (not other video platforms)
2. Refresh the Meet page (F5)
3. Check extension is enabled in `chrome://extensions/`
4. Look for console errors (F12)

### Issue: No screenshots captured

**Solutions:**
1. Tab must be **visible and active**
2. Grant tab capture permission if prompted
3. Check browser console for errors
4. Try reloading extension

### Issue: No transcript appearing

**Solutions:**
1. Verify API key is correct in settings
2. Check you have API credits (check provider dashboard)
3. Wait full 60 seconds for first batch
4. Check browser console for API errors
5. Try enabling Meet's auto-captions for better results

### Issue: Transcript is empty/generic

**Solutions:**
1. **Enable Google Meet captions** (Settings → Captions)
2. Make sure people are speaking
3. Share screen with text/presentations for AI to read
4. Increase image quality in settings
5. Check that Meet window is clearly visible (not tiny)

---

## 💡 Pro Tips

1. **Always enable Meet captions** for best transcription
2. **Use lower quality (25%)** to save money (still works!)
3. **Drag the panel** out of the way so it doesn't cover speakers
4. **Minimize the panel** (click `-`) to save screen space
5. **Copy transcript periodically** as backup during long meetings
6. **Keep tab visible** - don't minimize or switch tabs
7. **Check console logs** if something seems wrong

---

## 🆘 Still Need Help?

1. Check `README.md` for full documentation
2. Check `TECHNICAL_NOTES.md` for implementation details
3. Open browser console (F12) and look for error messages
4. Verify your API key works by testing in settings popup
5. Try with a simple test: Join Meet alone, enable captions, speak clearly

---

**Last Updated:** December 28, 2025
**Version:** 1.0.0

