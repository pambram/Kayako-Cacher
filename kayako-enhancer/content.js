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

// Wait for the extension runtime to become available again (e.g., after reload)
function waitForRuntimeAvailable(timeoutMs = 6000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
            if (isRuntimeAvailable()) {
                resolve(true);
                return;
            }
            if (Date.now() - start >= timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(tick, 300);
        };
        tick();
    });
}

// Track permanent invalidation (occurs when extension is reloaded; page must refresh)
let runtimePermanentlyInvalidated = false;
let runtimeInvalidationLogged = false;
function markRuntimeInvalidated(reason) {
    runtimePermanentlyInvalidated = true;
    if (!runtimeInvalidationLogged) {
        console.log('🛑 Extension runtime invalidated – page reload required for title suggestions.', reason || '');
        runtimeInvalidationLogged = true;
    }
}

// Ensure a stable per-editor id for de-duping suggestion prompts
function ensureEditorUid(editor) {
    try {
        if (!editor || !editor.dataset) return 'ed0';
        if (!editor.dataset.kayakoEditorUid) {
            editor.dataset.kayakoEditorUid = 'ed' + Date.now() + '_' + Math.random().toString(36).slice(2);
        }
        return editor.dataset.kayakoEditorUid;
    } catch (_) { return 'ed0'; }
}

