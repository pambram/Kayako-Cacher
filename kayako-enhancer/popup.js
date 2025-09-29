let __lastTicketHistoryCache = [];

document.addEventListener("DOMContentLoaded", function () {
    // Main editor elements
    let minSizeInput = document.getElementById("min-size");
    let maxSizeInput = document.getElementById("max-size");
    let applyButton = document.getElementById("apply");
    let hideEventsToggle = document.getElementById("hide-events");
    let hideInternalNotesToggle = document.getElementById("hide-internal-notes");
    let hideDatesToggle = document.getElementById("hide-dates");

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

    // Load stored values or set defaults for main editor
    chrome.storage.local.get(["editorMinHeight", "editorMaxHeight"], (data) => {
        minSizeInput.value = data.editorMinHeight || 44;
        maxSizeInput.value = data.editorMaxHeight || 600;
    });

    // Load stored values or set defaults for side conversation editor and toggles
    chrome.storage.local.get(["sideMinWidth", "sideMinHeight", "sideMaxHeight", "hideEvents", "hideInternalNotes", "hideDates"], (data) => {
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
        refreshHistoryBtn.addEventListener("click", loadTicketHistory);
    }
    
    if (addCurrentTicketBtn) {
        addCurrentTicketBtn.addEventListener("click", addCurrentTicket);
    }
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", clearTicketHistory);
    }
    
    // Load ticket history on popup open (non-blocking: show cached → background refresh → animate diffs)
    loadTicketHistory();
    
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

function loadTicketHistory() {
    // 1) Render cached immediately
    chrome.storage.local.get(['ticketHistory'], (data) => {
        const cached = data && Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
        __lastTicketHistoryCache = cached;
        displayTicketHistory(cached);
        showRefreshIndicator(true);
    });
    // 2) Trigger background refresh; when done, diff and animate
    try {
        chrome.runtime.sendMessage({ action: 'forceCheckTickets' }, () => {
            chrome.storage.local.get(['ticketHistory'], (data) => {
                const fresh = data && Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
                applyUnreadDiff(__lastTicketHistoryCache, fresh);
                __lastTicketHistoryCache = fresh;
                showRefreshIndicator(false);
            });
        });
    } catch (_) {
        showRefreshIndicator(false);
    }
}

function mapById(arr) {
    const m = {};
    (arr || []).forEach(t => { if (t && t.id != null) m[String(t.id)] = t; });
    return m;
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
        const has = !!(n && (n.hasUnseenActivity || (Number(n.unreadCount||0) > 0)));
        const item = container.querySelector(`.ticket-item[data-ticket-id="${id}"]`);
        if (!item) return;
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
    });
}

// Function to display ticket history in the popup
function displayTicketHistory(history) {
    const container = document.getElementById("ticket-history-container");
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="no-history">No ticket history yet<br>Work on tickets and click "Send" to track them!</div>';
        return;
    }
    
    let historyHTML = '';
    history.slice(0, 20).forEach(ticket => { // Show only last 20 in popup
        const relativeTime = getRelativeTime(ticket.timestamp);
        const unread = Number(ticket.unreadCount || 0);
        const hasUnseen = !!ticket.hasUnseenActivity || unread > 0;
        const unreadDot = hasUnseen ? `<span class="unread-dot" title="${unread ? unread + ' new' : 'New activity'}"></span>` : '';
        const unreadMeta = unread ? ` • ${unread} new` : (hasUnseen ? ' • new' : '');
        
        historyHTML += `
            <div class="ticket-item" data-ticket-id="${ticket.id}">
                <div class="ticket-info">
                    <div class="ticket-id"><a href="#" class="ticket-id-link" data-url="${ticket.url}" data-ticket-id="${ticket.id}" data-domain="${ticket.domain || ''}">#${ticket.id}</a>${unreadDot}</div>
                    <div class="ticket-title" title="${ticket.title}">${ticket.title}</div>
                    <div class="ticket-meta">
                        ${ticket.customer ? ticket.customer + ' • ' : ''}${relativeTime}${ticket.domain ? ' • ' + ticket.domain : ''}${unreadMeta}
                    </div>
                </div>
                <div class="ticket-actions">
                    <button class="ticket-action-btn open" data-url="${ticket.url}" data-ticket-id="${ticket.id}" data-domain="${ticket.domain || ''}" title="Open ticket">📂</button>
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
            chrome.tabs.create({ url: url, active: false });
            // Baseline and clear inline (no full list refresh) with fade
            try {
                chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain, ticketId }, () => {
                    const item = el.closest('.ticket-item');
                    if (item) {
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
                });
            } catch (_) {
                const item = el.closest('.ticket-item');
                if (item) {
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
            const domain = el.dataset.domain;
            chrome.tabs.create({ url: url, active: false });
            try {
                chrome.runtime.sendMessage({ action: 'baselineTicketActivity', domain, ticketId }, () => {
                    const item = el.closest('.ticket-item');
                    if (item) {
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
                });
            } catch (_) {
                const item = el.closest('.ticket-item');
                if (item) {
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
            }
        });
    });
    
    // Delete button -> inline confirm
    container.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.ticket-item');
            if (!item) return;
            item.classList.add('confirming');
        });
    });

    // Confirm Yes -> remove only that ticket and update storage
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

