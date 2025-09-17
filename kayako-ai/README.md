# Kayako AI Text Enhancer

AI-powered text enhancement extension for Kayako support platform, providing Gmail-like AI writing assistance directly in Kayako's Froala text editors.

## Features

- **AI-Powered Text Enhancement**: Similar to Gmail's Gemini features
  - ✨ **Polish**: Improve grammar and readability
  - 👔 **Formalize**: Make text more professional
  - 📝 **Elaborate**: Add more details and context  
  - ✂️ **Shorten**: Make text more concise

- **Seamless Integration**: Adds AI buttons directly to Froala editor toolbars
- **Multi-Domain Support**: Works across all Kayako-related domains
- **Configurable**: Easy setup with OpenAI API key
- **Real-time Processing**: Instant text enhancement with visual feedback

## Installation

1. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `kayako-ai` folder

2. Configure your OpenAI API key:
   - Click the extension icon in the toolbar
   - Enter your OpenAI API key (get one from [OpenAI Platform](https://platform.openai.com/api-keys))
   - Choose your preferred model (GPT-3.5 Turbo recommended for cost efficiency)
   - Click "Save Configuration"

3. Test the connection using the "Test Connection" button

## Usage

1. Navigate to any Kayako ticket reply or compose screen
2. Look for the **🤖 AI** button in the Froala editor toolbar
3. Type or select text in the editor
4. Click the **🤖 AI** button and choose an enhancement option:
   - **✨ Polish**: Improves grammar, clarity, and readability
   - **👔 Formalize**: Makes text more professional and business-appropriate
   - **📝 Elaborate**: Adds detail, context, and helpful information
   - **✂️ Shorten**: Condenses text while preserving key information

## Supported Domains

The extension works on the following Kayako-related domains:
- `*.kayako.com/agent/*`
- `*.gfi.com/agent/*`
- `*.aurea.com/agent/*`
- `*.ignitetech.com/agent/*`
- `*.crossover.com/agent/*`
- `*.totogi.com/agent/*`
- `*.alpha.school/agent/*`
- `*.cloudsense.com/agent/*`
- `*.kandy.io/agent/*`
- `dnnsupport.dnnsoftware.com/agent/*`
- `csai.trilogy.com/agent/*`

## Configuration Options

- **API Key**: Your OpenAI API key for text processing
- **Model**: Choose between GPT-3.5 Turbo, GPT-4, or GPT-4 Turbo
- **Enable/Disable**: Toggle the extension functionality
- **Connection Testing**: Verify your API configuration

## Privacy & Security

- API keys are stored locally in the browser
- Text is sent to OpenAI for processing according to their privacy policy
- No text is stored or logged by the extension
- All communications are encrypted via HTTPS

## Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Content Script**: Detects and enhances Froala editors
- **Background Service Worker**: Handles API communication and configuration
- **Popup Interface**: User-friendly configuration and status panel

## Development

Based on learnings from existing Kayako extensions:
- Uses similar domain patterns as `kayako-cacher` and `kayako-enhancer`
- Integrates with Froala editor selectors (`.fr-toolbar`, `.fr-element`)
- Follows Chrome extension best practices

## Version

1.0.1 - Fixed popup width and improved Kayako editor targeting
1.0.0 - Initial release

## License

This extension is designed for enhancing Kayako customer support workflows with AI assistance.