// Quick presence check: is the URL currently present as anchor or raw text inside editor?
function isUrlPresentInEditor(editor, url) {
    try {
        if (!editor || !url) return false;
        if (findAnchorForURL(editor, url)) return true;
        const u = String(url);
        const uHttps = u.replace(/^http:\/\//i, 'https://');
        const uHttp = u.replace(/^https:\/\//i, 'http://');
        const txt = (editor.innerText || editor.textContent || '');
        return txt.includes(u) || txt.includes(uHttps) || txt.includes(uHttp);
    } catch (_) { return false; }
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

// Ensure the hidden side panel doesn't reserve layout space when closed
function ensureSidePanelClosedFixStyle() {
    if (document.getElementById('kayako-side-panel-closed-fix')) return;
    try {
        const style = document.createElement('style');
        style.id = 'kayako-side-panel-closed-fix';
        style.textContent = `
            /* When side panel is not open, force it to occupy no width */
            .side-conversations-panel__side-panel_4k6b2r:not(.side-conversations-panel__open_4k6b2r) {
                width: 0 !important;
                min-width: 0 !important;
                max-width: 0 !important;
                flex-basis: 0 !important;
            }
        `;
        document.head.appendChild(style);
    } catch(_) {}
}

// Clear inline widths on side panel when it closes to avoid leftover whitespace
function normalizeSidePanelSpace() {
    try {
        const panels = document.querySelectorAll('.side-conversations-panel__side-panel_4k6b2r');
        panels.forEach((p) => {
            const isOpen = p.classList.contains('side-conversations-panel__open_4k6b2r');
            if (!isOpen) {
                p.style.minWidth = '';
                p.style.width = '';
                p.style.maxWidth = '';
            }
        });
    } catch (_) {}
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
        
        // If no selection (collapsed) and clipboard contains ONLY a standalone raw URL,
        // let paste happen, then offer title replacement. If other text exists too,
        // skip here (auto-link scan will catch the URL later if needed).
        if (!selection.rangeCount || selection.isCollapsed) {
            if (clipboardText) {
                // If clipboard already contains a titled <a>, skip entirely
                try {
                    const titled = extractTitledAnchorFromClipboardEvent(e);
                    if (titled) {
                        console.log('🛑 Skipping title suggestion: clipboard already has titled link →', titled.text);
                        return;
                    }
                } catch (_) {}
                const standalone = extractStandaloneUrl(clipboardText);
                if (standalone) {
                    console.log('📎 Pasted standalone URL, will suggest title:', standalone);
                    // Give the editor a moment to insert/auto-link, then suggest replacement
                    setTimeout(() => {
                        trySuggestTitleReplace(target, standalone, 1);
                    }, 150);
                } else {
                    // Not just a URL → do nothing now; rely on auto-link scan after paste
                    setTimeout(() => { try { scanEditorForAutoLinks(target.closest('.fr-element, [contenteditable="true"]') || document.querySelector('.fr-element')); } catch(_) {} }, 250);
                }
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
        if (runtimePermanentlyInvalidated) {
            console.log('⚠️ runtime permanently invalidated; aborting title fetch until page reload');
            return;
        }
        // Skip if URL is no longer present (user deleted quickly)
        if (!isUrlPresentInEditor(editor, url)) {
            return;
        }
        // If an anchor exists for this URL and its visible text is NOT a raw URL,
        // then the link is already titled; skip fetching/suggesting entirely.
        try {
            const a = findAnchorForURL(editor, url);
            if (a) {
                const visible = (a.textContent || '').trim();
                if (visible && !isLikelyRawUrlText(visible, url)) {
                    return;
                }
            }
        } catch (_) {}
        // De-dupe: avoid parallel/rapid duplicate requests for same editor+URL
        const edKey = ensureEditorUid(editor);
        window.__kayakoSuggestInflight = window.__kayakoSuggestInflight || Object.create(null);
        const inflightKey = edKey + '|' + url;
        const nowTs = Date.now();
        const prevTs = window.__kayakoSuggestInflight[inflightKey] || 0;
        if (nowTs - prevTs < 2500) {
            return;
        }
        // Cancel if selection-based flow has been cancelled
        try {
            if (window.__kayakoSelCancel && window.__kayakoSelCancel[inflightKey]) {
                return;
            }
        } catch(_) {}
        window.__kayakoSuggestInflight[inflightKey] = nowTs;
        // Avoid duplicate prompts for same URL if one is already showing
        const existing = document.querySelector('.kayako-link-title-suggestion');
        if (existing && existing.dataset.url === url) {
            return;
        }
        
        // Ask background to fetch the page title
        let ver = 'unknown';
        try { if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) { ver = chrome.runtime.getManifest().version; } } catch (_) { ver = 'unknown'; }
        console.log('📡 Requesting page title from background for URL:', url, 'enhancer v', ver);
        let responded = false;
        let cancelled = false;
        const cancelIfInput = () => { cancelled = true; };
        try { editor.addEventListener('input', cancelIfInput, { once: true }); } catch(_) {}
        const timeoutId = setTimeout(() => {
            if (!responded) {
                console.log('⏳ No response from service worker for title within 2s. Pinging…');
                if (isRuntimeAvailable()) {
                    try {
                        chrome.runtime.sendMessage({ action: 'ping' }, (pong) => {
                            const err = chrome.runtime?.lastError;
                            if (err) {
                                console.log('⚠️ ping error:', err.message);
                                if (/invalidated/i.test(err.message || '')) { markRuntimeInvalidated('ping'); }
                            } else {
                                console.log('🏓 ping response:', pong);
                            }
                        });
                    } catch (e) {
                        const msg = e?.message || String(e || '');
                        console.log('⚠️ ping threw:', msg);
                        if (/invalidated/i.test(msg)) { markRuntimeInvalidated('ping-throw'); }
                    }
                } else {
                    console.log('⚠️ runtime unavailable, skipping ping');
                }
            }
        }, 2000);
        if (!isRuntimeAvailable()) {
            console.log('⚠️ runtime unavailable, will retry shortly to request fetchPageTitle');
            waitForRuntimeAvailable(8000).then((ok) => {
                if (ok && !runtimePermanentlyInvalidated) {
                    try { suggestReplaceURLWithTitle(editor, url); } catch (_) {}
                } else {
                    console.log('⚠️ runtime still unavailable after wait; giving up for now');
                }
            });
            return;
        }
        chrome.runtime.sendMessage({ action: 'fetchPageTitle', url: url }, (response) => {
            responded = true;
            clearTimeout(timeoutId);
            const err = chrome.runtime?.lastError;
            if (err) {
                console.log('⚠️ sendMessage error:', err.message);
                if (/invalidated/i.test(err.message || '')) { markRuntimeInvalidated('sendMessage'); return; }
            }
            // If user edited or URL disappeared meanwhile, abort quietly
            try { editor.removeEventListener('input', cancelIfInput); } catch(_) {}
            if (cancelled || (window.__kayakoSelCancel && window.__kayakoSelCancel[inflightKey]) || !isUrlPresentInEditor(editor, url)) {
                return;
            }
            if (!response || !response.success || !response.title) {
                console.log('⚠️ No title available for', url);
                return;
            }
            const titleRaw = String(response.title).trim();
            let title = decodeHtmlEntities(titleRaw).trim();
            // Special-case adjustment for Kayako KB pages
            title = adjustTitleForKayako(url, title);
            if (!title || title.length === 0) {
                console.log('⚠️ Empty title for', url);
                return;
            }
            if (titlesEquivalentOrUrlLike(title, url)) {
                console.log('⚠️ Title looks like URL or equals URL, skipping suggestion for', url, 'title:', title);
                return;
            }
            // If an anchor exists and its current visible text already equals this title, skip
            try {
                const a = findAnchorForURL(editor, url);
                if (a) {
                    const norm = (s) => decodeHtmlEntities(String(s || '')).replace(/\s+/g,' ').trim().toLowerCase();
                    const visible = (a.textContent || '').trim();
                    if (norm(visible) === norm(title)) {
                        return;
                    }
                }
            } catch (_) {}
            
            // Build and show suggestion UI
            console.log('🏷️ Title fetched:', title);
            try {
                // If selection-based flow was cancelled meanwhile, skip UI
                if (window.__kayakoSelCancel && window.__kayakoSelCancel[inflightKey]) return;
                createOrUpdateLinkSuggestion(editor, url, title);
            } finally {
                // allow a new prompt for this URL after a short cooldown
                setTimeout(() => { try { if (window.__kayakoSuggestInflight) delete window.__kayakoSuggestInflight[inflightKey]; } catch(_) {} }, 800);
            }
        });
    } catch (error) {
        const msg = error?.message || String(error || '');
        console.log('Title suggestion failed:', msg);
        if (/invalidated/i.test(msg)) { markRuntimeInvalidated('catch'); }
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

// For knowledge/support portals, trim trailing brand suffix like
// " - DNN Corp. Customer Support" / " - Help Center" from fetched titles.
function adjustTitleForKayako(url, title) {
    try {
        if (!url || !title) return title;
        const u = new URL(url, window.location.href);
        const host = String(u.hostname || '').toLowerCase();
        const parts = String(title).split(/\s[-–—]\s/);
        if (parts.length < 2) return title;
        const last = parts[parts.length - 1].replace(/[\s.]+$/g, '').toLowerCase();
        // Common help/support suffixes
        const isCommonSuffix = /(help\s*center|customer\s*support|support(?:\s*center|\s*portal)?|knowledge\s*base|knowledgebase|support\s*desk|supportdesk|customer\s*care|documentation|docs|community)\b/.test(last);
        // Host-token match: if the suffix mostly repeats the host/brand (e.g., "GFI Archiver")
        const hostTokens = host.split(/[.\-]/).filter(Boolean).filter(t => !/^(www|com|net|org|io|co|us|uk|de|fr|es|it|br|ca|au|in|jp|cn|dev|app|cloud|support|help|kb|docs?)$/.test(t));
        const suffixTokens = last.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        let sharedCount = 0;
        try {
            const set = new Set(hostTokens);
            for (const tok of suffixTokens) {
                if (tok.length >= 3 && set.has(tok)) sharedCount++;
            }
        } catch (_) {}
        if (isCommonSuffix || sharedCount >= 2) {
            parts.pop();
            const trimmed = parts.join(' - ').trim();
            return trimmed || title;
        }
        return title;
    } catch (_) { return title; }
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

    // Auto-dismiss if the URL disappears due to user deletion/edits
    let verifyTimer = null;
    try {
        verifyTimer = setInterval(() => {
            if (!isUrlPresentInEditor(editor, url)) {
                try { ui.remove(); } catch(_) {}
                try { document.removeEventListener('keydown', keydownHandler, true); } catch(_) {}
                try { clearInterval(verifyTimer); } catch(_) {}
            }
        }, 300);
    } catch (_) {}
    const cleanupVerify = () => { try { clearInterval(verifyTimer); } catch(_) {} };
    ui.addEventListener('click', cleanupVerify, { once: true });

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
        // Selection-based override: if we initiated from a selection, use its exact text
        let matchText = url;
        try {
            if (window.__kayakoSelectionOverrides && window.__kayakoSelectionOverrides[url]) {
                matchText = window.__kayakoSelectionOverrides[url];
            }
        } catch (_) {}
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const idx = node.nodeValue.indexOf(matchText);
            if (idx !== -1) {
                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + matchText.length);
                const link = document.createElement('a');
                link.href = url;
                link.textContent = cleanTitle;
                link.target = '_blank';
                range.deleteContents();
                range.insertNode(link);
                try { if (window.__kayakoSelectionOverrides) delete window.__kayakoSelectionOverrides[url]; } catch(_) {}
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

// Extract a single standalone raw URL from plain text; return null if the
// text contains any additional non-URL content besides trivial whitespace
function extractStandaloneUrl(text) {
    try {
        let s = String(text || '').trim();
        // Collapse whitespace/newlines to a single space and trim
        s = s.replace(/\s+/g, ' ').trim();
        const m = s.match(/^(https?:\/\/[\S<>]+|www\.[\S<>]+)$/i);
        if (!m) return null;
        // Strip trailing punctuation commonly copied with URLs
        let url = m[1].replace(/[),.;:!?]+$/, '');
        if (/^www\./i.test(url)) url = 'http://' + url;
        return isValidURL(url) ? url : null;
    } catch (_) {
        return null;
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

// When the user selects a whole raw URL inside the editor, offer to replace
// it with the page title by fetching in the background.
function setupSelectedUrlSuggestion(editor) {
    try {
        if (editor.dataset.selectedUrlSuggestSetup === 'true') return;
        editor.dataset.selectedUrlSuggestSetup = 'true';
        let selTimer = null;
        let activeKey = null;
        const cancelActive = () => {
            try {
                if (!activeKey) return;
                window.__kayakoSelCancel = window.__kayakoSelCancel || Object.create(null);
                window.__kayakoSelCancel[activeKey] = true;
                const ui = document.querySelector('.kayako-link-title-suggestion');
                if (ui) ui.remove();
                activeKey = null;
            } catch(_) {}
        };
        const scheduleCheck = () => {
            try { if (selTimer) clearTimeout(selTimer); } catch(_) {}
            selTimer = setTimeout(() => {
                try {
                    const sel = window.getSelection && window.getSelection();
                    if (!sel || !sel.rangeCount || sel.isCollapsed) { cancelActive(); return; }
                    const range = sel.getRangeAt(0);
                    const sc = range.startContainer, ec = range.endContainer;
                    if (!editor.contains(sc) || !editor.contains(ec)) { cancelActive(); return; }
                    const raw = String(sel.toString() || '');
                    const m = raw.match(/^\s*(https?:\/\/\S+|www\.\S+)\s*$/i);
                    if (!m) { cancelActive(); return; }
                    const displayUrl = m[1];
                    // Build fetch URL but keep display text exact
                    const fetchUrl = /^www\./i.test(displayUrl) ? ('http://' + displayUrl) : displayUrl;
                    const edKey = ensureEditorUid(editor);
                    const key = edKey + '|' + fetchUrl;
                    window.__kayakoSelectionOverrides = window.__kayakoSelectionOverrides || Object.create(null);
                    window.__kayakoSelectionOverrides[fetchUrl] = displayUrl;
                    window.__kayakoSelCancel = window.__kayakoSelCancel || Object.create(null);
                    window.__kayakoSelCancel[key] = false;
                    activeKey = key;
                    // Use direct call with resolved editor
                    suggestReplaceURLWithTitle(editor, fetchUrl);
                } catch (_) {}
            }, 120);
        };
        // React to changes in selection and mouse/keyboard adjustments
        document.addEventListener('selectionchange', scheduleCheck, true);
        editor.addEventListener('mouseup', scheduleCheck, true);
        editor.addEventListener('keyup', scheduleCheck, true);
    } catch (_) {}
}

// Attempt to manually auto-link a raw URL immediately before the caret when
// Space/Enter is pressed, even if there is trailing content to the right.
function tryManualAutolinkAtCaret(editor) {
    try {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return false;
        let node = range.startContainer;
        let offset = range.startOffset;
        // Normalize to a text node at/before caret
        if (node.nodeType !== 3) {
            // Find deepest text node before current offset
            let cursor = node;
            if (cursor.childNodes && cursor.childNodes.length) {
                let i = Math.min(offset, cursor.childNodes.length) - 1;
                for (; i >= 0; i--) {
                    let n = cursor.childNodes[i];
                    while (n && n.nodeType === 1 && n.lastChild) n = n.lastChild;
                    if (n && n.nodeType === 3) { node = n; offset = n.nodeValue.length; break; }
                }
            }
            if (node.nodeType !== 3) return false;
        }
        const left = String(node.nodeValue || '').slice(0, offset);
        if (!left) return false;
        // Allow trailing whitespace after URL (user just pressed space/enter)
        const trimmedEnd = left.replace(/\s+$/,'');
        const m = trimmedEnd.match(/(https?:\/\/[^\s)<>]+)$/i);
        if (!m) return false;
        const urlText = m[1];
        if (!isValidURL(urlText)) return false;
        // Avoid if already an anchor exists for the same URL
        try { if (findAnchorForURL(editor, urlText)) return false; } catch (_) {}
        const trailingWsLen = left.length - trimmedEnd.length;
        const startOffset = left.length - trailingWsLen - urlText.length;
        if (startOffset < 0) return false;
        const urlRange = document.createRange();
        urlRange.setStart(node, startOffset);
        urlRange.setEnd(node, startOffset + urlText.length);
        const link = document.createElement('a');
        link.href = urlText;
        link.textContent = urlText;
        link.target = '_blank';
        urlRange.deleteContents();
        urlRange.insertNode(link);
        // Restore caret after the typed whitespace if it exists
        const after = link.nextSibling;
        const newSel = window.getSelection();
        if (after && after.nodeType === 3) {
            const wsPrefix = (after.nodeValue.match(/^\s+/) || [''])[0].length;
            const caretPos = Math.min(wsPrefix, after.nodeValue.length);
            const caretRange = document.createRange();
            caretRange.setStart(after, caretPos);
            caretRange.setEnd(after, caretPos);
            newSel.removeAllRanges();
            newSel.addRange(caretRange);
        } else {
            const caretRange = document.createRange();
            caretRange.setStartAfter(link);
            caretRange.setEndAfter(link);
            newSel.removeAllRanges();
            newSel.addRange(caretRange);
        }
        try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
        // Kick off title suggestion for this new anchor
        setTimeout(() => { try { trySuggestTitleReplace(editor, urlText, 1); } catch (_) {} }, 60);
        return true;
    } catch (_) {
        return false;
    }
}

function setupManualAutolink(editor) {
    try {
        if (editor.dataset.manualAutolinkSetup === 'true') return;
        editor.dataset.manualAutolinkSetup = 'true';
        const onKey = (e) => {
            if (e && (e.key === ' ' || e.key === 'Enter')) {
                // Allow the keystroke to update DOM, then attempt autolink
                setTimeout(() => { try { tryManualAutolinkAtCaret(editor); } catch (_) {} }, 0);
            }
        };
        editor.addEventListener('keyup', onKey, true);
    } catch (_) {}
}

// Normalize a single <li> after word-deletion to prevent stray <br> or wrappers
function normalizeListItemAfterEdit(li) {
    try {
        if (!li || li.nodeName.toLowerCase() !== 'li') return;
        // Remove Froala br-wrapper artifacts within li
        try { li.querySelectorAll('div.br-wrapper, div[class*="br-wrapper"]').forEach(n => { try { n.remove(); } catch(_) {} }); } catch(_) {}
        // Convert inline-only divs to p
        try {
            li.querySelectorAll('div').forEach(div => {
                const hasBlockDesc = !!div.querySelector('div, p, ul, ol, table, pre, blockquote, h1, h2, h3, h4, h5, h6');
                if (!hasBlockDesc) {
                    const p = document.createElement('p');
                    while (div.firstChild) p.appendChild(div.firstChild);
                    div.parentNode.replaceChild(p, div);
                }
            });
        } catch(_) {}
        // Collapse consecutive <br> siblings
        const collapseConsecutiveBr = (el) => {
            let i = 0;
            while (i < el.childNodes.length - 1) {
                const a = el.childNodes[i];
                const b = el.childNodes[i + 1];
                if (a.nodeType === 1 && a.nodeName === 'BR' && b && b.nodeType === 1 && b.nodeName === 'BR') {
                    try { el.removeChild(b); } catch(_) {}
                    continue;
                }
                i++;
            }
        };
        collapseConsecutiveBr(li);
        // Remove trailing <br> if there is other content before it
        try {
            const html = String(li.innerHTML || '').trim().toLowerCase();
            if (html && html !== '<br>') {
                while (li.lastChild && li.lastChild.nodeType === 1 && li.lastChild.nodeName === 'BR') {
                    try { li.removeChild(li.lastChild); } catch(_) { break; }
                }
            }
        } catch(_) {}
        // Trim leading nbsp/text run at start of list item
        if (li.firstChild && li.firstChild.nodeType === 3) {
            li.firstChild.nodeValue = (li.firstChild.nodeValue || '').replace(/^\s+/, '');
        }
    } catch(_) {}
}

function isEmptyListItem(li) {
    try {
        if (!li || li.nodeName.toLowerCase() !== 'li') return false;
        const hasMedia = !!(li.querySelector && li.querySelector('img, picture, svg, video, iframe, figure'));
        if (hasMedia) return false;
        const txt = (li.textContent || '').replace(/\u00a0/g,' ').trim();
        if (txt) return false;
        // allow a single <br> placeholder to count as empty
        const html = String(li.innerHTML || '').replace(/\s/gi,'').toLowerCase();
        return html === '' || html === '<br>';
    } catch(_) { return false; }
}

function cleanupConsecutiveEmptyLis(li) {
    try {
        if (!li || li.nodeName.toLowerCase() !== 'li') return;
        const list = li.parentElement;
        if (!list || !/^(ul|ol)$/i.test(list.nodeName)) return;
        // Collapse current with previous if both empty
        const prev = li.previousElementSibling;
        if (prev && prev.nodeName.toLowerCase() === 'li' && isEmptyListItem(prev) && isEmptyListItem(li)) {
            try { prev.remove(); } catch(_) {}
        }
        // Collapse current with next if both empty
        const next = li.nextElementSibling;
        if (next && next.nodeName.toLowerCase() === 'li' && isEmptyListItem(next) && isEmptyListItem(li)) {
            try { next.remove(); } catch(_) {}
        }
    } catch(_) {}
}

// Set up a lightweight stabilizer: after Option+Backspace inside a list item, normalize that item
function setupListEditStabilizer(editor) {
    try {
        if (editor._listStabilizerSetup) return; editor._listStabilizerSetup = true;
        let lastAltBackspaceAt = 0;
        let lastBackspaceAt = 0;
        let lastEnterAt = 0;
        editor.addEventListener('keydown', (e) => {
            try {
                if (e && e.altKey && (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Backspace' || e.code === 'Delete' || e.keyCode === 8 || e.keyCode === 46)) {
                    lastAltBackspaceAt = Date.now();
                }
                if (e && !e.altKey && (e.key === 'Backspace' || e.code === 'Backspace' || e.keyCode === 8 || e.key === 'Delete' || e.code === 'Delete' || e.keyCode === 46)) {
                    lastBackspaceAt = Date.now();
                }
                if (e && !e.shiftKey && (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13)) {
                    lastEnterAt = Date.now();
                }
            } catch(_) {}
        });
        editor.addEventListener('input', () => {
            try {
                const now = Date.now();
                const recentAltDel = (now - lastAltBackspaceAt) <= 450;
                const recentBackspace = (now - lastBackspaceAt) <= 450;
                const recentEnter = (now - lastEnterAt) <= 450;
                if (!recentAltDel && !recentBackspace && !recentEnter) return;
                // Allow DOM to settle first
                setTimeout(() => {
                    try {
                        const sel = window.getSelection && window.getSelection();
                        if (!sel || !sel.rangeCount) return;
                        const node = sel.anchorNode ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode) : null;
                        let li = node && node.closest && node.closest('li');
                        if (li) {
                            normalizeListItemAfterEdit(li);
                            cleanupConsecutiveEmptyLis(li);
                            // Also normalize neighbor created by Enter split
                            if (recentEnter) {
                                const sib = li.nextElementSibling && li.nextElementSibling.nodeName === 'LI' ? li.nextElementSibling : (li.previousElementSibling && li.previousElementSibling.nodeName === 'LI' ? li.previousElementSibling : null);
                                if (sib) {
                                    normalizeListItemAfterEdit(sib);
                                    cleanupConsecutiveEmptyLis(sib);
                                }
                            }
                            // If a backspace merge happened, normalize previous sibling too
                            if (recentBackspace) {
                                const prev = li.previousElementSibling;
                                if (prev && prev.nodeName === 'LI') {
                                    normalizeListItemAfterEdit(prev);
                                    cleanupConsecutiveEmptyLis(prev);
                                }
                            }
                            try { editor.dispatchEvent(new Event('fr-change', { bubbles: true })); } catch(_) {}
                        }
                    } catch(_) {}
                }, 0);
            } catch(_) {}
        });
    } catch(_) {}
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

// From clipboard HTML, detect an <a> whose visible text is NOT a raw URL
function extractTitledAnchorFromClipboardEvent(e) {
    try {
        if (!e || !e.clipboardData || !e.clipboardData.getData) return null;
        const html = e.clipboardData.getData('text/html') || '';
        if (!html || !/<a\s/i.test(html)) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const a = doc.querySelector('a[href]');
        if (!a) return null;
        const text = (a.textContent || '').trim();
        const href = a.getAttribute('href') || a.href || '';
        if (!href || !text) return null;
        if (!isLikelyRawUrlText(text, href)) return { text, href };
        return null;
    } catch (_) {
        return null;
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
        
        // Allow native drag-to-resize and scrolling within the editor
        try {
            editor.style.resize = 'vertical';
            editor.style.overflowY = 'auto';
        } catch (_) {}
        const wrapEl = editor.closest('.fr-wrapper');
        if (wrapEl) {
            try { wrapEl.style.overflow = 'visible'; } catch (_) {}
        }

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
            try {
                const until = parseInt(editor.dataset.suppressExpandUntil || '0', 10);
                if (until && Date.now() < until) return;
            } catch (_) {}
            try { activateEditor(editor); } catch(_) {}
            // If AI is/was running and content changed, allow normal shrinking again
            try { if (window.__kayakoAIActive) window.__kayakoAIActive = false; } catch (_) {}
        };
        editor.addEventListener('input', expandOnChange);
        editor.addEventListener('fr-change', expandOnChange);
        
        // Always keep toolbar interactions expanding the editor
        setupToolbarButtonListeners(editor);

		// Watch for Kayako auto-linking (URL text becomes anchor after typing space/enter)
		setupAutoLinkSuggestionOnAutoAnchor(editor);

		// Fallback manual auto-linking when caret is at end of a raw URL
		setupManualAutolink(editor);

		// Suggest title when a whole raw URL is selected
		setupSelectedUrlSuggestion(editor);

		// Stabilize list editing on Option+Backspace to avoid stray line breaks
		setupListEditStabilizer(editor);

        // Ctrl/Cmd+Enter shortcut to click Send
        setupSendShortcut(editor);

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

let __kayakoSidebarPreferredWidthCache = null;

function getPreferredSidebarWidth(sidebar, cb) {
    try {
        if (typeof cb !== 'function') return;
        const fallback = () => {
            const initial = Number(sidebar && sidebar.dataset && sidebar.dataset.initialWidth) || Math.round((sidebar && sidebar.getBoundingClientRect && sidebar.getBoundingClientRect().width) || 360);
            const clamped = Math.max(200, Math.min(700, initial || defaultSidebarWidth));
            __kayakoSidebarPreferredWidthCache = clamped;
            cb(clamped);
        };
        if (__kayakoSidebarPreferredWidthCache != null) {
            cb(__kayakoSidebarPreferredWidthCache);
            return;
        }
        if (!isStorageAvailable()) {
            fallback();
            return;
        }
        chrome.storage.local.get(['sidebarDefaultWidth'], (d) => {
            const preferred = d && d.sidebarDefaultWidth ? Number(d.sidebarDefaultWidth) : null;
            if (preferred && !Number.isNaN(preferred)) {
                const clamped = Math.max(200, Math.min(700, preferred));
                __kayakoSidebarPreferredWidthCache = clamped;
                cb(clamped);
            } else {
                fallback();
            }
        });
    } catch (_) { try { cb(defaultSidebarWidth); } catch(_) {} }
}

function applySidebarWidthInline(sidebar, widthPx, important) {
    const w = Math.round(widthPx);
    const set = important ? (p, v) => { try { sidebar.style.setProperty(p, v, 'important'); } catch(_) {} } : (p, v) => { sidebar.style[p.replace(/-([a-z])/g,(m,g1)=>g1.toUpperCase())] = v; };
    set('width', w + 'px');
    set('min-width', w + 'px');
    set('max-width', w + 'px');
    set('flex', `0 0 ${w}px`);
    set('flex-basis', w + 'px');
}

function clearSidebarInlineWidth(sidebar) {
    try {
        ['width','minWidth','maxWidth','flex','flexBasis'].forEach((p) => { try { sidebar.style[p] = ''; } catch(_) {} });
        const inner = sidebar && sidebar.querySelector && sidebar.querySelector('[class*="ko-agent-content_layout__fields_"]');
        if (inner) {
            ['width','minWidth','maxWidth','flex','flexBasis'].forEach((p) => { try { inner.style[p] = ''; } catch(_) {} });
        }
    } catch (_) {}
}

function attachSidebarObserver(sidebar) {
    try {
        if (!sidebar || sidebar.dataset.sidebarObserverAttached === 'true') return;
        const mo = new MutationObserver(() => {
            // If not collapsed, enforce preferred width when class/style changes
            const collapsed = sidebar.classList.contains('kayako-sidebar-collapsed');
            if (collapsed) return;
            if (sidebar.dataset.userResizing === 'true') return;
            const untilTs = Number(sidebar.dataset.enforceUntilTs || 0);
            if (!untilTs || Date.now() > untilTs) return;
            getPreferredSidebarWidth(sidebar, (w) => {
                const rectW = Math.round(sidebar.getBoundingClientRect().width || 0);
                if (Math.abs(rectW - w) > 2) {
                    applySidebarWidthInline(sidebar, w, true);
                }
            });
        });
        mo.observe(sidebar, { attributes: true, attributeFilter: ['class','style'], childList: false, subtree: false });
        sidebar.dataset.sidebarObserverAttached = 'true';
    } catch (_) {}
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
                .kayako-sidebar-collapsed { width:12px !important; min-width:12px !important; max-width:12px !important; flex:0 0 12px !important; flex-basis:12px !important; overflow:hidden !important; padding:0 !important; }
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
            const applyWidth = (w, important) => {
                if (important) {
                    try {
                        sidebar.style.setProperty('width', w + 'px', 'important');
                        sidebar.style.setProperty('min-width', w + 'px', 'important');
                        sidebar.style.setProperty('max-width', w + 'px', 'important');
                        sidebar.style.setProperty('flex', `0 0 ${w}px`, 'important');
                        sidebar.style.setProperty('flex-basis', `${w}px`, 'important');
                        const inner = sidebar.querySelector('[class*="ko-agent-content_layout__fields_"]');
                        if (inner) {
                            inner.style.setProperty('width', w + 'px', 'important');
                            inner.style.setProperty('max-width', w + 'px', 'important');
                            inner.style.setProperty('min-width', w + 'px', 'important');
                            inner.style.setProperty('flex-basis', `${w}px`, 'important');
                            inner.style.setProperty('flex', `0 0 ${w}px`, 'important');
                        }
                    } catch(_) {}
                } else {
                    sidebar.style.width = w + 'px';
                    sidebar.style.minWidth = w + 'px';
                    sidebar.style.maxWidth = w + 'px';
                    sidebar.style.flex = `0 0 ${w}px`;
                    sidebar.style.flexBasis = `${w}px`;
                    const inner = sidebar.querySelector('[class*="ko-agent-content_layout__fields_"]');
                    if (inner) {
                        inner.style.width = w + 'px';
                        inner.style.maxWidth = w + 'px';
                        inner.style.minWidth = w + 'px';
                        inner.style.flexBasis = `${w}px`;
                        inner.style.flex = `0 0 ${w}px`;
                    }
                }
            };
            const onMove = (e) => { lastDX = e.clientX - startX; if (!rafQueued) { rafQueued = true; requestAnimationFrame(() => { rafQueued = false; const newW = clamp(startW - lastDX, 12, 700); applyWidth(newW); try { chrome.storage.local.set({ sidebarWidth: newW, sidebarCollapsed: false }); __kayakoSidebarPreferredWidthCache = null; } catch(_) {} }); } };
            const onUp = () => { dragging = false; sidebar.dataset.userResizing = 'false'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; };
            resizer.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; sidebar.dataset.userResizing = 'true'; sidebar.dataset.enforceUntilTs = '0'; startX = e.clientX; startW = sidebar.getBoundingClientRect().width; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor = 'col-resize'; });
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
                    // Clear inline enforced sizes so CSS collapse can take effect
                    clearSidebarInlineWidth(sidebar);
                    try { sidebar.dataset.enforceUntilTs = '0'; } catch(_) {}
                    try { sidebar.dataset.userResizing = 'false'; } catch(_) {}
                    // Ensure toggle visible inside the stub
                    toggle.style.left = '0px';
                } else {
                    sidebar.classList.remove('kayako-sidebar-collapsed');
                    // Restore width from storage or default
                    // Clear any residual inline widths from prior versions
                    clearSidebarInlineWidth(sidebar);
                    getPreferredSidebarWidth(sidebar, (w) => {
                        // briefly enforce for reflow windows
                        try { sidebar.dataset.enforceUntilTs = String(Date.now() + 800); } catch(_) {}
                        applySidebarWidthInline(sidebar, w, true);
                        requestAnimationFrame(() => applySidebarWidthInline(sidebar, w, true));
                        setTimeout(() => applySidebarWidthInline(sidebar, w, true), 30);
                        setTimeout(() => applySidebarWidthInline(sidebar, w, true), 120);
                        try { chrome.storage.local.set({ sidebarWidth: w }); } catch(_) {}
                    });
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
                        // Ensure inner fields don't carry stale inline widths
                        clearSidebarInlineWidth(sidebar);
                        applySidebarWidthInline(sidebar, w, true);
                        toggle.style.left = '-18px';
                        if (!sidebar.dataset.initialWidth) { try { sidebar.dataset.initialWidth = String(w); } catch(_) {} }
                    }
                    setIcon(collapsed);
                });
            } catch(_) {}
            attachSidebarObserver(sidebar);
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
        if (window.__kayakoAIActive) {
            // While AI modal/workflow is active, avoid shrinking
            return;
        }
        if (window.__kayakoMacroActive) {
            // While macro selection UI is active, avoid shrinking
            return;
        }
        if (!document.hasFocus()) {
            // Skip shrink on window blur; we'll shrink later only on in-page interactions
            return;
        }
        // Ignore clicks on Froala's inline link popup/buttons (open/edit/unlink)
        const lastClick = window.__kayakoLastMouseDownTarget;
        try {
            if (lastClick && lastClick.closest('.fr-popup, .fr-buttons, .fr-command, button[id^="link"], [data-cmd^="link"]')) {
                return;
            }
        } catch (_) {}
        // Only shrink on blur if the last page click was outside this editor's container
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
        // console.log('📏 User clicked in empty editor - activating and expanding');
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
            // If this is an AI trigger/modal action, keep editor expanded while AI runs
            const isAITrigger = !!e.target.closest('.kayako-ai-dropdown, [class*="kayako-ai"]');
            if (isAITrigger) {
                try {
                    window.__kayakoAIActive = true;
                    window.__kayakoLastAIEditor = editor;
                } catch (_) {}
            }
        }
    };

    // Use capture so we run before other handlers that might stop propagation
    toolbar.addEventListener('mousedown', delegatedHandler, true);
    toolbar.addEventListener('click', delegatedHandler, true);

    toolbar.dataset.autoSizeListenersSetup = 'true';
}

