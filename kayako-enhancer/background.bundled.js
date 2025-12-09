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
      try { console.log('[SW] translateText OK src=', sourceLang || 'auto', ' out=', String(translation||'').slice(0, 60)); } catch(_) {}
      sendResponse({ success: true, translation, sourceLang });
    }).catch(err => {
      console.warn('[SW] translateText failed:', err?.message || err);
      sendResponse({ success: false, error: err?.message || String(err) });
    });
    return true;
  }
  // Open a URL in a background tab
  if (message.action === 'openInBackground' && message.url) {
    try {
      chrome.tabs.create({ url: message.url, active: false }, () => {
        sendResponse({ success: true });
      });
    } catch (e) {
      sendResponse({ success: false, error: e?.message || String(e) });
    }
    return true;
  }
  // Fetch a lightweight preview for a ticket (latest post snippet)
  if (message.action === 'fetchTicketPreview' && message.ticketId && message.domain) {
    fetchTicketPreview(message.domain, message.ticketId).then((preview) => {
      sendResponse({ success: true, preview });
    }).catch(err => {
      console.warn('[SW] fetchTicketPreview failed:', err?.message || err);
      sendResponse({ success: false, error: err?.message || String(err) });
    });
    return true;
  }
  // Generate an auto note for bookmarks using first public, last public, last internal posts
  if (message.action === 'generateBookmarkNote' && message.ticketId && message.domain) {
    generateBookmarkNote(message.domain, message.ticketId).then((note) => {
      sendResponse({ success: true, note });
    }).catch(err => {
      console.warn('[SW] generateBookmarkNote failed:', err?.message || err);
      sendResponse({ success: false, error: err?.message || String(err) });
    });
    return true;
  }
  // Ignored bots lists get/set (separate for public vs internal)
  if (message.action === 'getIgnoredBotsLists') {
    chrome.storage.local.get(['ignoredBotsPublic','ignoredBotsInternal'], (data) => {
      const pub = Array.isArray(data.ignoredBotsPublic) ? data.ignoredBotsPublic : ['hermes'];
      const intl = Array.isArray(data.ignoredBotsInternal) ? data.ignoredBotsInternal : ['centralsupport-ai-acc','lachesis'];
      sendResponse({ success: true, public: pub, internal: intl });
    });
    return true;
  }
  if (message.action === 'setIgnoredBotsLists') {
    const pub = Array.isArray(message.public) ? message.public : [];
    const intl = Array.isArray(message.internal) ? message.internal : [];
    chrome.storage.local.set({ ignoredBotsPublic: pub, ignoredBotsInternal: intl }, () => sendResponse({ success: true }));
    return true;
  }
  // Backwards-compat single list
  if (message.action === 'getIgnoredBots') {
    chrome.storage.local.get(['ignoredBotsPublic','ignoredBotsInternal'], (data) => {
      const merged = [
        ...(Array.isArray(data.ignoredBotsPublic) ? data.ignoredBotsPublic : ['hermes']),
        ...(Array.isArray(data.ignoredBotsInternal) ? data.ignoredBotsInternal : ['centralsupport-ai-acc','lachesis'])
      ];
      sendResponse({ success: true, bots: Array.from(new Set(merged)) });
    });
    return true;
  }
  if (message.action === 'setIgnoredBots') {
    const list = Array.isArray(message.bots) ? message.bots : [];
    // Store to both as a convenience
    chrome.storage.local.set({ ignoredBotsPublic: list, ignoredBotsInternal: list }, () => sendResponse({ success: true }));
    return true;
  }
  // Ignored bots get/set
  if (message.action === 'getIgnoredBots') {
    chrome.storage.local.get(['ignoredBots'], (data) => {
      const list = Array.isArray(data.ignoredBots) ? data.ignoredBots : ['centralsupport-ai-acc','lachesis','hermes'];
      sendResponse({ success: true, bots: list });
    });
    return true;
  }
  if (message.action === 'setIgnoredBots' && Array.isArray(message.bots)) {
    chrome.storage.local.set({ ignoredBots: message.bots }, () => sendResponse({ success: true }));
    return true;
  }
  // Recent tickets (rolling 15) touch
  if (message.action === 'touchTicket' && message.ticket) {
    (async () => {
      try {
        const t = message.ticket;
        const data = await storageGet(['recentTickets']);
        let recents = Array.isArray(data.recentTickets) ? data.recentTickets : [];
        const key = (x) => `${x.domain||''}:${x.id}`;
        recents = recents.filter(x => key(x) !== key(t));
        recents.unshift({ ...t, touchedAt: Date.now() });
        if (recents.length > 15) recents = recents.slice(0, 15);
        await storageSet({ recentTickets: recents });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }
  if (message.action === 'getRecentTickets') {
    chrome.storage.local.get(['recentTickets'], (data) => {
      const recents = Array.isArray(data.recentTickets) ? data.recentTickets : [];
      sendResponse({ success: true, recentTickets: recents });
    });
    return true;
  }
  // Bookmarks CRUD
  if (message.action === 'getBookmarks') {
    chrome.storage.local.get(['ticketBookmarks'], (data) => {
      const list = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
      sendResponse({ success: true, bookmarks: list });
    });
    return true;
  }
  if (message.action === 'addBookmark' && message.bookmark) {
    (async () => {
      const data = await storageGet(['ticketBookmarks']);
      let list = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
      const key = (x) => `${x.domain||''}:${x.id}`;
      list = list.filter(x => key(x) !== key(message.bookmark));
      list.unshift({ ...message.bookmark, createdAt: Date.now() });
      await storageSet({ ticketBookmarks: list });
      sendResponse({ success: true });
    })();
    return true;
  }
  if (message.action === 'updateBookmark' && message.bookmark) {
    (async () => {
      const data = await storageGet(['ticketBookmarks']);
      let list = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
      const key = (x) => `${x.domain||''}:${x.id}`;
      list = list.map(b => key(b) === key(message.bookmark) ? { ...b, ...message.bookmark } : b);
      await storageSet({ ticketBookmarks: list });
      sendResponse({ success: true });
    })();
    return true;
  }
  if (message.action === 'deleteBookmark' && message.ticket) {
    (async () => {
      const data = await storageGet(['ticketBookmarks']);
      let list = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
      const key = (x) => `${x.domain||''}:${x.id}`;
      list = list.filter(b => key(b) !== key(message.ticket));
      await storageSet({ ticketBookmarks: list });
      sendResponse({ success: true });
    })();
    return true;
  }
  // Mark a ticket as seen (clear unread flags immediately in both history and bookmarks)
  if (message.action === 'markTicketSeen' && message.ticketId) {
    (async () => {
      const ticketId = String(message.ticketId);
      const now = Date.now();
      console.log('[SW] markTicketSeen received for ticketId:', ticketId);
      // Update ticketHistory
      const dataH = await storageGet(['ticketHistory']);
      let history = Array.isArray(dataH.ticketHistory) ? dataH.ticketHistory : [];
      let hChanged = false;
      const beforeH = history.find(t => t && String(t.id) === ticketId);
      console.log('[SW] markTicketSeen history BEFORE:', beforeH ? { id: beforeH.id, hasUnseenActivity: beforeH.hasUnseenActivity, unreadCount: beforeH.unreadCount, lastSeenAt: beforeH.lastSeenAt } : 'NOT FOUND');
      history = history.map(t => {
        if (!t || String(t.id) !== ticketId) return t;
        hChanged = true;
        return { ...t, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: now, lastSeenAt: now };
      });
      if (hChanged) {
        await storageSet({ ticketHistory: history });
        const afterH = history.find(t => t && String(t.id) === ticketId);
        console.log('[SW] markTicketSeen history AFTER write:', afterH ? { id: afterH.id, hasUnseenActivity: afterH.hasUnseenActivity, unreadCount: afterH.unreadCount, lastSeenAt: afterH.lastSeenAt } : 'NOT FOUND');
      } else {
        console.log('[SW] markTicketSeen: ticket NOT in history');
      }
      // Update ticketBookmarks
      const dataB = await storageGet(['ticketBookmarks']);
      let bookmarks = Array.isArray(dataB.ticketBookmarks) ? dataB.ticketBookmarks : [];
      let bChanged = false;
      const beforeB = bookmarks.find(b => b && String(b.id) === ticketId);
      console.log('[SW] markTicketSeen bookmarks BEFORE:', beforeB ? { id: beforeB.id, hasUnseenActivity: beforeB.hasUnseenActivity, unreadCount: beforeB.unreadCount, lastSeenAt: beforeB.lastSeenAt } : 'NOT FOUND');
      bookmarks = bookmarks.map(b => {
        if (!b || String(b.id) !== ticketId) return b;
        bChanged = true;
        return { ...b, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: now, lastSeenAt: now };
      });
      if (bChanged) {
        await storageSet({ ticketBookmarks: bookmarks });
        const afterB = bookmarks.find(b => b && String(b.id) === ticketId);
        console.log('[SW] markTicketSeen bookmarks AFTER write:', afterB ? { id: afterB.id, hasUnseenActivity: afterB.hasUnseenActivity, unreadCount: afterB.unreadCount, lastSeenAt: afterB.lastSeenAt } : 'NOT FOUND');
      } else {
        console.log('[SW] markTicketSeen: ticket NOT in bookmarks');
      }
      console.log('[SW] markTicketSeen COMPLETE for', ticketId);
      sendResponse({ success: true });
    })();
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
// Adds resilience: tries googleapis first, then google.com, with a timeout.
async function translateTextSingle(text, toLang) {
  const buildParams = () => `client=gtx&sl=auto&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const endpoints = [
    `https://translate.googleapis.com/translate_a/single?${buildParams()}`,
    `https://translate.google.com/translate_a/single?${buildParams()}`
  ];
  const fetchJsonWithTimeout = async (url, timeoutMs = 8000) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => { try { ctrl.abort(); } catch(_) {} }, timeoutMs);
    try {
      const res = await fetch(url, { redirect: 'follow', credentials: 'omit', signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(to);
    }
  };
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const json = await fetchJsonWithTimeout(url, 9000);
      // Response shape: [[ [translated, original, ...], ... ], null, sourceLang, ...]
      let translation = '';
      try { translation = (json?.[0] || []).map(p => p?.[0] || '').join(''); } catch (_) { translation = ''; }
      const sourceLang = (typeof json?.[2] === 'string' && json[2]) || (json && json.src) || 'auto';
      if (translation && typeof translation === 'string') return { translation, sourceLang };
      // If we got an empty translation, try next endpoint
      lastErr = new Error('Empty translation payload');
    } catch (e) {
      lastErr = e;
      try { console.warn('[SW] translate endpoint failed:', url, e?.message || e); } catch(_) {}
    }
  }
  throw lastErr || new Error('Translation failed');
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

/** Concurrency helper */
async function runWithConcurrency(items, limit, task) {
  let index = 0;
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (index < items.length) {
      const i = index++;
      try { await task(items[i], i); } catch (_) {}
    }
  });
  await Promise.all(workers);
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

/** Fetch latest post meta: id and createdAt (ms) */
async function fetchLatestPostMeta(domain, ticketId) {
  const url = `https://${domain}/api/v1/cases/${ticketId}/posts?limit=5`;
  const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${domain} ticket ${ticketId}`);
  const json = await res.json();
  const posts = normalizePostsPayload(json);
  let latest = { id: 0, createdAt: 0 };
  for (const p of posts) {
    const pid = Number(p?.id) || 0;
    const ts = Date.parse(extractPostCreatedAt(p) || '') || 0;
    if (pid > latest.id) latest = { id: pid, createdAt: ts };
  }
  return latest;
}

/** Fetch case meta (status, product, updatedAt) */
async function fetchCaseMeta(domain, ticketId) {
  try {
    const url = `https://${domain}/api/v1/cases/${ticketId}`;
    const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = json?.data || json?.result || json || {};
    const lc = (s)=> (s||'').toString().toLowerCase();
    // Robust status extraction across payload variants
    const pick = (v) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object') return v.name || v.label || v.title || v.value || v.state || '';
      return '';
    };
    // Deep search helpers as a last resort
    const deepPickKeys = (obj, keys) => {
      try {
        const want = new Set(keys.map(k => k.toLowerCase()));
        const stack = [obj];
        const seen = new Set();
        while (stack.length) {
          const cur = stack.pop();
          if (!cur || typeof cur !== 'object') continue;
          if (seen.has(cur)) continue;
          seen.add(cur);
          for (const k of Object.keys(cur)) {
            const v = cur[k];
            if (want.has(String(k).toLowerCase())) {
              const out = pick(v);
              if (out) return out;
            }
            if (v && typeof v === 'object') stack.push(v);
          }
        }
      } catch (_) {}
      return '';
    };
    const deepFindFieldByName = (obj, fieldName) => {
      try {
        const target = String(fieldName).toLowerCase();
        const stack = [obj];
        const seen = new Set();
        while (stack.length) {
          const cur = stack.pop();
          if (!cur || typeof cur !== 'object') continue;
          if (seen.has(cur)) continue;
          seen.add(cur);
          // Common "field" objects: {name:'Product', value:'X'} or {label:'Product', value:'X'}
          const nm = (cur.name || cur.label || cur.title || cur.key || '').toString().toLowerCase();
          if (nm === target) {
            const out = pick(cur.value) || pick(cur.current) || pick(cur.selected) || pick(cur.text) || pick(cur.display) || pick(cur.label);
            if (out) return out;
          }
          for (const k of Object.keys(cur)) {
            const v = cur[k];
            if (v && typeof v === 'object') stack.push(v);
          }
        }
      } catch (_) {}
      return '';
    };
    let status = 
      // direct strings/objects
      pick(data?.status) ||
      pick(data?.state) ||
      pick(data?.status_name) ||
      pick(data?.state_name) ||
      pick(data?.status_label) ||
      pick(data?.state_label) ||
      pick(data?.case_status) ||
      pick(data?.caseStatus) ||
      pick(data?.current_status) ||
      pick(data?.currentStatus) ||
      // nested common shapes
      pick(data?.case?.status) ||
      pick(data?.case?.state) ||
      pick(data?.ticket?.status) ||
    pick(data?.ticket?.state) ||
    // JSON:API style attributes
    pick(data?.attributes?.status) ||
    pick(data?.attributes?.state) ||
    pick(data?.case?.attributes?.status) ||
    pick(data?.case?.attributes?.state) ||
    pick(data?.ticket?.attributes?.status) ||
    pick(data?.ticket?.attributes?.state) ||
    // generic property bags
    pick(data?.properties?.status) ||
    pick(data?.properties?.state) ||
    pick(data?.fields?.status) ||
      pick(data?.fields?.state) ||
      // deep scan anywhere as last resort
      deepPickKeys(data, ['status','state','status_name','state_name','current_status','currentStatus']);
    // If we found a purely numeric status string, map it to a friendly label
    if (status && typeof status === 'string' && /^\d+$/.test(status.trim())) {
      const num = Number(status.trim());
      const statusMap = {
        1: 'New',
        2: 'Open',
        3: 'Pending',
        4: 'Hold',
        5: 'Completed',
        6: 'Closed'
      };
      status = statusMap[num] || status;
    }
    // If still blank, try numeric status id mapping from common id fields
    if (!status) {
      const statusId = Number(
        (data?.status && (data?.status.id || data?.status.value || data?.status.code)) ||
        (data?.case?.status && (data?.case?.status.id || data?.case?.status.value || data?.case?.status.code)) ||
        (data?.ticket?.status && (data?.ticket?.status.id || data?.ticket?.status.value || data?.ticket?.status.code)) ||
        data?.status_id || data?.case_status_id || data?.current_status_id ||
        data?.attributes?.status_id || data?.attributes?.state_id ||
        data?.case?.attributes?.status_id || data?.ticket?.attributes?.status_id || 0
      ) || 0;
      if (statusId) {
        const statusMap = {
          1: 'New',
          2: 'Open',
          3: 'Pending',
          4: 'Hold',
          5: 'Completed',
          6: 'Closed'
        };
        status = statusMap[statusId] || String(statusId);
      }
    }
    if (!status) {
      // Fallback from booleans commonly present
      if (data?.is_closed || data?.closed) status = 'Closed';
      else if (data?.completed) status = 'Completed';
      else if (data?.resolved || data?.is_resolved) status = 'Resolved';
    }
    // Normalize capitalization (OPEN -> Open, hold -> Hold)
    if (status && typeof status === 'string') {
      const s = status.trim();
      const up = s.toUpperCase();
      // Map common noise "ACTIVE" to empty so UI doesn't show misleading value
      if (up === 'ACTIVE') {
        // Prefer empty; downstream will fall back to better value on next refresh
        status = '';
      } else {
        status = s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
    let updatedAt = Date.parse(data?.updated_at || data?.updatedAt || data?.modified_at || data?.last_activity_at || data?.lastUpdated || '') || 0;
    let product = '';
    try {
      const cf = data?.custom_fields || data?.customFields || {};
      product = cf?.Product?.value || cf?.product?.value || cf?.product || '';
      if (!product && Array.isArray(cf)) {
        const p = cf.find(x => lc(x?.name||'') === 'product');
        product = p?.value || '';
      }
    } catch(_) {}
    if (!product) {
      // Look in generic fields collections or deep objects
      product = pick(data?.fields?.product) || pick(data?.fields?.Product) || deepFindFieldByName(data, 'product');
    }
    const out = { status: String(status||'').trim(), product: String(product||'').trim(), updatedAt };
    try { console.log('[SW] fetchCaseMeta', domain, `#${ticketId}`, '→', out); } catch(_) {}
    return out;
  } catch (_) {
    return { status: '', product: '', updatedAt: 0 };
  }
}

/** Fetch posts for a ticket and combine with remaining older posts (single extra call).
 *  - First request uses limit=30 (Kayako default) to get newest page
 *  - Inspect pagination (limit, total_count, next_url)
 *  - If there are remaining posts, call next_url once with limit=remaining to fetch all older posts
 *  - Combine and return mapped posts; content script will render earliest→latest
 */
async function fetchTicketPreview(domain, ticketId) {
  const firstUrl = `https://${domain}/api/v1/cases/${ticketId}/posts?limit=30`;
  const headers = { 'Accept': 'application/json' };
  const res = await fetch(firstUrl, { credentials: 'include', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching preview for ${ticketId}`);
  const json = await res.json();
  const pagePosts = normalizePostsPayload(json);
  try {
    const dbgCount = Array.isArray(pagePosts) ? pagePosts.length : 0;
    console.log('[SW] preview page1 posts:', dbgCount);
  } catch(_) {}

  // Extract pagination in a resilient way
  const get = (o, pathArr) => {
    try { return pathArr.reduce((v,k)=> (v && (k in v)) ? v[k] : undefined, o); } catch(_) { return undefined; }
  };
  const asNum = (x) => { const n = Number(x); return isNaN(n) ? 0 : n; };
  const limit = asNum(json?.limit || get(json, ['meta','limit']) || get(json, ['pagination','limit']) || get(json, ['page','limit']) || get(json, ['data','limit']));
  const total = asNum(json?.total || json?.total_count || get(json, ['meta','total_count']) || get(json, ['pagination','total_count']) || get(json, ['page','total']));
  let nextUrl = json?.next_url || get(json, ['meta','next_url']) || get(json, ['pagination','next_url']) || get(json, ['links','next']) || get(json, ['links','next','href']);

  // If nextUrl is relative, make absolute to the current domain
  if (nextUrl && typeof nextUrl === 'string' && !/^https?:\/\//i.test(nextUrl)) {
    if (nextUrl.startsWith('/')) nextUrl = `https://${domain}${nextUrl}`; else nextUrl = `https://${domain}/${nextUrl}`;
  }

  let combined = Array.isArray(pagePosts) ? pagePosts.slice() : [];

  // If there are remaining posts and a next URL, fetch all remaining in one go
  if (nextUrl && total && limit && total > limit) {
    const remaining = Math.max(0, total - limit);
    try {
      const u = new URL(nextUrl);
      // Replace limit with the remaining count
      u.searchParams.set('limit', String(remaining));
      console.log('[SW] preview next_url:', u.href, 'remaining=', remaining);
      const res2 = await fetch(u.href, { credentials: 'include', headers });
      if (res2.ok) {
        const json2 = await res2.json();
        const rest = normalizePostsPayload(json2);
        if (Array.isArray(rest) && rest.length) combined = combined.concat(rest);
        try { console.log('[SW] preview page2 posts:', Array.isArray(rest)? rest.length : 0); } catch(_) {}
      } else {
        console.warn(`[SW] next_url fetch failed ${res2.status} for ticket ${ticketId}`);
      }
    } catch (e) {
      console.warn('[SW] next_url handling failed:', e?.message || e);
    }
  }

  // Pick latest post for snippet
  let latest = null;
  let latestId = 0;
  for (const p of combined) {
    const pid = Number(p?.id) || 0;
    if (pid > latestId) { latestId = pid; latest = p; }
  }
  const selected = latest || combined?.[0] || {};
  const snippet = extractPostText(selected) || '';
  const html = extractPostHtml(selected) || '';

  // Map and sort earliest→latest
  const mapped = (combined || []).map(p => ({
    id: String(p?.id || ''),
    createdAt: extractPostCreatedAt(p),
    html: extractPostHtml(p) || '',
    text: extractPostText(p) || ''
  }));
  try {
    mapped.sort((a,b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      if (ta !== tb) return ta - tb; // earliest first
      const ia = Number(a.id) || 0, ib = Number(b.id) || 0;
      return ia - ib;
    });
  } catch (_) {}
  try { console.log('[SW] preview total mapped posts:', mapped.length); } catch(_) {}
  return {
    ticketId: String(ticketId),
    lastPostId: latestId || 0,
    snippet: snippet.slice(0, 1000),
    html: html,
    posts: mapped,
    fetchedAt: Date.now(),
  };
}

/** Generate a concise bookmark note using GPT with context from
 *  - first public post
 *  - last public post
 *  - last internal post
 */
async function generateBookmarkNote(domain, ticketId) {
  const url = `https://${domain}/api/v1/cases/${ticketId}/posts?limit=50`;
  const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching posts for ${ticketId}`);
  const json = await res.json();
  const posts = normalizePostsPayload(json);

  // Helpers mirroring the unread classifier
  const lc = (s)=> (s||'').toString().toLowerCase();
  const isInternal = (p)=> {
    const t = lc(p?.type || p?.post_type || p?.category || '');
    const vis = lc(p?.visibility || '');
    const ch = lc(p?.channel || '');
    return p?.is_internal === true || p?.isInternal === true || vis === 'internal' || ch === 'internal' || t.includes('note') || t.includes('internal') || p?.private === true;
  };
  const isPublic = (p)=> !isInternal(p);
  const createdAt = (p)=> {
    const t = Date.parse(extractPostCreatedAt(p) || '') || 0;
    const id = Number(p?.id || 0) || 0;
    return { t, id };
  };

  // Sort by time
  const sorted = posts.slice().sort((a,b) => {
    const A = createdAt(a), B = createdAt(b);
    if (A.t !== B.t) return A.t - B.t; // earliest first
    return A.id - B.id;
  });
  const firstPublic = sorted.find(isPublic);
  const lastPublic = [...sorted].reverse().find(isPublic);
  const lastInternal = [...sorted].reverse().find(isInternal);

  const fp = firstPublic ? htmlToText(extractPostText(firstPublic) || extractPostHtml(firstPublic) || '') : '';
  const lp = lastPublic ? htmlToText(extractPostText(lastPublic) || extractPostHtml(lastPublic) || '') : '';
  const li = lastInternal ? htmlToText(extractPostText(lastInternal) || extractPostHtml(lastInternal) || '') : '';

  // If there is no API key configured, fall back to a simple heuristic string
  const keyData = await storageGet(['openrouterApiKey','openaiApiKey','gptApiKey','llmModel','llmEndpoint']);
  let provider = 'none';
  let apiKey = '';
  if (keyData.openrouterApiKey && String(keyData.openrouterApiKey).trim()) { provider = 'openrouter'; apiKey = String(keyData.openrouterApiKey).trim(); }
  else if (keyData.openaiApiKey && String(keyData.openaiApiKey).trim()) { provider = 'openai'; apiKey = String(keyData.openaiApiKey).trim(); }
  else if (keyData.gptApiKey && String(keyData.gptApiKey).trim()) {
    const k = String(keyData.gptApiKey).trim();
    provider = k.startsWith('openrouter_') ? 'openrouter' : (k.startsWith('sk-') ? 'openai' : 'openrouter');
    apiKey = k;
  }
  let model = keyData.llmModel || (provider === 'openai' ? 'gpt-5-mini' : 'gpt-5-nano=');
  let endpoint = keyData.llmEndpoint || (provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions');
  if (provider === 'openai' && model === 'gpt-5-mini') model = 'gpt-5-nano';
  if (provider === 'openrouter') {
    // Ensure model id format is OpenRouter-compatible
    if (!String(model).includes('/')) {
      if (String(model).includes('gpt-5-mini')) model = 'openrouter/gpt-5-mini';
      else if (String(model).includes('gpt-5-nano')) model = 'openai/gpt-5-nano';
    }
  }

  const prompt = [
    'Write a concise MEMORY-JOG note for a support ticket. Not a plan.',
    'Goal: help me recall what this ticket is about at a glance.',
    'Style: 2-3 short lines separated by newlines; avoid imperative or recommendations; no scheduling or task lists; neutral tone.',
    'Content to include (brief): what the issue is, impacted area/customer/product if obvious, latest state/outcome. Skip step-by-step actions.',
    'Hard limits: <= 220 chars per line, <= 3 lines total. No quotes.',
    `Context for Ticket #${ticketId} (${domain}):`,
    fp ? `First public post (context):\n${truncate(fp, 1000)}` : 'First public post: (none)',
    lp && lp !== fp ? `Last public post (latest):\n${truncate(lp, 1000)}` : 'Last public post: (same as first or none)',
    li ? `Last internal note (internal state):\n${truncate(li, 1000)}` : 'Last internal note: (none)',
    'Return only the 1-3 lines of the memory-jog note.'
  ].join('\n\n');

  if (!apiKey) {
    return composeFallbackNote(fp, lp, li);
  }

  try {
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You produce short memory-jog summaries for support tickets. Never give instructions; no imperative verbs; 1-3 short lines only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.35,
      max_tokens: 180
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    if (provider === 'openrouter') {
      // Helpful metadata for OpenRouter routing and attribution
      headers['HTTP-Referer'] = 'https://kayako-qol-enhancer.local';
      headers['X-Title'] = 'Kayako QoL Enhancer';
    }
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
    const json = await resp.json();
    const note = json?.choices?.[0]?.message?.content?.trim?.();
    const plain = htmlToText((note || '').replace(/\s+/g,' ').trim());
    return plain || composeFallbackNote(fp, lp, li);
  } catch (e) {
    console.warn('LLM call failed, attempting alternate model:', e?.message || e);
    // One alternate attempt: OpenRouter auto if available
    try {
      if (provider === 'openrouter') {
        const altBody = {
          model: 'openrouter/auto',
          messages: [
            { role: 'system', content: 'You produce short memory-jog summaries for support tickets. Never give instructions; no imperative verbs; 1-3 short lines only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.35,
          max_tokens: 180
        };
        const altHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://kayako-qol-enhancer.local',
          'X-Title': 'Kayako QoL Enhancer'
        };
        const r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: altHeaders, body: JSON.stringify(altBody) });
        if (r2.ok) {
          const j2 = await r2.json();
          const n2 = j2?.choices?.[0]?.message?.content?.trim?.();
          const p2 = htmlToText((n2 || '').replace(/\s+/g,' ').trim());
          if (p2) return p2;
        }
      }
    } catch (_) {}
    console.warn('LLM alternate failed; using fallback.');
    return composeFallbackNote(fp, lp, li);
  }
}

