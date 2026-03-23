/* app-claude.js — Meet Fleet Dashboard by Claude Sonnet */

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

function renderArtifactLinks(job) {
  const links = [];

  (job.latestCheckpointLinks || []).forEach(file => {
    const name = (file.name || '').toLowerCase();
    let label = 'checkpoint';
    if (name.includes('live') && name.endsWith('.txt')) label = 'transcript (s3)';
    else if (name.includes('state') && name.endsWith('.json')) label = 'state (s3)';
    links.push(`<a href="${file.url}" target="_blank" rel="noopener" class="artifact-link">↗ ${label}</a>`);
  });

  (job.finalLinks || []).forEach(file => {
    links.push(`<a href="${file.url}" target="_blank" rel="noopener" class="artifact-link">↗ ${file.name}</a>`);
  });

  return links.length ? `<div class="artifact-section">${links.join('')}</div>` : '';
}

/* ─── Summary Section ─────────────────────────────────────────── */

function renderSummarySection(job) {
  const types = [
    { key: 'tldr',       label: 'TL;DR' },
    { key: 'bullets',    label: 'Bullets' },
    { key: 'storyArc',   label: 'Story Arc' }
  ];

  // KT Document only available when intelligent screenshot capture was enabled for this job.
  if (job.classifierConfig?.enabled) {
    types.push({ key: 'ktDocument', label: 'KT Document', isMarkdown: true });
  }

  const items = types.map(({ key, label, isMarkdown }) => {
    const task    = job.summaryTasks?.[key] || {};
    const status  = task.status || 'idle';
    const pct     = Number.isFinite(task.progress) ? task.progress : 0;
    const ready   = Boolean(job.summaryArtifacts?.[key]?.localPath);
    const fileUrl = ready ? `/api/jobs/${job.id}/summaries/${key}/file` : '';
    const running = status === 'running';
    const mr      = task.mode === 'map_reduce';

    const alreadyDone = ready && !running;
    const btnLabel = running
      ? `<span class="spinner"></span>${label} (${pct}%) ✕`
      : alreadyDone
        ? `↺ Regenerate ${label}`
        : `${label}${mr ? ' ↻' : ''}`;

    const progressBar = running
      ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`
      : '';

    // Markdown files open inline; add download link too.
    const fileLink = ready
      ? `<a href="${fileUrl}" target="_blank" rel="noopener" class="btn-link">↗ ${label} file${isMarkdown ? ' (.md)' : ''}</a>`
      : '';

    // Google Doc link / status — driven by job.gdocsStatus set in job-manager.
    let gdocLink = '';
    if (key === 'ktDocument') {
      const gdocUrl   = job.summaryArtifacts?.ktDocumentGoogleDoc?.docUrl || '';
      const gdocState = job.gdocsStatus || (ready ? 'idle' : '');
      const gdocError = job.gdocsError || '';

      if (gdocUrl) {
        const shareNote = job.summaryArtifacts?.ktDocumentGoogleDoc?.sharedPublicly === false
          ? ' (shared with you)' : '';
        gdocLink = `<a href="${gdocUrl}" target="_blank" rel="noopener" class="btn-link" style="color:#4285f4">↗ Open in Google Docs${shareNote}</a>
          <button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}" style="font-size:0.78em;padding:2px 8px;margin-left:4px" title="Regenerate Google Doc from latest .md file">↺ Regenerate</button>`;
      } else if (gdocState === 'creating') {
        gdocLink = `<span class="muted" style="font-size:0.82em"><span class="spinner" style="width:10px;height:10px;margin-right:4px"></span>Creating Google Doc…</span>`;
      } else if (gdocState === 'failed') {
        const errShort = gdocError ? gdocError.slice(0, 80) : 'unknown error';
        gdocLink = `<span class="muted" style="font-size:0.82em;color:var(--danger)" title="${gdocError.replace(/"/g, '&quot;')}">✕ Google Doc failed: ${errShort}</span>
          <button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}" style="font-size:0.78em;padding:2px 8px;margin-left:4px">Retry</button>`;
      } else if (ready && gdocState === 'idle') {
        gdocLink = `<button class="btn btn-ghost btn-sm" data-gdocs-retry="${job.id}" style="font-size:0.78em;padding:2px 8px">Create Google Doc</button>`;
      }
    }

    const btnClass = key === 'ktDocument' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
    const dataAttr = running ? `data-cancel-summary="${job.id}:${key}"` : `data-summary="${job.id}:${key}"`;

    return `
      <div class="summary-action-item">
        <button class="${btnClass}" ${dataAttr}>
          ${btnLabel}
        </button>
        ${progressBar}
        ${fileLink}
        ${gdocLink}
      </div>`;
  }).join('');

  return `
    <div class="summary-section">
      <div class="summary-label">Summaries</div>
      <div class="summary-actions">${items}</div>
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

/* ─── Job Card ────────────────────────────────────────────────── */

function renderJobCard(job) {
  const duration = formatDuration(job.startedAt, job.endedAt);
  const isInactive = job.status === 'failed' || job.status === 'cancelled' || job.status === 'ended';

  const classifierLine = job.classifierConfig?.enabled
    ? `<div class="meta-item">
         <span class="meta-label">📸 screenshots:</span>
         ${job.classifierConfig.model || 'on'}
       </div>
       ${job.classifierConfig.meetingObjective ? `<div class="meta-item"><span class="meta-label">objective:</span> ${job.classifierConfig.meetingObjective}</div>` : ''}`
    : '';

  const errorBlock = job.error
    ? `<div class="job-error">${job.error}</div>`
    : '';

  const leaveBtn = (job.status === 'running' || job.status === 'cancelling')
    ? `<button class="btn btn-danger btn-sm" data-cancel="${job.id}">Leave meeting</button>`
    : '';

  return `
    <div class="job-card ${job.status === 'running' ? 'job-running' : ''} ${isInactive ? 'job-inactive' : ''}"
         data-job-id="${job.id}">

      <div class="job-card-header">
        <div class="job-status-group">
          ${renderStatusDot(job)}
          ${renderStatusBadge(job.status)}
        </div>
        <span class="job-id" title="${job.id}">${job.id}</span>
      </div>

      <a href="${job.meetUrl}" class="job-meet-url" target="_blank" rel="noopener"
         title="${job.meetUrl}">${job.meetUrl}</a>

      <div class="job-meta">
        ${duration ? `<div class="meta-item"><span class="meta-label">duration:</span> ${duration}</div>` : ''}
        <div class="meta-item"><span class="meta-label">created:</span> ${relativeTime(job.createdAt)}</div>
        ${job.lastEvent ? `<div class="meta-item"><span class="meta-label">last:</span> ${job.lastEvent}</div>` : ''}
        ${job.heartbeatAt ? `<div class="meta-item"><span class="meta-label">heartbeat:</span> ${relativeTime(job.heartbeatAt)}</div>` : ''}
        ${classifierLine}
      </div>

      ${renderHealthChecks(job)}
      ${errorBlock}
      ${renderArtifactLinks(job)}
      ${renderSummarySection(job)}

      <div class="job-card-footer">
        <button class="btn btn-ghost btn-sm" data-filterjob="${job.id}">Filter events</button>
        <a href="/api/jobs/${job.id}/live-transcript" target="_blank" rel="noopener"
           class="btn btn-ghost btn-sm">Live transcript</a>
        ${leaveBtn}
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
    const haystack = [j.meetUrl, j.status, j.id, j.classifierConfig?.meetingObjective, j.lastEvent].join(' ').toLowerCase();
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
        <p>${hiddenCount > 0 ? 'All meetings are hidden by the current filter.' : 'No bots in the fleet yet.<br>Head to <strong>New Meeting</strong> to deploy one.'}</p>
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

  const lines = [];
  jobs.forEach(job => {
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
  document.getElementById('cfgGuestName').value                    = cfg.guestName ?? 'Meet Bot';
  setModelOptions('cfgAnalysisModel',            cfg.analysisModel ?? '');
  setModelOptions('cfgSummaryModel',             cfg.summaryModel ?? '');
  setModelOptions('cfgTldrModel',                cfg.tldrModel ?? '');
  setModelOptions('cfgArcModel',                 cfg.arcModel ?? '');
  setModelOptions('cfgBulletsModel',             cfg.bulletsModel ?? '');
  setModelOptions('cfgScreenshotClassifierModel', cfg.screenshotClassifierModel ?? '');
  setModelOptions('cfgKtModel', cfg.ktModel ?? 'gemini-3.1-pro-preview', KT_MODEL_OPTIONS);
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
    metaAnalysisWindow:         Number(document.getElementById('cfgMetaAnalysisWindow').value)
  };
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

async function refresh() {
  let jobs = [];
  try {
    jobs = await fetchJobs();
  } catch (_err) {
    return;
  }

  const filterState = document.getElementById('hideFailedJobs')?.checked;
  const searchQuery = (document.getElementById('fleetSearch')?.value || '').trim().toLowerCase();
  const hash = JSON.stringify({ filter: filterState, view: viewMode, search: searchQuery, jobs: jobs.map(j => ({ id: j.id, status: j.status, lastEvent: j.lastEvent, updatedAt: j.updatedAt })) });
  const jobsChanged = hash !== lastJobsHash;
  lastJobsHash = hash;

  renderStats(jobs);
  if (jobsChanged) {
    renderJobs(jobs);
  }
  renderEventPanel(jobs);
  lastRefreshAt = Date.now();

  // Re-attempt config load if server was down on initial page load.
  if (!configLoaded) {
    try {
      await loadConfigIntoForm();
      configLoaded = true;
    } catch (_err) {
      // Will retry next cycle.
    }
  }
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
    showToast('Bot deployed! Joining meeting…', 'success');
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

document.getElementById('saveObjectiveBtn').addEventListener('click', async () => {
  try {
    await saveConfig({
      enableScreenshotClassifier: document.getElementById('liveEnableScreenshotClassifier').checked,
      meetingObjective:           document.getElementById('liveMeetingObjective').value.trim()
    });
    showToast('Objective saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('liveEnableScreenshotClassifier').addEventListener('change', queueObjectiveSave);
document.getElementById('liveMeetingObjective').addEventListener('input', queueObjectiveSave);

document.getElementById('showScheduleToggle').addEventListener('change', function () {
  document.getElementById('scheduleSection').style.display = this.checked ? 'block' : 'none';
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
