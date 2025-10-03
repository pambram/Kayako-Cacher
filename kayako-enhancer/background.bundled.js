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
  "hand-support.kayako.com",
  "help.hand.com",
  "1-dayremoteu.kayako.com",
  "ic-remoteu.trilogy.com",
  "2hr-learning-support.kayako.com",
  "support.2hourlearning.com",
  "accuris-support.kayako.com",
  "acorn-supportdesk.kayako.com",
  "acquisition-integration.kayako.com",
  "acrm.kayako.com",
  "support.acrm.aurea.com",
  "actional-supportdesk.kayako.com",
  "support.actional.aurea.com",
  "lyris-hq-support.kayako.com",
  "lyris-lm-support.kayako.com",
  "aes-cis-support.kayako.com",
  "aes-edi-support.kayako.com",
  "agemni-supportdesk.kayako.com",
  "alp-support.kayako.com",
  "alpha-staff-campus-operation.kayako.com",
  "staff-support.alpha.school",
  "alpha-supportdesk.kayako.com",
  "ams-alertfind-support.kayako.com",
  "ams-ems-support.kayako.com",
  "answerhub-supportdesk.kayako.com",
  "answerhub.support.ignitetech.com",
  "support-apm.kayako.com",
  "support.apm.aurea.com",
  "atlas-success.kayako.com",
  "support-aem.kayako.com",
  "support.aem.aurea.com",
  "support-aes.kayako.com",
  "support.aes.aurea.com",
  "aurea-enterprise.kayako.com",
  "support-360002472480.kayako.com",
  "alss.support.ignitetech.com",
  "support-alss-jump.kayako.com",
  "support-ams.kayako.com",
  "support.ams.aurea.com",
  "support-aps.kayako.com",
  "support.aps.aurea.com",
  "aurea-rescue-line.kayako.com",
  "support-skyvera.kayako.com",
  "aureasocial.support.ignitetech.com",
  "support-aurea.kayako.com",
  "support.aurea.com",
  "auto-trol.kayako.com",
  "avolin-supportdesk.kayako.com",
  "beckon-supportdesk.kayako.com",
  "smsmasterminds-supportdesk.kayako.com",
  "biznessapps.kayako.com",
  "support-bonzai.kayako.com",
  "support.bonzai.aurea.com",
  "callstream-supportdesk.kayako.com",
  "support.callstream.com",
  "cardinalmark.kayako.com",
  "central-collections.kayako.com",
  "central-compliance.kayako.com",
  "central-finance.kayako.com",
  "central-saas.kayako.com",
  "central-supportdesk.kayako.com",
  "central-vendor-management.kayako.com",
  "centralhr.kayako.com",
  "citynumbers-supportdesk.kayako.com",
  "support.citynumbers.co.uk",
  "ccab-supportdesk.kayako.com",
  "support.ccab.totogi.com",
  "cloudcfo-supportdesk.kayako.com",
  "cloudfix.kayako.com",
  "support.cloudfix.com",
  "cloudsense.kayako.com",
  "supportportal.cloudsense.com",
  "communicate-xi-support.kayako.com",
  "support.guidespark.com",
  "computron-support.kayako.com",
  "contently-support.kayako.com",
  "support.contently.com",
  "coretrac.kayako.com",
  "crossoverhiring.kayako.com",
  "candidate-support.crossover.com",
  "crossover-internal.kayako.com",
  "crossover-supportdesk.kayako.com",
  "support.crossover.com",
  "cs-escalation.kayako.com",
  "cs-foundations.kayako.com",
  "cs-knowledge.kayako.com",
  "cs-managers-coaching.kayako.com",
  "csai.kayako.com",
  "csai.trilogy.com",
  "devflows.kayako.com",
  "devgraph.kayako.com",
  "devspaces.kayako.com",
  "discoverxi-supportdesk.kayako.com",
  "support.tivian.com",
  "dnn-centralsupport.kayako.com",
  "dnnsupport.dnnsoftware.com",
  "ecora-supportdesk.kayako.com",
  "alpha-school-support.kayako.com",
  "support.alpha.school",
  "edu-supportdesk.kayako.com",
  "edu-finops.kayako.com",
  "eloquens-ignitetech.kayako.com",
  "engineyardsupport.kayako.com",
  "support.engineyard.com",
  "trilogy5k.kayako.com",
  "engineering-remote-university.kayako.com",
  "ephor-support.kayako.com",
  "support.ephor.ai",
  "epm-live-ignitetech.kayako.com",
  "escalations-team.kayako.com",
  "everest.kayako.com",
  "gfi-exinda-supportdesk.kayako.com",
  "support.exinda.gfi.com",
  "field-forcemanager-supportdesk.kayako.com",
  "support.fieldforcemanager.com",
  "fionn-renewals.kayako.com",
  "firm58-support.kayako.com",
  "support-firstrain.kayako.com",
  "support-firstrain-jump.kayako.com",
  "fogbugz-legacy-redirection.kayako.com",
  "fogbugz.kayako.com",
  "support.fogbugz.com",
  "gensym-ignitetech.kayako.com",
  "gfi-accountsportal-supportdesk.kayako.com",
  "support.accounts.gfi.com",
  "gfi-appmanager-supportdesk.kayako.com",
  "support.appmanager.gfi.com",
  "gfi-archiver-supportdesk.kayako.com",
  "support.archiver.gfi.com",
  "gfi-clearview-supportdesk.kayako.com",
  "gfi-endpointsecurity-supportdesk.kayako.com",
  "support.endpointsecurity.gfi.com",
  "gfi-eventsmanager-supportdesk.kayako.com",
  "support.eventsmanager.gfi.com",
  "gfi-faxmaker-supportdesk.kayako.com",
  "support.faxmaker.gfi.com",
  "gfi-faxmakeronline-supportdesk.kayako.com",
  "support.faxmakeronline.gfi.com",
  "gfi-languard-supportdesk.kayako.com",
  "support.languard.gfi.com",
  "gfi-mailessentials-supportdesk.kayako.com",
  "support.mailessentials.gfi.com",
  "gfi-supportdesk.kayako.com",
  "support.gfi.com",
  "gfi-webmonitor-supportdesk.kayako.com",
  "gomembers-4gov.kayako.com",
  "gomembers-enterprise.kayako.com",
  "gomembers-ondemand.kayako.com",
  "suuchi-grid-support.kayako.com",
  "support-grid.ignitetech.com",
  "ignite-supportdesk.kayako.com",
  "support.ignitetech.com",
  "infer-ignitetech.kayako.com",
  "influitive-supportdesk.kayako.com",
  "support.influitive.com",
  "infobright-ignitetech.kayako.com",
  "inmoment-support.kayako.com",
  "internal-test-centralsupport.kayako.com",
  "invigorate-support.kayako.com",
  "jigsawme-supportdesk.kayako.com",
  "support.jigsawinteractive.com",
  "aureajive.kayako.com",
  "support.jivesoftware.com",
  "jive-support-jump.kayako.com",
  "kandy-ucaas-support.kayako.com",
  "supportportal.kandy.io",
  "kayakoclassic.kayako.com",
  "classichelp.kayako.com",
  "kayako-supportdesk.kayako.com",
  "help.kayako.com",
  "support-360002231414.kayako.com",
  "gfi-kerioconnect-supportdesk.kayako.com",
  "support.kerioconnect.gfi.com",
  "gfi-keriocontrol-supportdesk.kayako.com",
  "support.keriocontrol.gfi.com",
  "gfi-keriooperator-supportdesk.kayako.com",
  "support.keriooperator.gfi.com",
  "khoros-support.kayako.com",
  "khoros-aurora.kayako.com",
  "khoros-care.kayako.com",
  "khoros-classic.kayako.com",
  "khoros-flow.kayako.com",
  "khoros-marketing.kayako.com",
  "knova.kayako.com",
  "learnandearn-supportdesk.kayako.com",
  "support.learnandearn.school",
  "cs-learning.kayako.com",
  "ma-internal.kayako.com",
  "mobileappco.kayako.com",
  "mobilogynow-support.kayako.com",
  "myalerts-supportdesk.kayako.com",
  "gfi-mykerio-supportdesk.kayako.com",
  "mypersonas-ignitetech.kayako.com",
  "newnet-support.kayako.com",
  "support-360002235594.kayako.com",
  "support.northplains.com",
  "telescope-supportdesk.kayako.com",
  "xinet.kayako.com",
  "xinet.support.northplains.com",
  "ns8protect.kayako.com",
  "nuview-ignitetech.kayako.com",
  "objectstore-ignitetech.kayako.com",
  "olive-ignitetech.kayako.com",
  "onescm-supportdesk.kayako.com",
  "support.onescm.com",
  "onyx-supportdesk.kayako.com",
  "support.onyx.aurea.com",
  "pivotal-supportdesk.kayako.com",
  "support.pivotal.aurea.com",
  "placeable-supportdesk.kayako.com",
  "support.placeable.com",
  "playbooks-supportdesk.kayako.com",
  "support.playbooks.aurea.com",
  "post-beyond.kayako.com",
  "cpq-brms.kayako.com",
  "prologic.kayako.com",
  "prysm-supportdesk.kayako.com",
  "support-quicksilver.kayako.com",
  "support.qs.aurea.com",
  "central-bootcamp.kayako.com",
  "responsetek-support.kayako.com",
  "routingbrand.kayako.com",
  "saas-backlog.kayako.com",
  "support-sb.kayako.com",
  "salesbuilder.kayako.com",
  "salesbuilder.support.ignitetech.com",
  "saratoga-supportdesk.kayako.com",
  "support.saratoga.aurea.com",
  "savvion-supportdesk.kayako.com",
  "support.savvion.aurea.com",
  "scalearc-devgraph.kayako.com",
  "scalearc.support.ignitetech.com",
  "schoolloop-supportdesk.kayako.com",
  "securityfirst-supportdesk.kayako.com",
  "servicegateway-support.kayako.com",
  "skyvera-analytics.kayako.com",
  "skyvera-monetization.kayako.com",
  "skyvera-network.kayako.com",
  "skyvera-helpdesk.kayako.com",
  "support.skyvera.com",
  "smartroutines.kayako.com",
  "smsmasterminds.kayako.com",
  "redirect-sms-masterminds.kayako.com",
  "sococo-supportdesk.kayako.com",
  "support.sococo.com",
  "sococo5k.kayako.com",
  "sonic-supportdesk.kayako.com",
  "support.sonic.aurea.com",
  "star.kayako.com",
  "stratifyd-supportdesk.kayako.com",
  "streetsmart-supportdesk.kayako.com",
  "support.streetsmartmobile.com",
  "supportsoft.kayako.com",
  "symphonycommerce-support.kayako.com",
  "support-synoptos-jump.kayako.com",
  "tempo-support.kayako.com",
  "tempo-assembly-lines.kayako.com",
  "totogi-supportdesk.kayako.com",
  "support.totogi.com",
  "tracking-supportdesk.kayako.com",
  "tradebeam.kayako.com",
  "vasona-support.kayako.com",
  "verdiem.kayako.com",
  "versata-centralsupport.kayako.com",
  "vision-supportdesk.kayako.com",
  "voltdelta-support.kayako.com",
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