function truncate(s, n){
  try { s = String(s); } catch(_) { return ''; }
  return s.length > n ? (s.slice(0, n) + '…') : s;
}

function composeFallbackNote(firstPublic, lastPublic, lastInternal){
  const norm = (s)=> htmlToText(String(s||'')).replace(/\s+/g,' ').trim();
  const parts = [];
  if (firstPublic) parts.push('Initial: ' + truncate(norm(firstPublic), 140));
  if (lastPublic && lastPublic !== firstPublic) parts.push('Latest public: ' + truncate(norm(lastPublic), 140));
  if (lastInternal) parts.push('Internal: ' + truncate(norm(lastInternal), 140));
  const txt = parts.join(' — ');
  return txt.slice(0, 240);
}

/** Try to extract readable text from diverse post payloads */
function extractPostText(post) {
  if (!post) return '';
  const candidates = [post.text, post.body, post.content, post.message, post.description, post.plain_text, post.plainText, post.contents];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  // Try HTML field
  const html = post.html || post.body_html || post.richText || post.contents || '';
  if (typeof html === 'string' && html.trim()) return htmlToText(html);
  try { return JSON.stringify(post); } catch (_) { return ''; }
}

function extractPostHtml(post) {
  if (!post) return '';
  const candidates = [post.html, post.body_html, post.richText, post.rich_text, post.content_html, post.description_html, post.contents];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  // Fallback: wrap plain text as HTML
  const txt = extractPostText(post);
  if (!txt) return '';
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div>${esc(txt).replace(/\n/g,'<br>')}</div>`;
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

function htmlToText(html) {
  try {
    return String(html)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/p\s*>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (_) { return String(html || ''); }
}

/** Baseline a single ticket's lastKnownPostId without flagging unread */
async function baselineTicketActivity(domain, ticketId) {
  try {
    const latest = await fetchLatestPostId(domain, ticketId);
    const data = await storageGet(['ticketHistory']);
    let history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
    let changed = false;
    history = history.map(t => {
      if (String(t.id) === String(ticketId) && (t.domain === domain || !t.domain)) {
        const updated = {
          ...t,
          domain: t.domain || domain,
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

    // Also baseline bookmarks if present
    const dataB = await storageGet(['ticketBookmarks']);
    let bookmarks = Array.isArray(dataB.ticketBookmarks) ? dataB.ticketBookmarks : [];
    let bChanged = false;
    bookmarks = bookmarks.map(b => {
      if (String(b.id) === String(ticketId) && (b.domain === domain || !b.domain)) {
        const updated = {
          ...b,
          domain: b.domain || domain,
          lastKnownPostId: latest || b.lastKnownPostId || 0,
          hasUnseenActivity: false,
          unreadCount: 0,
          lastCheckedAt: Date.now()
        };
        bChanged = true;
        return updated;
      }
      return b;
    });
    if (bChanged) await storageSet({ ticketBookmarks: bookmarks });
  } catch (e) {
    console.warn('BaselineTicketActivity failed:', e?.message || e);
  }
}

/** Check all tracked tickets and flag unseen activity */
let _checkInFlight = false;
async function checkAllTrackedTickets() {
  if (_checkInFlight) return; // collapse overlapping runs
  _checkInFlight = true;
  const data = await storageGet(['ticketHistory']);
  const history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
  if (!history.length) return;
  let mutated = false;
  // Per-run caches to avoid duplicate network calls
  const caseMetaCache = new Map();
  const latestMetaCache = new Map();
  const keyOf = (d,id)=> `${d}:${id}`;
  const getCaseMeta = async (d,id)=> {
    const k = keyOf(d,id);
    if (caseMetaCache.has(k)) return caseMetaCache.get(k);
    const m = await fetchCaseMeta(d,id);
    caseMetaCache.set(k,m);
    return m;
  };
  const getLatestMeta = async (d,id)=> {
    const k = keyOf(d,id);
    if (latestMetaCache.has(k)) return latestMetaCache.get(k);
    const m = await fetchLatestPostMeta(d,id);
    latestMetaCache.set(k,m);
    return m;
  };
  await runWithConcurrency(history, 6, async (_t, i) => {
    const t = _t;
    if (!t || !t.id || !t.domain) return;
    try {
      const latestMeta = await getLatestMeta(t.domain, t.id);
      const latest = latestMeta.id;
      const baseline = Number(t.lastKnownPostId || 0);
      if (!baseline) {
        // First time baseline
        const meta = await getCaseMeta(t.domain, t.id);
        history[i] = { ...t, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now(), lastActivityAt: latestMeta.createdAt || meta.updatedAt || Date.now(), status: (typeof meta.status === 'string' ? meta.status : (t.status || '')), product: meta.product || t.product || '' };
        mutated = true;
        return;
      }
      if (latest > baseline) {
        // Fetch recent posts and apply classification using editable bot list
        const postsUrl = `https://${t.domain}/api/v1/cases/${t.id}/posts?limit=25`;
        let posts = [];
        try {
          const res = await fetch(postsUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          posts = normalizePostsPayload(json);
        } catch (_) {}
        const dataBots = await storageGet(['ignoredBotsPublic','ignoredBotsInternal']);
        const ignoredPublic = Array.isArray(dataBots.ignoredBotsPublic) ? dataBots.ignoredBotsPublic.map(b => String(b).toLowerCase()) : ['hermes'];
        const ignoredInternal = Array.isArray(dataBots.ignoredBotsInternal) ? dataBots.ignoredBotsInternal.map(b => String(b).toLowerCase()) : ['centralsupport-ai-acc','lachesis'];
        const lc = (s)=> (s||'').toString().toLowerCase();
        const nameOf = (p)=> lc(p?.creator?.name || p?.author?.name || p?.actor?.name || p?.created_by?.name || p?.user?.name || p?.sender?.name || p?.from?.name || p?.from_name || '');
        const emailOf = (p)=> lc(p?.creator?.email || p?.author?.email || p?.actor?.email || p?.created_by?.email || p?.user?.email || p?.sender?.email || p?.from?.email || p?.email || '');
        const typeOf = (p)=> lc(p?.creator?.type || p?.actor?.type || p?.created_by?.type || p?.user?.type || p?.creator_type || p?.actor_type || p?.role || '');
        const isInternal = (p)=> {
          const t = lc(p?.type || p?.post_type || p?.category || p?.postType || '');
          const vis = lc(p?.visibility || p?.scope || p?.access || '');
          const ch = lc(p?.channel || p?.via || '');
          return (
            p?.is_internal === true ||
            p?.isInternal === true ||
            p?.internal === true ||
            p?.is_private === true ||
            p?.private === true ||
            vis === 'internal' || vis === 'private' || vis === 'staff' ||
            ch === 'internal' || ch === 'private' || ch === 'notes' ||
            t.includes('note') || t.includes('internal') || t.includes('private')
          );
        };
        const isPublic = (p)=> {
          if (isInternal(p)) return false;
          if (p?.is_public === true || p?.isPublic === true) return true;
          const vis = lc(p?.visibility || '');
          return vis ? vis === 'public' : true;
        };
        const isBotPublic = (p)=> {
          const nm = nameOf(p), em = emailOf(p);
          return ignoredPublic.some(b => nm.includes(b) || em.includes(b));
        };
        const isBotInternal = (p)=> {
          const nm = nameOf(p), em = emailOf(p);
          return ignoredInternal.some(b => nm.includes(b) || em.includes(b));
        };
        const isCustomer = (p)=> {
          const t = typeOf(p);
          if (t && ['customer','user','requester','end_user','end-user','client','contact'].some(k => t.includes(k))) return true;
          const flags = [p?.is_customer, p?.isCustomer, p?.from_customer, p?.fromCustomer, p?.is_user, p?.isUser, p?.is_requester, p?.isRequester, p?.requester === true, p?.contact_type === 'customer'];
          return flags.some(Boolean);
        };
        const pid = (p)=> Number(p?.id || p?.post_id || p?.uid || p?.postId || p?.message_id || 0) || 0;
        const relevant = posts
          .filter(p => pid(p) > baseline)
          .filter(p => {
            // Only count posts that happened after the last time *you* viewed this ticket (if known)
            try {
              const ts = Date.parse(extractPostCreatedAt(p) || '') || 0;
              if (t.lastSeenAt && ts && ts <= t.lastSeenAt) return false;
            } catch (_) {}
            if (isInternal(p)) {
              // internal note: ignore if from internal-bot list
              if (isBotInternal(p)) return false;
              return true; // human/internal
            }
            if (isPublic(p)) {
              // public reply: ignore if from public-bot list
              if (isBotPublic(p)) return false;
              return true; // any human public reply (customer or agent)
            }
            return false;
          });
        const unreadCount = relevant.length;
        // Enrich meta for display
        const meta = await getCaseMeta(t.domain, t.id);
        // Latest relevant ts (ignoring bots) for display
        let latestRelevantTs = 0;
        try {
          for (const p of relevant) {
            const ts = Date.parse(extractPostCreatedAt(p) || '') || 0;
            if (ts > latestRelevantTs) latestRelevantTs = ts;
          }
          if (!latestRelevantTs) {
            // Fallback: any non-bot (agent or customer) among fetched posts
            for (const p of posts) {
              const nonBot = isInternal(p) ? !isBotInternal(p) : !isBotPublic(p);
              if (nonBot) {
                const ts = Date.parse(extractPostCreatedAt(p) || '') || 0;
                if (ts > latestRelevantTs) latestRelevantTs = ts;
              }
            }
          }
        } catch(_) {}
        const displayTs = latestRelevantTs || meta.updatedAt || latestMeta.createdAt || Date.now();
        if (unreadCount > 0) {
          history[i] = { ...t, hasUnseenActivity: true, unreadCount, lastCheckedAt: Date.now(), lastActivityAt: displayTs, status: (typeof meta.status === 'string' ? meta.status : (t.status || '')), product: meta.product || t.product || '' };
          mutated = true;
        } else {
          // No relevant new activity; baseline to avoid re-fetching same range
          history[i] = { ...t, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now(), lastActivityAt: displayTs, status: (typeof meta.status === 'string' ? meta.status : (t.status || '')), product: meta.product || t.product || '' };
          mutated = true;
        }
      } else if (t.hasUnseenActivity || t.unreadCount) {
        const meta = await getCaseMeta(t.domain, t.id);
        const la = latestMeta.createdAt || meta.updatedAt || t.lastActivityAt || Date.now();
        history[i] = { ...t, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: Date.now(), lastActivityAt: la, status: (typeof meta.status === 'string' ? meta.status : (t.status || '')), product: meta.product || t.product || '' };
        mutated = true;
      } else {
        const meta = await getCaseMeta(t.domain, t.id);
        const la = latestMeta.createdAt || meta.updatedAt || t.lastActivityAt || Date.now();
        history[i] = { ...t, lastCheckedAt: Date.now(), lastActivityAt: la, status: (typeof meta.status === 'string' ? meta.status : (t.status || '')), product: meta.product || t.product || '' };
        mutated = true;
      }
    } catch (e) {
      console.warn('Ticket check failed:', t?.id, e?.message || e);
    }
  });
  if (mutated) await storageSet({ ticketHistory: history });

  // Prune closed/resolved tickets from recents (rolling list)
  try {
    const data2 = await storageGet(['recentTickets']);
    let recents = Array.isArray(data2.recentTickets) ? data2.recentTickets : [];
    if (recents && recents.length) {
      const pruned = [];
      for (const r of recents) {
        try {
          const meta = await getCaseMeta(r.domain, r.id);
          const s = String(meta.status || '').toLowerCase();
          const isClosed = ['closed','completed','resolved','done'].some(x => s.includes(x));
          if (!isClosed) pruned.push(r);
        } catch (_) {
          pruned.push(r);
        }
      }
      if (pruned.length !== recents.length) await storageSet({ recentTickets: pruned.slice(0, 15) });
    }
  } catch (_) {}

  // Also check bookmarked tickets for unread (skip closed/resolved)
  try { await checkAllBookmarkedTickets(); } catch (_) {}
  _checkInFlight = false;
}

