/* app-claude.js — Witness. Dashboard */

/* ─── API ─────────────────────────────────────────────────────── */

async function fetchJobs() {
  const response = await fetch('/api/jobs');
  const data = await response.json();
  return data.jobs || [];
}

async function fetchConfig() {
  const response = await fetch('/api/config');
  const data = await response.json();
  return data.config || {};
}

async function saveConfig(config) {
  const response = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save config');
  }
}

/* ─── Toast ───────────────────────────────────────────────────── */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Double rAF ensures transition fires after paint
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-visible')));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}

/* ─── Utilities ───────────────────────────────────────────────── */

function formatDuration(startedAt, endedAt) {
  if (!startedAt) return null;
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalSec = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function relativeTime(isoString) {
  if (!isoString) return 'n/a';
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return isoString;
  if (diff < 5000)   return 'just now';
  if (diff < 60000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

/* ─── Status Rendering ────────────────────────────────────────── */

const STATUS_BADGE_CLASS = {
  running:    'badge-info',
  pending:    'badge-warning',
  scheduled:  'badge-warning',
  cancelling: 'badge-warning',
  completed:  'badge-success',
  ended:      'badge-ended',
  failed:     'badge-danger',
  cancelled:  'badge-neutral'
};

function renderStatusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || 'badge-neutral';
  return `<span class="badge ${cls}">${status}</span>`;
}

function renderStatusDot(job) {
  if (job.status === 'running') {
    return '<span class="status-dot dot-success dot-pulse"></span>';
  }
  if (['pending', 'scheduled', 'cancelling'].includes(job.status)) {
    return '<span class="status-dot dot-warning"></span>';
  }
  if (job.status === 'completed') {
    return '<span class="status-dot dot-success"></span>';
  }
  if (job.status === 'ended') {
    return '<span class="status-dot dot-ended"></span>';
  }
  return '<span class="status-dot dot-danger"></span>';
}

function getSetupChecks(job) {
  const joined = (job.recentEvents || []).find(e => e.event === 'joined');
  const av = joined?.payload?.avState || {};
  const hasAny = Boolean(joined?.payload?.avState) || typeof joined?.payload?.captionsOn === 'boolean';
  return {
    hasAny,
    micOff:     Boolean(av.micOff),
    camOff:     Boolean(av.camOff),
    captionsOn: Boolean(joined?.payload?.captionsOn)
  };
}

function renderHealthChecks(job) {
  const checks = getSetupChecks(job);
  if (!checks.hasAny) return '';
  const items = [
    { label: 'mic', ok: checks.micOff },
    { label: 'cam', ok: checks.camOff },
    { label: 'cc',  ok: checks.captionsOn }
  ];
  const pills = items
    .map(i => `<span class="check-pill ${i.ok ? 'check-ok' : 'check-pending'}">${i.label}</span>`)
    .join('');
  return `<div class="health-checks">${pills}</div>`;
}

/* ─── Artifact Links ──────────────────────────────────────────── */

function s3LinkHref(file) {
  // Always use the presign proxy so URLs never expire.
  if (file.key) return `/api/s3/presign?key=${encodeURIComponent(file.key)}`;
  return file.url || '#';
}

function renderArtifactLinks(job) {
  const links = [];

  (job.latestCheckpointLinks || []).forEach(file => {
    const name = (file.name || '').toLowerCase();
    let label = 'checkpoint';
    if (name.includes('live') && name.endsWith('.txt')) label = 'transcript (s3)';
    else if (name.includes('state') && name.endsWith('.json')) label = 'state (s3)';
    const href = s3LinkHref(file);
    if (file.key) {
      // Presign proxy — generates a fresh URL before navigating.
      links.push(`<a href="#" data-s3-open="${encodeURIComponent(file.key)}" class="artifact-link">↗ ${label}</a>`);
    } else {
      links.push(`<a href="${href}" target="_blank" rel="noopener" class="artifact-link">↗ ${label}</a>`);
    }
  });

  (job.finalLinks || []).forEach(file => {
    if (file.key) {
      links.push(`<a href="#" data-s3-open="${encodeURIComponent(file.key)}" class="artifact-link">↗ ${file.name}</a>`);
    } else {
      links.push(`<a href="${file.url || '#'}" target="_blank" rel="noopener" class="artifact-link">↗ ${file.name}</a>`);
    }
  });

  return links.length ? `<div class="artifact-section">${links.join('')}</div>` : '';
}

/* ─── Summary Section (mini-cards) ───────────────────────────── */

function renderSummaryStatusBadge(status, pct) {
  if (status === 'running') {
    return `<span class="smc-badge smc-badge-generating">generating ${pct}%</span>`;
  }
  if (status === 'completed' || status === 'idle') {
    // 'idle' here means no task has ever run — "ready" is determined by artifact presence
    return '';
  }
  if (status === 'failed') {
    return `<span class="smc-badge smc-badge-failed">failed</span>`;
  }
  return '';
}

function renderSummaryMiniCard(job, { key, label, isMarkdown, description }) {
  const task    = job.summaryTasks?.[key] || {};
  const status  = task.status || 'idle';
  const pct     = Number.isFinite(task.progress) ? task.progress : 0;
  const ready   = Boolean(job.summaryArtifacts?.[key]?.localPath);
  const fileUrl = ready ? `/api/jobs/${job.id}/summaries/${key}/file` : '';
  const running = status === 'running';
  const failed  = status === 'failed';

  // Header: label + ready badge + generating badge
  const readyBadge  = ready && !running ? `<span class="smc-badge smc-badge-ready">ready</span>` : '';
  const statusBadge = renderSummaryStatusBadge(status, pct);

  // Progress bar (visible while generating)
  const progressBar = running
    ? `<div class="progress-bar-wrap smc-progress"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`
    : '';

  // Artifact links (file)
  const fileLink = ready
    ? `<a href="${fileUrl}" target="_blank" rel="noopener" class="smc-artifact-link">↗ ${label} file${isMarkdown ? ' (.md)' : ''}</a>`
    : '';

  // Error message
  const errorMsg = (failed && task.error)
    ? `<div class="smc-error" title="${String(task.error).replace(/"/g, '&quot;')}">${String(task.error).slice(0, 100)}</div>`
    : '';

  // ── Action buttons (type-specific) ───────────────────────
  let actions = '';

  if (key === 'ktDocument') {
    // KT: two independent regenerate actions
    const ktRunning = running;
    const primaryLabel = ktRunning
      ? `<span class="spinner"></span>Generating… ✕`
      : ready ? '↺ Regenerate KT' : 'Generate KT';
    const primaryAttr  = ktRunning
      ? `data-cancel-summary="${job.id}:${key}"`
      : `data-summary="${job.id}:${key}"`;

    // Google Doc section
    const gdocUrl   = job.summaryArtifacts?.ktDocumentGoogleDoc?.docUrl || '';
    const gdocState = job.gdocsStatus || (ready ? 'idle' : '');
    const gdocError = job.gdocsError || '';

    let gdocArtifact = '';
    let gdocAction   = '';

    if (gdocUrl) {
      const shareNote = job.summaryArtifacts?.ktDocumentGoogleDoc?.sharedPublicly === false
        ? ' (shared with you)' : '';
      gdocArtifact = `<a href="${gdocUrl}" target="_blank" rel="noopener" class="smc-artifact-link smc-artifact-gdoc">↗ Open in Google Docs${shareNote}</a>`;
      gdocAction   = `<button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}"
                             title="Rebuild the Google Doc from the existing .md file (faster)">
                        ↺ Regen Google Doc
                      </button>`;
    } else if (gdocState === 'creating') {
      gdocAction = `<span class="smc-creating"><span class="spinner" style="width:9px;height:9px"></span>Creating Google Doc…</span>`;
    } else if (gdocState === 'failed') {
      const errShort = gdocError ? gdocError.slice(0, 80) : 'unknown error';
      gdocAction = `<span class="smc-error" title="${gdocError.replace(/"/g, '&quot;')}">${errShort}</span>
                    <button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}">Retry</button>`;
    } else if (ready) {
      gdocAction = `<button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}">Create Google Doc</button>`;
    }

    actions = `
      <div class="smc-actions">
        <button class="btn btn-primary btn-sm" ${primaryAttr}>${primaryLabel}</button>
        ${gdocAction}
      </div>
      ${fileLink}
      ${gdocArtifact}`;
  } else if (key === 'bullets') {
    // Bullets: regenerate + optional incremental append
    const bulletsRunning = running;
    const primaryLabel = bulletsRunning
      ? `<span class="spinner"></span>Generating… ✕`
      : ready ? '↺ Regenerate' : 'Generate';
    const primaryAttr  = bulletsRunning
      ? `data-cancel-summary="${job.id}:${key}"`
      : `data-summary="${job.id}:${key}"`;
    const appendBtn = (ready && !running)
      ? `<button class="btn btn-ghost btn-sm" data-summary-incremental="${job.id}:bullets"
               title="Only generate bullets for new transcript entries since last run">
           + Append new
         </button>`
      : '';

    actions = `
      <div class="smc-actions">
        <button class="btn btn-ghost btn-sm" ${primaryAttr}>${primaryLabel}</button>
        ${appendBtn}
      </div>
      ${fileLink}`;
  } else {
    // TL;DR and Story Arc: simple generate / regenerate
    const thisRunning = running;
    const primaryLabel = thisRunning
      ? `<span class="spinner"></span>Generating… ✕`
      : ready ? '↺ Regenerate' : 'Generate';
    const primaryAttr  = thisRunning
      ? `data-cancel-summary="${job.id}:${key}"`
      : `data-summary="${job.id}:${key}"`;

    const storyArcHint = (key === 'storyArc' && !ready && !running)
      ? `<p class="smc-hint">Takes a while — runs in progressive chunks.</p>`
      : '';

    actions = `
      <div class="smc-actions">
        <button class="btn btn-ghost btn-sm" ${primaryAttr}>${primaryLabel}</button>
      </div>
      ${storyArcHint}
      ${fileLink}`;
  }

  return `
    <div class="summary-mini-card ${running ? 'smc-running' : ''} ${failed ? 'smc-failed' : ''}">
      <div class="smc-header">
        <span class="smc-label">${label}</span>
        <div class="smc-badges">
          ${readyBadge}
          ${statusBadge}
        </div>
      </div>
      ${progressBar}
      ${errorMsg}
      ${actions}
    </div>`;
}

function renderSummarySection(job) {
  const types = [
    { key: 'tldr',     label: 'TL;DR',      description: 'Concise executive summary' },
    { key: 'bullets',  label: 'Bullets',     description: 'Status update bullet points' },
    { key: 'storyArc', label: 'Story Arc',   description: 'Narrative arc of the meeting' }
  ];

  if (job.classifierConfig?.enabled) {
    types.push({ key: 'ktDocument', label: 'KT Document', isMarkdown: true, description: 'Knowledge transfer doc + Google Docs' });
  }

  // Append enabled custom summarizers from config.
  for (const cs of customSummarizersState) {
    if (!cs.enabled || !cs.id) continue;
    types.push({ key: cs.id, label: cs.name || cs.id, isMarkdown: cs.isMarkdown || false, description: cs.prompt?.slice(0, 60) || '' });
  }

  const cards = types.map(t => renderSummaryMiniCard(job, t)).join('');

  return `
    <div class="summary-section">
      <div class="summary-label">Summaries</div>
      <div class="summary-mini-grid">${cards}</div>
    </div>`;
}

/* ─── Job List Row (compact) ──────────────────────────────────── */

function renderJobRow(job) {
  const duration = formatDuration(job.startedAt, job.endedAt);
  const objective = job.classifierConfig?.meetingObjective;
  const meetCode = (job.meetUrl || '').split('/').pop();
  const summaryBadges = ['tldr', 'bullets', 'storyArc', 'ktDocument']
    .filter(k => job.summaryArtifacts?.[k]?.localPath)
    .map(k => `<span class="badge badge-neutral" style="font-size:0.68rem;padding:1px 5px">${k === 'ktDocument' ? 'KT' : k === 'storyArc' ? 'Arc' : k === 'tldr' ? 'TL;DR' : 'Bullets'}</span>`)
    .join(' ');
  return `
    <div class="job-row ${job.status === 'running' ? 'job-running' : ''}" data-job-id="${job.id}">
      <div class="job-row-status">${renderStatusDot(job)}</div>
      <div class="job-row-main">
        <a href="${job.meetUrl}" class="job-meet-url" target="_blank" rel="noopener">${meetCode}</a>
        ${objective ? `<span class="muted" style="font-size:0.78rem;margin-left:6px">— ${objective}</span>` : ''}
      </div>
      <div class="job-row-meta muted">
        ${duration} &middot; ${relativeTime(job.createdAt)}
      </div>
      <div class="job-row-badges">${summaryBadges}</div>
      ${renderStatusBadge(job.status)}
      <div class="job-row-actions">
        <button class="btn btn-ghost btn-sm" data-filterjob="${job.id}">Events</button>
        <a href="/api/jobs/${job.id}/live-transcript" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Transcript</a>
        ${(job.status === 'running' || job.status === 'cancelling') ? `<button class="btn btn-danger btn-sm" data-cancel="${job.id}">Leave</button>` : ''}
      </div>
    </div>`;
}

/* ─── Summary availability badges (Tier 2) ───────────────────── */

function renderSummaryBadges(job) {
  const SUMMARY_KEYS = [
    { key: 'tldr',       label: 'TL;DR' },
    { key: 'bullets',    label: 'Bullets' },
    { key: 'storyArc',   label: 'Arc' },
    { key: 'ktDocument', label: 'KT' }
  ];

  const badges = SUMMARY_KEYS
    .filter(({ key }) => job.summaryArtifacts?.[key]?.localPath)
    .map(({ key, label }) => {
      const url = `/api/jobs/${job.id}/summaries/${key}/file`;
      const isKt = key === 'ktDocument';
      const gdocUrl = isKt ? (job.summaryArtifacts?.ktDocumentGoogleDoc?.docUrl || '') : '';
      if (gdocUrl) {
        return `<a href="${gdocUrl}" target="_blank" rel="noopener" class="summary-badge summary-badge-gdoc" title="Open KT Document in Google Docs">↗ Google Docs</a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener" class="summary-badge" title="${label}">${label}</a>`;
    });

  // Show in-progress summaries too
  const inProgress = Object.entries(job.summaryTasks || {})
    .filter(([, t]) => t?.status === 'running')
    .map(([key]) => {
      const pct = job.summaryTasks[key]?.progress || 0;
      const label = key === 'ktDocument' ? 'KT' : key === 'storyArc' ? 'Arc' : key === 'tldr' ? 'TL;DR' : 'Bullets';
      return `<span class="summary-badge summary-badge-running">${label} ${pct}%</span>`;
    });

  const all = [...badges, ...inProgress];
  return all.length ? `<div class="summary-badge-row">${all.join('')}</div>` : '';
}

/* ─── Job Card ────────────────────────────────────────────────── */

function renderJobCard(job) {
  const duration   = formatDuration(job.startedAt, job.endedAt);
  const isInactive = job.status === 'failed' || job.status === 'cancelled' || job.status === 'ended';
  const isRunning  = job.status === 'running' || job.status === 'cancelling';
  // Running jobs auto-expand; preserve user's manual toggle across re-renders
  const expanded = jobExpandedState.has(job.id) ? jobExpandedState.get(job.id) : isRunning;

  const meetCode   = (job.meetUrl || '').split('/').pop();
  const objective  = job.classifierConfig?.meetingObjective;
  // Tier 1 title: custom displayName > objective > meet code
  const cardTitle  = job.displayName || objective || meetCode || job.meetUrl;

  // ── Tier 1 primary action ──────────────────────────────────
  const primaryAction = isRunning
    ? `<button class="btn btn-danger btn-sm" data-cancel="${job.id}"><span class="spinner" style="display:none"></span>Leave</button>`
    : ['ended', 'failed', 'cancelled'].includes(job.status)
      ? `<button class="btn btn-ghost btn-sm card-action-secondary" data-rejoin="${job.id}" title="Rejoin and continue from last transcript">↩ Rejoin</button>`
      : '';

  // ── Tier 3 (drawer) contents ───────────────────────────────
  const classifierMeta = job.classifierConfig?.enabled
    ? `<div class="meta-item"><span class="meta-label">screenshots:</span> ${job.classifierConfig.model || 'on'}</div>`
    : '';

  const errorBlock = job.error
    ? `<div class="job-error">${job.error}</div>`
    : '';

  const drawerMeta = `
    <div class="job-meta">
      <div class="meta-item"><span class="meta-label">id:</span><span style="font-family:var(--font-mono);font-size:0.72rem">${job.id}</span></div>
      ${job.lastEvent ? `<div class="meta-item"><span class="meta-label">last event:</span> ${job.lastEvent}</div>` : ''}
      ${job.heartbeatAt ? `<div class="meta-item"><span class="meta-label">heartbeat:</span> ${relativeTime(job.heartbeatAt)}</div>` : ''}
      ${classifierMeta}
    </div>`;

  return `
    <div class="job-card job-card-v2 ${isRunning ? 'job-running' : ''} ${isInactive ? 'job-inactive' : ''} ${job.status === 'ended' ? 'job-ended' : ''}"
         data-job-id="${job.id}" data-expanded="${expanded}">

      <!-- Tier 1: Headline -->
      <div class="jc-headline">
        <div class="jc-headline-left">
          ${renderStatusDot(job)}
          <span class="jc-title" data-rename-job="${job.id}" title="Click to rename" style="cursor:pointer" tabindex="0">${cardTitle}</span>
        </div>
        <div class="jc-headline-right">
          ${duration ? `<span class="jc-duration">${duration}</span>` : ''}
          <span data-status-badge="${job.id}" title="Click to change status" style="cursor:pointer">${renderStatusBadge(job.status)}</span>
          ${primaryAction}
          <button class="jc-expand-btn" data-toggle-card="${job.id}" title="Show / hide details" aria-label="Toggle details">
            <svg class="jc-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Tier 2: Key details (always visible) -->
      <div class="jc-details">
        <div class="jc-details-row">
          <a href="${job.meetUrl}" class="jc-meet-link" target="_blank" rel="noopener" title="${job.meetUrl}">${meetCode}</a>
          <span class="jc-created">${relativeTime(job.createdAt)}</span>
          ${objective && meetCode !== cardTitle ? `<span class="jc-objective">${objective}</span>` : ''}
        </div>
        ${renderSummaryBadges(job)}
        ${errorBlock}
      </div>

      <!-- Tier 3: Drawer (collapsed by default) -->
      <div class="jc-drawer" ${expanded ? '' : 'hidden'}>
        ${renderHealthChecks(job)}
        ${renderArtifactLinks(job)}
        ${renderSummarySection(job)}
        ${drawerMeta}
        <div class="jc-drawer-footer">
          <button class="btn btn-ghost btn-sm" data-filterjob="${job.id}">Events</button>
          <a href="/api/jobs/${job.id}/live-transcript" target="_blank" rel="noopener"
             class="btn btn-ghost btn-sm">Transcript</a>
        </div>
      </div>
    </div>`;
}

/* ─── Stats ───────────────────────────────────────────────────── */

function renderStats(jobs) {
  const counts = { total: jobs.length, running: 0, completed: 0, pending: 0, failed: 0 };
  for (const job of jobs) {
    if (job.status === 'running' || job.status === 'cancelling') counts.running++;
    else if (job.status === 'completed')                          counts.completed++;
    else if (job.status === 'pending' || job.status === 'scheduled') counts.pending++;
    else if (job.status === 'ended')                                 counts.completed++;
    else if (job.status === 'failed' || job.status === 'cancelled')  counts.failed++;
  }
  document.getElementById('statTotal').textContent     = counts.total;
  document.getElementById('statRunning').textContent   = counts.running;
  document.getElementById('statCompleted').textContent = counts.completed;
  document.getElementById('statPending').textContent   = counts.pending;
  document.getElementById('statFailed').textContent    = counts.failed;
}

/* ─── Render Jobs ─────────────────────────────────────────────── */

function renderJobs(jobs) {
  const root       = document.getElementById('jobs');
  const hideFailed = document.getElementById('hideFailedJobs')?.checked !== false;
  const searchQ    = (document.getElementById('fleetSearch')?.value || '').trim().toLowerCase();

  const matchesSearch = (j) => {
    if (!searchQ) return true;
    const haystack = [j.meetUrl, j.status, j.id, j.displayName, j.classifierConfig?.meetingObjective, j.lastEvent].join(' ').toLowerCase();
    return haystack.includes(searchQ);
  };

  const visible = jobs.filter(j => {
    if (hideFailed && (j.status === 'failed' || j.status === 'cancelled')) return false;
    return matchesSearch(j);
  });
  // 'ended' (user-left) and 'completed' are always shown — they are past meetings.

  if (!visible.length) {
    const hiddenCount = jobs.length - visible.length;
    const hiddenMsg = hiddenCount > 0
      ? `<p class="muted" style="margin-top:8px;font-size:0.82rem">${hiddenCount} past meeting${hiddenCount !== 1 ? 's' : ''} hidden by filter. <a href="#" id="showAllLink" style="color:var(--accent,#818cf8)">Show all</a></p>`
      : '';
    root.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect width="48" height="48" rx="12" stroke="currentColor" stroke-width="2"/>
          <circle cx="24" cy="24" r="7" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="24" r="3.5" stroke="currentColor" stroke-width="2"/>
          <circle cx="36" cy="24" r="3.5" stroke="currentColor" stroke-width="2"/>
          <circle cx="24" cy="12" r="3.5" stroke="currentColor" stroke-width="2"/>
          <circle cx="24" cy="36" r="3.5" stroke="currentColor" stroke-width="2"/>
        </svg>
        <p>${hiddenCount > 0 ? 'All meetings are hidden by the current filter.' : 'No bots deployed yet.<br>Head to <strong>New Meeting</strong> to send Witness into a call.'}</p>
        ${hiddenMsg}
      </div>`;
    if (hiddenCount > 0) {
      root.querySelector('#showAllLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = document.getElementById('hideFailedJobs');
        if (cb) { cb.checked = false; refresh(); }
      });
    }
    return;
  }

  const sorted = [...visible].sort((a, b) => {
    const aTs = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const bTs = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return bTs - aTs;
  });

  root.className = viewMode === 'list' ? 'jobs-list' : 'jobs-grid';
  root.innerHTML = sorted.map(j => viewMode === 'list' ? renderJobRow(j) : renderJobCard(j)).join('');

  // Expand / collapse card drawer
  root.querySelectorAll('[data-rename-job]').forEach(titleEl => {
    const id = titleEl.getAttribute('data-rename-job');
    const startEdit = () => {
      if (titleEl.querySelector('input')) return; // already editing
      const current = titleEl.textContent.trim();
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.className = 'input';
      input.style.cssText = 'width:100%;min-width:180px;padding:2px 6px;font-size:inherit;font-weight:inherit';
      input.maxLength = 200;
      titleEl.textContent = '';
      titleEl.appendChild(input);
      input.focus();
      input.select();

      const save = async () => {
        const newName = input.value.trim();
        titleEl.removeChild(input);
        titleEl.textContent = newName || current;
        if (newName && newName !== current) {
          try {
            await fetch(`/api/jobs/${id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ displayName: newName })
            });
          } catch (_e) {
            // non-fatal; in-memory already updated
          }
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
      });
      input.addEventListener('blur', save, { once: true });
    };

    titleEl.addEventListener('click', startEdit);
    titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(); });
  });

  root.querySelectorAll('[data-s3-open]').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const key = decodeURIComponent(link.getAttribute('data-s3-open'));
      link.textContent = '…';
      try {
        const res = await fetch(`/api/s3/presign?key=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error('Presign failed');
        const { url } = await res.json();
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        showToast('Could not generate S3 link: ' + err.message, 'error');
      } finally {
        link.textContent = '↗ ' + (link.getAttribute('data-s3-open').includes('state') ? 'state (s3)' : link.getAttribute('data-s3-open').includes('live') ? 'transcript (s3)' : 'file');
      }
    });
  });

  root.querySelectorAll('[data-status-badge]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.querySelector('.status-picker')) return;
      const id = el.getAttribute('data-status-badge');
      const options = ['ended', 'completed', 'failed', 'cancelled'];
      const picker = document.createElement('div');
      picker.className = 'status-picker';
      picker.style.cssText = 'position:absolute;z-index:99;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:4px;display:flex;flex-direction:column;gap:2px;min-width:100px';
      options.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm';
        btn.style.cssText = 'text-align:left;font-size:0.78rem;padding:3px 8px';
        btn.textContent = s;
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          picker.remove();
          try {
            const res = await fetch(`/api/jobs/${id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ status: s })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
          } catch (err) {
            showToast(err.message, 'error');
          }
          await refresh();
        });
        picker.appendChild(btn);
      });
      el.style.position = 'relative';
      el.appendChild(picker);
      const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', close); } };
      setTimeout(() => document.addEventListener('click', close), 0);
    });
  });

  root.querySelectorAll('button[data-toggle-card]').forEach(btn => {
    const id   = btn.getAttribute('data-toggle-card');
    const card = root.querySelector(`[data-job-id="${id}"]`);
    // Apply initial chevron rotation from persisted state
    if (card?.getAttribute('data-expanded') === 'true') {
      const chevron = card.querySelector('.jc-chevron');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
    btn.addEventListener('click', () => {
      if (!card) return;
      const drawer  = card.querySelector('.jc-drawer');
      const chevron = card.querySelector('.jc-chevron');
      const isOpen  = card.getAttribute('data-expanded') === 'true';
      const next = !isOpen;
      card.setAttribute('data-expanded', String(next));
      jobExpandedState.set(id, next);   // persist across re-renders
      drawer.hidden  = isOpen;
      if (chevron) chevron.style.transform = next ? 'rotate(180deg)' : '';
    });
  });

  root.querySelectorAll('button[data-cancel]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cancel');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Leaving…';
      const res = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Could not leave meeting', 'error');
      }
      await refresh();
    });
  });

  root.querySelectorAll('button[data-filterjob]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-filterjob');
      document.getElementById('eventJobFilter').value = id;
      switchTab('event-log');
      refresh();
    });
  });

  root.querySelectorAll('button[data-rejoin]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-rejoin');
      const priorJob = latestJobsCache?.find(j => j.id === id);
      if (!priorJob) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Rejoining…';
      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ meetUrl: priorJob.meetUrl, resumeFromJobId: id, displayName: priorJob.displayName || '' })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to rejoin');
        }
        showToast(`Rejoining meeting, continuing from prior transcript…`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        await refresh();
      }
    });
  });

  root.querySelectorAll('button[data-cancel-summary]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [id, type] = btn.getAttribute('data-cancel-summary').split(':');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/jobs/${id}/summaries/${type}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Could not cancel ${type}`);
        }
        showToast(`${type} generation cancelled`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        await refresh();
      }
    });
  });

  root.querySelectorAll('button[data-summary]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [id, type] = btn.getAttribute('data-summary').split(':');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/jobs/${id}/summaries/${type}`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed generating ${type}`);
        }
        showToast(`Generating ${type}…`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        await refresh();
      }
    });
  });

  root.querySelectorAll('button[data-summary-incremental]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [id, type] = btn.getAttribute('data-summary-incremental').split(':');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/jobs/${id}/summaries/${type}?incremental=true`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed appending ${type}`);
        }
        showToast(`Appending new bullets…`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        await refresh();
      }
    });
  });

  root.querySelectorAll('button[data-gdocs-retry]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-gdocs-retry');
      btn.disabled = true;
      btn.textContent = 'Retrying…';
      try {
        const res = await fetch(`/api/jobs/${id}/gdocs-retry`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create Google Doc');
        }
        showToast('Creating Google Doc…', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        await refresh();
      }
    });
  });
}

