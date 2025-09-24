// Function to resize the main editor with both min-height and max-height
function resizeEditor(minHeight, maxHeight) {
    let editor = document.querySelector(".fr-wrapper");
    if (editor) {
        editor.style.minHeight = minHeight + "px";
        editor.style.maxHeight = maxHeight + "px";
    }
}

// Function to resize the side conversation editor
function resizeSideConversationEditor(minWidth, minHeight, maxHeight) {
    let sidePanel = document.querySelector(".side-conversations-panel__side-panel_4k6b2r");
    if (sidePanel) {
        if (sidePanel.classList.contains("side-conversations-panel__open_4k6b2r")) {
            sidePanel.style.minWidth = minWidth + "px";
        } else {
            sidePanel.style.minWidth = "";
        }
    }

    let sideEditorWrapper = sidePanel ? sidePanel.querySelector(".fr-wrapper") : null;
    if (sideEditorWrapper) {
        sideEditorWrapper.style.maxHeight = maxHeight + "px";
        let editorElement = sideEditorWrapper.querySelector(".fr-element.fr-view");
        if (editorElement) {
            editorElement.style.minHeight = minHeight + "px";
        }
    }
}

// Default values
const defaultMinHeight = 44;
const defaultMaxHeight = 600;
const defaultSideMinWidth = 500;
const defaultSideMinHeight = 100;
const defaultSideMaxHeight = 300;

// Function to apply saved or default sizes
function applyAllEditorSizes() {
    try {
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                console.log('Could not get editor size data, using defaults');
                resizeEditor(defaultMinHeight, defaultMaxHeight);
                return;
            }
            resizeEditor(data.editorMinHeight || defaultMinHeight, data.editorMaxHeight || defaultMaxHeight);
        });
        chrome.storage.local.get(["sideMinWidth", "sideMinHeight", "sideMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                console.log('Could not get side editor size data, using defaults');
                resizeSideConversationEditor(defaultSideMinWidth, defaultSideMinHeight, defaultSideMaxHeight);
                return;
            }
            resizeSideConversationEditor(data.sideMinWidth || defaultSideMinWidth, data.sideMinHeight || defaultSideMinHeight, data.sideMaxHeight || defaultSideMaxHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension was reloaded, using default editor sizes');
            resizeEditor(defaultMinHeight, defaultMaxHeight);
            resizeSideConversationEditor(defaultSideMinWidth, defaultSideMinHeight, defaultSideMaxHeight);
        } else {
            console.error('Error applying editor sizes:', error);
        }
    }
}


// --- DRAG-TO-RESIZE FUNCTIONALITY STARTS HERE ---

/**
 * Initializes drag-to-resize for the main text editor (vertical resizing).
 * @param {HTMLElement} container - The container element for the text editor.
 */
function initMainEditorDraggable(container) {
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    container.addEventListener('mousemove', function(e) {
        const rect = container.getBoundingClientRect();
        // Make the top 10px the draggable handle
        if (e.clientY - rect.top <= 10) {
            container.style.cursor = 'row-resize';
        } else {
            container.style.cursor = 'auto';
        }
    });

    container.addEventListener('mousedown', function(e) {
        const rect = container.getBoundingClientRect();
        if (e.clientY - rect.top <= 10) { // Check if the mousedown is on the handle
            e.preventDefault();

            // Fetch min and max from storage
            chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
                const minHeight = data.editorMinHeight || defaultMinHeight;
                const maxHeight = data.editorMaxHeight || defaultMaxHeight;

                const startY = e.clientY;
                const resizable = container.querySelector('.fr-element.fr-view');
                if (!resizable) return;

                const startH = resizable.offsetHeight;
                let lastDY = 0;
                let rafScheduled = false;

                function updateHeight() {
                    let newHeight = startH - lastDY;
                    // Clamp newHeight between minHeight and maxHeight
                    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
                    resizable.style.height = newHeight + 'px';
                    // Set maxHeight directly, no buffer
                    const wrapper = container.querySelector('.fr-wrapper');
                    if(wrapper) wrapper.style.maxHeight = maxHeight + 'px';
                    rafScheduled = false;
                }

                function move(e) {
                    lastDY = e.clientY - startY;
                    if (!rafScheduled) {
                        rafScheduled = true;
                        requestAnimationFrame(updateHeight);
                    }
                }

                function up() {
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                    container.style.cursor = 'auto';

                    // Save the new height to storage as maxHeight
                    // const finalHeight = resizable.offsetHeight;
                    // chrome.storage.local.set({ editorMaxHeight: finalHeight });
                }

                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
            });
        }
    });
}

