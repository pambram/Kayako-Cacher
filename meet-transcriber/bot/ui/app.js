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

function renderJobs(jobs) {
  const root = document.getElementById('jobs');
  if (!jobs.length) {
    root.innerHTML = '<div class="muted">No jobs yet.</div>';
    return;
  }

  root.innerHTML = jobs.map((job) => {
    const checkpointLinks = (job.latestCheckpointLinks || [])
      .map((file) => `<a href="${file.url}" target="_blank" rel="noopener">checkpoint:${file.name}</a>`)
      .join('');
    const finalLinks = (job.finalLinks || [])
      .map((file) => `<a href="${file.url}" target="_blank" rel="noopener">final:${file.name}</a>`)
      .join('');

    const summaryActions = ['tldr', 'bullets', 'storyArc'].map((type) => {
      const label = type === 'storyArc' ? 'Story Arc' : type === 'tldr' ? 'TL;DR' : 'Bullets';
      const task = job.summaryTasks?.[type] || {};
      const status = task.status || 'idle';
      const pct = Number.isFinite(task.progress) ? task.progress : 0;
      const ready = Boolean(job.summaryArtifacts?.[type]?.localPath);
      const fileHref = ready ? `/api/jobs/${job.id}/summaries/${type}/file` : '';
      const running = status === 'running';
      const caption = running ? `Generating ${label}${type === 'storyArc' ? ` (${pct}%)` : ''}` : `Generate ${label}`;
      const spinner = running ? '⏳ ' : '';
      return `
        <button data-summary="${job.id}:${type}" ${running ? 'disabled' : ''}>${spinner}${caption}</button>
        ${ready ? `<a href="${fileHref}" target="_blank" rel="noopener">${label} file</a>` : ''}
      `;
    }).join('');

    return `
      <div class="job">
        <div><strong>${job.id}</strong> — <code>${job.status}</code></div>
        <div class="muted">${job.meetUrl}</div>
        <div class="muted">last event: ${job.lastEvent || 'n/a'} | heartbeat: ${job.heartbeatAt || 'n/a'} | duration: ${formatDuration(job.startedAt, job.endedAt)}</div>
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
      button.textContent = 'Leaving...';
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

  root.innerHTML = filtered.slice(0, 120).map((line) => {
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
  document.getElementById('cfgTechnicalMode').checked = Boolean(cfg.technicalMode);
  document.getElementById('cfgForceGoogleSignIn').checked = Boolean(cfg.forceGoogleSignIn);
  document.getElementById('cfgCaptureInterval').value = cfg.captureIntervalSec ?? 10;
  document.getElementById('cfgBatchSize').value = cfg.batchSize ?? 6;
  document.getElementById('cfgScreenshotQuality').value = cfg.screenshotQuality ?? 50;
  document.getElementById('cfgGuestName').value = cfg.guestName ?? 'Meet Bot';
  setModelOptions('cfgAnalysisModel', cfg.analysisModel ?? '');
  setModelOptions('cfgSummaryModel', cfg.summaryModel ?? '');
  setModelOptions('cfgTldrModel', cfg.tldrModel ?? '');
  setModelOptions('cfgArcModel', cfg.arcModel ?? '');
  setModelOptions('cfgBulletsModel', cfg.bulletsModel ?? '');
  document.getElementById('cfgCheckpointUploadEnabled').checked = Boolean(cfg.checkpointUploadEnabled);
  document.getElementById('cfgCheckpointUploadMinutes').value = cfg.checkpointUploadMinutes ?? 5;
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
    guestName: document.getElementById('cfgGuestName').value.trim(),
    analysisModel: document.getElementById('cfgAnalysisModel').value.trim(),
    summaryModel: document.getElementById('cfgSummaryModel').value.trim(),
    tldrModel: document.getElementById('cfgTldrModel').value.trim(),
    arcModel: document.getElementById('cfgArcModel').value.trim(),
    bulletsModel: document.getElementById('cfgBulletsModel').value.trim(),
    checkpointUploadEnabled: document.getElementById('cfgCheckpointUploadEnabled').checked,
    checkpointUploadMinutes: Number(document.getElementById('cfgCheckpointUploadMinutes').value)
  };
}

document.getElementById('joinNow').addEventListener('click', createJob);
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
document.getElementById('eventJobFilter').addEventListener('input', () => refresh());
document.getElementById('eventTextFilter').addEventListener('input', () => refresh());
loadConfigIntoForm().catch(() => {});
refresh();
setInterval(refresh, 3000);