/* ─── Event Log ───────────────────────────────────────────────── */

const SUCCESS_EVENTS = new Set([
  'completed', 'checkpoint_uploaded', 'batch_analyzed', 'joined',
  'local_output_written', 'final_upload_complete', 'summary_generated',
  'gdocs_created'
]);
const DANGER_EVENTS  = new Set(['failed', 'summary_failed', 'gdocs_failed']);
const WARNING_EVENTS = new Set(['cancelling', 'cancelled']);
const ACCENT_EVENTS  = new Set(['summarizing', 'summary_progress', 'summary_running', 'capturing']);

function eventClass(name) {
  if (SUCCESS_EVENTS.has(name)) return 'ev-success';
  if (DANGER_EVENTS.has(name))  return 'ev-danger';
  if (WARNING_EVENTS.has(name)) return 'ev-warning';
  if (ACCENT_EVENTS.has(name))  return 'ev-accent';
  return '';
}

function renderEventPanel(jobs) {
  const root       = document.getElementById('events');
  const jobFilter  = (document.getElementById('eventJobFilter')?.value  || '').trim().toLowerCase();
  const textFilter = (document.getElementById('eventTextFilter')?.value || '').trim().toLowerCase();

  // When a job filter is active, only collect events from matching jobs to prevent
  // background-task events from other jobs leaking through between render cycles.
  const sourceJobs = jobFilter
    ? jobs.filter(j => j.id.toLowerCase().includes(jobFilter))
    : jobs;

  const lines = [];
  sourceJobs.forEach(job => {
    (job.recentEvents || []).forEach(ev => {
      lines.push({ ts: ev.ts, jobId: job.id, event: ev.event, data: ev.payload || null });
    });
  });
  lines.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const filtered = lines.filter(line => {
    const jobOk  = !jobFilter  || line.jobId.toLowerCase().includes(jobFilter);
    const textOk = !textFilter || line.event.toLowerCase().includes(textFilter);
    return jobOk && textOk;
  });

  if (!filtered.length) {
    root.innerHTML = '<div class="empty-state" style="padding:32px"><p>No events match the current filters.</p></div>';
    return;
  }

  const visible  = filtered.slice(0, 120);
  const copyText = visible
    .map(l => `${l.ts} ${l.jobId} :: ${l.event}${l.data ? ' ' + JSON.stringify(l.data) : ''}`)
    .join('\n');
  root.setAttribute('data-copy-text', copyText);

  // Events that should show inline detail from their payload.
  const DETAIL_EVENTS = new Set([
    'summary_failed', 'summary_generated', 'summary_plan',
    'analysis_error', 'analysis_quota_exceeded',
    'meta_summary_error', 'screenshot_classifier_error',
    'gdocs_created', 'gdocs_failed',
    'failed', 'leave_warning'
  ]);

  root.innerHTML = visible.map(line => {
    const shortId = line.jobId.length > 26 ? '…' + line.jobId.slice(-18) : line.jobId;
    let detail = '';
    if (DETAIL_EVENTS.has(line.event) && line.data) {
      const msg = line.data.error || line.data.type || line.data.docUrl || '';
      if (msg) {
        const safe = String(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        detail = `<span class="event-detail" title="${safe}">${safe}</span>`;
      }
    }
    return `
      <div class="event-line">
        <span class="event-ts"  title="${line.ts}">${relativeTime(line.ts)}</span>
        <span class="event-job" title="${line.jobId}">${shortId}</span>
        <span class="event-last"><span class="event-type ${eventClass(line.event)}">${line.event}</span>${detail}</span>
      </div>`;
  }).join('');
}

/* ─── Config ──────────────────────────────────────────────────── */

const MODEL_OPTIONS = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'gpt-5.4-nano',
  'gpt-5.4-mini',
  'gpt-5.4'
];