// Ctrl/Cmd+Enter → click the Send button in this editor's container
function setupSendShortcut(editor) {
    try {
        if (editor._sendShortcutHandler) return;
        const handler = (e) => {
            try {
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13)) {
                    const container = editor.closest('.ko-text-editor__container_1p5g6r');
                    let btn = null;
                    if (container) {
                        btn = container.querySelector('button[class*="ko-button__primary"], button[class*="ko-button__shared"]');
                    }
                    if (!btn) {
                        btn = document.querySelector('button[class*="ko-button__primary"], button[class*="ko-button__shared"]');
                    }
                    if (btn) {
                        e.preventDefault();
                        e.stopPropagation();
                        // mark handled so global fallback won't double-trigger
                        try { window.__kayakoSendShortcutHandled = Date.now(); } catch(_) {}
                        // Prevent QC snippet persistence reinserts on send
                        try { disableQCSnippetPersistenceNearButton(btn); } catch(_) {}
                        // Normalize the active editor HTML right before sending
                        try { normalizeEditorContentForSend(getActiveEditorNearButton(btn)); } catch(_) {}
                        btn.click();
                        // collapse editor immediately for reading space
                        try {
                            const targetContainer = btn.closest('.ko-text-editor__container_1p5g6r') || container;
                            const candidates = targetContainer ? targetContainer.querySelectorAll('.fr-element') : document.querySelectorAll('.fr-element');
                            if (candidates && candidates.length > 0) {
                                const suppressUntil = Date.now() + 2000;
                                chrome.storage.local.get(["editorMinHeight"], (data) => {
                                    const minHeight = (data && data.editorMinHeight) ? data.editorMinHeight : defaultMinHeight;
                                    candidates.forEach((ed) => { try { ed.dataset.suppressExpandUntil = String(suppressUntil); animateEditorToHeight(ed, minHeight); } catch(_) {} });
                                });
                            }
                        } catch(_) {}
                    }
                }
            } catch (_) {}
        };
        editor.addEventListener('keydown', handler);
        editor._sendShortcutHandler = handler;
    } catch (_) {}
}

