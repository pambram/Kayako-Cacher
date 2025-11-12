let __lastTicketHistoryCache = [];
let __optimisticCleared = new Set();
let __cachedRecents = [];
let __cachedUnified = [];
let __bookmarkTicket = null;

document.addEventListener("DOMContentLoaded", function () {
    // Main editor elements
    let minSizeInput = document.getElementById("min-size");
    let maxSizeInput = document.getElementById("max-size");
    let applyButton = document.getElementById("apply");
    let hideEventsToggle = document.getElementById("hide-events");
    let hideInternalNotesToggle = document.getElementById("hide-internal-notes");
    let hideDatesToggle = document.getElementById("hide-dates");
    let autoPasteQCToggle = document.getElementById("auto-paste-qc");

    // Side conversation editor elements
    let sideMinWidthInput = document.getElementById("side-min-width");
    let sideMinHeightInput = document.getElementById("side-min-height");
    let sideMaxHeightInput = document.getElementById("side-max-height");
    let applySideButton = document.getElementById("apply-side");
    
    // Ticket history elements
    let refreshHistoryBtn = document.getElementById("refresh-history");
    let addCurrentTicketBtn = document.getElementById("add-current-ticket");
    let clearHistoryBtn = document.getElementById("clear-history");
    let historyContainer = document.getElementById("ticket-history-container");
    // Tabs and other containers
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const refreshRecentBtn = document.getElementById('refresh-recent');
    const refreshBookmarksBtn = document.getElementById('refresh-bookmarks');
    const recentContainer = document.getElementById('recent-tickets-container');
    const bookmarksContainer = document.getElementById('bookmarks-container');
    const filterUnread = document.getElementById('filter-unread');
    const ignoredBotsPublicInput = document.getElementById('ignored-bots-public');
    const ignoredBotsInternalInput = document.getElementById('ignored-bots-internal');
    const saveIgnoredBotsBtn = document.getElementById('save-ignored-bots');
    const toggleAdvanced = document.getElementById('toggle-advanced-notifications');
    const advancedPanel = document.getElementById('advanced-notifications');
    const llmApiKeyInput = document.getElementById('llm-api-key');
    const saveLlmApiKeyBtn = document.getElementById('save-llm-api-key');
    // Bookmark modal
    const modal = document.getElementById('bookmark-modal');
    const modalTitle = document.getElementById('bookmark-modal-title');
    const modalNote = document.getElementById('bookmark-note');
    const modalSave = document.getElementById('bookmark-save');
    const modalCancel = document.getElementById('bookmark-cancel');
    const modalSuggest = document.getElementById('bookmark-suggest');

    // Load stored values or set defaults for main editor
    chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
        minSizeInput.value = data.editorMinHeight || 44;
        maxSizeInput.value = data.editorMaxHeight || 600;
    });

    // Load stored values or set defaults for side conversation editor and toggles
    chrome.storage.local.get(["sideMinWidth", "sideMinHeight", "sideMaxHeight", "hideEvents", "hideInternalNotes", "hideDates", "autoPasteQCSendToCustomer"], (data) => {
        sideMinWidthInput.value = data.sideMinWidth || 500;
        sideMinHeightInput.value = data.sideMinHeight || 100;
        sideMaxHeightInput.value = data.sideMaxHeight || 300;
        if (hideEventsToggle) {
            hideEventsToggle.checked = data.hideEvents || false;
        }
        if (hideInternalNotesToggle) {
            hideInternalNotesToggle.checked = data.hideInternalNotes || false;
        }
        if (hideDatesToggle) {
            hideDatesToggle.checked = data.hideDates || false;
        }
        if (autoPasteQCToggle) {
            const hasNew = typeof data.autoPasteQCSendToCustomer !== 'undefined';
            const hasOld = typeof data.autoPasteQC !== 'undefined';
            autoPasteQCToggle.checked = hasNew ? !!data.autoPasteQCSendToCustomer : (hasOld ? !!data.autoPasteQC : true);
        }
    });

    // Toggle events
    if (hideEventsToggle) {
        hideEventsToggle.addEventListener("change", function() {
            const shouldHide = this.checked;
            
            // Save the preference
            chrome.storage.local.set({ hideEvents: shouldHide });
            
            // Send message to content script to apply the style
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleEvents",
                    hide: shouldHide
                });
            });
        });
    }

    // Toggle: Auto‑paste QC template after macro
    if (autoPasteQCToggle) {
        autoPasteQCToggle.addEventListener("change", function() {
            const enabled = this.checked;
            chrome.storage.local.set({ autoPasteQCSendToCustomer: enabled, autoPasteQC: enabled });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'setAutoPasteQC', enabled });
                }
            });
        });
    }

    // Toggle internal notes
    if (hideInternalNotesToggle) {
        hideInternalNotesToggle.addEventListener("change", function() {
            const shouldHide = this.checked;
            
            // Save the preference
            chrome.storage.local.set({ hideInternalNotes: shouldHide });
            
            // Send message to content script to apply the style
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleInternalNotes",
                    hide: shouldHide
                });
            });
        });
    }

    // Toggle day separators
    if (hideDatesToggle) {
        hideDatesToggle.addEventListener("change", function() {
            const shouldHide = this.checked;
            
            // Save the preference
            chrome.storage.local.set({ hideDates: shouldHide });
            
            // Send message to content script to apply the style
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleDaySeparators",
                    hide: shouldHide
                });
            });
        });
    }

    // Main editor apply button
    applyButton.addEventListener("click", function () {
        let newMinSize = parseInt(minSizeInput.value, 10);
        let newMaxSize = parseInt(maxSizeInput.value, 10);

        if (newMinSize && newMaxSize) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "resize", 
                    minHeight: newMinSize, 
                    maxHeight: newMaxSize 
                });
            });

            chrome.storage.local.set({ 
                editorMinHeight: newMinSize, 
                editorMaxHeight: newMaxSize 
            });
        }
    });

    // Side conversation editor apply button
    applySideButton.addEventListener("click", function () {
        let newMinWidth = parseInt(sideMinWidthInput.value, 10);
        let newMinHeight = parseInt(sideMinHeightInput.value, 10);
        let newMaxHeight = parseInt(sideMaxHeightInput.value, 10);

        if (newMinWidth && newMinHeight && newMaxHeight) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "resizeSideConversation", 
                    minWidth: newMinWidth,
                    minHeight: newMinHeight, 
                    maxHeight: newMaxHeight 
                });
            });

            chrome.storage.local.set({ 
                sideMinWidth: newMinWidth,
                sideMinHeight: newMinHeight, 
                sideMaxHeight: newMaxHeight 
            });
        }
    });
    
    // Ticket history event listeners
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener("click", () => {
            setButtonLoading(refreshHistoryBtn, true, 'Refreshing…');
            loadUnifiedRecent();
            setTimeout(() => setButtonLoading(refreshHistoryBtn, false), 1300);
        });
    }
    
    if (addCurrentTicketBtn) {
        addCurrentTicketBtn.addEventListener("click", quickBookmarkCurrent);
    }
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", clearTicketHistory);
    }
    if (refreshBookmarksBtn) {
        refreshBookmarksBtn.addEventListener('click', () => {
            setButtonLoading(refreshBookmarksBtn, true, 'Refreshing…');
            // Trigger background refresh (covers bookmarks as well)
            try {
                chrome.runtime.sendMessage({ action: 'forceCheckTickets' }, () => {
                    loadBookmarks();
                    setTimeout(() => setButtonLoading(refreshBookmarksBtn, false), 200);
                });
            } catch (_) {
                loadBookmarks();
                setTimeout(() => setButtonLoading(refreshBookmarksBtn, false), 200);
            }
        });
    }
    
    // Load unified Recent list on popup open (history + recents)
    // Restore unread filter state
    chrome.storage.local.get(['recentUnreadOnly'], (cfg) => {
        if (filterUnread) filterUnread.checked = !!cfg.recentUnreadOnly;
        loadUnifiedRecent();
    });
    // We load bookmarks and bots immediately; Recents now only track tickets you've worked on
    loadBookmarks();
    loadIgnoredBots();
    // Load API key if present
    chrome.storage.local.get(['openrouterApiKey','openaiApiKey'], (data) => {
        if (llmApiKeyInput) llmApiKeyInput.value = data.openrouterApiKey || data.openaiApiKey || '';
    });
    // Advanced toggle
    if (toggleAdvanced && advancedPanel) {
        toggleAdvanced.addEventListener('click', (e) => {
            e.preventDefault();
            advancedPanel.classList.toggle('hidden');
        });
    }

    // Auto-update bookmarks list when background writes new unread flags
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.ticketBookmarks) {
                const next = Array.isArray(changes.ticketBookmarks.newValue) ? changes.ticketBookmarks.newValue : [];
                try { displayBookmarks(next); } catch (_) {}
            }
        });
    } catch (_) {}

    // Unread-only filter
    if (filterUnread) {
        filterUnread.addEventListener('change', () => {
            chrome.storage.local.set({ recentUnreadOnly: filterUnread.checked });
            // Re-render using cached unified list if present
            try { displayTicketHistory(__cachedUnified && __cachedUnified.length ? __cachedUnified : __lastTicketHistoryCache); } catch (_) {}
        });
    }
    // Save API key (auto-detect provider)
    if (saveLlmApiKeyBtn && llmApiKeyInput) {
        saveLlmApiKeyBtn.addEventListener('click', () => {
            const key = (llmApiKeyInput.value || '').trim();
            setButtonLoading(saveLlmApiKeyBtn, true, 'Saving…');
            const store = {};
            if (key.startsWith('openrouter_')) {
                store.openrouterApiKey = key;
                store.llmEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
                store.llmModel = 'gpt-5-mini';
                store.openaiApiKey = '';
            } else if (key.startsWith('sk-')) {
                store.openaiApiKey = key;
                store.llmEndpoint = 'https://api.openai.com/v1/chat/completions';
                // Use a compatible OpenAI model when not using OpenRouter
                store.llmModel = 'gpt-4o-mini';
                store.openrouterApiKey = '';
            } else {
                // Unknown; store generically and default to OpenRouter
                store.openrouterApiKey = key;
                store.llmEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
                store.llmModel = 'gpt-5-mini';
                store.openaiApiKey = '';
            }
            chrome.storage.local.set(store, () => {
                showNotification('API key saved', 'success');
                setButtonLoading(saveLlmApiKeyBtn, false, 'Saved ✓');
                setTimeout(() => { if (saveLlmApiKeyBtn) saveLlmApiKeyBtn.textContent = '💾 Save'; }, 1000);
            });
        });
    }
    
    // Apply the current toggle states on popup open
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.storage.local.get(["hideEvents", "hideInternalNotes", "hideDates"], (data) => {  
            if (data.hideEvents) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleEvents",
                    hide: true
                });
            }
            if (data.hideInternalNotes) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleInternalNotes",
                    hide: true
                });
            }
            if (data.hideDates) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleDaySeparators",
                    hide: true
                });
            }
        });
    });
    // Modal handlers
    if (modalCancel) modalCancel.addEventListener('click', closeBookmarkModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeBookmarkModal(); });
    if (modalSave) modalSave.addEventListener('click', () => {
        if (!__bookmarkTicket) return closeBookmarkModal();
        const note = modalNote.value || '';
        chrome.runtime.sendMessage({ action: 'addBookmark', bookmark: { id: __bookmarkTicket.id, url: __bookmarkTicket.url, domain: __bookmarkTicket.domain, title: __bookmarkTicket.title, note } }, () => {
            showNotification('Bookmarked #' + __bookmarkTicket.id, 'success');
            closeBookmarkModal();
            loadBookmarks();
        });
    });
    if (modalSuggest) modalSuggest.addEventListener('click', () => {
        if (!__bookmarkTicket) return;
        setButtonLoading(modalSuggest, true, 'Generating…');
        chrome.runtime.sendMessage({ action: 'generateBookmarkNote', ticketId: __bookmarkTicket.id, domain: __bookmarkTicket.domain }, (res) => {
            const suggestion = res && res.success ? (res.note || '') : '';
            if (suggestion) {
                modalNote.value = suggestion;
                setButtonLoading(modalSuggest, false, 'Generated ✓');
                setTimeout(() => { if (modalSuggest) modalSuggest.textContent = '✨ Suggest'; }, 1000);
            } else {
                // Fallback to simple preview
                chrome.runtime.sendMessage({ action: 'fetchTicketPreview', ticketId: __bookmarkTicket.id, domain: __bookmarkTicket.domain }, (r) => {
                    const s = r && r.success && r.preview ? (r.preview.snippet || r.preview.html || '') : '';
                    modalNote.value = s || modalNote.value;
                    setButtonLoading(modalSuggest, false, 'Generated ✓');
                    setTimeout(() => { if (modalSuggest) modalSuggest.textContent = '✨ Suggest'; }, 1000);
                });
            }
        });
    });
});

