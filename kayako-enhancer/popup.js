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
    
    // Load ticket history on popup open
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
function loadTicketHistory() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getTicketHistory" }, (response) => {
            if (response && response.success) {
                displayTicketHistory(response.history);
            } else {
                displayTicketHistory([]);
            }
        });
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
        
        historyHTML += `
            <div class="ticket-item" data-ticket-id="${ticket.id}">
                <div class="ticket-info">
                    <div class="ticket-id">#${ticket.id}</div>
                    <div class="ticket-title" title="${ticket.title}">${ticket.title}</div>
                    <div class="ticket-meta">
                        ${ticket.customer ? ticket.customer + ' • ' : ''}${relativeTime}${ticket.domain ? ' • ' + ticket.domain : ''}
                    </div>
                </div>
                <div class="ticket-actions">
                    <button class="ticket-action-btn open" data-url="${ticket.url}" title="Open ticket">📂</button>
                    <button class="ticket-action-btn delete" data-ticket-id="${ticket.id}" title="Remove from history">🗑️</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = historyHTML;
    
    // Add event listeners to action buttons
    container.querySelectorAll('.ticket-action-btn.open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            chrome.tabs.create({ url: url });
        });
    });
    
    container.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ticketId = e.target.dataset.ticketId;
            deleteTicket(ticketId);
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { 
            action: "deleteTicketFromHistory",
            ticketId: ticketId
        }, (response) => {
            if (response && response.success) {
                showNotification(`Ticket #${ticketId} removed`, 'success');
                loadTicketHistory(); // Refresh display
            } else {
                showNotification('Failed to remove ticket', 'error');
            }
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