/** Check bookmarks for unseen activity; skip closed tickets entirely */
async function checkAllBookmarkedTickets() {
  const data = await storageGet(['ticketBookmarks', 'ignoredBotsPublic', 'ignoredBotsInternal', 'ticketHistory']);
  let bookmarks = Array.isArray(data.ticketBookmarks) ? data.ticketBookmarks : [];
  if (!bookmarks.length) return;
  const ignoredPublic = Array.isArray(data.ignoredBotsPublic) ? data.ignoredBotsPublic.map(b => String(b).toLowerCase()) : ['hermes'];
  const ignoredInternal = Array.isArray(data.ignoredBotsInternal) ? data.ignoredBotsInternal.map(b => String(b).toLowerCase()) : ['centralsupport-ai-acc','lachesis'];
  // Map history by domain:id so new bookmarks can adopt existing baselines
  const history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
  const histMap = new Map();
  const hk = (d,id)=> `${d}:${id}`;
  for (const h of history) {
    if (h && h.domain && h.id) histMap.set(hk(h.domain, h.id), h);
  }
  const lc = (s)=> (s||'').toString().toLowerCase();
  const nameOf = (p)=> lc(p?.creator?.name || p?.author?.name || p?.actor?.name || p?.created_by?.name || p?.user?.name || p?.sender?.name || p?.from?.name || p?.from_name || '');
  const emailOf = (p)=> lc(p?.creator?.email || p?.author?.email || p?.actor?.email || p?.created_by?.email || p?.user?.email || p?.sender?.email || p?.from?.email || p?.email || '');
  const typeOf = (p)=> lc(p?.creator?.type || p?.actor?.type || p?.created_by?.type || p?.user?.type || p?.creator_type || p?.actor_type || p?.role || '');
        const isInternal = (p)=> {
    const t = lc(p?.type || p?.post_type || p?.category || p?.postType || '');
    const vis = lc(p?.visibility || p?.scope || p?.access || '');
    const ch = lc(p?.channel || p?.via || '');
    return (
      p?.is_internal === true ||
      p?.isInternal === true ||
      p?.internal === true ||
      p?.is_private === true ||
      p?.private === true ||
      vis === 'internal' || vis === 'private' || vis === 'staff' ||
      ch === 'internal' || ch === 'private' || ch === 'notes' ||
      t.includes('note') || t.includes('internal') || t.includes('private')
    );
  };
  const isPublic = (p)=> {
    if (isInternal(p)) return false;
    if (p?.is_public === true || p?.isPublic === true) return true;
    const vis = lc(p?.visibility || '');
    return vis ? vis === 'public' : true;
  };
  const isBotPublic = (p)=> {
    const nm = nameOf(p), em = emailOf(p);
    return ignoredPublic.some(b => nm.includes(b) || em.includes(b));
  };
  const isBotInternal = (p)=> {
    const nm = nameOf(p), em = emailOf(p);
    return ignoredInternal.some(b => nm.includes(b) || em.includes(b));
  };
  const isCustomer = (p)=> {
    const t = typeOf(p);
    if (t && ['customer','user','requester','end_user','end-user','client','contact'].some(k => t.includes(k))) return true;
    const flags = [p?.is_customer, p?.isCustomer, p?.from_customer, p?.fromCustomer, p?.is_user, p?.isUser, p?.is_requester, p?.isRequester, p?.requester === true, p?.contact_type === 'customer'];
    return flags.some(Boolean);
  };
  const pid = (p)=> Number(p?.id || p?.post_id || p?.uid || p?.postId || p?.message_id || 0) || 0;

  let mutated = false;
  await runWithConcurrency(bookmarks, 6, async (_b, i) => {
    const b = _b;
    if (!b || !b.id || !b.domain) return;
    try {
      const meta = await fetchCaseMeta(b.domain, b.id);
      const statusLc = lc(meta.status || b.status || '');
      const isClosed = ['closed','completed','resolved','done'].some(x => statusLc.includes(x));
      // Always update meta fields
      let updated = { ...b, status: (typeof meta.status === 'string' ? meta.status : (b.status || '')), product: meta.product || b.product || '', lastActivityAt: meta.updatedAt || b.lastActivityAt || 0, lastCheckedAt: Date.now() };
      if (isClosed) {
        // Skip polling posts; clear unread
        updated.hasUnseenActivity = false;
        updated.unreadCount = 0;
        bookmarks[i] = updated;
        mutated = true;
        return;
      }
      const latest = await fetchLatestPostId(b.domain, b.id);
      let baseline = Number(b.lastKnownPostId || 0);
      if (!baseline) {
        const fromHistory = Number((histMap.get(hk(b.domain, b.id)) || {}).lastKnownPostId || 0);
        baseline = fromHistory || 0;
      }
      if (!baseline) {
        // First time ever tracking this as bookmark and no history exists → adopt latest
        bookmarks[i] = { ...updated, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0 };
        mutated = true;
        return;
      }
      if (latest > baseline) {
        const postsUrl = `https://${b.domain}/api/v1/cases/${b.id}/posts?limit=25`;
        let posts = [];
        try {
          const res = await fetch(postsUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          posts = normalizePostsPayload(json);
        } catch (_) {}
        const relevant = posts
          .filter(p => pid(p) > baseline)
          .filter(p => {
            // Only count posts that happened after the last time *you* viewed this ticket (if known)
            try {
              const ts = Date.parse(extractPostCreatedAt(p) || '') || 0;
              if (b.lastSeenAt && ts && ts <= b.lastSeenAt) return false;
            } catch (_) {}
            if (isInternal(p)) {
              if (isBotInternal(p)) return false;
              return true;
            }
            if (isPublic(p)) {
              if (isBotPublic(p)) return false;
              return true; // any human public reply (customer or agent)
            }
            return false;
          });
        const unreadCount = relevant.length;
        if (unreadCount > 0) {
          bookmarks[i] = { ...updated, hasUnseenActivity: true, unreadCount };
          mutated = true;
        } else if (b.hasUnseenActivity || b.unreadCount) {
          bookmarks[i] = { ...updated, hasUnseenActivity: false, unreadCount: 0 };
          mutated = true;
        } else {
          bookmarks[i] = updated;
          mutated = true;
        }
      } else if (b.hasUnseenActivity || b.unreadCount) {
        bookmarks[i] = { ...updated, hasUnseenActivity: false, unreadCount: 0 };
        mutated = true;
      } else {
        bookmarks[i] = updated;
        mutated = true;
      }
    } catch (e) {
      console.warn('Bookmark check failed:', b?.id, e?.message || e);
    }
  });
  if (mutated) await storageSet({ ticketBookmarks: bookmarks });
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
    // Update baseline to latest observed (includes our own post + any immediate bot posts after)
    const now = Date.now();
    const data = await storageGet(['ticketHistory']);
    let history = Array.isArray(data.ticketHistory) ? data.ticketHistory : [];
    let changed = false;
    history = history.map(t => {
      if (String(t.id) === String(ticketId) && t.domain === domain) {
        const updated = { ...t, lastKnownPostId: latest, hasUnseenActivity: false, unreadCount: 0, lastCheckedAt: now, lastSeenAt: now };
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