const KT_MODEL_OPTIONS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview'
];

const ALL_MODEL_OPTIONS = [
  ...MODEL_OPTIONS,
  ...KT_MODEL_OPTIONS
];

function setModelOptions(selectId, currentValue, options = MODEL_OPTIONS) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = options
    .map(v => `<option value="${v}">${v}</option>`)
    .join('');
  if (options.includes(currentValue)) select.value = currentValue;
}

async function loadConfigIntoForm() {
  const cfg = await fetchConfig();
  document.getElementById('liveEnableScreenshotClassifier').checked = Boolean(cfg.enableScreenshotClassifier);
  document.getElementById('liveMeetingObjective').value             = cfg.meetingObjective ?? '';
  document.getElementById('cfgTechnicalMode').checked              = Boolean(cfg.technicalMode);
  document.getElementById('cfgForceGoogleSignIn').checked          = Boolean(cfg.forceGoogleSignIn);
  document.getElementById('cfgCaptureInterval').value              = cfg.captureIntervalSec ?? 10;
  document.getElementById('cfgBatchSize').value                    = cfg.batchSize ?? 6;
  document.getElementById('cfgScreenshotQuality').value            = cfg.screenshotQuality ?? 50;
  document.getElementById('cfgArtifactUploadEndpoint').value       = cfg.artifactUploadEndpoint ?? '';
  document.getElementById('cfgGuestName').value                    = cfg.guestName ?? 'Witness';
  setModelOptions('cfgAnalysisModel',            cfg.analysisModel ?? '');
  setModelOptions('cfgSummaryModel',             cfg.summaryModel ?? '');
  setModelOptions('cfgTldrModel',                cfg.tldrModel ?? '');
  setModelOptions('cfgArcModel',                 cfg.arcModel ?? '');
  setModelOptions('cfgBulletsModel',             cfg.bulletsModel ?? '');
  setModelOptions('cfgScreenshotClassifierModel', cfg.screenshotClassifierModel ?? '');
  setModelOptions('cfgKtModel', cfg.ktModel ?? 'gemini-3.1-pro-preview', KT_MODEL_OPTIONS);
  customSummarizersState = Array.isArray(cfg.customSummarizers) ? cfg.customSummarizers : [];
  renderCustomSummarizersEditor();
  const botEmailEl = document.getElementById('botEmailHint');
  if (botEmailEl) botEmailEl.textContent = cfg.googleEmail || 'not configured (set GOOGLE_EMAIL)';
  // Capture mode
  const captureMode = cfg.captureMode || 'puppeteer';
  document.getElementById('cfgCaptureMode').value = captureMode;
  document.getElementById('cfgTranscriptionMode').value = cfg.transcriptionMode || 'none';
  updateMediaApiConnectionStatus();
  document.getElementById('cfgDeepgramApiKey').value = cfg.deepgramApiKey ?? '';
  document.getElementById('mediaApiSettings').style.display = captureMode === 'media-api' ? 'block' : 'none';

  document.getElementById('cfgEnableMetaAnalysis').checked   = Boolean(cfg.enableMetaAnalysis);
  document.getElementById('cfgMetaAnalysisInterval').value  = cfg.metaAnalysisInterval ?? 5;
  document.getElementById('cfgMetaAnalysisWindow').value    = cfg.metaAnalysisWindow ?? 5;
}