// Listener for messages (if needed in future features)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "log") {
        console.log("Kayako Resizer Log:", message.data);
    }
    if (message.action === 'ping') {
        console.log('[SW] ping received');
        sendResponse({ ok: true, ts: Date.now() });
        return true;
    }
    if (message.action === 'fetchPageTitle' && message.url) {
        console.log('[SW] fetchPageTitle request for', message.url);
        fetchPageTitle(message.url).then(title => {
            console.log('[SW] fetchPageTitle result length', title ? title.length : 0);
            sendResponse({ success: !!title, title });
        }).catch(err => {
            console.warn('[SW] fetchPageTitle failed:', err?.message || err);
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
    // Initialize baseline after tracking a ticket
    if (message.action === 'baselineTicketActivity' && message.ticketId && message.domain) {
        baselineTicketActivity(message.domain, message.ticketId).then(() => sendResponse({ success: true })).catch(err => {
            console.error('Baseline error:', err?.message || err);
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
    if (message.action === 'forceCheckTickets') {
        checkAllTrackedTickets().then(() => sendResponse({ success: true })).catch(err => {
            console.error('Force check error:', err?.message || err);
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
    if (message.action === 'baselineAfterSend' && message.ticketId && message.domain) {
        baselineAfterSend(message.domain, message.ticketId).then(() => sendResponse({ success: true })).catch(err => {
            console.error('baselineAfterSend error:', err?.message || err);
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
  // Quick translation (auto-detect -> target language, default en)
  if (message.action === 'translateText' && message.text) {
    const toLang = message.toLang || 'en';
    const sample = String(message.text).slice(0, 80).replace(/\s+/g, ' ');
    console.log('[SW] translateText request →', sample, '…');
    translateText(message.text, toLang).then(({ translation, sourceLang }) => {
      sendResponse({ success: true, translation, sourceLang });
    }).catch(err => {
      console.warn('[SW] translateText failed:', err?.message || err);
      sendResponse({ success: false, error: err?.message || String(err) });
    });
    return true;
  }
});

// --- Page title fetcher ---
function decodeHTMLEntities(str){
  try {
    return str
      .replace(/&amp;/g,'&')
      .replace(/&lt;/g,'<')
      .replace(/&gt;/g,'>')
      .replace(/&quot;/g,'"')
      .replace(/&#39;/g,"'");
  } catch(_) { return str; }
}

async function fetchPageTitle(url){
  let res;
  try {
    console.log('[SW] fetching for title:', url);
    res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
  } catch (e) {
    // Try https variant if http blocked and host supports it
    try {
      const u = new URL(url);
      if (u.protocol === 'http:') {
        u.protocol = 'https:';
        console.log('[SW] retrying https variant:', u.href);
        res = await fetch(u.href, { redirect: 'follow', credentials: 'omit' });
      } else {
        throw e;
      }
    } catch (_) {
      return '';
    }
  }
  if (!res || !res.ok) { console.log('[SW] title fetch not ok'); return ''; }
  const text = await res.text();
  const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) { console.log('[SW] no <title> tag found'); return ''; }
  const raw = m[1].replace(/\s+/g,' ').trim();
  return decodeHTMLEntities(raw).slice(0, 200);
}

// --- Lightweight translation via Google public endpoint ---
async function translateTextSingle(text, toLang) {
  const endpoint = 'https://translate.googleapis.com/translate_a/single';
  // Using the free gtx client. This is unofficial and subject to change.
  const url = `${endpoint}?client=gtx&sl=auto&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status} translating`);
  const json = await res.json();
  // Response shape: [[ [translated, original, null, null, ...], ... ], null, sourceLang, ...]
  let translation = '';
  try { translation = (json?.[0] || []).map(p => p?.[0] || '').join(''); } catch (_) { translation = ''; }
  const sourceLang = (json?.[2] || 'auto');
  return { translation, sourceLang };
}

async function translateText(text, toLang) {
  if (text.indexOf('\n') === -1 && text.indexOf('\r') === -1) {
    return translateTextSingle(text, toLang);
  }
  const lines = String(text).split(/\r?\n/);
  let sourceLang = 'auto';
  const out = [];
  for (const line of lines) {
    if (!line.trim()) { out.push(''); continue; }
    try {
      const r = await translateTextSingle(line, toLang);
      if (r.sourceLang && r.sourceLang !== 'auto') sourceLang = r.sourceLang;
      out.push(r.translation || '');
    } catch (_) {
      out.push('');
    }
  }
  return { translation: out.join('\n'), sourceLang };
}

// ----- Ticket activity checking (minimal, surgical) -----

/** Return Promise wrapper for chrome.storage.local.get */
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

/** Return Promise wrapper for chrome.storage.local.set */
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

/** Normalize various Kayako posts payload shapes to an array */
function normalizePostsPayload(json) {
  try {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.data?.data)) return json.data.data;
    if (Array.isArray(json?.result)) return json.result;
  } catch (_) {}
  return [];
}

/** Fetch latest post id for a ticket from its brand */
async function fetchLatestPostId(domain, ticketId) {
  const url = `https://${domain}/api/v1/cases/${ticketId}/posts?limit=5`;
  const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${domain} ticket ${ticketId}`);
  }
  const json = await res.json();
  const posts = normalizePostsPayload(json);
  let latest = 0;
  for (const p of posts) {
    const pid = Number(p?.id) || 0;
    if (pid > latest) latest = pid;
  }
  return latest;
}

/** Baseline a single ticket's lastKnownPostId without flagging unread */
async function baselineTicketActivity(domain, ticketId) {
  try {
    const latest = await fetchLatestPostId(domain, ticketId);
    const data = await storageGet(['ticketHistory']);
    let history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
    let changed = false;
    history = history.map(t => {
      if (String(t.id) === String(ticketId) && t.domain === domain) {
        const updated = {
          ...t,
          lastKnownPostId: latest || t.lastKnownPostId || 0,
          hasUnseenActivity: false,
          unreadCount: 0,
          lastCheckedAt: Date.now()
        };
        changed = true;
        return updated;
      }
      return t;
    });
    if (changed) await storageSet({ ticketHistory: history });
  } catch (e) {
    console.warn('BaselineTicketActivity failed:', e?.message || e);
  }
}

/** Check all tracked tickets and flag unseen activity */
async function checkAllTrackedTickets() {
  const data = await storageGet(['ticketHistory']);
  const history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
  if (!history.length) return;
  let mutated = false;
  for (let i = 0; i < history.length; i++) {
    const t = history[i];
    if (!t || !t.id || !t.domain) continue;
    try {
      const latest = await fetchLatestPostId(t.domain, t.id);
      const baseline = Number(t.lastKnownPostId || 0);
      if (!baseline) {
        // First time baseline
        history[i] = { ...t, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now() };
        mutated = true;
        continue;
      }
      if (latest > baseline) {
        const unreadCount = Number(t.unreadCount || 0) + (latest - baseline);
        history[i] = { ...t, hasUnseenActivity: true, unreadCount, lastCheckedAt: Date.now() };
        mutated = true;
      } else if (t.hasUnseenActivity || t.unreadCount) {
        history[i] = { ...t, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now() };
        mutated = true;
      } else {
        history[i] = { ...t, lastCheckedAt: Date.now() };
        mutated = true;
      }
    } catch (e) {
      console.warn('Ticket check failed:', t?.id, e?.message || e);
    }
  }
  if (mutated) await storageSet({ ticketHistory: history });
}

// Schedule periodic checks
try {
  chrome.alarms.create('kayako_ticket_updates', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === 'kayako_ticket_updates') {
      checkAllTrackedTickets();
    }
  });
} catch (e) {
  console.warn('Alarms not available:', e?.message || e);
}

/** Wait helper */
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

/** After user sends, wait for the new post to appear and baseline to it */
async function baselineAfterSend(domain, ticketId) {
  try {
    const beforeId = await fetchLatestPostId(domain, ticketId);
    const start = Date.now();
    let latest = beforeId;
    // poll up to 20s
    while (Date.now() - start < 20000) {
      await delay(1000);
      try {
        const probe = await fetchLatestPostId(domain, ticketId);
        if (probe > latest) {
          latest = probe;
          break;
        }
      } catch (_) {}
    }
    // Update baseline to latest observed (includes our own post)
    const data = await storageGet(['ticketHistory']);
    let history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
    let changed = false;
    history = history.map(t => {
      if (String(t.id) === String(ticketId) && t.domain === domain) {
        const updated = { ...t, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now() };
        changed = true;
        return updated;
      }
      return t;
    });
    if (changed) await storageSet({ ticketHistory: history });
  } catch (e) {
    console.warn('baselineAfterSend failed:', e?.message || e);
  }
}