/**
 * Initializes drag-to-resize for the side conversation panel (horizontal resizing).
 * @param {HTMLElement} panel - The side conversation panel element.
 */
function initSideConversationDraggable(panel) {
     panel.addEventListener('mousemove', function(e) {
        const rect = panel.getBoundingClientRect();
        // Make the left 10px the draggable handle
        if (e.clientX - rect.left <= 10) {
            panel.style.cursor = 'col-resize';
        } else {
            panel.style.cursor = 'auto';
        }
    });

    panel.addEventListener('mousedown', function(e) {
        const rect = panel.getBoundingClientRect();
         if (e.clientX - rect.left <= 10) { // Check if mousedown is on the handle
            e.preventDefault();

            const startX = e.clientX;
            const startW = panel.offsetWidth;
            let lastDX = 0;
            let rafScheduled = false;

            function updateWidth() {
                panel.style.minWidth = (startW - lastDX) + 'px';
                rafScheduled = false;
            }

            function move(e) {
                lastDX = e.clientX - startX;
                if (!rafScheduled) {
                    rafScheduled = true;
                    requestAnimationFrame(updateWidth);
                }
            }

            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                panel.style.cursor = 'auto';

                // Save the new width to storage
                // const finalWidth = panel.offsetWidth;
                // chrome.storage.local.set({ sideMinWidth: finalWidth });
            }

            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        }
    });
}


/**
 * Attaches listeners to all found editor components.
 * This is called by the MutationObserver.
 */
function attachAllListeners() {
    // Attach to main editor
    const mainContainers = document.querySelectorAll('[class*="ko-text-editor__container"]');
    mainContainers.forEach(c => {
        if (!c.dataset.draggableAttached) {
            initMainEditorDraggable(c);
            c.dataset.draggableAttached = "true";
        }
    });

    // Attach to side conversation panel
    const sidePanel = document.querySelector(".side-conversations-panel__side-panel_4k6b2r.side-conversations-panel__open_4k6b2r");
    if (sidePanel && !sidePanel.dataset.draggableAttached) {
         initSideConversationDraggable(sidePanel);
         sidePanel.dataset.draggableAttached = "true";
    }
}

// --- DRAG-TO-RESIZE FUNCTIONALITY ENDS HERE ---

// --- VISIBILITY FUNCTIONALITY STARTS HERE ---

// Function to toggle event visibility
function toggleEvents(hide) {
    const styleId = 'kayako-events-style';
    let style = document.getElementById(styleId);
    
    if (hide) {
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Target only standard timeline posts that are direct children of the timeline list */
                .ko-timeline-2_list_post__post_1nm4l4 > .ko-timeline-2_list_post__standard_1nm4l4 {
                    display: none !important;
                }
                
                /* Ensure the parent post element is also hidden */
                .ko-timeline-2_list_post__post_1nm4l4:has(> .ko-timeline-2_list_post__standard_1nm4l4) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        if (style) {
            style.remove();
        }
    }
}

// Function to toggle internal notes visibility
function toggleInternalNotes(hide) {
    const styleId = 'kayako-internal-notes-style';
    let style = document.getElementById(styleId);
    
    if (hide) {
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Target all internal notes */
                .ko-timeline-2_list_item__note_1oksrd {
                    display: none !important;
                }
                
                /* Ensure the parent post element is also hidden */
                .ko-timeline-2_list_post__post_1nm4l4:has(> .ko-timeline-2_list_item__note_1oksrd) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        if (style) {
            style.remove();
        }
    }
}

