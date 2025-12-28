# Google Meet AI Transcriber

A Chrome extension that provides AI-powered visual transcription for Google Meet calls using screenshot analysis and large language models.

## 🎯 Features

- **📸 Automatic Screenshot Capture**: Takes screenshots of your Google Meet call every 10 seconds (configurable)
- **🤖 AI-Powered Analysis**: Uses OpenAI GPT-4 or Anthropic Claude to analyze screenshots and generate transcriptions
- **📝 Live Transcription**: Shows real-time transcript updates in a floating control panel
- **🎛️ Customizable Settings**: Adjust capture interval, batch size, and image quality
- **💾 Export Options**: Copy or download transcripts for later reference
- **🔒 Privacy-Focused**: Screenshots are processed by AI and immediately deleted - nothing is stored permanently
- **⚡ Efficient**: Low-quality JPEG screenshots minimize bandwidth and API costs

## 🚀 How It Works

1. The extension monitors your Google Meet tab
2. Every X seconds (configurable, default 10s), it captures a screenshot
3. When it collects a batch of screenshots (default 6 = 60 seconds), it sends them to your chosen AI provider
4. The AI analyzes the screenshots to identify:
   - Visible speakers and dialogue (from captions/subtitles)
   - Screen shares and presentations
   - Join/leave events
   - Chat messages
   - Other visual elements
5. The transcript is displayed in real-time in a floating panel
6. After successful analysis, screenshots are deleted to free up resources

## 📋 Requirements

- Chrome browser (Manifest V3 compatible)
- API key from either:
  - **Anthropic** (Claude) - Recommended for better vision capabilities
  - **OpenAI** (GPT-4 with vision)

## 🔧 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `meet-transcriber` folder
6. Click the extension icon and configure your API key

## ⚙️ Configuration

### API Provider Settings

- **Provider**: Choose between Anthropic Claude or OpenAI GPT-4
- **API Key**: Enter your API key for the chosen provider
- **Model**: Select which AI model to use
  - Anthropic: Claude 3.5 Sonnet (recommended), Claude 3.5 Haiku, Claude 3 Opus
  - OpenAI: GPT-4o (recommended), GPT-4o Mini, GPT-4 Turbo

### Capture Settings

- **Capture Interval**: How often to take screenshots (5-30 seconds, default 10s)
- **Batch Size**: How many screenshots to analyze at once (3-12, default 6)
  - Larger batches = more context but higher API costs
  - Smaller batches = faster updates but less context
- **Image Quality**: JPEG compression quality (10%-100%, default 50%)
  - Lower quality = less bandwidth/storage but may miss details
  - Higher quality = better accuracy but higher costs

## 🎮 Usage

1. Join a Google Meet call
2. Look for the floating "🎥 AI Transcriber" panel in the top-right corner
3. Click **Start** to begin recording
4. Watch the live transcript appear in the panel
5. Click **Stop** when done
6. Use **Copy** or **Download** to save the transcript

### Control Panel Features

- **Status Indicator**: Shows recording/processing status
- **Screenshot Counter**: Current screenshots in buffer
- **Batch Counter**: Number of batches processed
- **Live Transcript**: Scrollable view of transcription
- **Draggable**: Move the panel anywhere on screen
- **Minimizable**: Click `-` to collapse the panel

## 💰 Cost Considerations

### Anthropic Claude 3.5 Sonnet (Recommended)
- Input: ~$3 per 1M tokens
- 6 screenshots at low quality ≈ 0.05M tokens
- **Cost per batch**: ~$0.015 (1.5 cents)
- **Cost per hour**: ~$0.09 (9 cents)

### OpenAI GPT-4o
- Input: ~$2.50 per 1M tokens (vision)
- 6 screenshots at low detail ≈ 0.05M tokens
- **Cost per batch**: ~$0.0125 (1.25 cents)
- **Cost per hour**: ~$0.075 (7.5 cents)

*Costs are approximate and may vary based on actual token usage*

## 🔒 Privacy & Security

- ✅ Screenshots are processed by your chosen AI provider's API
- ✅ Screenshots are immediately deleted after processing
- ✅ No permanent storage of images
- ✅ Transcripts are stored locally in your browser only
- ⚠️ AI providers may temporarily process/log API requests per their policies
- ⚠️ Use responsibly and ensure you have permission to record meetings

## 🛠️ Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Background Service Worker**: Handles API calls and screenshot processing
- **Content Script**: Monitors Meet page and manages UI
- **Tab Capture API**: Captures visible tab screenshots
- **Chrome Storage API**: Persists configuration

### Screenshot Format

- Format: JPEG (configurable to WebP)
- Quality: 50% default (configurable 10%-100%)
- Resolution: Full viewport at time of capture
- Encoding: Base64 data URLs

### API Integration

- Supports both OpenAI and Anthropic APIs
- Handles image encoding for both providers
- Automatic error handling and retry logic
- Incremental context passing for better continuity

## 📝 Limitations

- Only works on Google Meet (https://meet.google.com/*)
- Requires active tab visibility for screenshot capture
- AI analysis depends on quality of captions/visual elements
- Cannot hear audio directly (relies on visual cues only)
- May miss rapid conversations without visible captions

## 🔮 Future Enhancements

- [ ] Audio capture integration (via Tab Capture API)
- [ ] Whisper API for actual audio transcription
- [ ] Speaker identification
- [ ] Real-time streaming analysis
- [ ] Multi-language support
- [ ] Export to various formats (PDF, DOCX, etc.)
- [ ] Meeting summary generation
- [ ] Action item extraction

## 🐛 Troubleshooting

### Extension doesn't load
- Make sure you're on a Google Meet page (https://meet.google.com/*)
- Check browser console for errors (F12)
- Try reloading the extension from chrome://extensions/

### No transcript appearing
- Verify your API key is correct in settings
- Check network tab for API errors
- Ensure you have sufficient API credits
- Try reducing image quality if timeouts occur

### Screenshots not capturing
- Grant permission when Chrome asks for tab access
- Check that the tab is visible (not minimized)
- Try refreshing the Meet page

## 📄 License

MIT License - feel free to modify and use as needed

## 🙏 Credits

Built with:
- OpenAI GPT-4 Vision API
- Anthropic Claude Vision API
- Chrome Extensions API
- Modern web technologies

---

**Disclaimer**: This tool is for personal use and educational purposes. Always obtain proper consent before recording or transcribing meetings. Be aware of your organization's policies and local laws regarding recording.

