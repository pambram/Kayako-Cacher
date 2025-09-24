# Kayako QoL Enhancer Chrome Extension

A comprehensive browser extension designed to enhance the agent experience in Kayako with smart editor auto-sizing, productivity improvements, and interface optimizations. Features include auto-expanding editors on focus, smart hyperlinking, timeline improvements, and much more. Take control of your workspace to fit your workflow.

## Features

This extension provides several ways to customize your Kayako experience:

1.  **Smart Editor Resizing**:
    * **Auto-Sizing**: Editors automatically grow to max height when focused and shrink to min height when blurred (with smooth animations)
    * **Popup Controls**:
        - Click the extension icon to open the control panel
        - Set specific dimensions for Main Editor and Side Conversation Editor
        - These settings are saved and will be used every time you load a page.
    * **Drag-to-Resize**:
        - You can resize the main editor or side conversation panel by dragging their edges.
        - Dragging immediately overrides all other size settings (including popup and Kayako's own defaults) for the current session.
        - For the side panel, this override ends when you leave the conversation or switch away from it (not just on refresh).
        - To change the persistent min/max limits, use the popup controls.

2.  **Timeline Customization**:
    * Toggle visibility of different timeline elements:
        - **Events**: Show/hide system events
        - **Internal Notes**: Toggle internal notes
        - **Date Separators**: Show/hide date dividers
    * **Enhanced Readability**: Automatically removes max-width constraints from timeline items for better reading experience
    * Note: Hiding many elements may affect infinite scroll. If content doesn't load, try showing elements, scrolling to load more, then re-hiding.

3.  **Smart Hyperlinking**:
    * **Auto-Hyperlink on Paste**: When you select text and paste a URL, it automatically creates a hyperlink
    * **Cmd+K / Ctrl+K Shortcut**: Quick hyperlink insertion with familiar keyboard shortcut
    * **Clipboard Integration**: Automatically detects URLs in clipboard and pre-fills hyperlink dialog

4.  **Persistent Login**:
    * When you log in to the Central Kayako brand (e.g., central-supportdesk.kayako.com), the extension keeps you logged in across all your configured Kayako brands automatically. You only need to log in once, and your session is synchronized everywhere.

## How to Use

### Using the Popup

1.  Navigate to a conversation page within your Kayako agent dashboard.
2.  Click on the **Kayako Resizer icon** in the Chrome toolbar.
3.  Enter your desired pixel values into the input fields for either the "Main Editor" or "Side Conversation Editor".
4.  Click the corresponding **Apply** button to see the changes immediately. These values are saved and will be used every time you visit a page.
5.  Use the toggle switches to show/hide timeline elements like system events, internal notes, and date separators.

### Using Auto-Sizing

- **Focus to Expand**: Click in any editor - it smoothly grows to your configured max height
- **Blur to Shrink**: Click outside the editor - it smoothly shrinks to your configured min height  
- **Smooth Animations**: Uses elegant cubic-bezier transitions for professional feel
- **Respects Settings**: Uses your min/max height settings from the popup controls
- **Works Everywhere**: Automatically applies to main editors and side conversation editors

### Using Drag-to-Resize

- To resize, simply drag the edge of the main editor or side conversation panel. This override lasts until you leave the conversation, switch away from the side panel, or reload the page.
- Dragging always takes priority over popup or default settings for the current session.

### Smart Hyperlinking

**Auto-Hyperlink on Paste:**
1. Select any text in a Kayako editor (e.g., "click here")
2. Copy a URL to your clipboard (e.g., https://google.com)
3. Paste (Cmd+V / Ctrl+V) - the selected text stays as "click here" but becomes a hyperlink to the URL
4. No manual hyperlink button clicking needed!

**Quick Hyperlink Insertion:**
1. Select text in a Kayako editor (optional)
2. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux)
3. A dialog appears with the selected text pre-filled
4. Enter the URL (or it auto-fills from clipboard if it contains a URL)
5. Press Enter or click "Insert Link"

### Timeline Improvements

- **Enhanced Readability**: Timeline items automatically expand to full width (no more cramped max-width)
- **Element Visibility**: Use the popup to toggle various timeline elements for cleaner view

## Installation

To install the extension locally for development or personal use:

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** by toggling the switch in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the directory where you saved the extension files.
6.  The Kayako Resizer extension will now be installed and active.

## Compatibility

This extension is specifically designed to work with the agent view of the Kayako platform (URLs matching `*://*.kayako.com/agent/*`). It may not function correctly on other parts of Kayako or on other websites.

## Version History

### v1.6.0 (Current) - Auto-Sizing Editor Enhancement
- **📏 Auto-Sizing on Focus/Blur**: Editors automatically grow to max height on focus and shrink to min height on blur
- **🎨 Smooth Animations**: Elegant cubic-bezier transitions for professional feel (0.3s duration)
- **⚙️ Settings Integration**: Uses your configured min/max heights from popup controls
- **🔄 Dynamic Setup**: Auto-sizing applies to existing and newly created editors
- **🛡️ Extension Context Protection**: Robust error handling for extension reloads
- **✅ Graceful Degradation**: Falls back to default heights if extension context lost

### v1.5.4 - Extension Context Error Handling
- **🛡️ MutationObserver Protection**: Prevents spam errors when extension is reloaded
- **🔧 Safe Storage Access**: All chrome.storage calls now handle context invalidation gracefully
- **📋 Enhanced Paste Debugging**: Comprehensive logging for hyperlink troubleshooting

### v1.5.3 - Hyperlink Paste Fix
- **🔗 Fixed Auto-Hyperlinking**: Now uses synchronous `e.clipboardData` instead of async clipboard API
- **✅ Immediate Prevention**: Prevents default paste behavior immediately when URL detected  
- **🎯 Improved Timeline CSS**: More aggressive CSS specificity to override Kayako's max-width constraints
- **📋 Enhanced Debugging**: Added detailed logging for timeline CSS application
- **💬 Success Notifications**: Visual feedback when auto-hyperlinking works

### v1.5.1 - Auto-Hyperlink Logic Improvements
- **🔧 Simplified Paste Logic**: Removed complex setTimeout-based interception
- **🎨 Enhanced CSS Targeting**: Better selectors for timeline elements

### v1.5.0 - QOL Productivity Enhancements
- **📏 Timeline Max-Width Removal**: Full-width timeline items for better readability
- **🔗 Auto-Hyperlinking**: Paste URLs over selected text to create hyperlinks automatically  
- **⌨️ Cmd+K Shortcut**: Standard hyperlink insertion shortcut like in other editors
- **🎨 Professional UI**: Clean hyperlink dialog with clipboard integration
- **🔄 Dynamic Application**: Features reapply to new content automatically