// Function to toggle day separators visibility
function toggleDaySeparators(hide) {
    const styleId = 'kayako-day-separators-style';
    let style = document.getElementById(styleId);
    
    if (hide) {
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Target all day separators - multiple selectors for better coverage */
                .ko-timeline-2_list_days__day-separator_1bbqo9,
                [class*='day-separator'] {
                    display: none !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    visibility: hidden !important;
                }
                
                /* Also target the parent container that might be controlling visibility */
                [class*='ko-timeline-2_list_days'] {
                    min-height: 0 !important;
                }
            `;
            document.head.appendChild(style);
            
            // Force a reflow to ensure styles are applied
            document.body.offsetHeight;
        }
    } else {
        if (style) {
            style.remove();
        }
    }
    
    // Debug: Log the current state and found elements
    console.log('Day separators hidden:', hide);
    console.log('Found day separators:', document.querySelectorAll('.ko-timeline-2_list_days__day-separator_1bbqo9, [class*="day-separator"]').length);
}

// --- VISIBILITY FUNCTIONALITY ENDS HERE ---

// --- QOL IMPROVEMENTS START HERE ---

// Function to remove max-width from timeline items for better readability
function removeTimelineMaxWidth() {
    const styleId = 'kayako-timeline-max-width-removal';
    let style = document.getElementById(styleId);
    
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Aggressive max-width removal with high specificity to override Kayako styles */
            body [class*="ko-timeline-2_list_item__note"],
            body [class*="ko-timeline-2_list_item__post"],
            body [class*="ko-timeline-2_list_item__content"],
            body .ko-timeline-2_list_item__note_1oksrd,
            body .ko-timeline-2_list_item__post_1oksrd,
            body .ko-timeline-2_list_item__content_1oksrd,
            body div[class*="ko-timeline-2_list_item__note"],
            body div[class*="ko-timeline-2_list_item__post"],
            body div[class*="ko-timeline-2_list_item__content"] {
                max-width: none !important;
                width: 100% !important;
            }
            
            /* Parent containers with high specificity */
            body [class*="ko-timeline-2__previous-activities-container"],
            body .ko-timeline-2__previous-activities-container-wrapper_vlsdot,
            body div[class*="ko-timeline-2__previous-activities-container"] {
                max-width: none !important;
                width: 100% !important;
            }
            
            /* Timeline body and content areas */
            body [class*="ko-timeline-2_list_item__body"],
            body div[class*="ko-timeline-2_list_item__body"] {
                max-width: none !important;
                width: 100% !important;
            }
            
            /* Target the specific element from your example with maximum specificity */
            body .message-or-note .ko-timeline-2_list_item__note_1oksrd,
            body .ko-timeline-2_list_post__post_1nm4l4 .ko-timeline-2_list_item__note_1oksrd,
            body div[data-id][class*="ko-timeline-2_list_item__note"],
            body div[data-id][data-status][class*="ko-timeline-2_list_item__note"] {
                max-width: none !important;
                width: 100% !important;
                flex: 1 !important;
            }
            
            /* Also target any container that might be limiting width */
            body [class*="ko-timeline-2_list_item__item"],
            body div[class*="ko-timeline-2_list_item__item"] {
                max-width: none !important;
                width: 100% !important;
            }
            
            /* Force full width on content divs */
            body .ko-timeline-2_list_item__content_1oksrd,
            body div[class*="ko-timeline-2_list_item__content"] {
                max-width: none !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
        `;
        document.head.appendChild(style);
        console.log('✅ Timeline max-width constraints removed');
        
        // Debug: Check if our styles are being applied
        setTimeout(() => {
            const timelineItems = document.querySelectorAll('[class*="ko-timeline-2_list_item__note"]');
            console.log('🔍 Found timeline items after CSS application:', timelineItems.length);
            timelineItems.forEach((item, index) => {
                const computedStyle = window.getComputedStyle(item);
                console.log(`🔍 Timeline item ${index} max-width:`, computedStyle.maxWidth);
                console.log(`🔍 Timeline item ${index} width:`, computedStyle.width);
                console.log(`🔍 Timeline item ${index} classes:`, item.className);
            });
        }, 1000);
    }
    
    // Add animations for notifications if not already present
    if (!document.getElementById('kayako-qol-animations')) {
        const animationStyle = document.createElement('style');
        animationStyle.id = 'kayako-qol-animations';
        animationStyle.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(animationStyle);
    }
}

