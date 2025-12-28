# Quick Installation Guide

## 1️⃣ Get Your API Key

Choose one provider:

### Option A: Anthropic Claude (Recommended)
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Option B: OpenAI GPT-4
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-`)

## 2️⃣ Install the Extension

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top right corner)
4. Click **"Load unpacked"**
5. Navigate to and select the `meet-transcriber` folder
6. The extension should now appear in your extensions list

## 3️⃣ Configure the Extension

1. Click the extension icon in your Chrome toolbar
2. Select your provider (Anthropic or OpenAI)
3. Paste your API key in the appropriate field
4. (Optional) Adjust other settings:
   - Capture interval: How often to take screenshots
   - Batch size: How many screenshots to analyze at once
   - Image quality: Lower = cheaper, higher = better accuracy
5. Click **"Save Settings"**

## 4️⃣ Use in Google Meet

1. Join any Google Meet call: https://meet.google.com/*
2. Look for the floating **"🎥 AI Transcriber"** panel (top-right corner)
3. Click **"Start"** to begin transcription
4. Watch the live transcript appear in real-time
5. Click **"Stop"** when done
6. Use **📋 Copy** or **💾 Download** to save the transcript

## 🎮 Tips

- **Drag the panel** to move it anywhere on screen
- **Click the `-` button** to minimize the panel
- **Enable captions in Google Meet** for better transcription accuracy
- **Larger batch sizes** provide more context but cost more
- **Lower image quality** saves money with minimal accuracy loss

## ⚠️ Troubleshooting

### Extension doesn't appear
- Make sure you loaded the correct folder
- Check that Developer mode is enabled
- Try reloading the extension

### No transcript appearing
- Verify your API key is correct
- Check that you have API credits
- Open browser console (F12) to check for errors
- Try refreshing the Meet page

### Screenshots not capturing
- Ensure Chrome has permission to access the tab
- Make sure the Meet tab is visible (not minimized)
- Check that you're on a valid Google Meet URL

## 💰 Expected Costs

With default settings (10s interval, 6 screenshots/batch):
- **Anthropic Claude 3.5 Sonnet**: ~$0.09 per hour
- **OpenAI GPT-4o**: ~$0.075 per hour

A typical 1-hour meeting costs less than 10 cents!

## 🔒 Privacy Notice

- Screenshots are sent to your chosen AI provider's API
- Images are deleted immediately after processing
- No permanent storage of screenshots
- Transcripts are stored locally in your browser only
- Always get consent before recording meetings

---

Need help? Check the full README.md for detailed documentation.