function collectConfigFromForm() {
  const rawQuality = Number(document.getElementById('cfgScreenshotQuality').value);
  return {
    technicalMode:              document.getElementById('cfgTechnicalMode').checked,
    forceGoogleSignIn:          document.getElementById('cfgForceGoogleSignIn').checked,
    captureIntervalSec:         Number(document.getElementById('cfgCaptureInterval').value),
    batchSize:                  Number(document.getElementById('cfgBatchSize').value),
    screenshotQuality:          Math.max(5, Math.min(100, Math.round(rawQuality / 5) * 5)),
    artifactUploadEndpoint:     document.getElementById('cfgArtifactUploadEndpoint').value.trim(),
    guestName:                  document.getElementById('cfgGuestName').value.trim(),
    analysisModel:              document.getElementById('cfgAnalysisModel').value,
    summaryModel:               document.getElementById('cfgSummaryModel').value,
    tldrModel:                  document.getElementById('cfgTldrModel').value,
    arcModel:                   document.getElementById('cfgArcModel').value,
    bulletsModel:               document.getElementById('cfgBulletsModel').value,
    screenshotClassifierModel:  document.getElementById('cfgScreenshotClassifierModel').value,
    ktModel:                    document.getElementById('cfgKtModel').value,
    enableMetaAnalysis:         document.getElementById('cfgEnableMetaAnalysis').checked,
    metaAnalysisInterval:       Number(document.getElementById('cfgMetaAnalysisInterval').value),
    metaAnalysisWindow:         Number(document.getElementById('cfgMetaAnalysisWindow').value),
    captureMode:                document.getElementById('cfgCaptureMode').value,
    transcriptionMode:          document.getElementById('cfgTranscriptionMode').value,
    deepgramApiKey:             document.getElementById('cfgDeepgramApiKey').value.trim(),
    customSummarizers:          collectCustomSummarizers()
  };
}

