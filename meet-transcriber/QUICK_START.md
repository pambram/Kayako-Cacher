# 🚀 Quick Start Guide

## 30-Second Setup

1. **Get API Key**
   - Anthropic: https://console.anthropic.com/ → API Keys
   - OR OpenAI: https://platform.openai.com/ → API Keys

2. **Install Extension**
   ```
   chrome://extensions/ → Developer mode ON → Load unpacked → Select 'meet-transcriber' folder
   ```

3. **Configure**
   - Click extension icon
   - Paste API key
   - Click "Save Settings"

4. **Use**
   - Join Google Meet
   - Click "Start" in floating panel
   - Done! Watch transcript appear

## Default Settings (Recommended)

| Setting | Value | Why |
|---------|-------|-----|
| Provider | Anthropic | Better vision capabilities |
| Model | Claude 3.5 Sonnet | Best accuracy/cost balance |
| Capture Interval | 10 seconds | Good balance of context/cost |
| Batch Size | 6 screenshots | 60 seconds of context |
| Image Quality | 50% | Readable text, low cost |

## Cost per Meeting

- **1 hour meeting**: ~$0.09 (9 cents)
- **30 min meeting**: ~$0.045 (4.5 cents)

## Pro Tips

✅ **Enable Google Meet captions** for better accuracy
✅ **Keep Meet tab visible** (not minimized)
✅ **Drag the panel** to move it out of the way
✅ **Lower quality to 25%** if you want even cheaper (still works!)
✅ **Increase batch size** for more context (costs more though)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No transcript | Check API key, verify network, check browser console |
| Blank panel | Refresh Meet page, reload extension |
| High costs | Reduce quality, increase interval, decrease batch size |
| Missing text | Enable Meet captions, increase quality |

## Files Reference

- `INSTALL.md` - Detailed installation instructions
- `README.md` - Full documentation
- `TECHNICAL_NOTES.md` - Implementation details
- `PROJECT_SUMMARY.md` - What was built

---

**Need help?** Check the other docs or open browser console (F12) for error messages.

