// Background script for the Kayako Resizer extension

// Keeps user logged in throughout other brands

// Configuration
const SOURCE_DOMAIN = 'central-supportdesk.kayako.com';
const COOKIE_NAME = 'novo_sessionid';

// Log that the service worker has started
console.log('Kayako Resizer service worker started');

// Load BRANDS dynamically
let BRANDS = [];

// Import the BRANDS configuration
try {
  // This will be replaced by the build system
  // @ts-ignore
  BRANDS = BRANDS_IMPORT;
} catch (e) {
  console.error('Failed to load BRANDS:', e);
  // Fallback to a minimal set of brands
  BRANDS = [
    'central-supportdesk.kayako.com',
    'hand-support.kayako.com',
    'help.hand.com'
  ];
}

/* -----------------------------------------------------------
   Delete all existing novo_sessionid cookies on <host>
----------------------------------------------------------- */
async function purgeOldCookies(host) {
  const stale = await chrome.cookies.getAll({ domain: host, name: COOKIE_NAME });

  for (const c of stale) {
    const scheme = c.secure ? 'https' : 'http';
    const dom    = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
    await chrome.cookies.remove({ url: `${scheme}://${dom}${c.path}`, name: COOKIE_NAME });
  }
}

/* -----------------------------------------------------------
   Write the fresh agent session on <host>
   • kayako.com hosts  →  cookie with Domain=<host>
   • other hosts       →  host‑only cookie (no domain attr)
----------------------------------------------------------- */
async function setFreshCookie(host, template) {
  const base = {
    url: `https://${host}/`,
    name: COOKIE_NAME,
    value: template.value,
    secure: template.secure ?? true,
    httpOnly: template.httpOnly,
    sameSite: template.sameSite,
    path: '/',
    expirationDate:
      template.expirationDate ?? Math.floor(Date.now() / 1000) + 86400 // +24 h
  };

  if (host.endsWith('.kayako.com') && host !== SOURCE_DOMAIN) {
    await chrome.cookies.set({ ...base, domain: host });     // explicit Domain attr
  } else {
    await chrome.cookies.set(base);                           // host‑only
  }
}

/* -----------------------------------------------------------
   Propagate the cookie to every brand (except SOURCE)
----------------------------------------------------------- */
async function propagateCookie(template) {
  for (const host of BRANDS) {
    if (host === SOURCE_DOMAIN) continue;          // never modify the source
    
    await purgeOldCookies(host);
    await setFreshCookie(host, template);
  }
}

/* -----------------------------------------------------------
   Helpers to recognise the agent cookie on the source brand
----------------------------------------------------------- */
function isSourceCookie(cookie) {
  return (
    cookie.name === COOKIE_NAME &&
    (cookie.domain === SOURCE_DOMAIN || cookie.domain === `.${SOURCE_DOMAIN}`)
  );
}

/* -----------------------------------------------------------
   Initial copy if a session already exists
----------------------------------------------------------- */
chrome.cookies.getAll({ name: COOKIE_NAME }, function(cookies) {
  const src = cookies.find(isSourceCookie);
  if (src) propagateCookie(src);
});

/* -----------------------------------------------------------
   Copy on every update to the source session
----------------------------------------------------------- */
chrome.cookies.onChanged.addListener(function(changeInfo) {
  if (changeInfo.removed || !isSourceCookie(changeInfo.cookie)) return;
  propagateCookie(changeInfo.cookie);
});

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log("Kayako Resizer extension installed.");
});

// Listener for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "log") {
        console.log("Kayako Resizer Log:", message.data);
    }
    // Fetch ticket preview (posts with author resolution)
    if (message.action === 'fetchTicketPreview' && message.ticketId && message.domain) {
        console.log('[SW] fetchTicketPreview request for ticket', message.ticketId, 'on', message.domain);
        // Race against a 12s timeout to ensure the port never closes before we respond
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('preview timeout')), 12000));
        Promise.race([fetchTicketPreview(message.domain, message.ticketId), timeoutPromise]).then((preview) => {
            console.log('[SW] fetchTicketPreview success, posts:', preview?.posts?.length);
            sendResponse({ success: true, preview });
        }).catch(err => {
            console.warn('[SW] fetchTicketPreview FAILED:', err?.message || err);
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
});

// --- Ticket preview fetcher ---

const _userNameCache = Object.create(null);

async function resolveUserName(domain, userId) {
    if (!userId) return '';
    const key = `${domain}:${userId}`;
    if (_userNameCache[key] !== undefined) return _userNameCache[key];
    try {
        // 3-second timeout so we never stall the whole preview response
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://${domain}/api/v1/users/${userId}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) { _userNameCache[key] = ''; return ''; }
        const json = await res.json();
        const user = json?.data || json;
        const name = user?.full_name || user?.fullname || user?.name || user?.email || user?.primary_email || '';
        _userNameCache[key] = String(name);
        return _userNameCache[key];
    } catch (_) { _userNameCache[key] = ''; return ''; }
}