/* ─── Custom Summarizers Editor ──────────────────────────────── */

let customSummarizersState = [];

function slugify(name) {
  return (name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'custom';
}

function renderCustomSummarizersEditor() {
  const root = document.getElementById('customSummarizersEditor');
  if (!root) return;
  if (!customSummarizersState.length) {
    root.innerHTML = '<p class="muted" style="font-size:0.82rem">No custom summarizers yet.</p>';
    return;
  }
  root.innerHTML = customSummarizersState.map((s, idx) => `
    <div class="custom-summarizer-row" data-idx="${idx}">
      <div class="form-row" style="align-items:flex-start;gap:var(--sp-3)">
        <div class="form-group" style="flex:1">
          <label>Name</label>
          <input class="input cs-name" value="${(s.name || '').replace(/"/g, '&quot;')}" placeholder="Meeting Notes">
        </div>
        <div class="form-group" style="flex:0 0 160px">
          <label>Model</label>
          <select class="select cs-model">${ALL_MODEL_OPTIONS.map(m => `<option value="${m}" ${m === s.model ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </div>
        <div class="form-group" style="flex:0 0 130px">
          <label>Screenshots</label>
          <select class="select cs-screenshots">
            <option value="none" ${s.includeScreenshots === 'none' ? 'selected' : ''}>None</option>
            <option value="urls" ${s.includeScreenshots === 'urls' ? 'selected' : ''}>URLs in transcript</option>
            <option value="vision" ${s.includeScreenshots === 'vision' ? 'selected' : ''}>Vision (images)</option>
          </select>
        </div>
        <div class="form-group" style="flex:0 0 auto;padding-top:1.6rem">
          <label class="toggle-label"><input type="checkbox" class="cs-markdown" ${s.isMarkdown ? 'checked' : ''}><span>Markdown</span></label>
        </div>
        <div class="form-group" style="flex:0 0 auto;padding-top:1.6rem">
          <label class="toggle-label"><input type="checkbox" class="cs-enabled" ${s.enabled !== false ? 'checked' : ''}><span>Enabled</span></label>
        </div>
        <div class="form-group" style="flex:0 0 auto;padding-top:1.6rem">
          <button class="btn btn-danger btn-sm cs-delete" data-idx="${idx}">Delete</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--sp-2)">
        <label>System prompt</label>
        <textarea class="input cs-prompt" rows="4" style="width:100%;font-family:var(--font-mono);font-size:0.82rem">${(s.prompt || '').replace(/</g, '&lt;')}</textarea>
      </div>
    </div>
  `).join('<hr style="border-color:var(--border);margin:var(--sp-3) 0">');

  root.querySelectorAll('.cs-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      customSummarizersState.splice(idx, 1);
      renderCustomSummarizersEditor();
    });
  });
}

function collectCustomSummarizers() {
  const rows = document.querySelectorAll('.custom-summarizer-row');
  return Array.from(rows).map((row, idx) => {
    const name = row.querySelector('.cs-name')?.value?.trim() || `Custom ${idx + 1}`;
    return {
      id: customSummarizersState[idx]?.id || slugify(name),
      name,
      model: row.querySelector('.cs-model')?.value || 'claude-sonnet-4-6',
      prompt: row.querySelector('.cs-prompt')?.value || '',
      includeScreenshots: row.querySelector('.cs-screenshots')?.value || 'none',
      isMarkdown: row.querySelector('.cs-markdown')?.checked || false,
      enabled: row.querySelector('.cs-enabled')?.checked !== false
    };
  });
}

/* ─── Health Check ────────────────────────────────────────────── */

async function checkHealth() {
  const dot   = document.getElementById('healthDot');
  const label = document.getElementById('healthLabel');
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      dot.className   = 'health-dot dot-ok';
      label.textContent = 'connected';
    } else {
      dot.className   = 'health-dot dot-error';
      label.textContent = 'error';
    }
  } catch {
    dot.className   = 'health-dot dot-error';
    label.textContent = 'offline';
  }
}

/* ─── Tab Switching ───────────────────────────────────────────── */

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('tab-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('tab-active', panel.dataset.panel === tabName);
  });
  try { localStorage.setItem('fleet-active-tab', tabName); } catch {}
}

/* ─── Refresh Loop ────────────────────────────────────────────── */

let lastRefreshAt = null;
let lastJobsHash = '';
let configLoaded = false;
let viewMode = 'grid'; // 'grid' | 'list'
let latestJobsCache = [];
const jobExpandedState = new Map(); // persists expand/collapse across re-renders

async function refresh() {
  // Load config before rendering jobs so custom summarizers are available.
  if (!configLoaded) {
    try {
      await loadConfigIntoForm();
      configLoaded = true;
    } catch (_err) {
      // Will retry next cycle.
    }
  }

  let jobs = [];
  try {
    jobs = await fetchJobs();
  } catch (_err) {
    return;
  }

  const filterState = document.getElementById('hideFailedJobs')?.checked;
  const searchQuery = (document.getElementById('fleetSearch')?.value || '').trim().toLowerCase();
  // Include custom summarizer count so that loading config triggers a re-render.
  const hash = JSON.stringify({ filter: filterState, view: viewMode, search: searchQuery, customCount: customSummarizersState.length, jobs: jobs.map(j => ({ id: j.id, status: j.status, lastEvent: j.lastEvent, updatedAt: j.updatedAt })) });
  const jobsChanged = hash !== lastJobsHash;
  lastJobsHash = hash;

  latestJobsCache = jobs;
  renderStats(jobs);
  if (jobsChanged) {
    renderJobs(jobs);
  }
  renderEventPanel(jobs);
  lastRefreshAt = Date.now();
}

/* ─── Objective Save (debounced) ──────────────────────────────── */

let objectiveSaveTimer = null;

function queueObjectiveSave() {
  if (objectiveSaveTimer) clearTimeout(objectiveSaveTimer);
  objectiveSaveTimer = setTimeout(async () => {
    objectiveSaveTimer = null;
    try {
      await saveConfig({
        enableScreenshotClassifier: document.getElementById('liveEnableScreenshotClassifier').checked,
        meetingObjective:           document.getElementById('liveMeetingObjective').value.trim()
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, 500);
}

/* ─── Event Listeners ─────────────────────────────────────────── */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('joinNow').addEventListener('click', async () => {
  const meetUrl      = document.getElementById('meetUrl').value.trim();
  const scheduledRaw = document.getElementById('scheduledAt').value;
  const body         = { meetUrl };
  if (scheduledRaw) body.scheduledAt = new Date(scheduledRaw).toISOString();

  const btn = document.getElementById('joinNow');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Joining…';

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create job');
    }
    showToast('Witness deployed. Joining meeting…', 'success');
    document.getElementById('meetUrl').value = '';
    switchTab('fleet');
    await refresh();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Join Meeting`;
  }
});

