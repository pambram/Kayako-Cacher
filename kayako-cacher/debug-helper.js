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
      listTimeline(){
        const c = getContainer(); if(!c) return 'NO_CONTAINER';
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline || {};
        const isPostModel = x => x && x.constructor && x.constructor.modelName === 'post';
        const rows = Object.keys(tl).map(k => {
          const v = tl[k]; const a = arr(v); if(!a.length) return null;
          const first = a[0];
          let kind = '';
          if(isPostModel(first)) kind = 'post[]';
          else if(first && (isPostModel(first.post) || isPostModel(first.get?.('post')))) kind = 'row{post}[]';
          else if(first && typeof first === 'object') kind = 'object[]';
          else if(Array.isArray(first)) kind = 'array[]';
          else kind = typeof first + '[]';
          const sample = isPostModel(first) ? [String(first.id)] : (first && (first.post||first.get?.('post')) ? [String((first.post&&first.post.id)||first.get?.('post.id')||'')] : []);
          return { key: 'timeline.'+k, len: a.length, kind, sampleIds: sample };
        }).filter(Boolean).sort((a,b)=>b.len-a.len);
        console.table(rows.slice(0,20));
        return rows;
      },
      scanTimelineProps(){
        const c = getContainer(); if(!c) return 'NO_CONTAINER';
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline || {};
        const keys = Array.from(new Set([].concat(Object.keys(tl||{}), Object.getOwnPropertyNames(tl||{}))));
        const out = [];
        keys.forEach(k => {
          try {
            const v = tl[k];
            const a = arr(v);
            const isArr = !!(Array.isArray(v) || (v&&v.toArray));
            const len = a.length || 0;
            const sample = len ? String(a[0]?.id || a[0]?.get?.('id') || '') : '';
            out.push({ key: 'timeline.'+k, isArr, len, sample });
          } catch(_) {
            out.push({ key: 'timeline.'+k, error: true });
          }
        });
        out.sort((a,b)=> (b.len||0)-(a.len||0));
        console.table(out.slice(0,30));
        return out;
      },
      showScrollData(){
        const c = getContainer(); if(!c) return 'NO_CONTAINER';
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline || {};
        const sd = tl && tl.scrollData ? tl.scrollData : {};
        try { console.table(sd); } catch(_) { try { console.log(sd); } catch(__){} }
        return sd;
      },
      forceStartAtZero(){
        const c = getContainer(); if(!c) return false;
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline; if(!tl) return false;
        const E = window.Ember;
        const keys = ['start','startIndex','firstIndex','offset','start_at','from','fromIndex','visibleStart'];
        E.run(()=>{
          try {
            if (tl.scrollData) {
              keys.forEach(k=>{ try { if (typeof tl.scrollData[k] === 'number' && tl.scrollData[k] !== 0) tl.scrollData[k] = 0; } catch(_){ } });
              try { if (tl.scrollData.notifyPropertyChange) { keys.forEach(k=>tl.scrollData.notifyPropertyChange(k)); } } catch(_){ }
            }
            keys.forEach(k=>{ try { if (typeof tl[k] === 'number' && tl[k] !== 0) tl[k] = 0; } catch(_){ } });
            try { if (tl.notifyPropertyChange) { keys.forEach(k=>tl.notifyPropertyChange(k)); } } catch(_){ }
            try { if (ctrl.notifyPropertyChange) { keys.forEach(k=>ctrl.notifyPropertyChange('timeline.'+k)); } } catch(_){ }
          } catch(_){ }
        });
        // Attempt DOM scroll to top as a fallback
        try {
          const nodes = Array.from(document.querySelectorAll('[data-qa-id*="timeline"], [class*="timeline"], [role="feed"], main, section, .scrollable, .content')).filter(el=>el && el.scrollHeight>el.clientHeight);
          let maxEl = null, maxH = 0; nodes.forEach(el=>{ if (el.scrollHeight>maxH) { maxH=el.scrollHeight; maxEl=el; } });
          if (maxEl) maxEl.scrollTop = 0;
        } catch(_){ }
        console.log('Forced start-at to 0');
        return true;
      },
      setAnchorToPostId(id){
        const c = getContainer(); if(!c) return false;
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline; if(!tl) return false;
        const E = window.Ember; const pid = Number(id);
        E.run(()=>{
          try { if (tl.scrollData) tl.scrollData.id = pid; } catch(_){ }
          try { tl.id = pid; } catch(_){ }
          try { if (tl.notifyPropertyChange) { tl.notifyPropertyChange('id'); tl.notifyPropertyChange('scrollData'); } } catch(_){ }
          try { if (tl.scrollData && tl.scrollData.notifyPropertyChange) tl.scrollData.notifyPropertyChange('id'); } catch(_){ }
          try { if (ctrl.notifyPropertyChange) { ctrl.notifyPropertyChange('timeline.id'); ctrl.notifyPropertyChange('timeline.scrollData'); } } catch(_){ }
        });
        console.log('Set anchor id to', pid);
        return true;
      },
      jumpToFirst(){
        const R=compute(); const a=arr(R.thread).slice().sort(byDate); if(!a.length) return false;
        const firstId = a[0] && (a[0].id || a[0].get?.('id'));
        if(!firstId) return false;
        this.expandLimit(); this.forceStartAtZero(); this.setAnchorToPostId(firstId); this.rebind();
        return true;
      },
      head(n=5){ const R=compute(); const a=arr(R.thread).slice().sort(byDate).slice(0,n).map(x=>({id:String(x.id), created: created(x), orig:(x.get?.('original.id')||x.original?.id||'')})); console.table(a); return a; },
      tail(n=5){ const R=compute(); const s=arr(R.thread).slice().sort(byDate); const a=s.slice(Math.max(0,s.length-n)).map(x=>({id:String(x.id), created: created(x), orig:(x.get?.('original.id')||x.original?.id||'')})); console.table(a); return a; },
      indexOfPostId(id){ const R=compute(); const a=arr(R.thread); const i=a.findIndex(x=>String(x.id)===String(id)); console.log('indexOf', id, '=', i); return i; },
      expandLimit(){
        const c = getContainer(); if(!c) return false;
        const r = c.lookup('router:main'); const rn = r.currentRouteName || r.get?.('currentRouteName');
        const ctrl = c.lookup('controller:'+rn); const tl = ctrl?.timeline;
        if(!tl) return false;
        const a = arr(tl.posts);
        const E = window.Ember;
        E.run(()=>{
          try { if (typeof tl.set === 'function') tl.set('limit', a.length); else tl.limit = a.length; } catch(_){ tl.limit = a.length; }
          try { if (tl.notifyPropertyChange) tl.notifyPropertyChange('limit'); } catch(_){ }
          try { if (ctrl.notifyPropertyChange) ctrl.notifyPropertyChange('timeline.limit'); } catch(_){ }
        });
        console.log('Expanded timeline.limit to', a.length);
        return true;
      },
      showNoOriginal(n=20){ const R=compute(); const bad=(R.posts||[]).filter(p=>{ try{ const o=p.get?.('original')||p.original; return !o; }catch(_){ return true; } }); const rows=bad.slice(0,n).map(p=>({postId:String(p.id), created: created(p)})); console.table(rows); return rows; },
      get(path){ try{ const parts=String(path||'').split('.'); let v=window; for(const t of parts){ if(!v) return undefined; v=v[t]; } return v; }catch(_){ return undefined; } },
      findByOriginalId(id){ const R=compute(); if(!R.posts) return null; const target=String(id); const inTimeline = arr(R.thread).some(p=>String(p.get?.('original.id')||p.original?.id||'')===target);
        const post = R.posts.find(p=>String(p.get?.('original.id')||p.original?.id||'')===target); return { id: target, postId: post? String(post.id):'', inStore: !!post, inTimeline }; },
      appendByOriginalIds(ids){ const R=compute(); if(!R.thread||!R.ctrl) return 0; const E=window.Ember; const list = (ids||[]).map(String);
        const toAdd = R.posts.filter(p=>{ const oid=String(p.get?.('original.id')||p.original?.id||''); if(!oid) return false; if(!list.includes(oid)) return false; const inTl = arr(R.thread).some(x=>String(x.get?.('original.id')||x.original?.id||'')===oid); return !inTl; });
        if(!toAdd.length) return 0; E.run(()=>{ R.thread.pushObjects? R.thread.pushObjects(toAdd) : Array.isArray(R.thread)&&R.thread.push(...toAdd); const sorted=arr(R.thread).slice().sort(byDate); R.ctrl.set&&R.ctrl.set('timeline.posts', sorted); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Appended by original ids:', toAdd.length); return toAdd.length; },
      appendMissing(){ const R=compute(); if(!R.thread||!R.ctrl) return 0; const E=window.Ember; const toAdd=R.missingByOriginal||[]; if(!toAdd.length) return 0; E.run(()=>{ R.thread.pushObjects? R.thread.pushObjects(toAdd) : Array.isArray(R.thread)&&R.thread.push(...toAdd); const sorted=arr(R.thread).slice().sort(byDate); R.ctrl.set&&R.ctrl.set('timeline.posts', sorted); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Appended:', toAdd.length); return toAdd.length; },
      rebind(){ const R=compute(); if(!R.thread||!R.ctrl) return false; const a=arr(R.thread).slice().sort(byDate); const E=window.Ember; E.run(()=>{ R.ctrl.set&&R.ctrl.set('timeline.posts', a); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('Rebound'); return true; },
      forceReset(){ const R=compute(); if(!R.thread||!R.ctrl) return false; const E=window.Ember; const a=arr(R.thread).slice().sort(byDate); E.run(()=>{ R.ctrl.set&&R.ctrl.set('timeline.posts', []); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); R.ctrl.set&&R.ctrl.set('timeline.posts', a); R.ctrl.notifyPropertyChange&&R.ctrl.notifyPropertyChange('timeline.posts'); }); console.log('ForceReset'); return true; },
      dumpByOriginalId(id){ const R=compute(); if(!R.posts) return null; const target=String(id); const post = R.posts.find(p=>String(p.get?.('original.id')||p.original?.id||'')===target); if(!post) return null; const g=(k)=>{ try{return post.get?.(k);}catch(_){return undefined;} }; let orig=null; try{ orig = post.get? post.get('original') : (post.original||null); }catch(_){ orig=null; } let origType = ''; try{ origType = (orig && (orig.get? orig.get('resource_type') : orig.resource_type)) || ''; }catch(_){ origType=''; } if(!origType && orig && orig.constructor && orig.constructor.modelName) origType = orig.constructor.modelName; const info={ postId:String(post.id), created: g('createdAt')||post.createdAt||'', kind:(g('resource_type')||post.resource_type||'post'), post_status:g('post_status')||post.post_status||'', is_requester: g('is_requester')||post.is_requester||'', original_type: origType||'', original_id: String(target) }; console.log(info); return info; },
      dumpByPostId(id){ const R=compute(); if(!R.posts) return null; const p = R.posts.find(x=>String(x.id)===String(id)); if(!p) return null; const g=(k)=>{ try{return p.get?.(k);}catch(_){return undefined;} }; let orig=null; try{ orig = p.get? p.get('original') : (p.original||null); }catch(_){ orig=null; } let origType = ''; try{ origType = (orig && (orig.get? orig.get('resource_type') : orig.resource_type)) || ''; }catch(_){ origType=''; } if(!origType && orig && orig.constructor && orig.constructor.modelName) origType = orig.constructor.modelName; let creator=null; try{ creator = p.get? p.get('creator') : (p.creator||null); }catch(_){ creator=null; } let creatorType=''; try{ creatorType = (creator && (creator.get? creator.get('resource_type') : creator.resource_type)) || ''; }catch(_){ creatorType=''; } const info={ postId:String(p.id), created: g('createdAt')||p.createdAt||'', kind:(g('resource_type')||p.resource_type||'post'), post_status:g('post_status')||p.post_status||'', is_requester: g('is_requester')||p.is_requester||'', original_type: origType||'', original_id: (orig && (orig.get? orig.get('id') : orig.id))||'', creator_type: creatorType||'' }; console.log(info); return info; }
    };
    console.log('DBG_READY');
  }
  function safeInstall(){ try{ install(); } catch(_){ } }
  safeInstall();
  try { window.addEventListener('kayako-data-refreshed', safeInstall); } catch(_){ }
  try { window.addEventListener('load', safeInstall); } catch(_){ }
  try { window.addEventListener('popstate', safeInstall); } catch(_){ }
})();