// Function to setup auto-hyperlinking when pasting URLs
function setupAutoHyperlinking() {
    console.log('🔗 Setting up auto-hyperlinking functionality');
    
    // Listen for paste events on all Kayako editors with capture phase to get first shot
    document.addEventListener('paste', (e) => {
        console.log('📋 Paste event detected, target:', e.target);
        const target = e.target;
        
        // Check if we're in a Kayako editor
        if (!target.closest('.fr-element, [contenteditable="true"]')) {
            return;
        }
        
        // Check if text is selected
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            return;
        }
        
        // Get the selected text BEFORE the paste happens
        const selectedText = selection.toString();
        const range = selection.getRangeAt(0);
        
        // Get the clipboard data synchronously from the paste event
        let clipboardText = '';
        try {
            clipboardText = e.clipboardData.getData('text/plain');
        } catch (error) {
            console.log('Could not get clipboard data from paste event:', error.message);
            return;
        }
        
        // Check if clipboard contains a URL
        if (isValidURL(clipboardText)) {
            console.log('🔗 Auto-hyperlinking detected');
            console.log('🔗 Selected text:', `"${selectedText}"`);
            console.log('🔗 URL from clipboard:', clipboardText);
            
            // IMMEDIATELY prevent the paste
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Create hyperlink element with the selected text immediately
            const link = document.createElement('a');
            link.href = clipboardText;
            link.textContent = selectedText; // Preserve the selected text
            link.target = '_blank';
            
            console.log('🔗 Created link:', link.outerHTML);
            
            // Replace selection with link immediately
            range.deleteContents();
            range.insertNode(link);
            
            // Position cursor after the link
            const newRange = document.createRange();
            newRange.setStartAfter(link);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            console.log('✅ Auto-hyperlinked:', `"${selectedText}"`, '→', clipboardText);
            
            // Show success notification
            showQuickNotification(`🔗 "${selectedText}" linked!`, 'success');
            
            // Trigger Kayako events
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('fr-change', { bubbles: true }));
            
            return false;
        }
        
        // If we get here, it's not a URL - let normal paste happen
    }, true); // Use capture phase to get first shot at the event
}

// Function to setup Cmd+K / Ctrl+K shortcut for hyperlink insertion
function setupHyperlinkShortcut() {
    console.log('⌨️ Setting up Cmd+K / Ctrl+K hyperlink shortcut');
    
    document.addEventListener('keydown', (e) => {
        // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            const target = e.target;
            
            // Check if we're in a Kayako editor
            if (!target.closest('.fr-element, [contenteditable="true"]')) {
                return;
            }
            
            e.preventDefault();
            
            // Get current selection
            const selection = window.getSelection();
            let selectedText = '';
            
            if (selection.rangeCount && !selection.isCollapsed) {
                selectedText = selection.toString();
            }
            
            // Show hyperlink dialog
            showHyperlinkDialog(selectedText, target);
        }
    });
}

// Helper function to validate URLs
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        // Try with common prefixes if not already present
        if (!string.match(/^https?:\/\//)) {
            try {
                new URL('http://' + string);
                return string.includes('.') && string.length > 4;
            } catch (_) {
                return false;
            }
        }
        return false;
    }
}