// Objective field animates in/out based on intelligent capture checkbox.
function syncObjectiveVisibility() {
  const on = document.getElementById('liveEnableScreenshotClassifier').checked;
  const section = document.getElementById('objectiveSection');
  section.classList.toggle('objective-expanded', on);
  section.classList.toggle('objective-collapsed', !on);
}
document.getElementById('liveEnableScreenshotClassifier').addEventListener('change', syncObjectiveVisibility);
syncObjectiveVisibility(); // apply initial state on load

document.getElementById('addCustomSummarizerBtn').addEventListener('click', () => {
  customSummarizersState.push({
    id: slugify('custom-' + Date.now()),
    name: '',
    model: 'claude-sonnet-4-6',
    prompt: '',
    includeScreenshots: 'none',
    isMarkdown: false,
    enabled: true
  });
  renderCustomSummarizersEditor();
});

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveConfigBtn');
  btn.disabled = true;
  try {
    await saveConfig(collectConfigFromForm());
    showToast('Configuration saved. New jobs will use updated settings.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('copyEventsBtn').addEventListener('click', async () => {
  const text = document.getElementById('events').getAttribute('data-copy-text') || '';
  if (!text.trim()) { showToast('No visible events to copy.', 'warning'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Events copied to clipboard', 'success');
  } catch {
    showToast('Could not access clipboard', 'error');
  }
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.getElementById('eventJobFilter').value  = '';
  document.getElementById('eventTextFilter').value = '';
  document.querySelectorAll('[data-preset]').forEach((btn) => btn.classList.remove('btn-active'));
  refresh();
});

document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.getAttribute('data-preset');
    const textInput = document.getElementById('eventTextFilter');
    const isActive = btn.classList.contains('btn-active');
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('btn-active'));
    if (isActive) {
      textInput.value = '';
    } else {
      textInput.value = preset;
      btn.classList.add('btn-active');
    }
    refresh();
  });
});

