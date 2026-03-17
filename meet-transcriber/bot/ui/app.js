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

let objectiveSaveTimer = null;

function queueObjectiveSave() {
  if (objectiveSaveTimer) {
    clearTimeout(objectiveSaveTimer);
  }
  objectiveSaveTimer = setTimeout(async () => {
    objectiveSaveTimer = null;
    try {
      await saveConfig({
        enableScreenshotClassifier: document.getElementById('liveEnableScreenshotClassifier').checked,
        meetingObjective: document.getElementById('liveMeetingObjective').value.trim()
      });
    } catch (error) {
      alert(error.message);
    }
  }, 500);
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt) return 'n/a';
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const start = new Date(startedAt).getTime();
  const totalSec = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(ts) {
  if (!ts) return 'n/a';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function getSetupChecks(job) {
  const joined = (job.recentEvents || []).find((event) => event.event === 'joined');
  const av = joined?.payload?.avState || {};
  const hasAny = Boolean(joined?.payload?.avState) || typeof joined?.payload?.captionsOn === 'boolean';
  const captionsOn = Boolean(joined?.payload?.captionsOn);
  return {
    hasAny,
    micOff: Boolean(av.micOff),
    camOff: Boolean(av.camOff),
    captionsOn
  };
}

function getHealthBadge(job) {
  const checks = getSetupChecks(job);
  const checksDone = checks.micOff && checks.camOff && checks.captionsOn;
  const activeEvents = new Set([
    'capturing',
    'batch_processing',
    'batch_analyzed',
    'checkpoint_uploaded',
    'summarizing',
    'summary_progress'
  ]);
  const setupEvents = new Set(['starting', 'joining', 'joined']);

  if (job.status === 'running') {
    if (activeEvents.has(job.lastEvent)) return { dot: '#31c46d', label: 'active' };
    if (checksDone) return { dot: '#31c46d', label: 'active' };
    if (setupEvents.has(job.lastEvent)) return { dot: '#f2c94c', label: 'setting up' };
    return { dot: '#31c46d', label: 'active' };
  }
  if (job.status === 'pending' || job.status === 'scheduled' || job.status === 'cancelling') {
    return { dot: '#f2c94c', label: job.status };
  }
  return { dot: '#e05c5c', label: job.status || 'inactive' };
}

function renderArtifactLink(file, kind) {
  const name = (file.name || '').toLowerCase();
  if (kind === 'checkpoint') {
    if (name.includes('live') && name.endsWith('.txt')) {
      return `<a href="${file.url}" target="_blank" rel="noopener">checkpoint transcript (s3 txt)</a>`;
    }
    if (name.includes('state') && name.endsWith('.json')) {
      return `<a href="${file.url}" target="_blank" rel="noopener">checkpoint state (s3 json)</a>`;
    }
    return `<a href="${file.url}" target="_blank" rel="noopener">checkpoint:${file.name}</a>`;
  }
  return `<a href="${file.url}" target="_blank" rel="noopener">final:${file.name}</a>`;
}

function renderJobs(jobs) {
  const root = document.getElementById('jobs');
  const hideFailed = document.getElementById('hideFailedJobs')?.checked !== false;
  const visibleJobs = hideFailed
    ? jobs.filter((job) => job.status !== 'failed' && job.status !== 'cancelled')
    : jobs;

  if (!visibleJobs.length) {
    root.innerHTML = '<div class="muted">No jobs yet.</div>';
    return;
  }

  const sortedJobs = [...visibleJobs].sort((a, b) => {
    const aTs = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const bTs = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return bTs - aTs;
  });

  root.innerHTML = sortedJobs.map((job) => {
    const health = getHealthBadge(job);
    const checks = getSetupChecks(job);
    const checkpointLinks = (job.latestCheckpointLinks || [])
      .map((file) => renderArtifactLink(file, 'checkpoint'))
      .join('');
    const finalLinks = (job.finalLinks || [])
      .map((file) => renderArtifactLink(file, 'final'))
      .join('');

    const summaryActions = ['tldr', 'bullets', 'storyArc'].map((type) => {
      const label = type === 'storyArc' ? 'Story Arc' : type === 'tldr' ? 'TL;DR' : 'Bullets';
      const task = job.summaryTasks?.[type] || {};
      const status = task.status || 'idle';
      const pct = Number.isFinite(task.progress) ? task.progress : 0;
      const ready = Boolean(job.summaryArtifacts?.[type]?.localPath);
      const fileHref = ready ? `/api/jobs/${job.id}/summaries/${type}/file` : '';
      const running = status === 'running';
      const overLimitMapReduce = task.mode === 'map_reduce';
      const caption = running
        ? `Generating ${label}${type === 'storyArc' ? ` (${pct}%)` : ''}`
        : `Generate ${label}${overLimitMapReduce ? ' (map-reduce)' : ''}`;
      const spinner = running ? '⏳ ' : '';
      return `
        <button data-summary="${job.id}:${type}" ${running ? 'disabled' : ''}>${spinner}${caption}</button>
        ${ready ? `<a href="${fileHref}" target="_blank" rel="noopener">${label} file</a>` : ''}
      `;
    }).join('');

    return `
      <div class="job">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${health.dot};margin-right:8px;"></span>
          <strong>${job.id}</strong> — <code>${job.status}</code> <span class="muted">(${health.label})</span>
        </div>
        <div class="muted">${job.meetUrl}</div>
        <div class="muted">created: ${formatDateTime(job.createdAt)}</div>
        <div class="muted">last event: ${job.lastEvent || 'n/a'} | heartbeat: ${job.heartbeatAt || 'n/a'} | duration: ${formatDuration(job.startedAt, job.endedAt)}</div>
        ${
          job.classifierConfig?.enabled
            ? `<div class="muted">screenshot capture: on | classifier model: ${job.classifierConfig.model || 'n/a'}${
                job.classifierConfig.meetingObjective
                  ? ` | objective: ${job.classifierConfig.meetingObjective}`
                  : ''
              }</div>`
            : ''
        }
        <div class="muted">checks: ${
          checks.hasAny
            ? `mic ${checks.micOff ? 'ok' : 'pending'} | cam ${checks.camOff ? 'ok' : 'pending'} | captions ${checks.captionsOn ? 'ok' : 'pending'}`
            : 'not reported by this run yet'
        }</div>
        ${job.error ? `<div style="color:#ff8b8b">error: ${job.error}</div>` : ''}
        <div class="links">${checkpointLinks}${finalLinks}</div>
        <div class="row">
          <button data-filterjob="${job.id}">Filter events</button>
          <a href="/api/jobs/${job.id}/live-transcript" target="_blank" rel="noopener">Live transcript</a>
          ${job.status === 'running' || job.status === 'cancelling' ? `<button data-cancel="${job.id}">Leave meeting</button>` : ''}
        </div>
        <div class="row">${summaryActions}</div>
      </div>
    `;
  }).join('');

  root.querySelectorAll('button[data-cancel]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-cancel');
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span>Leaving...';
      const response = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Could not cancel/leave this meeting');
      }
      await refresh();
    });
  });

  root.querySelectorAll('button[data-filterjob]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-filterjob');
      document.getElementById('eventJobFilter').value = id;
      refresh();
    });
  });

  root.querySelectorAll('button[data-summary]').forEach((button) => {
    button.addEventListener('click', async () => {
      const [id, type] = button.getAttribute('data-summary').split(':');
      button.disabled = true;
      try {
        const response = await fetch(`/api/jobs/${id}/summaries/${type}`, { method: 'POST' });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed generating ${type}`);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        await refresh();
      }
    });
  });
}

function renderEventPanel(jobs) {
  const root = document.getElementById('events');
  const jobFilter = (document.getElementById('eventJobFilter')?.value || '').trim().toLowerCase();
  const textFilter = (document.getElementById('eventTextFilter')?.value || '').trim().toLowerCase();
  const lines = [];
  jobs.forEach((job) => {
    (job.recentEvents || []).forEach((event) => {
      lines.push({
        ts: event.ts,
        jobId: job.id,
        event: event.event,
        data: event.payload || null
      });
    });
  });
  lines.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const filtered = lines.filter((line) => {
    const jobOk = !jobFilter || line.jobId.toLowerCase().includes(jobFilter);
    const textOk = !textFilter || line.event.toLowerCase().includes(textFilter);
    return jobOk && textOk;
  });

  if (!filtered.length) {
    root.innerHTML = '<div class="muted">No events yet.</div>';
    return;
  }

  const visible = filtered.slice(0, 120);
  const copyText = visible.map((line) => {
    const details = line.data ? ` ${JSON.stringify(line.data)}` : '';
    return `${line.ts} ${line.jobId} :: ${line.event}${details}`;
  }).join('\n');
  root.setAttribute('data-copy-text', copyText);

  root.innerHTML = visible.map((line) => {
    const details = line.data ? ` ${JSON.stringify(line.data)}` : '';
    return `<div class="eventLine"><span class="eventTs">${line.ts}</span>${line.jobId} :: ${line.event}${details}</div>`;
  }).join('');
}

async function refresh() {
  const jobs = await fetchJobs();
  renderJobs(jobs);
  renderEventPanel(jobs);
}

async function createJob() {
  const meetUrl = document.getElementById('meetUrl').value.trim();
  const scheduledRaw = document.getElementById('scheduledAt').value;
  const body = {
    meetUrl
  };
  if (scheduledRaw) {
    body.scheduledAt = new Date(scheduledRaw).toISOString();
  }

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json();
    alert(data.error || 'Failed to create job');
    return;
  }
  await refresh();
}

function setModelOptions(selectId, currentValue) {
  const options = [
    'claude-haiku-4-5',
    'claude-sonnet-4-6',
    'claude-opus-4-6'
  ];
  const select = document.getElementById(selectId);
  select.innerHTML = options.map((v) => `<option value="${v}">${v}</option>`).join('');
  if (options.includes(currentValue)) {
    select.value = currentValue;
  }
}

async function loadConfigIntoForm() {
  const cfg = await fetchConfig();
  document.getElementById('liveEnableScreenshotClassifier').checked = Boolean(cfg.enableScreenshotClassifier);
  document.getElementById('liveMeetingObjective').value = cfg.meetingObjective ?? '';
  document.getElementById('cfgTechnicalMode').checked = Boolean(cfg.technicalMode);
  document.getElementById('cfgForceGoogleSignIn').checked = Boolean(cfg.forceGoogleSignIn);
  document.getElementById('cfgCaptureInterval').value = cfg.captureIntervalSec ?? 10;
  document.getElementById('cfgBatchSize').value = cfg.batchSize ?? 6;
  document.getElementById('cfgScreenshotQuality').value = cfg.screenshotQuality ?? 50;
  document.getElementById('cfgArtifactUploadEndpoint').value = cfg.artifactUploadEndpoint ?? '';
  document.getElementById('cfgGuestName').value = cfg.guestName ?? 'Meet Bot';
  setModelOptions('cfgAnalysisModel', cfg.analysisModel ?? '');
  setModelOptions('cfgSummaryModel', cfg.summaryModel ?? '');
  setModelOptions('cfgTldrModel', cfg.tldrModel ?? '');
  setModelOptions('cfgArcModel', cfg.arcModel ?? '');
  setModelOptions('cfgBulletsModel', cfg.bulletsModel ?? '');
  setModelOptions('cfgScreenshotClassifierModel', cfg.screenshotClassifierModel ?? '');
}

function collectConfigFromForm() {
  const rawQuality = Number(document.getElementById('cfgScreenshotQuality').value);
  const screenshotQuality = Math.max(5, Math.min(100, Math.round(rawQuality / 5) * 5));
  return {
    technicalMode: document.getElementById('cfgTechnicalMode').checked,
    forceGoogleSignIn: document.getElementById('cfgForceGoogleSignIn').checked,
    captureIntervalSec: Number(document.getElementById('cfgCaptureInterval').value),
    batchSize: Number(document.getElementById('cfgBatchSize').value),
    screenshotQuality,
    artifactUploadEndpoint: document.getElementById('cfgArtifactUploadEndpoint').value.trim(),
    guestName: document.getElementById('cfgGuestName').value.trim(),
    analysisModel: document.getElementById('cfgAnalysisModel').value.trim(),
    summaryModel: document.getElementById('cfgSummaryModel').value.trim(),
    tldrModel: document.getElementById('cfgTldrModel').value.trim(),
    arcModel: document.getElementById('cfgArcModel').value.trim(),
    bulletsModel: document.getElementById('cfgBulletsModel').value.trim(),
    screenshotClassifierModel: document.getElementById('cfgScreenshotClassifierModel').value.trim()
  };
}

document.getElementById('joinNow').addEventListener('click', createJob);
document.getElementById('liveEnableScreenshotClassifier').addEventListener('change', queueObjectiveSave);
document.getElementById('liveMeetingObjective').addEventListener('input', queueObjectiveSave);
document.getElementById('saveObjectiveBtn').addEventListener('click', async () => {
  try {
    await saveConfig({
      enableScreenshotClassifier: document.getElementById('liveEnableScreenshotClassifier').checked,
      meetingObjective: document.getElementById('liveMeetingObjective').value.trim()
    });
    const btn = document.getElementById('saveObjectiveBtn');
    const prev = btn.textContent;
    btn.textContent = 'Saved';
    setTimeout(() => {
      btn.textContent = prev;
    }, 1000);
  } catch (error) {
    alert(error.message);
  }
});
document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  try {
    await saveConfig(collectConfigFromForm());
    alert('Config saved. New jobs will use updated settings.');
  } catch (error) {
    alert(error.message);
  }
});
document.getElementById('toggleConfigBtn').addEventListener('click', () => {
  const body = document.getElementById('configBody');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  document.getElementById('toggleConfigBtn').textContent = isHidden ? 'Hide config' : 'Show config';
});
document.getElementById('toggleScheduleBtn').addEventListener('click', () => {
  const row = document.getElementById('scheduleRow');
  const isHidden = row.style.display === 'none';
  row.style.display = isHidden ? 'flex' : 'none';
  document.getElementById('toggleScheduleBtn').textContent = isHidden ? 'Hide schedule' : 'Show schedule';
});
document.getElementById('copyEventsBtn').addEventListener('click', async () => {
  const eventsEl = document.getElementById('events');
  const text = eventsEl.getAttribute('data-copy-text') || '';
  if (!text.trim()) {
    alert('No visible events to copy.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyEventsBtn');
    const prev = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => {
      btn.textContent = prev;
    }, 1200);
  } catch (_error) {
    alert('Could not access clipboard in this browser context.');
  }
});
document.getElementById('hideFailedJobs').addEventListener('change', () => refresh());
document.getElementById('eventJobFilter').addEventListener('input', () => refresh());
document.getElementById('eventTextFilter').addEventListener('input', () => refresh());
loadConfigIntoForm().catch(() => {});
refresh();
setInterval(refresh, 3000);
