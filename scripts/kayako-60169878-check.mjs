import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const workspace = '/Users/pabloambram/Development/Kayako-Enhancer-Chrome-Extension';
  const extPath = path.join(workspace, 'kayako-cacher');
  const tempDir = path.join(workspace, 'kayako-cacher', 'temp');
  try { fs.mkdirSync(tempDir, { recursive: true }); } catch (_) {}

  const baseUrl = process.env.KAYAKO_BASE || 'https://central-supportdesk.kayako.com';
  const ticketId = process.env.KAYAKO_TICKET_ID || '60169878';
  const convUrl = `${baseUrl}/agent/conversations/${ticketId}`;

  // Reuse a logged-in Chrome profile if available; set CHROME_PROFILE to your actual Chrome profile dir
  // Example (macOS): export CHROME_PROFILE="$HOME/Library/Application Support/Google/Chrome/Default"
  const userDataDir = process.env.CHROME_PROFILE || path.join(tempDir, 'playwright-profile');

  const consoleLogPath = path.join(tempDir, `ticket-${ticketId}-console.log`);
  const netLogPath = path.join(tempDir, `ticket-${ticketId}-network.log`);
  const screenshotPath = path.join(tempDir, `ticket-${ticketId}.png`);

  const consoleStream = fs.createWriteStream(consoleLogPath, { flags: 'w' });
  const netStream = fs.createWriteStream(netLogPath, { flags: 'w' });

  console.log(`[info] Launching Chromium with extension from ${extPath}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`
    ]
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const line = `[console:${msg.type()}] ${msg.text()}\n`;
    consoleStream.write(line);
    if (/Kayako|Backfill|CACHED|Appended|Ember store/i.test(msg.text())) {
      // Also echo key lines
      process.stdout.write(line);
    }
  });

  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      if (/\/api\/v1\/cases\/.+\/posts/.test(url)) {
        netStream.write(`[${resp.status()}] ${url}\n`);
      }
    } catch (_) {}
  });

  console.log(`[info] Navigating to ${convUrl}`);
  await page.goto(convUrl, { waitUntil: 'domcontentloaded' });

  // If not logged in, the app will redirect. Give it a moment.
  await page.waitForTimeout(4000);

  // Try to wait for the timeline to be present; don't fail if missing.
  try {
    await page.waitForSelector('[data-test-id="timeline"], .timeline', { timeout: 15000 });
  } catch (_) {}

  // Gather Ember diagnostics in the page context.
  const diagnostics = await page.evaluate(() => {
    const E = window.Ember;
    function getContainer(){
      try { if (E && E.__container__) return E.__container__; } catch(_){ }
      try {
        const ns = (E && E.Namespace && E.Namespace.NAMESPACES) || [];
        for (let i=0;i<ns.length;i++) if (ns[i] && ns[i].__container__) return ns[i].__container__;
      } catch(_){ }
      try {
        const apps = (E && E.Application && E.Application.instances) || [];
        if (apps.length && apps[0].__container__) return apps[0].__container__;
      } catch(_){ }
      return null;
    }
    function norm(val){
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (val && typeof val.toArray === 'function') try { return val.toArray(); } catch(_) {}
      return [];
    }
    function isPostModel(item){
      try { const m = item && item.constructor && item.constructor.modelName; return m==='post'||m==='case-message'||m==='case_message'; } catch(_){ return false; }
    }
    function created(r){
      try { return (r.get && (r.get('createdAt')||r.get('created_at'))) || r.createdAt || r.created_at || ''; } catch(_){ return ''; }
    }
    function byDate(a,b){ return new Date(created(a)) - new Date(created(b)); }

    const container = getContainer();
    if (!container) return { error: 'no-container' };
    const store = (container.lookup && (container.lookup('service:store') || container.lookup('store:main'))) || null;
    const router = (container.lookup && container.lookup('router:main')) || null;
    const routeName = (router && (router.currentRouteName || (router.get && router.get('currentRouteName')))) || null;
    const route = (routeName && container.lookup && container.lookup('route:' + routeName)) || null;
    const controller = (route && route.controller) || (routeName && container.lookup && container.lookup('controller:' + routeName)) || null;

    function findThread(){
      const cand = [
        controller && controller.timeline && controller.timeline.posts,
        route && route.controller && route.controller.timeline && route.controller.timeline.posts,
        route && route.currentModel && route.currentModel.timeline && route.currentModel.timeline.posts,
        route && route.context && route.context.timeline && route.context.timeline.posts,
        controller && controller.timeline && controller.timeline.items
      ];
      for (let i=0;i<cand.length;i++){
        const arr = norm(cand[i]);
        if (arr.length && isPostModel(arr[0])) return cand[i];
      }
      const pools = [controller, route, controller && controller.model, route && route.currentModel];
      for (let p=0;p<pools.length;p++){
        const obj = pools[p]; if (!obj) continue;
        for (const k in obj){ if (!Object.prototype.hasOwnProperty.call(obj,k)) continue; const arr = norm(obj[k]); if (arr.length && isPostModel(arr[0])) return obj[k]; }
      }
      return null;
    }

    const thread = findThread();
    const visible = norm(thread);
    const posts = norm(store && store.peekAll && store.peekAll('post'));
    const caseMsg = norm(store && store.peekAll && store.peekAll('case-message'));
    const all = posts.concat(caseMsg);

    const ev = visible.slice().sort(byDate)[0];
    const lv = visible.slice().sort(byDate).slice(-1)[0];
    const es = all.slice().sort(byDate)[0];

    return {
      route: routeName,
      visibleCount: visible.length,
      storeCounts: { post: posts.length, caseMessage: caseMsg.length },
      earliestVisible: { id: ev && ev.id, created: created(ev) },
      latestVisible: { id: lv && lv.id, created: created(lv) },
      earliestStore: { id: es && es.id, created: created(es) }
    };
  });

  fs.writeFileSync(path.join(tempDir, `ticket-${ticketId}-diagnostics.json`), JSON.stringify(diagnostics, null, 2));
  console.log('[diagnostics]', diagnostics);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  console.log(`[info] Screenshot saved at ${screenshotPath}`);

  await page.waitForTimeout(2000);
  await context.close();
  consoleStream.end();
  netStream.end();
  console.log(`[done] Logs written to:\n  - ${consoleLogPath}\n  - ${netLogPath}`);
})().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});