document.getElementById('cfgCaptureMode').addEventListener('change', () => {
  const isMediaApi = document.getElementById('cfgCaptureMode').value === 'media-api';
  document.getElementById('mediaApiSettings').style.display = isMediaApi ? 'block' : 'none';
  if (isMediaApi) updateMediaApiConnectionStatus();
});

// ── Meet Media API connect / disconnect ─────────────────────────────────────

let _mediaApiPollHandle = null;

async function updateMediaApiConnectionStatus() {
  try {
    const res = await fetch('/api/media-api/status');
    if (!res.ok) return;
    const { connected, hasCredentials } = await res.json();
    const statusEl = document.getElementById('mediaApiConnectionStatus');
    const connectBtn = document.getElementById('mediaApiConnectBtn');
    const disconnectBtn = document.getElementById('mediaApiDisconnectBtn');
    if (!statusEl) return;
    if (connected) {
      statusEl.innerHTML = '<span style="color:#31c46d">● Connected</span> — Google account authorized';
      connectBtn.textContent = 'Re-authorize';
      disconnectBtn.style.display = 'inline-block';
    } else if (!hasCredentials) {
      statusEl.innerHTML = '<span style="color:#e05c5c">● Not configured</span> — set MEDIA_API_CREDENTIALS_PATH in .env';
      connectBtn.disabled = true;
    } else {
      statusEl.innerHTML = '<span style="color:#f2c94c">● Not connected</span> — authorize your Google account';
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect Google Account';
      disconnectBtn.style.display = 'none';
    }
  } catch (_e) { /* server may be starting */ }
}