// Function to load and display ticket history
function ensureRefreshIndicator() {
    const container = document.getElementById("ticket-history-container");
    if (!container) return null;
    let ind = document.getElementById('refresh-indicator');
    if (!ind) {
        ind = document.createElement('div');
        ind.id = 'refresh-indicator';
        ind.className = 'refresh-indicator';
        ind.innerHTML = '<div class="refresh-spinner"></div><div class="refresh-text">Refreshing…</div>';
        container.parentNode.insertBefore(ind, container);
    }
    return ind;
}

function showRefreshIndicator(show) {
    const ind = ensureRefreshIndicator();
    if (!ind) return;
    if (show) ind.classList.add('show'); else ind.classList.remove('show');
}

function loadUnifiedRecent() {
    // 1) Render cached immediately (history + recents)
    showRefreshIndicator(true);
    chrome.storage.local.get(['ticketHistory'], (data) => {
        const history = data && Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
        __lastTicketHistoryCache = history;
        // Show history immediately to avoid spinner hang
        try { displayTicketHistory(history); } catch (_) {}
        // fetch recents in parallel
        try {
            chrome.runtime.sendMessage({ action: 'getRecentTickets' }, (res) => {
                __cachedRecents = (res && res.success && Array.isArray(res.recentTickets)) ? res.recentTickets : [];
                const unified = mergeHistoryAndRecents(history, __cachedRecents);
                __cachedUnified = unified;
                try { displayTicketHistory(unified); } catch (_) {}
                showRefreshIndicator(false);
            });
            // Hard timeout fallback in case background doesn't respond
            setTimeout(() => {
                if (!__cachedUnified || !__cachedUnified.length) {
                    try { displayTicketHistory(history); } catch (_) {}
                    showRefreshIndicator(false);
                }
            }, 1200);
        } catch (_) {
            const unified = mergeHistoryAndRecents(history, []);
            __cachedUnified = unified;
            try { displayTicketHistory(unified); } catch (_) {}
            showRefreshIndicator(false);
        }
    });
    // 2) Trigger background refresh; when done, diff and animate
    try {
        chrome.runtime.sendMessage({ action: 'forceCheckTickets' }, () => {
            chrome.storage.local.get(['ticketHistory'], (data) => {
                const fresh = data && Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
                applyUnreadDiff(__lastTicketHistoryCache, fresh);
                __lastTicketHistoryCache = fresh;
                // Rebuild unified with latest history flags
                const unified = mergeHistoryAndRecents(fresh, __cachedRecents);
                __cachedUnified = unified;
                // We don't redraw whole list to preserve inline animations; dots are handled by applyUnreadDiff
                showRefreshIndicator(false);
            });
        });
    } catch (_) {
        showRefreshIndicator(false);
    }
}