function extractCreatorId(post) {
    if (!post) return null;
    if (post.creator && typeof post.creator === 'object' && post.creator.id) return post.creator.id;
    if (post.creator_id) return post.creator_id;
    if (post.person && typeof post.person === 'object' && post.person.id) return post.person.id;
    if (post.user && typeof post.user === 'object' && post.user.id) return post.user.id;
    return null;
}

function extractPostType(post) {
    if (!post) return 'public';
    const lc = (s) => (s || '').toString().toLowerCase();
    // PRIMARY: original.resource_type is definitive
    if (post.original && typeof post.original === 'object') {
        const rt = lc(post.original.resource_type || '');
        if (rt === 'note' || rt === 'notes' || rt === 'internal_note') return 'internal';
        if (rt === 'case_message' || rt === 'message') return 'public';
    }
    const dm = lc(post.destination_medium || '');
    if (dm === 'note' || dm === 'notes' || dm === 'internal') return 'internal';
    if (post.is_internal === true) return 'internal';
    if (post.private === true) return 'internal';
    return 'public';
}

function extractPostCreatedAt(post) {
    try {
        const candidates = [post.created_at, post.createdAt, post.created_on, post.date, post.timestamp];
        for (const c of candidates) {
            if (!c) continue;
            const t = Date.parse(c);
            if (!isNaN(t)) return new Date(t).toISOString();
            if (typeof c === 'number' && c > 0) return new Date(c).toISOString();
        }
    } catch (_) {}
    return null;
}

function extractPostHtml(post) {
    if (!post) return '';
    const candidates = [post.html, post.body_html, post.richText, post.rich_text, post.content_html, post.description_html];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c;
    }
    // contents is plain text in Kayako -- wrap it
    if (post.contents && typeof post.contents === 'string' && post.contents.trim()) {
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<div>${esc(post.contents).replace(/\n/g,'<br>')}</div>`;
    }
    return '';
}

function normalizePostsPayload(json) {
    try {
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.data)) return json.data;
        if (Array.isArray(json?.data?.data)) return json.data.data;
        if (Array.isArray(json?.result)) return json.result;
    } catch (_) {}
    return [];
}

async function fetchTicketPreview(domain, ticketId) {
    const url = `https://${domain}/api/v1/cases/${ticketId}/posts?limit=30`;
    const headers = { 'Accept': 'application/json' };
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching preview for ticket ${ticketId}`);
    const json = await res.json();
    const posts = normalizePostsPayload(json);
    console.log('[SW] preview posts fetched:', posts.length);

    // Debug sample
    let _debugRawSample = null;
    try { if (posts.length > 0) _debugRawSample = JSON.parse(JSON.stringify(posts[0])); } catch(_) {}

    // Resolve unique creator IDs to names
    const creatorIds = new Set();
    for (const p of posts) { const cid = extractCreatorId(p); if (cid) creatorIds.add(cid); }
    await Promise.allSettled([...creatorIds].map(cid => resolveUserName(domain, cid)));

    // Map posts
    const mapped = posts.map(p => {
        const cid = extractCreatorId(p);
        const authorName = cid ? (_userNameCache[`${domain}:${cid}`] || '') : '';
        return {
            id: String(p?.id || ''),
            createdAt: extractPostCreatedAt(p),
            html: extractPostHtml(p) || '',
            text: typeof p?.contents === 'string' ? p.contents : '',
            author: authorName,
            postType: extractPostType(p),
            isRequester: !!p?.is_requester
        };
    });

    // Sort earliest first
    mapped.sort((a, b) => {
        const ta = Date.parse(a.createdAt || '') || 0;
        const tb = Date.parse(b.createdAt || '') || 0;
        if (ta !== tb) return ta - tb;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    return { ticketId: String(ticketId), posts: mapped, _debugRawSample, fetchedAt: Date.now() };
}

// --- Conversation preloader (ported from CLANK by colleague) ---
// Uses declarativeNetRequest to rewrite Kayako's /posts API requests at the
// network layer, bumping limit=30 to limit=500. Kayako receives all posts in
// one batch and its "no more pages" check fires immediately, eliminating
// lazy-load round-trips and ensuring the full timeline is in the DOM on first render.
const PRELOAD_RULE_ID = 1;
const PRELOAD_TARGET_LIMIT = '500';

const PRELOAD_RULE = {
    id: PRELOAD_RULE_ID,
    priority: 1,
    action: {
        type: 'redirect',
        redirect: {
            transform: {
                queryTransform: {
                    addOrReplaceParams: [{ key: 'limit', value: PRELOAD_TARGET_LIMIT }]
                }
            }
        }
    },
    condition: {
        regexFilter: '^https?://[^/]+/api/v1/cases/\\d+/posts(?:\\?|$)',
        resourceTypes: ['xmlhttprequest'],
        requestDomains: ['kayako.com']
    }
};

async function applyPreloadRule() {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [PRELOAD_RULE_ID],
            addRules: [PRELOAD_RULE]
        });
        console.log('[Preload] DNR rule applied: /posts limit -> ' + PRELOAD_TARGET_LIMIT);
    } catch (err) {
        console.warn('[Preload] failed to apply DNR rule:', err);
    }
}

applyPreloadRule();