// Global fallback: capture Cmd/Ctrl+Enter anywhere inside the editor
function setupGlobalSendShortcut() {
    if (window.__kayakoGlobalSendSetup === true) return; window.__kayakoGlobalSendSetup = true;
    document.addEventListener('keydown', (e) => {
        try {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.shiftKey) return;
            if (!((e.key === 'Enter') || (e.code === 'Enter') || (e.keyCode === 13))) return;
            // avoid duplicate handling if a per-editor handler already ran
            if (window.__kayakoSendShortcutHandled && Date.now() - window.__kayakoSendShortcutHandled < 150) return;

            // identify the focused editor
            let editor = null;
            const ae = document.activeElement;
            if (ae) {
                editor = ae.classList && ae.classList.contains('fr-element') ? ae : ae.closest && ae.closest('.fr-element');
            }
            if (!editor) {
                const sel = window.getSelection && window.getSelection();
                const node = sel && sel.anchorNode;
                if (node) {
                    const el = (node.nodeType === 3 ? node.parentElement : node);
                    editor = el && el.closest && el.closest('.fr-element');
                }
            }
            if (!editor) return;

            const container = editor.closest('.ko-text-editor__container_1p5g6r');
            let btn = null;
            if (container) {
                // prefer a button with Send text
                const candidates = container.querySelectorAll('button[class*="ko-button__primary"], button[class*="ko-button__shared"]');
                btn = Array.from(candidates).find(b => /send/i.test((b.textContent || b.innerText || '')));
                if (!btn && candidates.length) btn = candidates[0];
            }
            if (!btn) {
                const candidates = document.querySelectorAll('button[class*="ko-button__primary"], button[class*="ko-button__shared"]');
                btn = Array.from(candidates).find(b => /send/i.test((b.textContent || b.innerText || ''))) || candidates[0];
            }
            if (!btn) return;

            e.preventDefault();
            e.stopPropagation();
            try { window.__kayakoSendShortcutHandled = Date.now(); } catch(_) {}
            // Prevent QC snippet persistence reinserts on send
            try { disableQCSnippetPersistenceNearButton(btn); } catch(_) {}
            btn.click();
            // collapse editors within this container
            try {
                const targetContainer = btn.closest('.ko-text-editor__container_1p5g6r') || container;
                const eds = targetContainer ? targetContainer.querySelectorAll('.fr-element') : document.querySelectorAll('.fr-element');
                if (eds && eds.length > 0) {
                    const suppressUntil = Date.now() + 2000;
                    chrome.storage.local.get(["editorMinHeight"], (data) => {
                        const minHeight = (data && data.editorMinHeight) ? data.editorMinHeight : defaultMinHeight;
                        eds.forEach((ed) => { try { ed.dataset.suppressExpandUntil = String(suppressUntil); animateEditorToHeight(ed, minHeight); } catch(_) {} });
                    });
                }
            } catch(_) {}
        } catch(_) {}
    }, true);
}

// --- Auto‑paste QC template after selecting Macro → Quality Control → Send to Customer ---
function setupQCMacroAutoPaste() {
    // Cache current toggle state (updated via message too)
    try {
        chrome.storage.local.get(["autoPasteQCSendToCustomer", "autoPasteQC"], (d) => {
            if (d && typeof d.autoPasteQCSendToCustomer !== 'undefined') {
                window.__kayakoAutoPasteQC = !!d.autoPasteQCSendToCustomer;
            } else if (d && typeof d.autoPasteQC !== 'undefined') {
                window.__kayakoAutoPasteQC = !!d.autoPasteQC;
            } else {
                window.__kayakoAutoPasteQC = true;
            }
        });
    } catch (_) { try { window.__kayakoAutoPasteQC = true; } catch(_) {} }

    const handleCandidate = (target, via) => {
        try {
            const enabled = (typeof window.__kayakoAutoPasteQC === 'boolean') ? window.__kayakoAutoPasteQC : true;
            if (!enabled) return;
            const menu = target && target.closest && target.closest('.ember-basic-dropdown-content, .ember-power-select-options, [id^="ember-basic-dropdown-content-"]');
            if (!menu) return;
            // If Enter was pressed, find the highlighted option
            let item = target.closest && target.closest('[role="option"], li, [class*="option"], [role="menuitem"]');
            if (!item) {
                item = menu.querySelector('[aria-current="true"], [aria-selected="true"]');
            }
            if (!item) return;
            const label = (item.textContent || '').trim();
            // console.log('🔎 Macro menu selection via', via, 'label=', label);
            const matchesQC = /send\s+to\s+customer/i.test(label) || /send\s+to\s+external\s*team/i.test(label) || /close\s*ticket/i.test(label);
            if (!matchesQC) return;
            const editor = window.__kayakoLastMacroEditor || document.querySelector('.fr-element');
            if (!editor) return;
            // Open a new paste session; allow persistence until explicit Send
            try { window.__kayakoQCPasteAllowed = true; } catch(_) {}
            try { window.__kayakoQCPasteSessionId = (window.__kayakoQCPasteSessionId || 0) + 1; } catch(_) {}
            try { editor.dataset.qcPasteSessionId = String(window.__kayakoQCPasteSessionId); } catch(_) {}
            window.__kayakoPendingQCPaste = true;
            waitForMacroApplyThenPaste(editor);
        } catch (_) {}
    };

    // Listen for macro option activation (click & mousedown to be safe)
    document.addEventListener('click', (e) => handleCandidate(e.target, 'click'), true);
    document.addEventListener('mousedown', (e) => handleCandidate(e.target, 'mousedown'), true);
    // Support selecting with Enter in the search input/menu
    document.addEventListener('keydown', (e) => {
        try {
            if (e.key !== 'Enter') return;
            const menu = e.target && e.target.closest && e.target.closest('.ember-basic-dropdown-content, .ember-power-select-options, [id^="ember-basic-dropdown-content-"]');
            if (!menu) return;
            const active = menu.querySelector('[aria-current="true"], [aria-selected="true"]');
            handleCandidate(active || e.target, 'enter');
        } catch (_) {}
    }, true);
}