// Function to show hyperlink insertion dialog
function showHyperlinkDialog(selectedText, targetEditor) {
    // Remove any existing dialog
    const existingDialog = document.querySelector('.kayako-hyperlink-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'kayako-hyperlink-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        padding: 24px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        min-width: 400px;
        max-width: 500px;
    `;
    
    dialog.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px;">🔗 Insert Hyperlink</h3>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label for="hyperlinkText" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Display Text:</label>
            <input type="text" id="hyperlinkText" value="${selectedText}" placeholder="Link text" style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                outline: none;
            ">
        </div>
        
        <div style="margin-bottom: 20px;">
            <label for="hyperlinkURL" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">URL:</label>
            <input type="url" id="hyperlinkURL" placeholder="https://example.com" style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                outline: none;
            ">
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancelHyperlink" style="
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Cancel</button>
            <button id="insertHyperlink" style="
                padding: 8px 16px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Insert Link</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus URL field and try to populate from clipboard
    const urlField = dialog.querySelector('#hyperlinkURL');
    const textField = dialog.querySelector('#hyperlinkText');
    
    // Try to get URL from clipboard
    navigator.clipboard.readText().then(clipboardText => {
        if (isValidURL(clipboardText)) {
            urlField.value = clipboardText;
            if (!selectedText) {
                textField.focus();
            } else {
                document.querySelector('#insertHyperlink').focus();
            }
        } else {
            urlField.focus();
        }
    }).catch(() => {
        urlField.focus();
    });
    
    // Handle button clicks
    dialog.querySelector('#cancelHyperlink').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('#insertHyperlink').addEventListener('click', () => {
        const text = textField.value.trim();
        const url = urlField.value.trim();
        
        if (!text || !url) {
            return;
        }
        
        insertHyperlinkIntoEditor(text, url, targetEditor);
        dialog.remove();
    });
    
    // Handle Enter key
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dialog.querySelector('#insertHyperlink').click();
        } else if (e.key === 'Escape') {
            dialog.remove();
        }
    });
    
    // Close dialog when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeDialog(e) {
            if (!dialog.contains(e.target)) {
                dialog.remove();
                document.removeEventListener('click', closeDialog);
            }
        });
    }, 100);
}

// Function to insert hyperlink into editor
function insertHyperlinkIntoEditor(text, url, targetEditor) {
    try {
        // Create link element
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        link.target = '_blank';
        
        // Get current selection or create one at cursor position
        const selection = window.getSelection();
        
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            
            // If text was selected, replace it
            if (!selection.isCollapsed) {
                range.deleteContents();
            }
            
            range.insertNode(link);
            
            // Move cursor after the link
            range.setStartAfter(link);
            range.setEndAfter(link);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Fallback: append to editor
            targetEditor.appendChild(link);
        }
        
        // Trigger change events to notify Kayako
        const changeEvent = new Event('input', { bubbles: true });
        targetEditor.dispatchEvent(changeEvent);
        
        console.log('🔗 Hyperlink inserted:', text, '->', url);
        
    } catch (error) {
        console.error('Error inserting hyperlink:', error);
    }
}

// Function to show quick notifications
function showQuickNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.kayako-qol-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'kayako-qol-notification';
    notification.textContent = message;
    
    const colors = {
        success: { bg: '#28a745', text: '#fff' },
        error: { bg: '#dc3545', text: '#fff' },
        info: { bg: '#17a2b8', text: '#fff' }
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color.bg};
        color: ${color.text};
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto remove after 2 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 2000);
}

// Function to setup auto-sizing: grow on focus, shrink on blur
function setupAutoSizing() {
    console.log('📏 Setting up auto-sizing functionality');
    
    // Add CSS for smooth animations
    const styleId = 'kayako-auto-sizing-animations';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Smooth animations for editor auto-sizing */
            .fr-element.auto-sizing {
                transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            
            .fr-wrapper.auto-sizing {
                transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Setup focus/blur listeners for all editor elements
    setupEditorAutoSizing();
}

// Function to setup auto-sizing for existing and new editors
function setupEditorAutoSizing() {
    const editors = document.querySelectorAll('.fr-element');
    
    editors.forEach(editor => {
        if (editor.dataset.autoSizingSetup) {
            return; // Already setup
        }
        
        console.log('📏 Setting up auto-sizing for editor:', editor);
        editor.dataset.autoSizingSetup = 'true';
        
        // Add animation classes
        editor.classList.add('auto-sizing');
        const wrapper = editor.closest('.fr-wrapper');
        if (wrapper) {
            wrapper.classList.add('auto-sizing');
        }
        
        // Add focus listener - grow to max height
        editor.addEventListener('focus', () => {
            handleEditorFocus(editor);
        });
        
        // Add blur listener - shrink to min height
        editor.addEventListener('blur', () => {
            handleEditorBlur(editor);
        });
        
        // Set initial size based on current focus state
        if (document.activeElement === editor) {
            handleEditorFocus(editor);
        } else {
            handleEditorBlur(editor);
        }
    });
}

// Handle editor focus - animate to max height
function handleEditorFocus(editor) {
    console.log('📏 Editor focused, growing to max height');
    
    try {
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                console.log('Could not get height data, using defaults for auto-sizing');
                animateEditorToHeight(editor, defaultMaxHeight);
                return;
            }
            
            const maxHeight = data.editorMaxHeight || defaultMaxHeight;
            animateEditorToHeight(editor, maxHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated, using default max height');
            animateEditorToHeight(editor, defaultMaxHeight);
        } else {
            console.error('Error getting max height for auto-sizing:', error);
        }
    }
}

// Handle editor blur - animate to min height
function handleEditorBlur(editor) {
    console.log('📏 Editor blurred, shrinking to min height');
    
    try {
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                console.log('Could not get height data, using defaults for auto-sizing');
                animateEditorToHeight(editor, defaultMinHeight);
                return;
            }
            
            const minHeight = data.editorMinHeight || defaultMinHeight;
            animateEditorToHeight(editor, minHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated, using default min height');
            animateEditorToHeight(editor, defaultMinHeight);
        } else {
            console.error('Error getting min height for auto-sizing:', error);
        }
    }
}

// Animate editor to specific height
function animateEditorToHeight(editor, targetHeight) {
    console.log('📏 Animating editor to height:', targetHeight + 'px');
    
    // Set the height on the editor element
    editor.style.height = targetHeight + 'px';
    
    // Also set max-height on the wrapper if it exists
    const wrapper = editor.closest('.fr-wrapper');
    if (wrapper) {
        wrapper.style.maxHeight = targetHeight + 'px';
    }
    
    // Store the current auto-size height so drag-to-resize knows about it
    editor.dataset.autoSizeHeight = targetHeight;
}

// --- QOL IMPROVEMENTS END HERE ---

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === "resize") {
            resizeEditor(request.minHeight, request.maxHeight);
            chrome.storage.local.set({
                editorMinHeight: request.minHeight,
                editorMaxHeight: request.maxHeight
            });
        } else if (request.action === "resizeSideConversation") {
            resizeSideConversationEditor(request.minWidth, request.minHeight, request.maxHeight);
            chrome.storage.local.set({
                sideMinWidth: request.minWidth,
                sideMinHeight: request.minHeight,
                sideMaxHeight: request.maxHeight
            });
        } else if (request.action === "toggleEvents") {
            toggleEvents(request.hide);
        } else if (request.action === "toggleInternalNotes") {
            toggleInternalNotes(request.hide);
        } else if (request.action === "toggleDaySeparators") {
            toggleDaySeparators(request.hide);
        }
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension was reloaded, could not save settings');
        } else {
            console.error('Error handling message:', error);
        }
    }
});

// Track if extension context is valid
let extensionContextValid = true;

// Use a single MutationObserver to handle all dynamic changes
const observer = new MutationObserver(() => {
    // Skip if extension context is invalidated to avoid spam errors
    if (!extensionContextValid) {
        return;
    }
    
    try {
        // Apply sizes set from the popup
        applyAllEditorSizes();
        // Attach the interactive draggable listeners
        attachAllListeners();
        // Ensure QOL improvements are applied to new content
        removeTimelineMaxWidth();
        // Setup auto-sizing for any new editors
        setupEditorAutoSizing();
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            extensionContextValid = false;
            console.log('🔄 Extension context invalidated - stopping MutationObserver to prevent spam');
            observer.disconnect();
        } else {
            console.error('Error in MutationObserver:', error);
        }
    }
});

// Start observing when the script loads
observer.observe(document.body, { childList: true, subtree: true });

// Also run once on initial load
applyAllEditorSizes();
attachAllListeners();

// Initialize QOL improvements
removeTimelineMaxWidth();
setupAutoHyperlinking();
setupHyperlinkShortcut();
setupAutoSizing();

// Apply saved visibility states on load
try {
    chrome.storage.local.get(["hideEvents", "hideInternalNotes", "hideDates"], (data) => {
        if (chrome.runtime.lastError) {
            console.log('Could not load visibility settings, using defaults');
            return;
        }
        if (data.hideEvents) {
            toggleEvents(true);
        }
        if (data.hideInternalNotes) {
            toggleInternalNotes(true);
        }
        if (data.hideDates) {
            toggleDaySeparators(true);
        }
    });
} catch (error) {
    if (error.message.includes('Extension context invalidated')) {
        console.log('Extension was reloaded, could not load visibility settings');
    } else {
        console.error('Error loading visibility settings:', error);
    }
}