function mergeHistoryAndRecents(history, recents){
    // Only include tickets you've worked on (tracked in history). Ignore passive views.
    const list = Array.isArray(history) ? history.slice() : [];
    return list.sort((a,b) => (Number(b.lastActivityAt||b.touchedAt||b.timestamp||b.lastCheckedAt||0) - Number(a.lastActivityAt||a.touchedAt||a.timestamp||a.lastCheckedAt||0)));
}

// Tabs
function switchTab(target){
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
}
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.target);
});

// Ignored bots
function loadIgnoredBots(){
    try {
        chrome.runtime.sendMessage({ action: 'getIgnoredBotsLists' }, (res) => {
            if (res && res.success) {
                if (ignoredBotsPublicInput) ignoredBotsPublicInput.value = (res.public || ['hermes']).join(', ');
                if (ignoredBotsInternalInput) ignoredBotsInternalInput.value = (res.internal || ['centralsupport-ai-acc','lachesis']).join(', ');
            }
        });
    } catch (_) {}
    // Fallback: read storage directly with defaults shortly after
    setTimeout(() => {
        try {
            chrome.storage.local.get(['ignoredBotsPublic','ignoredBotsInternal'], (data) => {
                if (ignoredBotsPublicInput && !ignoredBotsPublicInput.value) ignoredBotsPublicInput.value = (Array.isArray(data.ignoredBotsPublic) ? data.ignoredBotsPublic : ['hermes']).join(', ');
                if (ignoredBotsInternalInput && !ignoredBotsInternalInput.value) ignoredBotsInternalInput.value = (Array.isArray(data.ignoredBotsInternal) ? data.ignoredBotsInternal : ['centralsupport-ai-acc','lachesis']).join(', ');
            });
        } catch (_) {}
    }, 500);
}
if (saveIgnoredBotsBtn) {
    saveIgnoredBotsBtn.addEventListener('click', () => {
        const pub = (ignoredBotsPublicInput?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const intl = (ignoredBotsInternalInput?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        setButtonLoading(saveIgnoredBotsBtn, true, 'Saving…');
        try {
            chrome.runtime.sendMessage({ action: 'setIgnoredBotsLists', public: pub, internal: intl }, () => {
                showNotification('Ignored bots saved', 'success');
                setButtonLoading(saveIgnoredBotsBtn, false, 'Saved ✓');
                setTimeout(() => { if (saveIgnoredBotsBtn) saveIgnoredBotsBtn.textContent = '💾 Save'; }, 1000);
            });
        } catch (_) { setButtonLoading(saveIgnoredBotsBtn, false); }
    });
}

// Recents
function touchCurrentTicket(){
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.url) return;
            const m = tab.url.match(/\/agent\/conversations?\/(\d+)/);
            if (!m) return;
            const id = m[1];
            const domain = new URL(tab.url).hostname;
            const t = { id, url: tab.url, title: tab.title || `Ticket #${id}`, domain };
            chrome.runtime.sendMessage({ action: 'touchTicket', ticket: t }, () => {});
        });
    } catch (_) {}
}

