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
const defaultSidebarWidth = 360;

// Helpers to safely use chrome APIs when the extension context may be reloading
function isStorageAvailable() {
    try { return !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local); } catch (_) { return false; }
}
function isRuntimeAvailable() {
    try { return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage); } catch (_) { return false; }
}

// Function to apply saved or default sizes
function applyAllEditorSizes() {
    try {
        if (!isStorageAvailable()) {
            resizeEditor(defaultMinHeight, defaultMaxHeight);
        } else chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                
                resizeEditor(defaultMinHeight, defaultMaxHeight);
                return;
            }
            resizeEditor(data.editorMinHeight || defaultMinHeight, data.editorMaxHeight || defaultMaxHeight);
        });
        if (!isStorageAvailable()) {
            resizeSideConversationEditor(defaultSideMinWidth, defaultSideMinHeight, defaultSideMaxHeight);
        } else chrome.storage.local.get(["sideMinWidth", "sideMinHeight", "sideMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                
                resizeSideConversationEditor(defaultSideMinWidth, defaultSideMinHeight, defaultSideMaxHeight);
                return;
            }
            resizeSideConversationEditor(data.sideMinWidth || defaultSideMinWidth, data.sideMinHeight || defaultSideMinHeight, data.sideMaxHeight || defaultSideMaxHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            
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
        // console.log('✅ Timeline max-width constraints removed');
        
        // Debug: Check if our styles are being applied
        setTimeout(() => {
            const timelineItems = document.querySelectorAll('[class*="ko-timeline-2_list_item__note"]');
            // console.log('🔍 Found timeline items after CSS application:', timelineItems.length);
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

// Make internal notes (yellow background, identified by data-note-id) 10% narrower
function narrowInternalNotes() {
    const styleId = 'kayako-internal-note-narrow';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Only target internal notes: containers that carry data-note-id */
        body .message-or-note[data-note-id] .ko-timeline-2_list_item__note_1oksrd,
        body .ko-timeline-2_list_post__post_1nm4l4.message-or-note[data-note-id] .ko-timeline-2_list_item__note_1oksrd,
        body div[data-note-id][data-id][data-status][class*="ko-timeline-2_list_item__note"],
        body .message-or-note[data-note-id] [class*="ko-timeline-2_list_item__note"],
        body .message-or-note[data-note-id] [class*="ko-timeline-2_list_item__content"] {
            width: 90% !important;
            max-width: 90% !important;
            margin-right: 10% !important; /* keep aligned to the left, create right gutter */
            box-sizing: border-box !important;
            flex: 0 0 auto !important; /* override earlier flex:1 to allow narrowing */
            align-self: flex-start !important;
        }
    `;
    document.head.appendChild(style);
}

// Function to setup auto-hyperlinking when pasting URLs
function setupAutoHyperlinking() {
    // console.log('🔗 Setting up auto-hyperlinking functionality');
    
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
        
        // Get the clipboard data synchronously from the paste event
        let clipboardText = '';
        try {
            clipboardText = e.clipboardData.getData('text/plain');
        } catch (error) {
            console.log('Could not get clipboard data from paste event:', error.message);
        }
        
        // If no selection (collapsed) and clipboard has a URL, let paste happen, then offer title replacement
        if (!selection.rangeCount || selection.isCollapsed) {
            if (clipboardText && isValidURL(clipboardText)) {
                console.log('📎 Pasted URL without selection, will suggest title:', clipboardText);
                // Give the editor a moment to insert/auto-link, then suggest replacement
                setTimeout(() => {
                    console.log('⏱️ Title suggestion timer fired for', clipboardText);
                    trySuggestTitleReplace(target, clipboardText, 1);
                }, 150);
            }
            return;
        }
        
        // Get the selected text BEFORE the paste happens
        const selectedText = selection.toString();
        const range = selection.getRangeAt(0);
        
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

function trySuggestTitleReplace(pasteTarget, url, attempt) {
    try {
        // Prefer the currently active contenteditable
        let editor = null;
        const ae = document.activeElement;
        if (ae && (ae.isContentEditable || ae.classList?.contains('fr-element'))) {
            editor = ae;
        }
        if (!editor && pasteTarget && typeof pasteTarget.closest === 'function') {
            editor = pasteTarget.closest('.fr-element, [contenteditable="true"]');
        }
        if (!editor) {
            editor = document.querySelector('.fr-element[contenteditable="true"], [contenteditable="true"]');
        }
        if (!editor) {
            console.log('🕵️ Could not resolve editor on attempt', attempt);
        } else {
            console.log('🧭 Resolved editor on attempt', attempt);
            suggestReplaceURLWithTitle(editor, url);
            return;
        }
        // Retry once more after a short delay because Froala may re-render
        if (attempt < 2) {
            setTimeout(() => trySuggestTitleReplace(pasteTarget, url, attempt + 1), 400);
        }
    } catch (e) {
        console.log('trySuggestTitleReplace error:', e?.message || e);
    }
}

// Suggest replacing a just-pasted raw URL with the page title as the link text
function suggestReplaceURLWithTitle(editor, url) {
    try {
        // Avoid duplicate prompts for same URL if one is already showing
        const existing = document.querySelector('.kayako-link-title-suggestion');
        if (existing && existing.dataset.url === url) {
            return;
        }
        
        // Ask background to fetch the page title
        const ver = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : 'unknown';
        console.log('📡 Requesting page title from background for:', url, 'enhancer v', ver);
        let responded = false;
        const timeoutId = setTimeout(() => {
            if (!responded) {
                console.log('⏳ No response from service worker for title within 2s. Pinging…');
                if (isRuntimeAvailable()) {
                    try {
                        chrome.runtime.sendMessage({ action: 'ping' }, (pong) => {
                            const err = chrome.runtime?.lastError;
                            if (err) {
                                console.log('⚠️ ping error:', err.message);
                            } else {
                                console.log('🏓 ping response:', pong);
                            }
                        });
                    } catch (e) {
                        console.log('⚠️ ping threw:', e?.message || e);
                    }
                } else {
                    console.log('⚠️ runtime unavailable, skipping ping');
                }
            }
        }, 2000);
        if (!isRuntimeAvailable()) {
            console.log('⚠️ runtime unavailable, cannot request fetchPageTitle');
            return;
        }
        chrome.runtime.sendMessage({ action: 'fetchPageTitle', url: url }, (response) => {
            responded = true;
            clearTimeout(timeoutId);
            const err = chrome.runtime?.lastError;
            if (err) {
                console.log('⚠️ sendMessage error:', err.message);
                if (/invalidated/i.test(err.message || '')) {
                    console.log('🔁 SW context invalidated; retrying title fetch shortly…');
                    setTimeout(() => { try { suggestReplaceURLWithTitle(editor, url); } catch(_) {} }, 600);
                    return;
                }
            }
            if (!response || !response.success || !response.title) {
                console.log('⚠️ No title available for', url);
                return;
            }
            const titleRaw = String(response.title).trim();
            const title = decodeHtmlEntities(titleRaw).trim();
            if (!title || title.length === 0) {
                console.log('⚠️ Empty title for', url);
                return;
            }
            if (titlesEquivalentOrUrlLike(title, url)) {
                console.log('⚠️ Title looks like URL or equals URL, skipping suggestion for', url, 'title:', title);
                return;
            }
            
            // Build and show suggestion UI
            console.log('🏷️ Title fetched:', title);
            createOrUpdateLinkSuggestion(editor, url, title);
        });
    } catch (error) {
        const msg = error?.message || String(error || '');
        console.log('Title suggestion failed:', msg);
        if (/invalidated/i.test(msg)) {
            console.log('🔁 SW context invalidated during suggest; retrying…');
            setTimeout(() => { try { suggestReplaceURLWithTitle(editor, url); } catch(_) {} }, 600);
        }
    }
}

function titlesEquivalentOrUrlLike(title, url) {
    try {
        const t = (title || '').trim();
        const u = new URL(url, window.location.href).href;
        if (!t) return true;
        // Exact match or case-insensitive
        if (t === url || t.toLowerCase() === url.toLowerCase() || t === u || t.toLowerCase() === u.toLowerCase()) return true;
        // Looks like a URL
        if (/^https?:\/\//i.test(t)) return true;
        if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t) && !t.includes(' ')) return true;
        return false;
    } catch (_) {
        return false;
    }
}

// Decode HTML entities (named and numeric) safely using a temporary textarea
function decodeHtmlEntities(str) {
    try {
        const ta = document.createElement('textarea');
        ta.innerHTML = String(str || '');
        return ta.value;
    } catch (_) {
        return String(str || '');
    }
}

// Escape for safe innerHTML interpolation
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Create a small inline UI offering to replace URL text with the page title
function createOrUpdateLinkSuggestion(editor, url, title) {
    // Clean up any previous suggestion
    const prior = document.querySelector('.kayako-link-title-suggestion');
    if (prior) prior.remove();
    
    const container = editor.closest('.ko-text-editor__container_1p5g6r') || editor.parentElement || document.body;
    const ui = document.createElement('div');
    ui.className = 'kayako-link-title-suggestion';
    ui.dataset.url = url;
    ui.style.cssText = `
        position: absolute;
        left: 0px;
        top: 0px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        padding: 8px 10px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
    `;
    const decodedTitle = decodeHtmlEntities(title);
    const safeTitle = decodedTitle.length > 90 ? decodedTitle.slice(0, 87) + '…' : decodedTitle;
    const safeHTMLTitle = escapeHtml(safeTitle);
    ui.innerHTML = `
        <span style="color:#333;">Replace pasted link with “${safeHTMLTitle}”?</span>
        <button class="kayako-link-suggest-apply" style="background:#007bff;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;">Replace</button>
        <button class="kayako-link-suggest-dismiss" style="background:#f1f3f5;color:#333;border:1px solid #ddd;border-radius:4px;padding:4px 8px;cursor:pointer;">Keep</button>
    `;
    
    // Position within container
    if (container !== document.body && getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    container.appendChild(ui);
    console.log('💡 Showing link title suggestion UI for', url);
    positionSuggestionNearURL(ui, container, editor, url);
    
    // Prevent editor blur when interacting with the bubble (keep size stable)
    ui.addEventListener('mousedown', (e) => { try { e.preventDefault(); editor && editor.focus(); } catch(_) {} }, true);
    ui.addEventListener('pointerdown', (e) => { try { e.preventDefault(); editor && editor.focus(); } catch(_) {} }, true);

    // Handlers
	const keydownHandler = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            try { editor && editor.focus(); } catch(_) {}
            try {
                const applied = replaceURLTextWithTitle(editor, url, title);
                if (applied) {
                    console.log('✅ Replaced URL text with title for', url, '(Tab accept)');
                    showQuickNotification('🔗 Replaced link text with page title', 'success');
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    showQuickNotification('Could not find pasted link to replace', 'error');
                }
            } catch (error) {
                console.error('Replace with title (Tab) failed:', error);
            } finally {
                try { ui.remove(); } catch(_) {}
                document.removeEventListener('keydown', keydownHandler, true);
            }
        }
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			try { ui.remove(); } finally { document.removeEventListener('keydown', keydownHandler, true); }
		}
    };
    document.addEventListener('keydown', keydownHandler, true);

	ui.querySelector('.kayako-link-suggest-dismiss').addEventListener('click', () => { try { ui.remove(); } finally { document.removeEventListener('keydown', keydownHandler, true); } });
    ui.querySelector('.kayako-link-suggest-apply').addEventListener('click', () => {
        try {
            try { editor && editor.focus(); } catch(_) {}
            const applied = replaceURLTextWithTitle(editor, url, title);
            if (applied) {
                console.log('✅ Replaced URL text with title for', url);
                showQuickNotification('🔗 Replaced link text with page title', 'success');
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                showQuickNotification('Could not find pasted link to replace', 'error');
            }
        } catch (error) {
            console.error('Replace with title failed:', error);
		} finally {
			ui.remove();
			document.removeEventListener('keydown', keydownHandler, true);
		}
    });
    
    // Auto-dismiss on further typing in editor
	const inputHandler = () => { try { ui.remove(); } catch (_) {} editor.removeEventListener('input', inputHandler); document.removeEventListener('keydown', keydownHandler, true); };
    editor.addEventListener('input', inputHandler);

	// Mark the corresponding anchor as checked to avoid duplicate suggestions from auto-link scan
	try {
		const a = findAnchorForURL(editor, url);
		if (a) a.dataset.titleSuggestChecked = '1';
	} catch (_) {}
}

// Try to replace the last pasted URL's visible text with the fetched title
function replaceURLTextWithTitle(editor, url, title) {
    const cleanTitle = decodeHtmlEntities(title);
    // Prefer replacing an anchor that matches the URL
    const anchor = findAnchorForURL(editor, url);
    if (anchor) {
        anchor.textContent = cleanTitle;
        return true;
    }
    // Fallback: wrap the first matching text node occurrence
    try {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const idx = node.nodeValue.indexOf(url);
            if (idx !== -1) {
                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + url.length);
                const link = document.createElement('a');
                link.href = url;
                link.textContent = cleanTitle;
                link.target = '_blank';
                range.deleteContents();
                range.insertNode(link);
                return true;
            }
        }
    } catch (_) {}
    return false;
}

// Find an anchor in the editor that corresponds to the pasted URL (handles http/https normalization)
function findAnchorForURL(editor, url) {
    try {
        const anchors = editor.querySelectorAll('a[href]');
        const u = new URL(url, window.location.href);
        const alt = new URL((u.protocol === 'http:' ? 'https:' : 'http:') + '//' + u.host + u.pathname + u.search + u.hash);
        for (const a of anchors) {
            try {
                const ah = new URL(a.href, window.location.href);
                if (ah.href === u.href || ah.href === alt.href) return a;
            } catch (_) {}
        }
    } catch (_) {}
    return null;
}

// Compute a good on-screen rect for the pasted URL, to place the suggestion nearby
function getURLClientRect(editor, url) {
    try {
        const anchor = findAnchorForURL(editor, url);
        if (anchor) return anchor.getBoundingClientRect();
        // Fallback: find text node occurrence and measure a range
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const idx = node.nodeValue.indexOf(url);
            if (idx !== -1) {
                const range = document.createRange();
                range.setStart(node, Math.max(0, idx));
                range.setEnd(node, Math.min(node.nodeValue.length, idx + Math.min(url.length, 32)));
                const rect = range.getBoundingClientRect();
                return rect && rect.width ? rect : editor.getBoundingClientRect();
            }
        }
    } catch (_) {}
    // Last resort: use selection/caret rect
    try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect && (rect.width || rect.height)) return rect;
        }
    } catch (_) {}
    return editor.getBoundingClientRect();
}

// Place the suggestion bubble near the pasted URL, within container bounds
function positionSuggestionNearURL(ui, container, editor, url) {
    try {
        const containerRect = container.getBoundingClientRect();
        const targetRect = getURLClientRect(editor, url);
        // Prefer above-right of the target
        const padding = 8;
        let left = targetRect.left - containerRect.left;
        let top = targetRect.top - containerRect.top - ui.offsetHeight - padding;
        // If above would overflow top, place below
        if (top < padding) {
            top = targetRect.bottom - containerRect.top + padding;
        }
        // Clamp horizontally inside container
        const maxLeft = (containerRect.width || container.clientWidth) - ui.offsetWidth - padding;
        left = Math.max(padding, Math.min(left, maxLeft));
        ui.style.left = left + 'px';
        ui.style.top = Math.max(padding, top) + 'px';
        console.log('📍 Positioned suggestion at', { left, top });
    } catch (e) {
        console.log('positionSuggestionNearURL failed:', e?.message || e);
    }
}

// --- Inline translation (preview) ---
function setupInlineTranslation() {
    // Trigger on double- or triple-click selections within timeline posts
    document.addEventListener('click', (e) => {
        try {
            // Only care about double/triple clicks
            if (!e || typeof e.detail !== 'number' || e.detail < 2) return;
            const target = e.target;
            // Ignore clicks in editors
            if (target.closest('.fr-element, [contenteditable="true"]')) return;
            // Limit to timeline content areas
            const timelineContainer = target.closest('[class*="ko-timeline-2_list_item__content"], [class*="ko-timeline-2_list_item__post"], [class*="ko-timeline-2_list_item__note"]');
            if (!timelineContainer) return;

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const text = sel.toString().trim();
            if (!text || text.length < 2) return;
            // Avoid overly long requests
            const capped = text.slice(0, 1200);

            // Remove any existing bubble
            const prior = document.querySelector('.kayako-translate-preview');
            if (prior) prior.remove();

            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Ask background for translation (auto → en), only create bubble if non-EN
            const ver = (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : 'unknown';
            console.log('📡 Requesting translation (auto→en), v', ver, 'sample:', capped.slice(0, 60));
            chrome.runtime.sendMessage({ action: 'translateText', text: capped, toLang: 'en' }, (resp) => {
                const err = chrome.runtime?.lastError;
                if (err) {
                    console.log('⚠️ translate sendMessage error:', err.message);
                    return;
                }
                if (!resp || !resp.success || !resp.translation) {
                    // Nothing to show
                    return;
                }
                const src = String(resp.sourceLang || '').toLowerCase();
                const isEnglish = src === 'en' || src.startsWith('en-');
                // Skip offering translation if detected source is English or translation equals original
                const norm = (s) => String(s || '').trim();
                if (isEnglish || norm(resp.translation) === norm(capped)) {
                    return;
                }
                // Create bubble on demand with final text
                createOrUpdateTranslationBubble(timelineContainer, rect, resp.translation, resp.sourceLang);
            });
        } catch (_) {}
    }, true);
}

function createTranslationBubble(container, rect, message, sourceLang) {
    const ui = document.createElement('div');
    ui.className = 'kayako-translate-preview';
    ui.style.cssText = `
        position: absolute;
        left: 0px;
        top: 0px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        padding: 10px 12px;
        z-index: 10000;
        max-width: 420px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        color: #333;
    `;
    ui.innerHTML = `
        <div style=\"display:flex;align-items:flex-start;gap:8px;width:100%;\">
            <span class=\"kayako-translate-text\" style=\"flex:1 1 auto; max-width:100%; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; display:block;\">${message}</span>
            <span class=\"kayako-translate-lang\" style=\"flex:0 0 auto;color:#ff8c00;font-weight:600;margin-left:8px;white-space:nowrap;\"></span>
            <button class=\"kayako-translate-copy\" title=\"Copy translation\" style=\"background:transparent;border:none;padding:0;width:18px;height:18px;cursor:pointer;opacity:.6;display:flex;align-items:center;justify-content:center;\">
                <svg viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><rect x=\"7\" y=\"3\" width=\"9\" height=\"9\" rx=\"2\" ry=\"2\" fill=\"none\" stroke=\"#666\" stroke-width=\"1.5\"></rect><rect x=\"4\" y=\"8\" width=\"9\" height=\"9\" rx=\"2\" ry=\"2\" fill=\"none\" stroke=\"#666\" stroke-width=\"1.5\"></rect></svg>
            </button>
            <button class=\"kayako-translate-close\" style=\"background:#f1f3f5;color:#333;border:1px solid #ddd;border-radius:4px;padding:2px 6px;cursor:pointer;\">✕</button>
        </div>
    `;
    // Position the bubble near selection
    if (container !== document.body && getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    container.appendChild(ui);
    // Set origin→EN label if known
    try {
        const langEl = ui.querySelector('.kayako-translate-lang');
        if (langEl) {
            let src = String(sourceLang || '').toUpperCase();
            if (src.indexOf('-') !== -1) src = src.split('-')[0];
            langEl.textContent = src ? `${src}→EN` : '';
        }
    } catch(_) {}
    ui._container = container;
    ui._rect = rect;
    // Constrain bubble width to container to avoid text appearing outside panel
    try {
        const cr = container.getBoundingClientRect();
        const maxW = Math.min(420, Math.max(160, (cr.width || container.clientWidth) - 16));
        ui.style.maxWidth = maxW + 'px';
    } catch(_) {}
    positionBubbleNearRect(ui, container, rect);

    // Dismiss logic
    const close = () => { try { ui.remove(); } catch(_) {} document.removeEventListener('click', onDoc, true); document.removeEventListener('keydown', onKey, true); };
    ui.querySelector('.kayako-translate-close').addEventListener('click', close);
    const onDoc = (ev) => { if (!ui.contains(ev.target)) close(); };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    setTimeout(() => { document.addEventListener('click', onDoc, true); document.addEventListener('keydown', onKey, true); }, 50);
    // Copy handler (tiny icon toggles to a check briefly)
    try {
        const copyBtn = ui.querySelector('.kayako-translate-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const textEl = ui.querySelector('.kayako-translate-text');
                const txt = textEl ? (textEl.textContent || '') : '';
                if (!txt) { showQuickNotification('Nothing to copy', 'error'); return; }
                const showTick = () => {
                    try {
                        copyBtn.style.opacity = '1';
                        copyBtn.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 10l3 3 7-7" fill="none" stroke="#2f9e44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="7" y="3" width="9" height="9" rx="2" ry="2" fill="none" stroke="#666" stroke-width="1.5"></rect><rect x="4" y="8" width="9" height="9" rx="2" ry="2" fill="none" stroke="#666" stroke-width="1.5"></rect></svg>';
                            copyBtn.style.opacity = '.6';
                        }, 1200);
                    } catch (_) {}
                };
                const fallback = () => {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = txt;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showQuickNotification('📋 Copied translation', 'success');
                        showTick();
                    } catch (_) {
                        showQuickNotification('Could not copy', 'error');
                    }
                };
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(txt).then(() => {
                            showQuickNotification('📋 Copied translation', 'success');
                            showTick();
                        }).catch(() => { fallback(); });
                    } else {
                        fallback();
                    }
                } catch (_) { fallback(); }
            });
        }
    } catch (_) {}
    return ui;
}

function updateTranslationBubble(ui, translation, sourceLang) {
    try {
        const textEl = ui.querySelector('.kayako-translate-text');
        const langEl = ui.querySelector('.kayako-translate-lang');
        if (textEl) textEl.textContent = translation || 'Translation unavailable';
        if (langEl) {
            let src = String(sourceLang || '').toUpperCase();
            if (src.indexOf('-') !== -1) src = src.split('-')[0];
            langEl.textContent = src ? `${src}→EN` : '';
        }
        // Re-clamp position in case size changed
        if (ui._container && ui._rect) {
            try {
                const cr = ui._container.getBoundingClientRect();
                const maxW = Math.min(420, Math.max(160, (cr.width || ui._container.clientWidth) - 16));
                ui.style.maxWidth = maxW + 'px';
            } catch(_) {}
            positionBubbleNearRect(ui, ui._container, ui._rect);
        }
    } catch (_) {}
}

function createOrUpdateTranslationBubble(container, rect, message, sourceLang) {
    // Remove any existing bubble
    const prior = document.querySelector('.kayako-translate-preview');
    if (prior) prior.remove();
    const ui = createTranslationBubble(container, rect, message, sourceLang);
    return ui;
}

function positionBubbleNearRect(ui, container, rect) {
    try {
        const containerRect = container.getBoundingClientRect();
        const padding = 8;
        let left = rect.left - containerRect.left;
        let top = rect.top - containerRect.top - ui.offsetHeight - padding;
        if (top < padding) top = rect.bottom - containerRect.top + padding;
        const maxLeft = (containerRect.width || container.clientWidth) - ui.offsetWidth - padding;
        left = Math.max(padding, Math.min(left, maxLeft));
        ui.style.left = left + 'px';
        ui.style.top = Math.max(padding, top) + 'px';
    } catch (_) {}
}

// Function to setup Cmd+K / Ctrl+K shortcut for hyperlink insertion
function setupHyperlinkShortcut() {
    // console.log('⌨️ Setting up Cmd+K / Ctrl+K hyperlink shortcut');
    
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

// Detect when plain URL text auto-converts into an anchor and offer title replacement
function setupAutoLinkSuggestionOnAutoAnchor(editor) {
    if (editor.dataset.autoLinkDetectSetup === 'true') return;
    editor.dataset.autoLinkDetectSetup = 'true';
    let scanTimer = null;
    const scheduleScan = () => {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
            try { scanEditorForAutoLinks(editor); } catch (_) {}
        }, 140);
    };
    editor.addEventListener('input', scheduleScan);
    editor.addEventListener('keyup', (e) => {
        if (e && (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab')) {
            scheduleScan();
        }
    });
}

function scanEditorForAutoLinks(editor) {
    try {
        const anchors = editor.querySelectorAll('a[href]');
        anchors.forEach(a => {
            try {
                if (a.dataset.titleSuggestChecked === '1') return;
                const text = (a.textContent || '').trim();
                const href = a.getAttribute('href') || a.href || '';
                if (!href) { a.dataset.titleSuggestChecked = '1'; return; }
                if (isLikelyRawUrlText(text, href)) {
                    a.dataset.titleSuggestChecked = '1';
                    // Give DOM a moment to settle, then suggest
                    setTimeout(() => { trySuggestTitleReplace(editor, href, 1); }, 50);
                }
            } catch (_) {}
        });
    } catch (_) {}
}

function isLikelyRawUrlText(text, href) {
    if (!text) return false;
    const t = String(text).trim();
    const h = String(href).trim();
    if (!t || !h) return false;
    // If the visible text itself looks like a URL/domain
    if (isValidURL(t)) return true;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t) && !t.includes(' ')) return true;
    // Normalize to compare ignoring protocol and trailing slash
    const norm = (s) => s.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
    return norm(t) === norm(h);
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
    // console.log('📏 Setting up auto-sizing functionality');
    
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
        
        // console.log('📏 Setting up auto-sizing for editor:', editor);
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

        // Expand when content changes (e.g., macro inserts template)
        const expandOnChange = () => {
            try { activateEditor(editor); } catch(_) {}
        };
        editor.addEventListener('input', expandOnChange);
        editor.addEventListener('fr-change', expandOnChange);
        
        // Always keep toolbar interactions expanding the editor
        setupToolbarButtonListeners(editor);

		// Watch for Kayako auto-linking (URL text becomes anchor after typing space/enter)
		setupAutoLinkSuggestionOnAutoAnchor(editor);

        // Set initial size based on current focus state and content
        if (document.activeElement === editor) {
            // Check if this is an empty editor on page load
            const isEmpty = isEditorEmpty(editor);
            if (isEmpty) {
                // console.log('📏 Found empty focused editor on page load - keeping minimized');
                // Keep minimized for reading, setup interaction listeners
                try {
                    chrome.storage.local.get(["editorMinHeight"], (data) => {
                        if (chrome.runtime.lastError) {
                            animateEditorToHeight(editor, defaultMinHeight);
                            return;
                        }
                        const minHeight = data.editorMinHeight || defaultMinHeight;
                        animateEditorToHeight(editor, minHeight);
                    });
                } catch (error) {
                    animateEditorToHeight(editor, defaultMinHeight);
                }
                setupFirstLoadInteractionListeners(editor);
            } else {
                // Has content, treat as normal focus
                handleEditorFocus(editor);
            }
        } else {
            handleEditorBlur(editor);
        }
    });
}

// Sidebar: collapse toggle and drag-to-resize (right-side details panel, not the side-conversations panel)
function setupSidebarControls() {
    try {
        const container = document.querySelector('[class*="ko-agent-content_layout__container_"]');
        if (!container) return;
        const sidebar = container.querySelector('[class*="ko-agent-content_layout__sidebar_"]');
        if (!sidebar) return;

        if (!document.getElementById('kayako-sidebar-controls-style')) {
            const style = document.createElement('style');
            style.id = 'kayako-sidebar-controls-style';
            style.textContent = `
                .kayako-sidebar-resizer { position:absolute; left:0; top:0; bottom:0; width:8px; cursor:col-resize; z-index:1000; }
                .kayako-sidebar-toggle { position:absolute; left:-18px; top:10px; width:16px; height:24px; border-radius:4px 0 0 4px; background:#f1f3f5; border:1px solid #d0d5d8; color:#333; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:1001; box-shadow:0 1px 3px rgba(0,0,0,.08); }
                .kayako-sidebar-toggle:hover { background:#e9ecef; }
                .kayako-sidebar-ui { pointer-events:auto !important; visibility:visible !important; }
                .kayako-sidebar-collapsed { width:12px !important; min-width:12px !important; max-width:12px !important; flex:0 0 12px !important; overflow:hidden !important; padding:0 !important; }
                .kayako-sidebar-collapsed > *:not(.kayako-sidebar-ui) { display:none !important; }
                .kayako-sidebar-collapsed .kayako-sidebar-toggle { left:0 !important; width:12px !important; height:24px; border-radius:0; }
            `;
            document.head.appendChild(style);
        }

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        if (getComputedStyle(sidebar).position === 'static') {
            sidebar.style.position = 'relative';
        }
        // Capture initial width once for fallback restores
        if (!sidebar.dataset.initialWidth) {
            try { sidebar.dataset.initialWidth = String(Math.round(sidebar.getBoundingClientRect().width || 360)); } catch(_) {}
        }

        if (!sidebar.querySelector('.kayako-sidebar-resizer')) {
            const resizer = document.createElement('div');
            resizer.className = 'kayako-sidebar-resizer kayako-sidebar-ui';
            sidebar.appendChild(resizer);

            let dragging = false; let startX = 0; let startW = 0; let rafQueued = false; let lastDX = 0;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const applyWidth = (w) => {
                sidebar.style.width = w + 'px';
                sidebar.style.minWidth = w + 'px';
                sidebar.style.maxWidth = w + 'px';
                sidebar.style.flex = `0 0 ${w}px`; 
            };
            const onMove = (e) => { lastDX = e.clientX - startX; if (!rafQueued) { rafQueued = true; requestAnimationFrame(() => { rafQueued = false; const newW = clamp(startW - lastDX, 12, 700); applyWidth(newW); try { chrome.storage.local.set({ sidebarWidth: newW, sidebarCollapsed: false }); } catch(_) {} }); } };
            const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; };
            resizer.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; startX = e.clientX; startW = sidebar.getBoundingClientRect().width; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor = 'col-resize'; });
        }

        if (!sidebar.querySelector('.kayako-sidebar-toggle')) {
            const toggle = document.createElement('div');
            toggle.className = 'kayako-sidebar-toggle kayako-sidebar-ui';
            toggle.title = 'Collapse/expand sidebar';
            toggle.textContent = '‹';
            sidebar.appendChild(toggle);

            const setIcon = (collapsed) => { toggle.textContent = collapsed ? '‹' : '›'; };
            const setCollapsed = (collapsed) => {
                if (collapsed) {
                    sidebar.classList.add('kayako-sidebar-collapsed');
                    // Ensure toggle visible inside the stub
                    toggle.style.left = '0px';
                } else {
                    sidebar.classList.remove('kayako-sidebar-collapsed');
                    // Restore width from storage or default
                    try {
                        chrome.storage.local.get(['sidebarDefaultWidth'], (d) => {
                            const initial = Number(sidebar.dataset.initialWidth) || Math.round(sidebar.getBoundingClientRect().width || 360);
                            const preferred = d && d.sidebarDefaultWidth ? Number(d.sidebarDefaultWidth) : initial || defaultSidebarWidth;
                            const w = Math.max(200, Math.min(700, preferred));
                            sidebar.style.width = w + 'px';
                            sidebar.style.minWidth = w + 'px';
                            sidebar.style.maxWidth = w + 'px';
                            sidebar.style.flex = `0 0 ${w}px`;
                            try { chrome.storage.local.set({ sidebarWidth: w }); } catch(_) {}
                        });
                    } catch(_) {}
                    // Float toggle into the gutter for easy click
                    toggle.style.left = '-18px';
                }
                try { chrome.storage.local.set({ sidebarCollapsed: collapsed }); } catch(_) {}
                setIcon(collapsed);
            };

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const collapsed = sidebar.classList.contains('kayako-sidebar-collapsed');
                if (!collapsed) {
                    // Save current width prior to collapsing
                    try { const w = sidebar.getBoundingClientRect().width; chrome.storage.local.set({ sidebarWidth: w }); } catch(_) {}
                }
                setCollapsed(!collapsed);
            });

            // Apply stored state on first setup
            try {
                chrome.storage.local.get(['sidebarCollapsed', 'sidebarWidth'], (d) => {
                    const collapsed = !!(d && d.sidebarCollapsed);
                    if (collapsed) {
                        sidebar.classList.add('kayako-sidebar-collapsed');
                        toggle.style.left = '0px';
                    } else if (d && d.sidebarWidth) {
                        const w = d.sidebarWidth;
                        sidebar.style.width = w + 'px';
                        sidebar.style.minWidth = w + 'px';
                        sidebar.style.maxWidth = w + 'px';
                        sidebar.style.flex = `0 0 ${w}px`;
                        toggle.style.left = '-18px';
                        if (!sidebar.dataset.initialWidth) { try { sidebar.dataset.initialWidth = String(w); } catch(_) {} }
                    }
                    setIcon(collapsed);
                });
            } catch(_) {}
        }
    } catch (_) {}
}

// Handle editor focus - smart sizing based on content and user intent
function handleEditorFocus(editor) {
    // Check if this is a "first load" scenario: editor is focused but empty
    const isEmpty = isEditorEmpty(editor);
    const isFirstLoad = isEmpty && !editor.dataset.userActivated;
    
    if (isFirstLoad) {
        // console.log('📏 Editor focused but empty on first load - keeping minimized for reading');
        // Keep at min height to give reading space
        try {
            chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
                if (chrome.runtime.lastError) {
                    animateEditorToHeight(editor, defaultMinHeight);
                    return;
                }
                const minHeight = data.editorMinHeight || defaultMinHeight;
                animateEditorToHeight(editor, minHeight);
            });
        } catch (error) {
            animateEditorToHeight(editor, defaultMinHeight);
        }
        
        // Setup one-time listeners for actual user interaction
        setupFirstLoadInteractionListeners(editor);
        
        // Also setup toolbar button listeners
        setupToolbarButtonListeners(editor);
        return;
    }
    
    // Normal focus behavior - grow to max height
    
    
    try {
        if (!isStorageAvailable()) {
            animateEditorToHeight(editor, defaultMaxHeight);
            return;
        }
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                
                animateEditorToHeight(editor, defaultMaxHeight);
                return;
            }
            
            const maxHeight = data.editorMaxHeight || defaultMaxHeight;
            animateEditorToHeight(editor, maxHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            
            animateEditorToHeight(editor, defaultMaxHeight);
        } else {
            console.error('Error getting max height for auto-sizing:', error);
        }
    }
}

// Handle editor blur - animate to min height
function handleEditorBlur(editor) {
    // console.log('📏 Editor blurred, shrinking to min height');
    // Do not shrink when the window/tab itself loses focus (user switched apps)
    try {
        if (window.__kayakoMacroActive) {
            // While macro selection UI is active, avoid shrinking
            return;
        }
        if (!document.hasFocus()) {
            // Skip shrink on window blur; we'll shrink later only on in-page interactions
            return;
        }
        // Only shrink on blur if the last page click was outside this editor's container
        const lastClick = window.__kayakoLastMouseDownTarget;
        const container = editor.closest('.ko-text-editor__container_1p5g6r');
        if (!lastClick || (container && container.contains(lastClick))) {
            return;
        }
    } catch (_) {}
    
    try {
        if (!isStorageAvailable()) {
            animateEditorToHeight(editor, defaultMinHeight);
            return;
        }
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                
                animateEditorToHeight(editor, defaultMinHeight);
                return;
            }
            
            const minHeight = data.editorMinHeight || defaultMinHeight;
            animateEditorToHeight(editor, minHeight);
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            
            animateEditorToHeight(editor, defaultMinHeight);
        } else {
            console.error('Error getting min height for auto-sizing:', error);
        }
    }
}

// Check if editor is empty (no meaningful content)
function isEditorEmpty(editor) {
    // Get the text content, ignoring HTML tags and whitespace
    const textContent = editor.textContent || editor.innerText || '';
    const cleanText = textContent.trim();
    
    // Also check for common empty states
    const innerHTML = editor.innerHTML.toLowerCase();
    const hasOnlyBrTags = innerHTML === '<br>' || innerHTML === '<div><br></div>' || innerHTML === '';
    const hasOnlyPlaceholder = innerHTML.includes('placeholder') && cleanText === '';
    
    const isEmpty = cleanText === '' || hasOnlyBrTags || hasOnlyPlaceholder;
    
    // console.log('📏 Editor empty check:', {
    //     textContent: `"${cleanText}"`,
    //     innerHTML: innerHTML.substring(0, 100),
    //     isEmpty: isEmpty
    // });
    
    return isEmpty;
}

// Setup listeners for first user interaction on empty, focused editors
function setupFirstLoadInteractionListeners(editor) {
    // Don't setup if already waiting for activation or already activated
    if (editor.dataset.waitingForActivation === 'true' || editor.dataset.userActivated === 'true') {
        return;
    }
    
    // console.log('📏 Setting up first-load interaction listeners');
    
    // Mark that we're waiting for user activation
    editor.dataset.waitingForActivation = 'true';
    
    // Create handlers that will clean themselves up
    const clickHandler = (e) => {
        console.log('📏 User clicked in empty editor - activating and expanding');
        activateEditor(editor);
        cleanupAllFirstLoadListeners(editor, { clickHandler, keydownHandler, inputHandler, pasteHandler });
    };
    
    const keydownHandler = (e) => {
        // Only activate on actual typing keys, not navigation keys
        if (isTypingKey(e.key)) {
            console.log('📏 User started typing in empty editor - activating and expanding');
            activateEditor(editor);
            cleanupAllFirstLoadListeners(editor, { clickHandler, keydownHandler, inputHandler, pasteHandler });
        }
    };
    
    const inputHandler = (e) => {
        if (!isEditorEmpty(e.target)) {
            console.log('📏 Content added to empty editor - activating and expanding');
            activateEditor(editor);
            cleanupAllFirstLoadListeners(editor, { clickHandler, keydownHandler, inputHandler, pasteHandler });
        }
    };
    
    const pasteHandler = (e) => {
        console.log('📏 User pasted in empty editor - activating and expanding');
        activateEditor(editor);
        cleanupAllFirstLoadListeners(editor, { clickHandler, keydownHandler, inputHandler, pasteHandler });
    };
    
    editor.addEventListener('click', clickHandler);
    editor.addEventListener('keydown', keydownHandler);
    editor.addEventListener('input', inputHandler);
    editor.addEventListener('paste', pasteHandler);
    
    // Store reference to handlers for cleanup
    editor._firstLoadHandlers = { clickHandler, keydownHandler, inputHandler, pasteHandler };
}

// Setup toolbar button listeners for first-load editors
function setupToolbarButtonListeners(editor) {
    // Find the toolbar associated with this editor
    const container = editor.closest('.ko-text-editor__container_1p5g6r');
    if (!container) {
        console.log('📏 Could not find editor container for toolbar listeners');
        return;
    }

    const toolbar = container.querySelector('.ko-text-editor__header_1p5g6r');
    if (!toolbar) {
        console.log('📏 Could not find toolbar for editor');
        return;
    }

    // Don't setup twice
    if (toolbar.dataset.autoSizeListenersSetup === 'true') {
        return;
    }

    // console.log('📏 Setting up toolbar listeners (delegated, capture)');

    // Helper to determine if an element within the toolbar should trigger expansion
    const isInteractive = (el) => {
        return !!el.closest(`
            .kayako-ai-dropdown,
            .ko-case_macro-selector__trigger_ltxhiw,
            .ko-case_macro-selector_trigger__trigger_7wpnlb,
            .ember-basic-dropdown-trigger,
            .ko-text-editor__itemWrap_1p5g6r,
            button,
            [role="button"],
            [tabindex]
        `);
    };

    const delegatedHandler = (e) => {
        if (isInteractive(e.target)) {
            // Ensure the editor stays expanded even if it blurs
            setTimeout(() => {
                activateEditor(editor);
                // Froala/Kayako may re-render the editor on macro/app actions; re-attach auto-sizing shortly after
                setTimeout(() => {
                    try { setupEditorAutoSizing(); } catch(_) {}
                }, 50);
            }, 0);

            // If this is the Macro trigger/dropdown trigger, mark macro as active so blur won't shrink
            const isMacroTrigger = !!e.target.closest('.ko-case_macro-selector__trigger_ltxhiw, .ko-case_macro-selector_trigger__trigger_7wpnlb, .ember-basic-dropdown-trigger');
            if (isMacroTrigger) {
                window.__kayakoMacroActive = true;
                window.__kayakoLastMacroEditor = editor;
            }
        }
    };

    // Use capture so we run before other handlers that might stop propagation
    toolbar.addEventListener('mousedown', delegatedHandler, true);
    toolbar.addEventListener('click', delegatedHandler, true);

    toolbar.dataset.autoSizeListenersSetup = 'true';
}

// Clean up toolbar listeners after activation
function cleanupToolbarListeners(toolbar, buttons, handler) {
    console.log('📏 Cleaning up toolbar listeners');
    
    buttons.forEach(button => {
        button.removeEventListener('click', handler);
    });
    
    delete toolbar._autoSizeHandler;
    delete toolbar._autoSizeButtons;
    toolbar.dataset.autoSizeListenersSetup = 'false';
}

// Clean up all first load listeners after activation
function cleanupAllFirstLoadListeners(editor, handlers) {
    console.log('📏 Cleaning up all first-load listeners');
    
    // Clean up editor listeners
    editor.removeEventListener('click', handlers.clickHandler);
    editor.removeEventListener('keydown', handlers.keydownHandler);
    editor.removeEventListener('input', handlers.inputHandler);
    editor.removeEventListener('paste', handlers.pasteHandler);
    
    // Clear the stored handlers
    delete editor._firstLoadHandlers;
    editor.dataset.firstLoadHandlers = 'false';
    
    // Also clean up toolbar listeners if they exist
    const container = editor.closest('.ko-text-editor__container_1p5g6r');
    if (container) {
        const toolbar = container.querySelector('.ko-text-editor__header_1p5g6r');
        if (toolbar && toolbar._autoSizeHandler && toolbar._autoSizeButtons) {
            cleanupToolbarListeners(toolbar, toolbar._autoSizeButtons, toolbar._autoSizeHandler);
        }
    }
}

// Activate editor for real editing (expand to max height)
function activateEditor(editor) {
    // console.log('📏 Activating editor for real use');
    
    // Mark as user activated
    editor.dataset.userActivated = 'true';
    editor.dataset.waitingForActivation = 'false';
    
    // Expand to max height
    try {
        if (!isStorageAvailable()) {
            animateEditorToHeight(editor, defaultMaxHeight);
            return;
        }
        chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
            if (chrome.runtime.lastError) {
                animateEditorToHeight(editor, defaultMaxHeight);
                return;
            }
            
            const maxHeight = data.editorMaxHeight || defaultMaxHeight;
            animateEditorToHeight(editor, maxHeight);
        });
    } catch (error) {
        animateEditorToHeight(editor, defaultMaxHeight);
    }
}

// Check if a key is a typing key (not navigation)
function isTypingKey(key) {
    // Exclude navigation and modifier keys
    const nonTypingKeys = [
        'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'PageUp', 'PageDown',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Escape', 'Insert', 'Delete'
    ];
    
    return !nonTypingKeys.includes(key) && key.length === 1;
}

// Animate editor to specific height
function animateEditorToHeight(editor, targetHeight) {
    // console.log('📏 Animating editor to height:', targetHeight + 'px');
    
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

// Function to setup ticket history tracking
function setupTicketHistoryTracking() {
    // console.log('📚 Setting up ticket history tracking');
    
    // Listen for clicks on Send buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Check if this is a Send button or contains Send text
        const isSendButton = (
            target.matches('button[class*="ko-button__primary"], button[class*="ko-button__shared"]') ||
            target.closest('button[class*="ko-button__primary"], button[class*="ko-button__shared"]')
        ) && (
            target.textContent?.includes('Send') ||
            target.querySelector?.('span')?.textContent?.includes('Send') ||
            target.closest('button')?.textContent?.includes('Send')
        );
        
        if (isSendButton) {
            console.log('📚 Send button clicked - tracking ticket');
            trackCurrentTicket();
            // Also minimize the relevant editor so user can review the ticket
            try {
                setTimeout(() => {
                    try {
                        const btn = target.closest('button') || target;
                        const container = btn?.closest?.('.ko-text-editor__container_1p5g6r') || document.querySelector('.ko-text-editor__container_1p5g6r');
                        const candidates = container ? container.querySelectorAll('.fr-element') : document.querySelectorAll('.fr-element');
                        if (!candidates || candidates.length === 0) return;
                        chrome.storage.local.get(["editorMinHeight"], (data) => {
                            const minHeight = (data && data.editorMinHeight) ? data.editorMinHeight : defaultMinHeight;
                            candidates.forEach((ed) => {
                                try { animateEditorToHeight(ed, minHeight); } catch(_) {}
                            });
                        });
                    } catch (_) {}
                }, 0);
            } catch (_) {}
        }
    });
}

// Function to track the current ticket
function trackCurrentTicket() {
    try {
        // Extract ticket information from the current page
        const ticketInfo = extractTicketInfo();
        
        if (ticketInfo) {
            console.log('📚 Extracted ticket info:', ticketInfo);
            saveTicketToHistory(ticketInfo);
        } else {
            console.log('📚 Could not extract ticket information');
        }
    } catch (error) {
        console.error('Error tracking ticket:', error);
    }
}

// Function to extract ticket information from the current page
function extractTicketInfo() {
    try {
        // Get ticket ID from URL (support both /conversation/ and /conversations/)
        const urlMatch = window.location.href.match(/\/agent\/conversations?\/(\d+)/);
        const ticketId = urlMatch ? urlMatch[1] : null;
        
        if (!ticketId) {
            console.log('📚 No ticket ID found in URL');
            return null;
        }
        
        // Try to extract ticket title/subject
        let title = '';
        const titleSelectors = [
            '.ko-conversation-header__subject',
            '.conversation-header__subject',
            '[class*="subject"]',
            'h1', 'h2', 'h3'
        ];
        
        for (const selector of titleSelectors) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                title = titleElement.textContent.trim();
                break;
            }
        }
        
        // Fallback title if none found
        if (!title) {
            title = `Ticket #${ticketId}`;
        }
        
        // Get customer/user info if available
        let customer = '';
        const customerSelectors = [
            '.ko-conversation-header__requester',
            '.conversation-header__requester', 
            '[class*="requester"]',
            '[class*="customer"]'
        ];
        
        for (const selector of customerSelectors) {
            const customerElement = document.querySelector(selector);
            if (customerElement && customerElement.textContent.trim()) {
                customer = customerElement.textContent.trim();
                break;
            }
        }
        
        return {
            id: ticketId,
            title: title.substring(0, 100), // Limit length
            customer: customer.substring(0, 50), // Limit length
            url: window.location.href,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            domain: window.location.hostname
        };
        
    } catch (error) {
        console.error('Error extracting ticket info:', error);
        return null;
    }
}

// Function to save ticket to history
function saveTicketToHistory(ticketInfo) {
    try {
        chrome.storage.local.get(['ticketHistory'], (data) => {
            if (chrome.runtime.lastError) {
                console.log('Could not access storage for ticket history');
                return;
            }
            
            let history = data.ticketHistory || [];
            
            // Remove any existing entry for this ticket ID to avoid duplicates
            history = history.filter(ticket => ticket.id !== ticketInfo.id);
            
            // Add new entry at the beginning
            history.unshift(ticketInfo);
            
            // Keep only last 100 tickets to avoid storage bloat
            if (history.length > 100) {
                history = history.slice(0, 100);
            }
            
            // Save back to storage
            chrome.storage.local.set({ ticketHistory: history }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving ticket history:', chrome.runtime.lastError);
                } else {
                    console.log('📚 Ticket saved to history:', ticketInfo.id);
                    showQuickNotification(`📚 Ticket #${ticketInfo.id} tracked`, 'success');
                    // After send, poll briefly and baseline to include our own new post
                    try {
                        chrome.runtime.sendMessage({ action: 'baselineAfterSend', domain: ticketInfo.domain, ticketId: ticketInfo.id });
                    } catch (_) {}
                }
            });
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated, could not save ticket history');
        } else {
            console.error('Error saving ticket to history:', error);
        }
    }
}

// Function to get ticket history for popup
function getTicketHistory(sendResponse) {
    try {
        chrome.storage.local.get(['ticketHistory'], (data) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: 'Could not access storage' });
                return;
            }
            
            const history = data.ticketHistory || [];
            sendResponse({ success: true, history: history });
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Function to delete ticket from history
function deleteTicketFromHistory(ticketId, sendResponse) {
    try {
        chrome.storage.local.get(['ticketHistory'], (data) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: 'Could not access storage' });
                return;
            }
            
            let history = data.ticketHistory || [];
            const originalLength = history.length;
            
            // Remove the ticket
            history = history.filter(ticket => ticket.id !== ticketId);
            
            chrome.storage.local.set({ ticketHistory: history }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: 'Could not save changes' });
                } else {
                    console.log('📚 Deleted ticket from history:', ticketId);
                    sendResponse({ 
                        success: true, 
                        removed: originalLength !== history.length,
                        history: history 
                    });
                }
            });
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Function to manually add ticket to history
function addTicketToHistory(ticketInfo, sendResponse) {
    try {
        chrome.storage.local.get(['ticketHistory'], (data) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: 'Could not access storage' });
                return;
            }
            
            let history = data.ticketHistory || [];
            
            // Remove any existing entry for this ticket ID
            history = history.filter(ticket => ticket.id !== ticketInfo.id);
            
            // Add new entry at the beginning
            history.unshift({
                ...ticketInfo,
                timestamp: Date.now(),
                date: new Date().toISOString()
            });
            
            // Keep only last 100 tickets
            if (history.length > 100) {
                history = history.slice(0, 100);
            }
            
            chrome.storage.local.set({ ticketHistory: history }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: 'Could not save changes' });
                } else {
                    console.log('📚 Manually added ticket to history:', ticketInfo.id);
                    // Notify background to baseline latest activity for this ticket
                    try {
                        chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain: ticketInfo.domain, ticketId: ticketInfo.id });
                    } catch (_) {}
                    sendResponse({ success: true, history: history });
                }
            });
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
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
        } else if (request.action === "getTicketHistory") {
            getTicketHistory(sendResponse);
            return true; // Keep channel open for async response
        } else if (request.action === "deleteTicketFromHistory") {
            deleteTicketFromHistory(request.ticketId, sendResponse);
            return true;
        } else if (request.action === "addTicketToHistory") {
            addTicketToHistory(request.ticketInfo, sendResponse);
            return true;
        } else if (request.action === "getSidebarWidth") {
            try {
                const container = document.querySelector('[class*="ko-agent-content_layout__container_"]');
                const sidebar = container ? container.querySelector('[class*="ko-agent-content_layout__sidebar_"]') : null;
                const collapsed = !!(sidebar && sidebar.classList.contains('kayako-sidebar-collapsed'));
                const rectW = sidebar ? Math.round(sidebar.getBoundingClientRect().width || 0) : 0;
                if (!isStorageAvailable()) {
                    sendResponse({ success: true, width: collapsed ? defaultSidebarWidth : (rectW || defaultSidebarWidth), collapsed });
                } else {
                    chrome.storage.local.get(['sidebarWidth', 'sidebarDefaultWidth'], (d) => {
                        const stored = d && d.sidebarWidth ? Number(d.sidebarWidth) : 0;
                        const pref = d && d.sidebarDefaultWidth ? Number(d.sidebarDefaultWidth) : defaultSidebarWidth;
                        const width = collapsed ? (stored || pref || defaultSidebarWidth) : (rectW || stored || pref || defaultSidebarWidth);
                        sendResponse({ success: true, width: width, collapsed });
                    });
                    return true;
                }
            } catch (e) {
                sendResponse({ success: false, error: e?.message || String(e) });
            }
            return true;
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
        narrowInternalNotes();
        // Ensure sidebar controls exist
        setupSidebarControls();
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
narrowInternalNotes();
setupAutoHyperlinking();
setupHyperlinkShortcut();
setupAutoSizing();
setupSidebarControls();
setupTicketHistoryTracking();
try { if (typeof setupInlineTranslation === 'function') { setupInlineTranslation(); } } catch (_) {}

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

// Shrink expanded editors when clicking elsewhere in the page (but not on window blur)
// This ensures that after returning from another app, the next in-page click outside
// the editor container will shrink it if appropriate.
document.addEventListener('mousedown', (e) => {
    try {
        // Record last page click target to coordinate with blur logic
        window.__kayakoLastMouseDownTarget = e.target;
        if (!document.hasFocus()) return; // ignore when switching apps
        // If user is clicking within macro dropdown/search UI, keep macro active and avoid shrinking
        const inMacroMenu = !!e.target.closest('.ember-basic-dropdown-content, .ember-power-select-options, [class*="macro"][class*="dropdown"], [data-test-id*="macro"]');
        if (inMacroMenu) {
            window.__kayakoMacroActive = true;
        } else {
            // Clicking anywhere else clears macro-active state
            window.__kayakoMacroActive = false;
            window.__kayakoLastMacroEditor = null;
        }
        const clickContainer = e.target.closest('.ko-text-editor__container_1p5g6r');
        const editors = document.querySelectorAll('.fr-element');
        editors.forEach((ed) => {
            const edContainer = ed.closest('.ko-text-editor__container_1p5g6r');
            if (!edContainer) return;
            // If the click is outside this editor's container and the editor isn't focused, shrink it
            if (!window.__kayakoMacroActive && clickContainer !== edContainer) {
                handleEditorBlur(ed);
            }
        });
    } catch (_) {}
}, true);

// When a macro option is selected, re-expand the last macro editor and clear macro-active flag
document.addEventListener('click', (e) => {
    try {
        if (!window.__kayakoMacroActive) return;
        const inMacroMenu = !!e.target.closest('.ember-basic-dropdown-content, .ember-power-select-options, [class*="macro"][class*="dropdown"], [data-test-id*="macro"]');
        if (inMacroMenu) {
            const ed = window.__kayakoLastMacroEditor;
            setTimeout(() => {
                try { if (ed) activateEditor(ed); } catch(_) {}
                window.__kayakoMacroActive = false;
                window.__kayakoLastMacroEditor = null;
            }, 0);
        }
    } catch (_) {}
}, true);