function waitForMacroApplyThenPaste(editor) {
    try {
        if (window.__kayakoQCPasteAllowed === false) return;
        let settledTimer = null;
        const observer = new MutationObserver(() => {
            try { if (settledTimer) clearTimeout(settledTimer); } catch(_) {}
            settledTimer = setTimeout(() => {
                try { observer.disconnect(); } catch(_) {}
                try { pasteLatestInternalNoteAboveFooter(editor); } catch(_) {}
            }, 260);
        });
        observer.observe(editor, { childList: true, subtree: true, characterData: true });
        // Fallback in case no mutations fire
        setTimeout(() => {
            try { observer.disconnect(); } catch(_) {}
            try {
                if (window.__kayakoQCPasteAllowed === false) return;
                const already = editor.querySelector && editor.querySelector('[data-kayako-qc-snippet="1"]');
                const sess = (editor && editor.dataset && editor.dataset.qcPasteSessionId) || (window.__kayakoQCPasteSessionId || '');
                const done = !!(sess && window.__kayakoQCPasteDone && window.__kayakoQCPasteDone[sess]);
                if (!already && !done) pasteLatestInternalNoteAboveFooter(editor);
            } catch(_) {}
        }, 2200);
    } catch (_) {}
}

function findLatestInternalNoteNode() {
    try {
        const nodes = document.querySelectorAll('.message-or-note[data-note-id], div[data-note-id][data-id]');
        if (!nodes || nodes.length === 0) return null;
        return nodes[nodes.length - 1];
    } catch (_) { return null; }
}

function findFooterStartInEditor(editor) {
    try {
        const blocks = editor.querySelectorAll('p, div, li');
        for (let i = 0; i < blocks.length; i++) {
            const t = (blocks[i].textContent || '').trim().toLowerCase();
            if (t.startsWith('best regards') || t.startsWith('regards,') || t.startsWith('kind regards')) {
                return blocks[i];
            }
        }
    } catch (_) {}
    return null;
}

function pasteLatestInternalNoteAboveFooter(editor) {
    try {
        if (window.__kayakoQCPasteAllowed === false) return;
        if (!window.__kayakoPendingQCPaste) return;
        const sessionId = (editor && editor.dataset && editor.dataset.qcPasteSessionId) || (window.__kayakoQCPasteSessionId || '');
        window.__kayakoQCPasteDone = window.__kayakoQCPasteDone || Object.create(null);
        if (sessionId && window.__kayakoQCPasteDone[sessionId]) { window.__kayakoPendingQCPaste = false; return; }
        if (sessionId && window.__kayakoQCPasteInFlight === sessionId) { window.__kayakoPendingQCPaste = false; return; }
        try { window.__kayakoQCPasteInFlight = sessionId || 'default'; } catch(_) {}
        window.__kayakoPendingQCPaste = false;
        if (editor.querySelector('[data-kayako-qc-snippet="1"]')) return;
        const note = findLatestInternalNoteNode();
        if (!note) return;
        const content = note.querySelector('[class*="ko-timeline-2_list_item__content"], [class*="_content_" ]') || note;
        const html = content && content.innerHTML ? String(content.innerHTML) : '';
        if (!html || !html.trim()) return;
        // Decide whether to strip footer based on whether macro already added one
        const footerStart = findFooterStartInEditor(editor);
        // Extract only the "PR to the customer" section as HTML; optionally strip footer
        const extracted = extractQCResponseHtmlFromHtml(html, !!footerStart) || '';
        if (!extracted || !extracted.trim()) {
            // console.log('✂️ QC paste skipped: empty extraction');
            return;
        }
        // Build a fragment from extracted HTML, without a wrapper to avoid Froala block merging
        const tmpWrap = document.createElement('div');
        tmpWrap.innerHTML = extracted;
        // Trim leading trivial nodes (br/whitespace)
        while (tmpWrap.firstChild && (
            (tmpWrap.firstChild.nodeType === 3 && !(/[^\s\u00a0]/.test(tmpWrap.firstChild.nodeValue || '')))
            || String(tmpWrap.firstChild.nodeName).toLowerCase() === 'br'
            || (tmpWrap.firstChild.nodeType === 1 && String(tmpWrap.firstChild.innerHTML || '').replace(/\s|&nbsp;/g,'').toLowerCase() === '')
        )) {
            tmpWrap.removeChild(tmpWrap.firstChild);
        }
        const frag = document.createDocumentFragment();
        let marked = false;
        Array.from(tmpWrap.childNodes).forEach((n) => {
            const clone = n.cloneNode(true);
            if (!marked && clone.nodeType === 1) { try { clone.setAttribute('data-kayako-qc-snippet','1'); marked = true; } catch(_) {} }
            frag.appendChild(clone);
        });
        if (footerStart && footerStart.parentNode) {
            // add a blank line before our insert
            const spacer = document.createElement('p'); spacer.innerHTML = '<br>';
            footerStart.parentNode.insertBefore(spacer, footerStart);
            footerStart.parentNode.insertBefore(frag, footerStart);
        } else {
            editor.appendChild(frag);
        }
        // Normalize top spacing of the entire editor so first line starts flush
        try { normalizeEditorTopSpacing(editor); } catch(_) {}
        try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
        try { editor.dispatchEvent(new Event('fr-change', { bubbles: true })); } catch(_) {}
        try { if (sessionId) window.__kayakoQCPasteDone[sessionId] = true; } catch(_) {}
        try { if (window.__kayakoQCPasteInFlight === (sessionId || 'default')) window.__kayakoQCPasteInFlight = null; } catch(_) {}

        // Keep snippet alive briefly across Note/Public toggle re-renders
        try {
            ensureQCSnippetPersistence(editor, tmpWrap.innerHTML);
        } catch (_) {}
    } catch (_) {}
}