// Removed separate recent renderer; unified list uses displayTicketHistory

// Bookmarks
function loadBookmarks(){
    try {
        chrome.runtime.sendMessage({ action: 'getBookmarks' }, (res) => {
            const list = (res && res.success && Array.isArray(res.bookmarks)) ? res.bookmarks : [];
            displayBookmarks(list);
        });
    } catch (_) {}
    // Fallback after 800ms if nothing rendered
    setTimeout(() => {
        const container = document.getElementById('bookmarks-container');
        if (!container) return;
        if (container.innerText && container.innerText.toLowerCase().includes('loading')) {
            chrome.storage.local.get(['ticketBookmarks'], (data) => {
                const list = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
                displayBookmarks(list);
            });
        }
    }, 800);
}

function displayBookmarks(list){
    const container = document.getElementById('bookmarks-container');
    if (!container) return;
    if (!list || !list.length) {
        container.innerHTML = '<div class="no-history">No bookmarks yet</div>';
        return;
    }
    // Sort by most recent relevant activity first
    list = list.slice().sort((a,b) => Number(b.lastActivityAt||b.createdAt||b.lastCheckedAt||0) - Number(a.lastActivityAt||a.createdAt||a.lastCheckedAt||0));
    let html = '';
    list.forEach(b => {
        const unread = Number(b.unreadCount || 0);
        const hasUnseen = !!b.hasUnseenActivity || unread > 0;
        const unreadDot = hasUnseen ? '<span class="unread-dot" title="' + (unread ? unread + ' new' : 'New activity') + '"></span>' : '';
        const when = Number(b.lastActivityAt || b.createdAt || b.lastCheckedAt || Date.now());
        const note = b.note ? `<div class="bookmark-note">${escapeHtml(String(b.note))}</div>` : '';
        html += `
            <div class="ticket-item" data-ticket-id="${b.id}">
                <div class="ticket-info">
                    <div class="ticket-id"><a href="#" class="ticket-id-link" data-url="${b.url}" data-ticket-id="${b.id}" data-domain="${b.domain || ''}">#${b.id}</a>${unreadDot}</div>
                    <div class="ticket-title" title="${b.title}">${b.title}</div>
                    <div class="ticket-meta">${b.domain || ''}${b.product ? ' • ' + b.product : ''}${b.status ? ' • ' + b.status : ''}${when ? ' • ' + getRelativeTime(when) : ''}${unread ? ' • ' + unread + ' new' : (hasUnseen ? ' • new' : '')}</div>
                    ${note}
                </div>
                <div class="ticket-actions">
                    <button class="bookmark-action-btn edit-note" data-ticket-id="${b.id}" data-domain="${b.domain || ''}">✏️</button>
                    <button class="bookmark-action-btn auto-note" data-ticket-id="${b.id}" data-domain="${b.domain || ''}">✨</button>
                    <button class="bookmark-action-btn delete-bookmark" data-ticket-id="${b.id}" data-domain="${b.domain || ''}">🗑️</button>
                </div>
                <div class="confirm-inline">
                    <span class="confirm-text">Sure?</span>
                    <button class="btn yes" data-ticket-id="${b.id}" data-domain="${b.domain || ''}">Yes</button>
                    <button class="btn no">No</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    // Make ticket id clickable in bookmarks tab
    container.querySelectorAll('.ticket-id-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.currentTarget.dataset.url;
            const ticketId = e.currentTarget.dataset.ticketId;
            let domain = e.currentTarget.dataset.domain || '';
            if (!domain && url) { try { domain = new URL(url).hostname; } catch (_) {} }
            try {
                chrome.runtime.sendMessage({ action: 'openInBackground', url }, () => {});
            } catch (_) {
                try { chrome.tabs.create({ url, active: false }); } catch (_) {}
            }
            __optimisticCleared.add(String(ticketId));
            const item = e.currentTarget.closest('.ticket-item');
            clearUnreadForItem(item);
            try { chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain, ticketId }, () => {}); } catch (_) {}
        });
    });
    container.querySelectorAll('.bookmark-action-btn.edit-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const ticketId = el.dataset.ticketId;
            const domain = el.dataset.domain;
            const note = prompt('Edit note for #' + ticketId + ':', '');
            if (note == null) return;
            chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark: { id: ticketId, domain, note } }, () => {
                loadBookmarks();
            });
        });
    });
    container.querySelectorAll('.bookmark-action-btn.auto-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const ticketId = el.dataset.ticketId;
            const domain = el.dataset.domain;
            setButtonLoading(el, true, 'Generating…');
            chrome.runtime.sendMessage({ action: 'generateBookmarkNote', ticketId, domain }, (res) => {
                const note = res && res.success ? (res.note || '') : '';
                const save = (n)=> chrome.runtime.sendMessage({ action: 'updateBookmark', bookmark: { id: ticketId, domain, note: n } }, () => { setButtonLoading(el, false, 'Saved ✓'); setTimeout(() => { el.textContent = '✨'; }, 1000); loadBookmarks(); });
                if (note) return save(note);
                // Fallback
                chrome.runtime.sendMessage({ action: 'fetchTicketPreview', ticketId, domain }, (r) => {
                    const s = r && r.success && r.preview ? (r.preview.snippet || '') : '';
                    save(s);
                });
            });
        });
    });
    container.querySelectorAll('.bookmark-action-btn.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const ticketId = el.dataset.ticketId;
            const domain = el.dataset.domain;
            if (!confirm('Remove bookmark #' + ticketId + '?')) return;
            chrome.runtime.sendMessage({ action: 'deleteBookmark', ticket: { id: ticketId, domain } }, () => {
                loadBookmarks();
            });
        });
    });
}

function openBookmarkModal(t){
    __bookmarkTicket = t;
    if (modalTitle) modalTitle.textContent = `Bookmark #${t.id}`;
    if (modalNote) modalNote.value = '';
    if (modal) modal.classList.remove('hidden');
}
function closeBookmarkModal(){
    if (modal) modal.classList.add('hidden');
    __bookmarkTicket = null;
}

// Escape HTML for safe note rendering
function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mapById(arr) {
    const m = {};
    (arr || []).forEach(t => { if (t && t.id != null) m[String(t.id)] = t; });
    return m;
}

// Build the base meta text (without unread suffix)
function buildMetaBase(ticket) {
    const when = Number(ticket.lastActivityAt || ticket.touchedAt || ticket.timestamp || ticket.lastCheckedAt || Date.now());
    const prod = ticket.product ? ` • ${ticket.product}` : '';
    const status = ticket.status ? ` • ${ticket.status}` : '';
    const dom = ticket.domain ? ` • ${ticket.domain}` : '';
    const cust = ticket.customer ? `${ticket.customer} • ` : '';
    return `${cust}${getRelativeTime(when)}${dom}${prod}${status}`;
}

// Update a rendered item's meta line to reflect current product/status/time
function updateMetaForItem(item, ticket) {
    if (!item) return;
    const meta = item.querySelector('.ticket-meta');
    if (!meta) return;
    const base = buildMetaBase(ticket);
    // Preserve any existing unread suffix
    const suffixMatch = meta.textContent.match(/\s•\s(?:\d+\snew|new)$/i);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    const currentBase = meta.textContent.replace(/\s•\s\d+\snew$/i, '').replace(/\s•\snew$/i, '');
    if (currentBase === base) return;
    meta.classList.add('fade-out');
    setTimeout(() => {
        meta.textContent = base + suffix;
        meta.classList.remove('fade-out');
        meta.classList.add('fade-in');
        setTimeout(() => meta.classList.remove('fade-in'), 200);
    }, 200);
}

function clearUnreadForItem(item) {
    if (!item) return;
    const dot = item.querySelector('.unread-dot');
    if (dot) {
        dot.classList.add('fade-out');
        setTimeout(() => { if (dot && dot.parentNode) dot.remove(); }, 200);
    }
    const meta = item.querySelector('.ticket-meta');
    if (meta) {
        const newText = meta.textContent.replace(/\s•\s\d+\snew$/i, '').replace(/\s•\snew$/i, '');
        meta.classList.add('fade-out');
        setTimeout(() => {
            meta.textContent = newText;
            meta.classList.remove('fade-out');
            meta.classList.add('fade-in');
            setTimeout(() => meta.classList.remove('fade-in'), 200);
        }, 200);
    }
}

function addUnreadForItem(item, unreadCount) {
    if (!item) return;
    const idWrap = item.querySelector('.ticket-id');
    if (!idWrap) return;
    let dot = item.querySelector('.unread-dot');
    if (!dot) {
        dot = document.createElement('span');
        dot.className = 'unread-dot appearing';
        dot.title = unreadCount ? `${unreadCount} new` : 'New activity';
        idWrap.appendChild(dot);
        requestAnimationFrame(() => {
            dot.classList.remove('appearing');
        });
    } else {
        dot.title = unreadCount ? `${unreadCount} new` : 'New activity';
    }
    const meta = item.querySelector('.ticket-meta');
    if (meta) {
        const base = meta.textContent.replace(/\s•\s\d+\snew$/i, '').replace(/\s•\snew$/i, '');
        const suffix = unreadCount ? ` • ${unreadCount} new` : ' • new';
        meta.textContent = base + suffix;
    }
}

function applyUnreadDiff(prev, next) {
    const prevMap = mapById(prev);
    const nextMap = mapById(next);
    const container = document.getElementById('ticket-history-container');
    if (!container) return;
    Object.keys(nextMap).forEach(id => {
        const p = prevMap[id];
        const n = nextMap[id];
        const had = !!(p && (p.hasUnseenActivity || (Number(p.unreadCount||0) > 0)));
        const rawHas = !!(n && (n.hasUnseenActivity || (Number(n.unreadCount||0) > 0)));
        let has = rawHas;
        // If user cleared this inline, keep it cleared optimistically until backend baseline reflects
        if (__optimisticCleared.has(String(id))) {
            has = false;
            if (n) {
                n.hasUnseenActivity = false;
                n.unreadCount = 0;
            }
        }
        const item = container.querySelector(`.ticket-item[data-ticket-id="${id}"]`);
        if (!item) return;
        // Update meta line (product/status/lastActivity) when changed
        try { updateMetaForItem(item, n || p); } catch (_) {}
        if (!had && has) {
            addUnreadForItem(item, Number(n.unreadCount||0));
        } else if (had && !has) {
            clearUnreadForItem(item);
        } else if (has) {
            // Update count/title if changed
            const prevCount = Number(p && p.unreadCount || 0);
            const nextCount = Number(n.unreadCount || 0);
            if (nextCount !== prevCount) {
                addUnreadForItem(item, nextCount);
            }
        }
        // If background now shows no unread, drop optimistic flag
        if (__optimisticCleared.has(String(id)) && rawHas === false) {
            __optimisticCleared.delete(String(id));
        }
    });
}

// Function to display ticket history in the popup
function displayTicketHistory(history) {
    const container = document.getElementById("ticket-history-container");
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="no-history">No ticket history yet<br>Work on tickets and click "Send" to track them!</div>';
        return;
    }
    
    // Apply unread-only filter if enabled
    let list = history.slice(0);
    const filterEl = document.getElementById('filter-unread');
    if (filterEl && filterEl.checked) {
        list = list.filter(t => (t && (t.hasUnseenActivity || Number(t.unreadCount||0) > 0)));
    }
    let historyHTML = '';
    list.slice(0, 20).forEach(ticket => { // Show only last 20 in popup
        const when = Number(ticket.lastActivityAt || ticket.touchedAt || ticket.timestamp || ticket.lastCheckedAt || Date.now());
        const unread = Number(ticket.unreadCount || 0);
        const hasUnseen = !!ticket.hasUnseenActivity || unread > 0;
        const unreadDot = hasUnseen ? `<span class="unread-dot" title="${unread ? unread + ' new' : 'New activity'}"></span>` : '';
        const unreadMeta = unread ? ` • ${unread} new` : (hasUnseen ? ' • new' : '');
        const prod = ticket.product ? ` • ${ticket.product}` : '';
        const status = ticket.status ? ` • ${ticket.status}` : '';
        
        historyHTML += `
            <div class="ticket-item" data-ticket-id="${ticket.id}">
                <div class="ticket-info">
                    <div class="ticket-id"><a href="#" class="ticket-id-link" data-url="${ticket.url}" data-ticket-id="${ticket.id}" data-domain="${ticket.domain || ''}">#${ticket.id}</a>${unreadDot}</div>
                    <div class="ticket-title" title="${ticket.title}">${ticket.title}</div>
                    <div class="ticket-meta">
                        ${ticket.customer ? ticket.customer + ' • ' : ''}${getRelativeTime(when)}${ticket.domain ? ' • ' + ticket.domain : ''}${prod}${status}${unreadMeta}
                    </div>
                </div>
                <div class="ticket-actions">
                    <button class="ticket-action-btn bookmark" data-url="${ticket.url}" data-ticket-id="${ticket.id}" data-domain="${ticket.domain || ''}" data-title="${ticket.title}" title="Bookmark">⭐</button>
                    <button class="ticket-action-btn delete" data-ticket-id="${ticket.id}" title="Remove from history">🗑️</button>
                </div>
                <div class="confirm-inline">
                    <span class="confirm-text">Sure?</span>
                    <button class="btn yes" data-ticket-id="${ticket.id}">Yes</button>
                    <button class="btn no">No</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = historyHTML;
    
    // Add event listeners to action buttons
    container.querySelectorAll('.ticket-action-btn.open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const url = el.dataset.url;
            const ticketId = el.dataset.ticketId;
            const domain = el.dataset.domain;
            try { chrome.runtime.sendMessage({ action: 'openInBackground', url }, () => {}); } catch (_) { try { chrome.tabs.create({ url: url, active: false }); } catch (_) {} }
            try {
                __optimisticCleared.add(String(ticketId));
                chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain, ticketId }, () => {
                    const item = el.closest('.ticket-item');
                    clearUnreadForItem(item);
                });
            } catch (_) {
                __optimisticCleared.add(String(ticketId));
                const item = el.closest('.ticket-item');
                clearUnreadForItem(item);
            }
        });
    });
    
    // Make ticket number clickable to open in background
    container.querySelectorAll('.ticket-id-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const el = e.currentTarget;
            const url = el.dataset.url;
            const ticketId = el.dataset.ticketId;
            let domain = el.dataset.domain || '';
            if (!domain && url) { try { domain = new URL(url).hostname; } catch (_) {} }
            // Open in background
            try { chrome.runtime.sendMessage({ action: 'openInBackground', url }, () => {}); } catch (_) { try { chrome.tabs.create({ url: url, active: false }); } catch (_) {} }
            // Optimistic UI clear immediately
            __optimisticCleared.add(String(ticketId));
            const item = el.closest('.ticket-item');
            clearUnreadForItem(item);
            // Baseline in background (best effort)
            try {
                chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain, ticketId }, () => {});
            } catch (_) {}
        });
    });
    
    // Delete button -> inline confirm (Recents)
    container.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.ticket-item');
            if (!item) return;
            item.classList.add('confirming');
        });
    });

    // Bookmark from history
    container.querySelectorAll('.ticket-action-btn.bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const ticket = { id: el.dataset.ticketId, url: el.dataset.url, domain: el.dataset.domain, title: el.dataset.title };
            try {
                chrome.runtime.sendMessage({ action: 'addBookmark', bookmark: ticket }, () => {
                    showNotification('Bookmarked #' + ticket.id, 'success');
                    try { loadBookmarks(); } catch (_) {}
                });
            } catch (_) {
                openBookmarkModal(ticket);
            }
        });
    });

    // Confirm Yes -> remove only that ticket and update storage (Recents)
    container.querySelectorAll('.confirm-inline .yes').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const ticketId = el.dataset.ticketId;
            chrome.storage.local.get(['ticketHistory'], (data) => {
                let history = (data && Array.isArray(data.ticketHistory)) ? data.ticketHistory : [];
                const filtered = history.filter(t => String(t.id) !== String(ticketId));
                chrome.storage.local.set({ ticketHistory: filtered }, () => {
                    const item = el.closest('.ticket-item');
                    if (item && item.parentNode) {
                        item.parentNode.removeChild(item);
                    }
                    showNotification(`Ticket #${ticketId} removed`, 'success');
                });
            });
        });
    });

    // Confirm No -> cancel
    container.querySelectorAll('.confirm-inline .no').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.ticket-item');
            if (!item) return;
            item.classList.remove('confirming');
        });
    });
}

