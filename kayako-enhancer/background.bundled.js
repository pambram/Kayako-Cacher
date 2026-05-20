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
  BRANDS = [
  "https://1-dayremoteu.kayako.com",
  "https://2hr-learning-support.kayako.com",
  "https://accuris-support.kayako.com",
  "https://acorn-supportdesk.kayako.com",
  "https://acorn-supportdesk.kayako.com",
  "https://acquisition-integration.kayako.com",
  "https://acquisition-integration.kayako.com",
  "https://acrm.kayako.com",
  "https://acrm.kayako.com",
  "https://actional-supportdesk.kayako.com",
  "https://actional-supportdesk.kayako.com",
  "https://aes-cis-support.kayako.com",
  "https://aes-edi-support.kayako.com",
  "https://agemni-supportdesk.kayako.com",
  "https://alp-support.kayako.com",
  "https://alpha-school-support.kayako.com",
  "https://alpha-staff-campus-operation.kayako.com",
  "https://alpha-supportdesk.kayako.com",
  "https://alss.support.ignitetech.com",
  "https://ams-alertfind-support.kayako.com",
  "https://ams-ems-support.kayako.com",
  "https://answerhub-supportdesk.kayako.com",
  "https://answerhub.support.ignitetech.com",
  "https://atlas-success.kayako.com",
  "https://aurea-enterprise.kayako.com",
  "https://aurea-rescue-line.kayako.com",
  "https://aureajive.kayako.com",
  "https://aureasocial.support.ignitetech.com",
  "https://auto-trol.kayako.com",
  "https://avolin-supportdesk.kayako.com",
  "https://beckon-supportdesk.kayako.com",
  "https://biznessapps.kayako.com",
  "https://callstream-supportdesk.kayako.com",
  "https://candidate-support.crossover.com",
  "https://cardinalmark.kayako.com",
  "https://ccab-supportdesk.kayako.com",
  "https://central-bootcamp.kayako.com",
  "https://central-collections.kayako.com",
  "https://central-compliance.kayako.com",
  "https://central-finance.kayako.com",
  "https://central-saas.kayako.com",
  "https://central-supportdesk.kayako.com",
  "https://central-vendor-management.kayako.com",
  "https://centralhr.kayako.com",
  "https://citynumbers-supportdesk.kayako.com",
  "https://classichelp.kayako.com",
  "https://cloudcfo-supportdesk.kayako.com",
  "https://cloudfix.kayako.com",
  "https://cloudsense.kayako.com",
  "https://communicate-xi-support.kayako.com",
  "https://computron-support.kayako.com",
  "https://contently-support.kayako.com",
  "https://coretrac.kayako.com",
  "https://cpq-brms.kayako.com",
  "https://crossover-internal.kayako.com",
  "https://crossover-supportdesk.kayako.com",
  "https://crossoverhiring.kayako.com",
  "https://cs-escalation.kayako.com",
  "https://cs-foundations.kayako.com",
  "https://cs-knowledge.kayako.com",
  "https://cs-learning.kayako.com",
  "https://cs-managers-coaching.kayako.com",
  "https://csai.kayako.com",
  "https://csai.trilogy.com",
  "https://devflows.kayako.com",
  "https://devgraph.kayako.com",
  "https://devspaces.kayako.com",
  "https://discoverxi-supportdesk.kayako.com",
  "https://dnn-centralsupport.kayako.com",
  "https://dnnsupport.dnnsoftware.com",
  "https://ecora-supportdesk.kayako.com",
  "https://edu-finops.kayako.com",
  "https://edu-supportdesk.kayako.com",
  "https://eloquens-ignitetech.kayako.com",
  "https://engineering-remote-university.kayako.com",
  "https://engineyardsupport.kayako.com",
  "https://ephor-support.kayako.com",
  "https://epm-live-ignitetech.kayako.com",
  "https://escalations-team.kayako.com",
  "https://everest.kayako.com",
  "https://field-forcemanager-supportdesk.kayako.com",
  "https://fionn-renewals.kayako.com",
  "https://firm58-support.kayako.com",
  "https://fogbugz-legacy-redirection.kayako.com",
  "https://fogbugz.kayako.com",
  "https://gensym-ignitetech.kayako.com",
  "https://gfi-accountsportal-supportdesk.kayako.com",
  "https://gfi-appmanager-supportdesk.kayako.com",
  "https://gfi-archiver-supportdesk.kayako.com",
  "https://gfi-clearview-supportdesk.kayako.com",
  "https://gfi-endpointsecurity-supportdesk.kayako.com",
  "https://gfi-eventsmanager-supportdesk.kayako.com",
  "https://gfi-exinda-supportdesk.kayako.com",
  "https://gfi-faxmaker-supportdesk.kayako.com",
  "https://gfi-faxmakeronline-supportdesk.kayako.com",
  "https://gfi-kerioconnect-supportdesk.kayako.com",
  "https://gfi-keriocontrol-supportdesk.kayako.com",
  "https://gfi-keriooperator-supportdesk.kayako.com",
  "https://gfi-languard-supportdesk.kayako.com",
  "https://gfi-mailessentials-supportdesk.kayako.com",
  "https://gfi-mykerio-supportdesk.kayako.com",
  "https://gfi-supportdesk.kayako.com",
  "https://gfi-webmonitor-supportdesk.kayako.com",
  "https://gomembers-4gov.kayako.com",
  "https://gomembers-enterprise.kayako.com",
  "https://gomembers-ondemand.kayako.com",
  "https://help.kayako.com",
  "https://ignite-supportdesk.kayako.com",
  "https://infer-ignitetech.kayako.com",
  "https://influitive-supportdesk.kayako.com",
  "https://infobright-ignitetech.kayako.com",
  "https://inmoment-support.kayako.com",
  "https://internal-test-centralsupport.kayako.com",
  "https://invigorate-support.kayako.com",
  "https://jigsawme-supportdesk.kayako.com",
  "https://jive-support-jump.kayako.com",
  "https://kandy-ucaas-support.kayako.com",
  "https://kayako-supportdesk.kayako.com",
  "https://kayakoclassic.kayako.com",
  "https://khoros-aurora.kayako.com",
  "https://khoros-care.kayako.com",
  "https://khoros-classic.kayako.com",
  "https://khoros-flow.kayako.com",
  "https://khoros-marketing.kayako.com",
  "https://khoros-support.kayako.com",
  "https://knova.kayako.com",
  "https://learnandearn-supportdesk.kayako.com",
  "https://lyris-hq-support.kayako.com",
  "https://lyris-lm-support.kayako.com",
  "https://ma-internal.kayako.com",
  "https://mobileappco.kayako.com",
  "https://mobilogynow-support.kayako.com",
  "https://myalerts-supportdesk.kayako.com",
  "https://mypersonas-ignitetech.kayako.com",
  "https://newnet-support.kayako.com",
  "https://ns8protect.kayako.com",
  "https://nuview-ignitetech.kayako.com",
  "https://objectstore-ignitetech.kayako.com",
  "https://olive-ignitetech.kayako.com",
  "https://onescm-supportdesk.kayako.com",
  "https://onyx-supportdesk.kayako.com",
  "https://pivotal-supportdesk.kayako.com",
  "https://placeable-supportdesk.kayako.com",
  "https://playbooks-supportdesk.kayako.com",
  "https://post-beyond.kayako.com",
  "https://prologic.kayako.com",
  "https://prysm-supportdesk.kayako.com",
  "https://redirect-sms-masterminds.kayako.com",
  "https://responsetek-support.kayako.com",
  "https://routingbrand.kayako.com",
  "https://saas-backlog.kayako.com",
  "https://salesbuilder.kayako.com",
  "https://salesbuilder.support.ignitetech.com",
  "https://saratoga-supportdesk.kayako.com",
  "https://savvion-supportdesk.kayako.com",
  "https://scalearc-devgraph.kayako.com",
  "https://scalearc.support.ignitetech.com",
  "https://schoolloop-supportdesk.kayako.com",
  "https://securityfirst-supportdesk.kayako.com",
  "https://servicegateway-support.kayako.com",
  "https://skyvera-analytics.kayako.com",
  "https://skyvera-helpdesk.kayako.com",
  "https://skyvera-monetization.kayako.com",
  "https://skyvera-network.kayako.com",
  "https://smartroutines.kayako.com",
  "https://smsmasterminds-supportdesk.kayako.com",
  "https://smsmasterminds.kayako.com",
  "https://sococo-supportdesk.kayako.com",
  "https://sococo5k.kayako.com",
  "https://sonic-supportdesk.kayako.com",
  "https://staff-support.alpha.school",
  "https://star.kayako.com",
  "https://stratifyd-supportdesk.kayako.com",
  "https://streetsmart-supportdesk.kayako.com",
  "https://support-360002231414.kayako.com",
  "https://support-360002235594.kayako.com",
  "https://support-360002472480.kayako.com",
  "https://support-aem.kayako.com",
  "https://support-aes.kayako.com",
  "https://support-alss-jump.kayako.com",
  "https://support-ams.kayako.com",
  "https://support-apm.kayako.com",
  "https://support-aps.kayako.com",
  "https://support-aurea.kayako.com",
  "https://support-bonzai.kayako.com",
  "https://support-firstrain-jump.kayako.com",
  "https://support-firstrain.kayako.com",
  "https://support-grid.ignitetech.com",
  "https://support-quicksilver.kayako.com",
  "https://support-sb.kayako.com",
  "https://support-skyvera.kayako.com",
  "https://support-synoptos-jump.kayako.com",
  "https://support.accounts.gfi.com",
  "https://support.acrm.aurea.com",
  "https://support.actional.aurea.com",
  "https://support.aem.aurea.com",
  "https://support.aes.aurea.com",
  "https://support.alpha.school",
  "https://support.ams.aurea.com",
  "https://support.apm.aurea.com",
  "https://support.appmanager.gfi.com",
  "https://support.aps.aurea.com",
  "https://support.archiver.gfi.com",
  "https://support.aurea.com",
  "https://support.bonzai.aurea.com",
  "https://support.callstream.com",
  "https://support.ccab.totogi.com",
  "https://support.citynumbers.co.uk",
  "https://support.cloudfix.com",
  "https://support.contently.com",
  "https://support.crossover.com",
  "https://support.endpointsecurity.gfi.com",
  "https://support.engineyard.com",
  "https://support.ephor.ai",
  "https://support.eventsmanager.gfi.com",
  "https://support.exinda.gfi.com",
  "https://support.faxmaker.gfi.com",
  "https://support.faxmakeronline.gfi.com",
  "https://support.fieldforcemanager.com",
  "https://support.fogbugz.com",
  "https://support.gfi.com",
  "https://support.guidespark.com",
  "https://support.ignitetech.com",
  "https://support.influitive.com",
  "https://support.jigsawinteractive.com",
  "https://support.jivesoftware.com",
  "https://support.kerioconnect.gfi.com",
  "https://support.keriocontrol.gfi.com",
  "https://support.keriooperator.gfi.com",
  "https://support.languard.gfi.com",
  "https://support.learnandearn.school",
  "https://support.mailessentials.gfi.com",
  "https://support.northplains.com",
  "https://support.onescm.com",
  "https://support.onyx.aurea.com",
  "https://support.pivotal.aurea.com",
  "https://support.placeable.com",
  "https://support.playbooks.aurea.com",
  "https://support.qs.aurea.com",
  "https://support.saratoga.aurea.com",
  "https://support.savvion.aurea.com",
  "https://support.skyvera.com",
  "https://support.sococo.com",
  "https://support.sonic.aurea.com",
  "https://support.streetsmartmobile.com",
  "https://support.tivian.com",
  "https://support.totogi.com",
  "https://supportportal.cloudsense.com",
  "https://supportportal.kandy.io",
  "https://supportsoft.kayako.com",
  "https://suuchi-grid-support.kayako.com",
  "https://symphonycommerce-support.kayako.com",
  "https://telescope-supportdesk.kayako.com",
  "https://tempo-assembly-lines.kayako.com",
  "https://tempo-support.kayako.com",
  "https://totogi-supportdesk.kayako.com",
  "https://tracking-supportdesk.kayako.com",
  "https://tradebeam.kayako.com",
  "https://trilogy5k.kayako.com",
  "https://vasona-support.kayako.com",
  "https://verdiem.kayako.com",
  "https://versata-centralsupport.kayako.com",
  "https://vision-supportdesk.kayako.com",
  "https://voltdelta-support.kayako.com",
  "https://xinet.kayako.com",
  "https://xinet.support.northplains.com",
];
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