// Reinsert the just-pasted QC snippet if the editor re-renders (e.g., Note→Public switch)
function ensureQCSnippetPersistence(editor, insertedHtml) {
    try {
        const container = editor.closest('.froala-editor-container') || editor.parentNode;
        if (!container) return;
        // If persistence disabled (e.g., just sent), skip entirely
        if ((container.dataset && container.dataset.qcPersistDisabled === '1') ||
            (window.__kayakoQCPasteAllowed === false) ||
            (window.__kayakoQCPasteBlockReinsert && Date.now() - window.__kayakoQCPasteBlockReinsert < 5000)) {
            return;
        }
        const endAt = Date.now() + 8000; // watch for up to 8s after paste
        let reinserts = 0;
        const observer = new MutationObserver(() => {
            // Abort if disabled while observing
            if ((container.dataset && container.dataset.qcPersistDisabled === '1') ||
                (window.__kayakoQCPasteAllowed === false) ||
                (window.__kayakoQCPasteBlockReinsert && Date.now() - window.__kayakoQCPasteBlockReinsert < 5000)) {
                try { observer.disconnect(); } catch(_) {}
                return;
            }
            const now = Date.now();
            if (now > endAt) { try { observer.disconnect(); } catch(_) {} return; }
            const currentEditor = container.querySelector('.fr-element');
            if (!currentEditor) return;
            if (currentEditor.querySelector('[data-kayako-qc-snippet="1"]')) return;
            // Skip if the current session already pasted successfully
            const sess = (currentEditor && currentEditor.dataset && currentEditor.dataset.qcPasteSessionId) || (window.__kayakoQCPasteSessionId || '');
            const done = !!(sess && window.__kayakoQCPasteDone && window.__kayakoQCPasteDone[sess]);
            if (done) { try { observer.disconnect(); } catch(_) {} return; }
            if (!insertedHtml) return;
            // Reinsert above footer if present, else append at end
            const wrap = document.createElement('div');
            wrap.innerHTML = insertedHtml;
            const frag = document.createDocumentFragment();
            Array.from(wrap.childNodes).forEach(n => frag.appendChild(n.cloneNode(true)));
            const footerStart = findFooterStartInEditor(currentEditor);
            if (footerStart && footerStart.parentNode) {
                const spacer = document.createElement('p'); spacer.innerHTML = '<br>';
                footerStart.parentNode.insertBefore(spacer, footerStart);
                footerStart.parentNode.insertBefore(frag, footerStart);
            } else {
                currentEditor.appendChild(frag);
            }
            try { normalizeEditorTopSpacing(currentEditor); } catch(_) {}
            try { currentEditor.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
            try { currentEditor.dispatchEvent(new Event('fr-change', { bubbles: true })); } catch(_) {}
            reinserts++;
            if (reinserts >= 2) { try { observer.disconnect(); } catch(_) {} }
        });
        observer.observe(container, { childList: true, subtree: true });
        try { container.__kayakoQCPersistObserver = observer; } catch(_) {}
        // Safety stop
        setTimeout(() => { try { observer.disconnect(); } catch(_) {} }, 10000);
    } catch (_) {}
}

// Sanitize whitespace for contentEditable editing (outside of <pre>/<code>)
function sanitizeHtmlForEditor(html) {
    try {
        const root = document.createElement('div');
        root.innerHTML = html;
        const walk = (node, inPre) => {
            if (!node) return;
            const name = node.nodeName ? String(node.nodeName).toLowerCase() : '';
            const nowInPre = inPre || name === 'pre' || name === 'code';
            if (node.nodeType === 3) {
                if (!nowInPre) {
                    let t = node.nodeValue || '';
                    t = t.replace(/\u00a0|&nbsp;/g, ' '); // NBSP → space
                    t = t.replace(/\t+/g, ' ');           // tabs → space
                    t = t.replace(/ {2,}/g, ' ');          // collapse runs
                    // trim leading spaces if first in parent block
                    if (!node.previousSibling) t = t.replace(/^ +/, '');
                    // trim trailing spaces if last in parent block
                    if (!node.nextSibling) t = t.replace(/ +$/, '');
                    node.nodeValue = t;
                }
            } else if (node.nodeType === 1) {
                // Recurse
                const children = Array.from(node.childNodes || []);
                for (const c of children) walk(c, nowInPre);
            }
        };
        walk(root, false);
        return root.innerHTML;
    } catch (_) { return html; }
}

function extractQCResponseTextFromHtml(html, stripFooter) {
    try {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        let text = tmp.innerText || '';
        text = text.replace(/\r\n/g, '\n');
        // Narrow to section after header and separator of '=' or '-' and before the next separator
        const re = /what\s+is\s+the\s+pr[^\n]*?\?[^\n]*\n[\s=\-]{3,}\n([\s\S]*?)(?:\n[\s=\-]{3,}\n|$)/i;
        let m = text.match(re);
        let body = (m && m[1]) ? m[1] : '';
        if (!body) {
            // Fallback: take lines after the header until footer markers
            const re2 = /what\s+is\s+the\s+pr[^\n]*?\?\s*\n([\s\S]*?)$/i;
            const m2 = text.match(re2);
            body = (m2 && m2[1]) ? m2[1] : '';
        }
        if (!body) body = text;
        // Optionally trim trailing footer like Best regards / Regards / Kind regards
        if (stripFooter) {
            body = body.replace(/\n\s*(best\s*regards|regards[,\s]*|kind\s*regards)[\s\S]*$/i, '\n');
        }
        // Trim leading/trailing whitespace but preserve internal spacing
        return body.replace(/^\s+|\s+$/g, '');
    } catch (_) { return ''; }
}

function normalizeEditorTopSpacing(editor) {
    try {
        const isWhitespaceNode = (n) => {
            if (!n) return false;
            if (n.nodeType === 3) return !(/[^\s\u00a0]/.test(n.nodeValue || ''));
            if (String(n.nodeName).toLowerCase() === 'br') return true;
            if (n.nodeType === 1) {
                const html = String(n.innerHTML || '').replace(/\s|&nbsp;/g, '').toLowerCase();
                return html === '' || html === '<br>';
            }
            return false;
        };
        // Remove leading ignorable nodes
        while (editor.firstChild && isWhitespaceNode(editor.firstChild)) {
            editor.removeChild(editor.firstChild);
        }
        // If the first element is an empty p/div with just a br, remove it
        const firstEl = editor.firstElementChild;
        if (firstEl) {
            const clean = String(firstEl.innerHTML || '').replace(/\s|&nbsp;/g, '').toLowerCase();
            if (clean === '' || clean === '<br>') {
                editor.removeChild(firstEl);
            }
        }
        // Ensure first visible block has no top margin
        let firstBlock = null;
        const blocks = editor.children;
        for (let i = 0; i < blocks.length; i++) {
            const el = blocks[i];
            const tag = String(el.nodeName).toLowerCase();
            const text = (el.textContent || '').trim();
            if (['p','div','ul','ol','table','pre','blockquote','h1','h2','h3','h4','h5','h6'].includes(tag) && text) {
                firstBlock = el; break;
            }
        }
        if (firstBlock && firstBlock.style) {
            firstBlock.style.marginTop = '0';
        }
    } catch (_) {}
}

// HTML-preserving extraction of the PR section
function extractQCResponseHtmlFromHtml(html, stripFooter) {
    try {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const children = Array.from(tmp.childNodes || []);
        const norm = (s) => String(s || '').trim().toLowerCase();
        const textOf = (n) => norm(n && (n.innerText || n.textContent || ''));
        const isSep = (t) => /^[\s=\-_*]{6,}$/.test(t);
        const isEmptyNode = (n) => {
            if (!n) return true;
            if (n.nodeType === 3) return !norm(n.textContent);
            if (String(n.nodeName).toLowerCase() === 'br') return true;
            // Treat nodes containing media as non-empty even if textContent is empty
            try {
                if (n.querySelector && n.querySelector('img, picture, svg, video, iframe, figure')) return false;
            } catch (_) {}
            return !norm(n.textContent);
        };
        const isBlockNode = (n) => {
            const tag = String(n && n.nodeName || '').toLowerCase();
            return ['p','div','ul','ol','table','pre','blockquote','h1','h2','h3','h4','h5','h6','figure'].includes(tag);
        };

        // Find the header line
        let headerIdx = -1;
        for (let i = 0; i < children.length; i++) {
            const t = textOf(children[i]);
            if (/what\s+is\s+the\s+pr/.test(t)) { headerIdx = i; break; }
        }
        let start = headerIdx >= 0 ? headerIdx + 1 : 0;
        while (start < children.length && isSep(textOf(children[start]))) start++;

        let end = children.length;
        for (let j = start; j < children.length; j++) {
            const t = textOf(children[j]);
            if (isSep(t) || /^(additional\s+context|acknowledge)/i.test(t) || (/what\s+is\s+the\s+pr/.test(t) && j > start)) { end = j; break; }
        }
        let slice = children.slice(start, end);
        // Trim leading/trailing empties
        while (slice.length && isEmptyNode(slice[0])) slice.shift();
        while (slice.length && isEmptyNode(slice[slice.length - 1])) slice.pop();

        if (stripFooter && slice.length) {
            let cut = -1;
            for (let k = 0; k < slice.length; k++) {
                const t = textOf(slice[k]);
                if (t.startsWith('best regards') || t.startsWith('regards,') || t.startsWith('kind regards')) { cut = k; break; }
            }
            if (cut >= 0) {
                slice = slice.slice(0, cut);
                while (slice.length && isEmptyNode(slice[slice.length - 1])) slice.pop();
            }
        }

        if (!slice.length) return '';
        const out = document.createElement('div');
        // Clone nodes exactly as in the note first
        slice.forEach((n) => out.appendChild(n.cloneNode(true)));
        // Preserve original structure from the template; avoid aggressive cleanups here
        return out.innerHTML;
    } catch (_) { return ''; }
}

function postCleanForFroala(root) {
    const isBlock = (el) => {
        const tag = String(el && el.nodeName || '').toLowerCase();
        return ['p','div','ul','ol','li','table','pre','blockquote','h1','h2','h3','h4','h5','h6','figure'].includes(tag);
    };
    const hasBlockDesc = (el) => {
        if (!el || !el.querySelector) return false;
        return !!el.querySelector('div, p, ul, ol, table, pre, blockquote, h1, h2, h3, h4, h5, h6, figure');
    };
    const toP = (el) => {
        if (!el || String(el.nodeName).toLowerCase() !== 'div') return;
        if (el.className && /br-wrapper/.test(el.className)) {
            const p = document.createElement('p'); p.innerHTML = '<br>';
            el.parentNode.replaceChild(p, el); return;
        }
        // Only convert divs that contain inline content only
        if (!hasBlockDesc(el)) {
            const p = document.createElement('p');
            while (el.firstChild) p.appendChild(el.firstChild);
            el.parentNode.replaceChild(p, el);
        }
    };
    const cleanLi = (li) => {
        // Remove empty li and trim whitespace-only nodes
        const txt = (li.textContent || '').replace(/\u00a0/g,' ').trim();
        const hasMedia = !!(li.querySelector && li.querySelector('img, picture, svg, video, iframe, figure'));
        if (!txt && !hasMedia) { try { li.remove(); } catch(_) {} return; }
        // Drop leading nbsp that cause indenting
        if (li.firstChild && li.firstChild.nodeType === 3) {
            li.firstChild.nodeValue = li.firstChild.nodeValue.replace(/^\s+/, '');
        }
        // Remove stray br-wrapper children
        li.querySelectorAll('div.br-wrapper, div[class*="br-wrapper"]').forEach(el => { try { el.remove(); } catch(_) {} });
    };
    // Convert top-level DIVs to P where appropriate
    Array.from(root.querySelectorAll('div')).forEach(toP);
    // Ensure UL/OL only have LI children and no empty LIs
    root.querySelectorAll('ul,ol').forEach(list => {
        const kids = Array.from(list.childNodes);
        kids.forEach(n => {
            if (n.nodeType === 3 && !(n.nodeValue || '').trim()) { try { n.remove(); } catch(_) {} return; }
            const tag = String(n.nodeName || '').toLowerCase();
            if (tag === 'li') { cleanLi(n); return; }
            // Wrap non-LI node into LI
            const li = document.createElement('li');
            li.appendChild(n.cloneNode(true));
            list.replaceChild(li, n);
            cleanLi(li);
        });
        // Remove any now-empty li
        Array.from(list.querySelectorAll('li')).forEach(li => { const t = (li.textContent || '').replace(/\u00a0/g,' ').trim(); if (!t) { try { li.remove(); } catch(_) {} } });
    });
    // Remove &nbsp; at paragraph starts
    root.querySelectorAll('p, div').forEach(el => {
        if (!isBlock(el)) return;
        if (el.firstChild && el.firstChild.nodeType === 3) {
            el.firstChild.nodeValue = (el.firstChild.nodeValue || '').replace(/^\s*\u00a0+/g,'');
        }
    });
}

// Prepare editor HTML just before sending to minimize server-side reformatting
function normalizeEditorContentForSend(editor) {
    try {
        if (!editor) return;
        // Safety-first: temporarily disable pre-send normalization to avoid any data loss
        return;
    } catch (_) {}
}

function getActiveEditorNearButton(btn) {
    try {
        const container = btn && btn.closest && btn.closest('.ko-text-editor__container_1p5g6r');
        // Prefer the currently focused/selection editor inside this container
        let editor = null;
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.anchorNode) {
            const node = (sel.anchorNode.nodeType === 3) ? sel.anchorNode.parentElement : sel.anchorNode;
            const ed = node && node.closest && node.closest('.fr-element');
            if (ed && (!container || (container.contains && container.contains(ed)))) editor = ed;
        }
        if (!editor && container) editor = container.querySelector('.fr-element');
        if (!editor) editor = document.querySelector('.fr-element');
        return editor;
    } catch (_) { return document.querySelector('.fr-element'); }
}

function disableQCSnippetPersistenceNearButton(btn) {
    try {
        const container = btn && btn.closest && btn.closest('.ko-text-editor__container_1p5g6r');
        if (container) {
            try { container.dataset.qcPersistDisabled = '1'; } catch(_) {}
            try {
                const froalaContainer = container.querySelector('.froala-editor-container') || container;
                const obs = froalaContainer.__kayakoQCPersistObserver;
                if (obs && obs.disconnect) { try { obs.disconnect(); } catch(_) {} }
            } catch(_) {}
        }
        // Globally disable further QC reinserts and invalidate any paste session
        try { window.__kayakoQCPasteAllowed = false; } catch(_) {}
        try { window.__kayakoQCPasteSessionId = (window.__kayakoQCPasteSessionId || 0) + 1; } catch(_) {}
        try {
            const ed = getActiveEditorNearButton(btn);
            if (ed && ed.dataset) ed.dataset.qcPasteSessionId = '';
        } catch(_) {}
        try { window.__kayakoQCPasteBlockReinsert = Date.now(); } catch(_) {}
    } catch(_) {}
}