// Function to add current ticket to history
function addCurrentTicket() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        
        // Extract ticket info from current tab URL (support both /conversation/ and /conversations/)
        const urlMatch = currentTab.url.match(/\/agent\/conversations?\/(\d+)/);
        if (!urlMatch) {
            showNotification('Not on a ticket page', 'error');
            return;
        }
        
        const ticketId = urlMatch[1];
        const ticketInfo = {
            id: ticketId,
            title: currentTab.title || `Ticket #${ticketId}`,
            customer: '',
            url: currentTab.url,
            domain: new URL(currentTab.url).hostname
        };
        
        chrome.tabs.sendMessage(currentTab.id, { 
            action: "addTicketToHistory",
            ticketInfo: ticketInfo
        }, (response) => {
            if (response && response.success) {
                showNotification(`Ticket #${ticketId} added to history`, 'success');
                loadTicketHistory(); // Refresh display
            } else {
                showNotification('Failed to add ticket', 'error');
            }
        });
    });
}

// Bookmark the current active ticket (open modal for optional note)
function bookmarkCurrentFromActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs && tabs[0];
        if (!currentTab || !currentTab.url) {
            showNotification('Not on a ticket page', 'error');
            return;
        }
        const urlMatch = currentTab.url.match(/\/agent\/conversations?\/(\d+)/);
        if (!urlMatch) {
            showNotification('Not on a ticket page', 'error');
            return;
        }
        const ticketId = urlMatch[1];
        const ticket = {
            id: ticketId,
            url: currentTab.url,
            domain: new URL(currentTab.url).hostname,
            title: currentTab.title || `Ticket #${ticketId}`
        };
        openBookmarkModal(ticket);
    });
}