document.getElementById('mediaApiConnectBtn').addEventListener('click', async () => {
  const btn = document.getElementById('mediaApiConnectBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Opening authorization…';
  try {
    const res = await fetch('/api/media-api/connect', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'Failed to start OAuth flow', 'error');
      btn.disabled = false;
      btn.textContent = 'Connect Google Account';
      return;
    }
    const { authUrl } = await res.json();
    window.open(authUrl, '_blank', 'noopener,width=600,height=700');

    // Poll for completion
    btn.innerHTML = '<span class="spinner"></span>Waiting for authorization…';
    _mediaApiPollHandle = setInterval(async () => {
      const sr = await fetch('/api/media-api/status').then(r => r.json()).catch(() => ({}));
      if (sr.connected) {
        clearInterval(_mediaApiPollHandle);
        _mediaApiPollHandle = null;
        btn.disabled = false;
        btn.textContent = 'Re-authorize';
        showToast('Google account connected for Meet Media API', 'success');
        updateMediaApiConnectionStatus();
      }
    }, 2000);

    // Stop polling after 6 minutes regardless
    setTimeout(() => {
      if (_mediaApiPollHandle) {
        clearInterval(_mediaApiPollHandle);
        _mediaApiPollHandle = null;
        btn.disabled = false;
        btn.textContent = 'Connect Google Account';
      }
    }, 6 * 60 * 1000);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Connect Google Account';
  }
});

document.getElementById('mediaApiDisconnectBtn').addEventListener('click', async () => {
  // Clear the token from .env via config save with empty token indicator
  try {
    await fetch('/api/media-api/disconnect', { method: 'POST' });
  } catch (_e) {}
  showToast('Disconnected. Re-authorize to reconnect.', 'info');
  updateMediaApiConnectionStatus();
});

document.getElementById('hideFailedJobs').addEventListener('change', () => refresh());
document.getElementById('fleetSearch').addEventListener('input', () => refresh());
document.getElementById('eventJobFilter').addEventListener('input',  () => refresh());
document.getElementById('viewGrid').addEventListener('click', () => {
  viewMode = 'grid';
  document.getElementById('viewGrid').classList.add('view-btn-active');
  document.getElementById('viewList').classList.remove('view-btn-active');
  refresh();
});
document.getElementById('viewList').addEventListener('click', () => {
  viewMode = 'list';
  document.getElementById('viewList').classList.add('view-btn-active');
  document.getElementById('viewGrid').classList.remove('view-btn-active');
  refresh();
});
document.getElementById('eventTextFilter').addEventListener('input', () => {
  document.querySelectorAll('[data-preset]').forEach((btn) => btn.classList.remove('btn-active'));
  refresh();
});

/* ─── "Last refreshed" ticker ─────────────────────────────────── */

setInterval(() => {
  if (!lastRefreshAt) return;
  const sec = Math.floor((Date.now() - lastRefreshAt) / 1000);
  const el  = document.getElementById('refreshInfo');
  if (el) el.textContent = sec < 5 ? 'just refreshed' : `refreshed ${sec}s ago`;
}, 1000);

/* ─── Init ────────────────────────────────────────────────────── */

// Restore last active tab from localStorage
const savedTab = (() => { try { return localStorage.getItem('fleet-active-tab'); } catch { return null; } })();
if (savedTab) switchTab(savedTab);

checkHealth();
loadConfigIntoForm().then(() => { configLoaded = true; }).catch(() => { configLoaded = false; });
refresh();
setInterval(refresh,      3000);
setInterval(checkHealth, 15000);