function collapseBlankBlocks(root) {
    const isTrivial = (el) => {
        if (!el || el.nodeType !== 1) return false;
        const tag = String(el.nodeName).toLowerCase();
        if (!['p','div'].includes(tag)) return false;
        const html = String(el.innerHTML || '').replace(/\s|&nbsp;/g, '').toLowerCase();
        return html === '' || html === '<br>';
    };
    const blocks = Array.from(root.children || []);
    let lastWasBlank = false;
    for (let i = 0; i < blocks.length; i++) {
        const el = blocks[i];
        if (isTrivial(el)) {
            if (lastWasBlank) { try { el.remove(); } catch(_) {} } else { lastWasBlank = true; }
        } else {
            lastWasBlank = false;
        }
    }
    // Trim leading/trailing blank blocks
    while (root.firstElementChild && isTrivial(root.firstElementChild)) {
        try { root.removeChild(root.firstElementChild); } catch(_) {}
    }
    while (root.lastElementChild && isTrivial(root.lastElementChild)) {
        try { root.removeChild(root.lastElementChild); } catch(_) {}
    }
    // Remove trailing <br> inside non-empty p/div/li to avoid extra newline rendering
    root.querySelectorAll('p, div, li').forEach(el => {
        const html = String(el.innerHTML || '').trim().toLowerCase();
        if (html === '<br>' || html === '') return; // keep empty line placeholders
        while (el.lastChild && String(el.lastChild.nodeName).toLowerCase() === 'br') {
            try { el.removeChild(el.lastChild); } catch(_) { break; }
        }
    });
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
    // console.log('📏 Cleaning up all first-load listeners');
    
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
    try { editor.style.maxHeight = targetHeight + 'px'; } catch (_) {}
    
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
    
    // Pre-normalize HTML on mousedown (capture) before Kayako handles Send
    document.addEventListener('mousedown', (e) => {
        const target = e.target;
        const isSend = (
            (target.matches && target.matches('button[class*="ko-button__primary"], button[class*="ko-button__shared"]')) ||
            (target.closest && target.closest('button[class*="ko-button__primary"], button[class*="ko-button__shared"]'))
        ) && /send/i.test((target.textContent || target.innerText || target.closest('button')?.textContent || ''));
        if (!isSend) return;
        try {
            const btn = target.closest ? (target.closest('button') || target) : target;
            // Prevent QC snippet persistence reinserts on send
            try { disableQCSnippetPersistenceNearButton(btn); } catch(_) {}
            const editor = getActiveEditorNearButton(btn);
            if (editor) normalizeEditorContentForSend(editor);
        } catch (_) {}
    }, true);

    // Listen for clicks on Send buttons (bubbling) to track ticket and shrink
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
                        const suppressUntil = Date.now() + 2000;
                        chrome.storage.local.get(["editorMinHeight"], (data) => {
                            const minHeight = (data && data.editorMinHeight) ? data.editorMinHeight : defaultMinHeight;
                            candidates.forEach((ed) => {
                                try { ed.dataset.suppressExpandUntil = String(suppressUntil); animateEditorToHeight(ed, minHeight); } catch(_) {}
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
        } else if (request.action === 'setAutoPasteQC') {
            try { window.__kayakoAutoPasteQC = !!request.enabled; } catch(_) {}
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
        // Ensure side panel closed state doesn't leave whitespace
        ensureSidePanelClosedFixStyle();
        normalizeSidePanelSpace();
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
setupGlobalSendShortcut();
setupAutoSizing();
setupSidebarControls();
ensureSidePanelClosedFixStyle();
normalizeSidePanelSpace();
setupTicketHistoryTracking();
try { if (typeof setupInlineTranslation === 'function') { setupInlineTranslation(); } } catch (_) {}
// Search page hover preview
try { setupSearchHoverPreview(); } catch (_) {}
// Auto‑paste QC template if enabled
try { setupQCMacroAutoPaste(); } catch (_) {}

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

// --- Search page hover preview (initial minimal implementation) ---
function setupSearchHoverPreview() {
    try {
        const isSearch = /\/agent\/search(\/|$)/.test(window.location.pathname) || /[?&]search/i.test(window.location.search) || /\/agent\/search\//.test(window.location.href);
        // Fallback for when search results are shown inside Kayako tabs without /search in the URL
        // Do not early-return; rows might be injected later by tabs/virtualized lists.
        const probableRowsPresent = !!document.querySelector('tr[class*="ko-table_row__container_"], [role="row"][class*="ko-table_row__container_"], div[role="row"], [class*="session_agent_search__row-styles_"], tr[class*="ko-cases-list_row__container_"], li[class*="ko-cases-list_row__container_"], li[class*="ko-cases-list_list__row_"]');
        if (document.body.dataset.kayakoSearchPreviewSetup === 'true') return;
        document.body.dataset.kayakoSearchPreviewSetup = 'true';

        let hoverTimer = null;
        let activeBubble = null;
        let lastMouse = { x: 0, y: 0 };
        const cache = Object.create(null); // ticketId -> { html, snippet, ts }
        let activeRowId = null;
        let suppressRowId = null;
        let suppressUntil = 0;
        let isBubbleHovered = false;
        let hideTimerId = null;
        let keepAliveUntil = 0;
		let fixedLeft = null; // freeze bubble position after first placement
		let fixedTop = null;

        // Generalized selectors (hashed class suffix changes between builds)
        const rowSelector = [
            'tr[class*="ko-table_row__container_"]',
            '[role="row"][class*="ko-table_row__container_"]',
            'div[role="row"]',
            '[class*="session_agent_search__row-styles_"]',
            // Cases list variants observed in some search pages
            'tr[class*="ko-cases-list_row__container_"]',
            'li[class*="ko-cases-list_row__container_"]',
            'li[class*="ko-cases-list_list__row_"]',
            // Conservative generic fallbacks; filtered by getRowTicketId at runtime
            'tr',
            'li'
        ].join(',');

		// Parent containers that indicate we're inside a search results grid/list, not the conversation timeline
		const searchContainerSelector = [
			'table[role="grid"]',
			'[role="grid"]',
			'table[class*="ko-table"]',
			'[class*="ko-table_body_"]',
			'[class*="ko-cases-list_table"]',
			'[class*="ko-cases-list_list"]',
			'[class*="session_agent_search__"]'
		].join(',');

		const isSearchRow = (row) => {
			try {
				if (!row) return false;
				// Exclude the timeline area entirely
				if (row.closest('[class*="ko-timeline"], [class*="timeline"]')) return false;
				return !!row.closest(searchContainerSelector);
			} catch (_) { return false; }
		};

        const getRowTicketId = (row) => {
            try {
                // Strong signal: dedicated ticket-id column in search results
                const idCol = row.querySelector('[class*="ko-cases-list_column_conv-composite__ticket-id_"]');
                const hasIdCol = !!idCol;
                if (hasIdCol) {
                    const txt = idCol.textContent || '';
                    const m = txt.match(/#?(\d{4,})/);
                    if (m) return m[1];
                }
                // Strong signal: link to conversation in the row
                const a = row.querySelector('a[href*="/agent/conversations/"]');
                if (a) {
                    const m = (a.getAttribute('href') || '').match(/conversations\/(\d+)/);
                    if (m) return m[1];
                    // If anchor exists but href didn't include numeric id, fall back to id column only
                    return hasIdCol ? ((idCol.textContent || '').match(/#?(\d{4,})/) || [])[1] || null : null;
                }
                // Avoid triggering on non-search pages where random #12345 may appear in content
                return null;
            } catch (_) { return null; }
        };

        const ensureStyles = () => {
            if (document.getElementById('kayako-search-preview-style')) return;
            const st = document.createElement('style');
            st.id = 'kayako-search-preview-style';
            st.textContent = `
                .kayako-search-preview-bubble{position:absolute;z-index:10000;width:900px;max-width:85vw;max-height:70vh;background:#fff;border:1px solid #d0d5d8;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.18);padding:12px 14px;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2328;display:flex;flex-direction:column}
                .kayako-search-preview-actions{display:flex;gap:8px;align-items:center;margin-top:10px}
                .kayako-search-preview-btn{background:#f1f3f5;color:#333;border:1px solid #d0d5d8;border-radius:6px;padding:6px 10px;cursor:pointer}
                .kayako-search-preview-title{font-weight:600;margin:0 0 8px 0;font-size:13px}
                .kayako-search-preview-content{flex:1 1 auto;overflow:auto;border:1px solid #eef1f3;border-radius:6px;padding:10px;background:#fafbfc;max-height:60vh;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
                .kayako-search-preview-content :is(h1,h2,h3){font-size:15px;margin:8px 0}
                .kayako-search-preview-content p{margin:6px 0}
                .kayako-search-preview-content a{color:#0969da;text-decoration:underline;}
            `;
            document.head.appendChild(st);
        };

        // Attach non-bubbling listeners to rows (for pages where events don't bubble reliably)
        const attachRowHover = () => {
            try {
				const rows = document.querySelectorAll(rowSelector);
                rows.forEach((row) => {
                    if (row.dataset.kayakoPreviewHoverAttached === '1') return;
					if (!isSearchRow(row)) return;
                    // Only attach to elements that resolve to a ticket id to avoid noise
                    const id = getRowTicketId(row);
                    if (!id) return;
                    row.addEventListener('mouseenter', () => onEnter(row));
                    row.addEventListener('mouseleave', (e) => onLeave(e));
                    row.dataset.kayakoPreviewHoverAttached = '1';
                });
            } catch (_) {}
        };

        const showBubble = (row) => {
            try { if (activeBubble) activeBubble.remove(); } catch(_) {}
            ensureStyles();
            const bubble = document.createElement('div');
            bubble.className = 'kayako-search-preview-bubble';
            bubble.textContent = 'Loading preview…';
            // Keep bubble alive while hovering over it
            bubble.addEventListener('mouseenter', () => {
                isBubbleHovered = true;
                if (hideTimerId) { clearTimeout(hideTimerId); hideTimerId = null; }
            });
            bubble.addEventListener('mouseleave', () => {
                isBubbleHovered = false;
                // hide a bit later if also not on row
                hideTimerId = setTimeout(() => { if (!isBubbleHovered && !currentRowHover) hideBubbleWithSuppress(); }, 140);
            });
			document.body.appendChild(bubble);
			fixedLeft = null; fixedTop = null;
			positionBubbleNearRow(bubble, row);
            activeBubble = bubble;
            keepAliveUntil = Date.now() + 700;
            return bubble;
        };

		const positionBubbleNearRow = (bubble, row, force) => {
            try {
                // If a fixed position is already chosen, reuse it to avoid flicker/movement
				if (fixedLeft != null && fixedTop != null && !force) {
                    bubble.style.left = fixedLeft + 'px';
                    bubble.style.top = fixedTop + 'px';
                    return;
                }
                const br = bubble.getBoundingClientRect();
                const padding = 12;
                const gapX = 28; // horizontal clearance from pointer
                const gapY = 24; // vertical clearance from pointer
                const vw = document.documentElement.clientWidth;
                const vh = document.documentElement.clientHeight;

                // Decide side relative to the pointer, not the row
                const availRight = vw - (lastMouse.x + gapX) - padding;
                const availLeft = (lastMouse.x - gapX) - padding;
                const placeRight = (availRight >= br.width) || (availRight >= availLeft);
                let left = placeRight
                    ? lastMouse.x + gapX
                    : lastMouse.x - gapX - br.width;

				// Vertical placement relative to pointer
				const availBelow = vh - (lastMouse.y + gapY) - padding;
				const availAbove = (lastMouse.y - gapY) - padding;
				const fitsBelow = availBelow >= br.height;
				const fitsAbove = availAbove >= br.height;
				// Prefer the side that fully fits; if neither fits, prefer above to avoid bottom cutoff
				let placeBelow;
				if (fitsBelow && !fitsAbove) {
					placeBelow = true;
				} else if (!fitsBelow && fitsAbove) {
					placeBelow = false;
				} else if (fitsBelow && fitsAbove) {
					placeBelow = (availBelow >= availAbove);
				} else {
					placeBelow = false; // neither fits fully → bias to above near bottom rows
				}
				// If pointer is near the bottom of the viewport, force placing above to avoid cutoffs
				try {
					const bottomBiasThreshold = Math.floor(vh * 0.66); // bottom ~34% of viewport
					if (lastMouse.y >= bottomBiasThreshold) {
						placeBelow = false;
					}
				} catch(_) {}
				let top = placeBelow
					? lastMouse.y + gapY
					: lastMouse.y - gapY - br.height;

                // Clamp within viewport
                const finalLeft = Math.max(padding, Math.min(left, vw - br.width - padding));
                const finalTop = Math.max(padding, Math.min(top, vh - br.height - padding));
                bubble.style.left = finalLeft + 'px';
                bubble.style.top = finalTop + 'px';

				// Freeze this placement to prevent subsequent reflows from moving it
                fixedLeft = finalLeft;
                fixedTop = finalTop;
                keepAliveUntil = Date.now() + 500;
            } catch (_) {}
        };

		let currentRowHover = false;
		const hideBubble = () => { if (activeBubble) { try { activeBubble.remove(); } catch(_) {} activeBubble = null; } fixedLeft = null; fixedTop = null; };
        const hideBubbleWithSuppress = () => { hideBubble(); suppressRowId = activeRowId; suppressUntil = Date.now() + 400; activeRowId = null; };

        const onEnter = (row) => {
            const id = getRowTicketId(row);
            if (!id) return;
            if (id === suppressRowId && Date.now() < suppressUntil) return;
            if (activeBubble && id === activeRowId) return; // no recalculation while same bubble
            currentRowHover = true;
            if (hoverTimer) clearTimeout(hoverTimer);
            const delay = (cache[id] && cache[id].html && Date.now() - cache[id].ts < 10 * 60 * 1000) ? 0 : 250;
            hoverTimer = setTimeout(() => {
                const bubble = showBubble(row);
                const domain = window.location.hostname;
                const subjectEl = row.querySelector('[class*="__subject-text_"]');
                const subject = subjectEl ? (subjectEl.textContent || '').trim() : '';
                const titleDiv = document.createElement('div');
                titleDiv.className = 'kayako-search-preview-title';
                titleDiv.textContent = subject ? `#${id} • ${subject}` : `#${id}`;
                const contentDiv = document.createElement('div');
                contentDiv.className = 'kayako-search-preview-content';
                contentDiv.textContent = 'Fetching latest post…';
                bubble.innerHTML = '';
                bubble.appendChild(titleDiv);
                bubble.appendChild(contentDiv);
                // No actions for now (open bg removed)
                activeRowId = id;

                // If cached, render immediately then refresh in background
                if (cache[id] && cache[id].html && Date.now() - cache[id].ts < 10 * 60 * 1000) {
                    contentDiv.innerHTML = sanitizeHtml(cache[id].html);
                    setTimeout(() => { try { positionBubbleNearRow(bubble, row, true); } catch(_) {} }, 0);
                }

                if (!isRuntimeAvailable()) return;
                chrome.runtime.sendMessage({ action: 'fetchTicketPreview', domain, ticketId: id }, (resp) => {
                    const err = chrome.runtime?.lastError;
                    if (err) { contentDiv.textContent = 'Preview unavailable'; return; }
                    if (!resp || !resp.success) { contentDiv.textContent = 'Preview unavailable'; return; }
                    const posts = (resp.preview && Array.isArray(resp.preview.posts)) ? resp.preview.posts : [];
                    if (posts.length) {
                        cache[id] = { html: renderPostsHtml(posts), snippet: '', ts: Date.now() };
                    } else {
                        const html = (resp.preview && resp.preview.html) ? String(resp.preview.html) : '';
                        const snip = (resp.preview && resp.preview.snippet) ? String(resp.preview.snippet) : '';
                        cache[id] = { html: html || `<div>${escapeHtml(snip)}</div>`, snippet: snip, ts: Date.now() };
                    }
                    contentDiv.innerHTML = sanitizeHtml(cache[id].html);
                    setTimeout(() => { try { positionBubbleNearRow(bubble, row, true); } catch(_) {} }, 0);
                    keepAliveUntil = Date.now() + 600;
                });
            }, 250);
        };

        const onLeave = (e) => {
            currentRowHover = false;
            if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
            // delay hiding to allow moving into bubble
            if (hideTimerId) { try { clearTimeout(hideTimerId); } catch(_) {} hideTimerId = null; }
            if (Date.now() < keepAliveUntil) return;
            if (hideTimerId) { clearTimeout(hideTimerId); }
            hideTimerId = setTimeout(() => {
                // If pointer moved into the bubble, keep it open
                try { if (e && activeBubble && activeBubble.contains(e.relatedTarget)) return; } catch(_) {}
                if (Date.now() < keepAliveUntil) return;
                if (!currentRowHover && activeBubble && !isBubbleHovered) {
                    hideBubbleWithSuppress();
                }
            }, 300);
        };

        // Delegate events from the table body (fallback) and also attach direct row listeners
        document.addEventListener('mousemove', (e) => { lastMouse = { x: e.clientX, y: e.clientY }; }, true);
		document.addEventListener('mouseover', (e) => {
			const row = e.target && e.target.closest && e.target.closest(rowSelector);
			if (row && row.dataset.kayakoPreviewHoverAttached !== '1' && isSearchRow(row)) {
				const id = getRowTicketId(row);
				if (id) onEnter(row);
			}
		}, { capture: true, passive: true });
		document.addEventListener('mouseout', (e) => {
			const row = e.target && e.target.closest && e.target.closest(rowSelector);
			if (row && row.dataset.kayakoPreviewHoverAttached !== '1' && isSearchRow(row)) {
				// If moving into the bubble, do not hide
				try {
					if (activeBubble && activeBubble.contains(e.relatedTarget)) return;
					// Ignore mouseout transitions within the same row
					if (row.contains && row.contains(e.relatedTarget)) return;
				} catch(_) {}
				onLeave(e);
			}
		}, { capture: true, passive: true });
        attachRowHover();
        // Observe for dynamic result lists (Kayako tabs/virtualized lists)
        try {
            let rafQueued = false;
            const observer = new MutationObserver(() => {
                if (rafQueued) return; rafQueued = true;
                requestAnimationFrame(() => { rafQueued = false; attachRowHover(); });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) {}
		// Close on any click outside the preview bubble (including clicking rows/links)
		document.addEventListener('mousedown', (e) => {
			try {
				if (!activeBubble) return;
				if (activeBubble.contains(e.target)) return; // allow interacting inside bubble
				hideBubbleWithSuppress();
			} catch (_) {}
		}, true);
    } catch (_) {}
}

function renderPostsHtml(posts) {
    try {
        const fmt = (d) => {
            try { return new Date(d).toLocaleString(); } catch (_) { return d || ''; }
        };
        const parts = posts.map(p => {
            const date = p.createdAt ? `<div style="color:#57606a;font-size:12px;margin:6px 0 4px 0;">${escapeHtml(fmt(p.createdAt))}</div>` : '';
            const body = p.html ? p.html : `<div>${escapeHtml(p.text || '')}</div>`;
            return `<div style="border-top:1px solid #eef1f3;padding-top:6px;margin-top:6px;">${date}${body}</div>`;
        });
        return parts.join('');
    } catch (_) { return ''; }
}

// Basic HTML sanitizer for preview content
function sanitizeHtml(html) {
    try {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = String(html || '');
        const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_ELEMENT, null);
        const toRemove = [];
        while (walker.nextNode()) {
            const el = walker.currentNode;
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (['script','style','iframe','object','embed','link','meta'].includes(tag)) { toRemove.push(el); continue; }
            [...el.attributes].forEach(attr => {
                const n = attr.name.toLowerCase();
                if (n.startsWith('on') || n === 'srcdoc') el.removeAttribute(attr.name);
            });
            if (tag === 'a') {
                el.setAttribute('target','_blank');
                el.setAttribute('rel','noopener noreferrer nofollow');
            }
        }
        toRemove.forEach(n => n.remove());
        return wrapper.innerHTML;
    } catch (_) {
        return escapeHtml(String(html || ''));
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
        // If user is interacting with AI modal/UI, keep AI active
        try {
            if (e.target.closest('[class*="kayako-ai"], .kayako-ai-dropdown')) {
                window.__kayakoAIActive = true;
            }
        } catch (_) {}
        // If user is clicking within macro dropdown/search UI, keep macro active and avoid shrinking
        const inMacroMenu = !!e.target.closest('.ember-basic-dropdown-content, .ember-power-select-options, [class*="macro"][class*="dropdown"], [data-test-id*="macro"]');
        if (inMacroMenu) {
            window.__kayakoMacroActive = true;
        } else {
            // Clicking anywhere else clears macro-active state
            window.__kayakoMacroActive = false;
            window.__kayakoLastMacroEditor = null;
        }
        // Do not shrink when clicking Froala link popup actions (open/edit/unlink)
        const inFroalaLinkPopup = !!e.target.closest('.fr-popup, .fr-buttons, .fr-command, button[id^="link"], [data-cmd^="link"]');
        if (inFroalaLinkPopup) {
            try {
                const activeEd = document.querySelector('.fr-element[contenteditable="true"]');
                if (activeEd) activateEditor(activeEd);
            } catch (_) {}
            return;
        }
        const clickContainer = e.target.closest('.ko-text-editor__container_1p5g6r');
        const editors = document.querySelectorAll('.fr-element');
        editors.forEach((ed) => {
            const edContainer = ed.closest('.ko-text-editor__container_1p5g6r');
            if (!edContainer) return;
            // If the click is outside this editor's container and the editor isn't focused, shrink it
            if (!window.__kayakoMacroActive && !window.__kayakoAIActive && clickContainer !== edContainer) {
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