// Quick add current active ticket to bookmarks (no modal)
function quickBookmarkCurrent() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs && tabs[0];
        if (!currentTab || !currentTab.url) {
            showNotification('Not on a ticket page', 'error');
            return;
        }
        const urlMatch = currentTab.url.match(/\/agent\/conversations?\/(\d+)/);
        if (!urlMatch) {
            showNotification('Not on a ticket page', 'error');
            return;
        }
        const ticketId = urlMatch[1];
        const bookmark = {
            id: ticketId,
            url: currentTab.url,
            domain: new URL(currentTab.url).hostname,
            title: currentTab.title || `Ticket #${ticketId}`,
            note: ''
        };
        chrome.runtime.sendMessage({ action: 'addBookmark', bookmark }, () => {
            showNotification(`Bookmarked #${ticketId}`, 'success');
            loadBookmarks();
        });
    });
}

// Function to delete ticket from history
function deleteTicket(ticketId) {
    // Delete directly from extension storage so it works on any page
    chrome.storage.local.get(['ticketHistory'], (data) => {
        let history = (data && Array.isArray(data.ticketHistory)) ? data.ticketHistory : [];
        const filtered = history.filter(t => t.id !== ticketId);
        chrome.storage.local.set({ ticketHistory: filtered }, () => {
            showNotification(`Ticket #${ticketId} removed`, 'success');
            loadTicketHistory();
        });
    });
}

// Function to clear all ticket history
function clearTicketHistory() {
    if (confirm('Are you sure you want to clear all ticket history?')) {
        chrome.storage.local.set({ ticketHistory: [] }, () => {
            showNotification('Ticket history cleared', 'success');
            loadTicketHistory(); // Refresh display
        });
    }
}

// Helper function to get relative time
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
}

// Helper function to show notifications in popup
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        text-align: center;
        ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
        ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
        ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Small helper for button loading states
function setButtonLoading(btn, loading, text) {
    if (!btn) return;
    if (loading) {
        btn.dataset._label = btn.textContent;
        btn.textContent = typeof text === 'string' ? text : 'Working…';
        btn.disabled = true;
    } else {
        btn.textContent = text || btn.dataset._label || btn.textContent || '';
        btn.disabled = false;
    }
}

