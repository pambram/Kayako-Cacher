// Debug helper: installs window.__KAYAKO_DBG so we don't paste snippets repeatedly
(function(){
  function arr(v){ if(!v) return []; if(Array.isArray(v)) return v; return (v&&v.toArray)? v.toArray() : []; }
  function isPost(m){ try{ const n=m&&m.constructor&&m.constructor.modelName; return n==='post'||n==='case-message'||n==='case_message'; }catch(_){ return false; } }
  function created(r){ try{ return (r.get&&(r.get('createdAt')||r.get('created_at'))) || r.createdAt || r.created_at || ''; }catch(_){ return ''; } }
  function byDate(a,b){ return new Date(created(a)) - new Date(created(b)); }
  function getContainer(){
    const E = window.Ember; if(!E) return null;
    try{ if(E.__container__) return E.__container__; }catch(_){ }
    try{ const apps=(E.Application&&E.Application.instances)||[]; if(apps.length&&apps[0].__container__) return apps[0].__container__; }catch(_){ }
    try{ const ns=(E.Namespace&&E.Namespace.NAMESPACES)||[]; for(let i=0;i<ns.length;i++) if(ns[i]&&ns[i].__container__) return ns[i].__container__; }catch(_){ }
    return null;
  }
  function compute(){
    const c = getContainer();
    const out = { route:null, visibleCount:0, storeCounts:{post:0,caseMessage:0}, earliestVisible:{created:''}, latestVisible:{created:''}, earliestStore:{created:''}, missingCount:0 };
    if(!c) return { c:null, out };
    const store = (c.lookup&&(c.lookup('service:store')||c.lookup('store:main'))) || null;
    const router = (c.lookup&&c.lookup('router:main')) || null;
    const rn = (router&&(router.currentRouteName||(router.get&&router.get('currentRouteName')))) || null; out.route = rn;
    const route = (rn&&c.lookup&&c.lookup('route:'+rn)) || null;
    const ctrl = (route&&route.controller) || (rn&&c.lookup&&c.lookup('controller:'+rn)) || null;
    function findThread(){
      const cand=[ctrl?.timeline?.posts, route?.controller?.timeline?.posts, route?.currentModel?.timeline?.posts, route?.context?.timeline?.posts, ctrl?.timeline?.items];
      for(const ref of cand){ const a=arr(ref); if(a.length&&isPost(a[0])) return ref; }
      const pools=[ctrl, route, ctrl&&ctrl.model, route&&route.currentModel];
      for(const p of pools){ if(!p) continue; for(const k in p){ if(!Object.prototype.hasOwnProperty.call(p,k)) continue; const a=arr(p[k]); if(a.length&&isPost(a[0])) return p[k]; } }
      return null;
    }
    const thread = findThread(); const visible = arr(thread); out.visibleCount = visible.length;
    const posts = arr(store&&store.peekAll&&store.peekAll('post')); const msgs=arr(store&&store.peekAll&&store.peekAll('case-message'));
    out.storeCounts = { post: posts.length, caseMessage: msgs.length };
    const ev=visible.slice().sort(byDate)[0], lv=visible.slice().sort(byDate).slice(-1)[0], es=posts.slice().sort(byDate)[0];
    out.earliestVisible = { id: ev&&ev.id, created: created(ev) };
    out.latestVisible   = { id: lv&&lv.id, created: created(lv) };
    out.earliestStore   = { id: es&&es.id, created: created(es) };
    const visIds = new Set(visible.map(r=>String(r?.id||(r.get&&r.get('id'))||'')));
    const missing = posts.filter(r=>!visIds.has(String(r?.id||(r.get&&r.get('id'))))).sort(byDate);
    out.missingCount = missing.length;
    function originalId(rec){
      try{
        const o = rec.get?.('original') || rec.original; const oid = o?.id || rec.get?.('original.id');
        return String(oid||'');
      }catch(_){ return ''; }
    }
    const visOrig = new Set(visible.map(p=>originalId(p)));
    const missingByOriginal = posts.filter(p=>{ const oid=originalId(p); return oid && !visOrig.has(oid); }).sort(byDate);
    return { c, out, thread, ctrl, missing, posts, msgs, missingByOriginal };
  }
  function install(){
    window.__KAYAKO_DBG = {
      get container(){ return getContainer(); },
      info(){ const { out } = compute(); console.log(out); return true; },
      showMissing(n=20){ const { missingByOriginal } = compute(); return (missingByOriginal||[]).slice(0,n).map(r=>({ postId:String(r&&r.id), originalId:(r.get?.('original.id')||r.original?.id||''), created: created(r) })); },
      findByOriginalId(id){ const R=compute(); if(!R.posts) return null; const target=String(id); const inTimeline = arr(R.thread).some(p=>String(p.get?.('original.id')||p.original?.id||'')===target);
        const post = R.posts.find(p=>String(p.get?.('original.id')||p.original?.id||'')===target); return { id: target, postId: post? String(post.id):'', inStore: !!post, inTimeline }; },
      appendByOriginalIds(ids){ const R=compute(); if(!R.thread||!R.ctrl) return 0; const E=window.Ember; const list = (ids||[]).map(String);
        const toAdd = R.posts.filter(p=>{ const oid=String(p.get?.('original.id')||p.original?.id||''); if(!oid) return false; if(!list.includes(oid)) return false; const inTl = arr(R.thread).some(x=>String(x.get?.('original.id')||x.original?.id||'')===oid); return !inTl; });
        if(!toAdd.length) return 0; E.run(()=>{ R.thread.pushObjects? R.thread.pushObjects(toAdd) : Array.isArray(R.thread)&&R.thread.push(...toAdd); const sorted=arr(R.thread).slice().sort(byDate); R.ctrl.set&&R.ctrl.set('timeline.posts', sorted); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Appended by original ids:', toAdd.length); return toAdd.length; },
      appendMissing(){ const R=compute(); if(!R.thread||!R.ctrl) return 0; const E=window.Ember; const toAdd=R.missingByOriginal||[]; if(!toAdd.length) return 0; E.run(()=>{ R.thread.pushObjects? R.thread.pushObjects(toAdd) : Array.isArray(R.thread)&&R.thread.push(...toAdd); const sorted=arr(R.thread).slice().sort(byDate); R.ctrl.set&&R.ctrl.set('timeline.posts', sorted); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Appended:', toAdd.length); return toAdd.length; },
      rebind(){ const R=compute(); if(!R.thread||!R.ctrl) return false; const a=arr(R.thread).slice().sort(byDate); const E=window.Ember; E.run(()=>{ R.ctrl.set&&R.ctrl.set('timeline.posts', a); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Rebound'); return true; }
    };
    console.log('DBG_READY');
  }
  function safeInstall(){ try{ install(); } catch(_){ } }
  safeInstall();
  try { window.addEventListener('kayako-data-refreshed', safeInstall); } catch(_){ }
  try { window.addEventListener('load', safeInstall); } catch(_){ }
  try { window.addEventListener('popstate', safeInstall); } catch(_){ }
})();


