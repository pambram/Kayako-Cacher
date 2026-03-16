import { runMeetingBot } from './runner.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { loadExtensionPromptSet } from './extension-compat.js';
import {
  generateTldr,
  generateBulletPoints,
  generateStoryArc,
  generateTldrMapReduce,
  generateBulletPointsMapReduce,
  generateStoryArcMapReduce,
  estimateTokenCount,
  MAX_SINGLE_SUMMARY_INPUT_TOKENS
} from './summarize.js';
import { normalizeMeetUrlInput } from './meet-url.js';

function newJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class JobManager {
  constructor(baseConfig) {
    this.baseConfig = baseConfig;
    this.jobs = new Map();
    this.persistTimer = null;
    this.statePath = path.resolve(
      baseConfig.outputDir || path.resolve(process.cwd(), 'bot-output'),
      'jobs-state.json'
    );
    this.#restoreJobsFromDisk();
    this.#schedulePersist();
  }

  getBaseConfig() {
    return { ...this.baseConfig };
  }

  setBaseConfig(nextConfig) {
    this.baseConfig = { ...nextConfig };
  }

  #pushEvent(job, event, payload = {}) {
    if (!job.recentEvents) {
      job.recentEvents = [];
    }
    job.recentEvents.push({
      ts: new Date().toISOString(),
      event,
      payload
    });
    if (job.recentEvents.length > 40) {
      job.recentEvents = job.recentEvents.slice(-40);
    }
    this.#schedulePersist();
  }

  #serializeJob(job) {
    return {
      ...job,
      timer: null,
      runnerPromise: null,
      abortController: null
    };
  }

  #restoreJobsFromDisk() {
    try {
      if (!fsSync.existsSync(this.statePath)) return;
      const raw = fsSync.readFileSync(this.statePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.jobs)) return;
      for (const item of parsed.jobs) {
        const restored = {
          ...item,
          timer: null,
          runnerPromise: null,
          abortController: null
        };
        if (['running', 'cancelling', 'pending', 'scheduled'].includes(restored.status)) {
          restored.status = 'failed';
          restored.error = restored.error || 'Bot server restarted before job completion';
          restored.endedAt = restored.endedAt || new Date().toISOString();
          restored.lastEvent = 'failed';
          restored.recentEvents = [
            ...(Array.isArray(restored.recentEvents) ? restored.recentEvents.slice(-39) : []),
            {
              ts: new Date().toISOString(),
              event: 'failed',
              payload: { error: restored.error }
            }
          ];
        }
        this.jobs.set(restored.id, restored);
      }
    } catch (error) {
      console.warn('Failed to restore jobs-state.json:', error.message);
    }
  }

  #schedulePersist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.#persistJobs();
    }, 250);
  }

  async #persistJobs() {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        jobs: [...this.jobs.values()].map((job) => this.#serializeJob(job))
      };
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn('Failed to persist jobs-state.json:', error.message);
    }
  }

  listJobs() {
    return [...this.jobs.values()].map((job) => ({
      ...job,
      timer: undefined,
      runnerPromise: undefined,
      abortController: undefined
    }));
  }

  getJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      ...job,
      timer: undefined,
      runnerPromise: undefined,
      abortController: undefined
    };
  }

  createJob(request = {}) {
    if (!request.meetUrl) {
      throw new Error('meetUrl is required');
    }
    const normalizedMeetUrl = normalizeMeetUrlInput(request.meetUrl);

    const scheduledAt = request.scheduledAt ? new Date(request.scheduledAt).toISOString() : null;
    const jobId = newJobId();
    const now = new Date().toISOString();
    const job = {
      id: jobId,
      meetUrl: normalizedMeetUrl,
      status: scheduledAt ? 'scheduled' : 'pending',
      createdAt: now,
      updatedAt: now,
      scheduledAt,
      startedAt: null,
      endedAt: null,
      heartbeatAt: null,
      lastEvent: 'created',
      summaryFlags: { enableTldr: false, enableBullets: false, enableStoryArc: false },
      summaryArtifacts: {},
      summaryTasks: {},
      latestCheckpointLinks: [],
      finalLinks: [],
      localPaths: null,
      checkpoint: null,
      error: null,
      recentEvents: [],
      timer: null,
      runnerPromise: null,
      abortController: null
    };

    this.jobs.set(jobId, job);
    this.#pushEvent(job, 'created', { meetUrl: job.meetUrl, scheduledAt: job.scheduledAt });
    this.#scheduleOrRun(jobId);
    return this.getJob(jobId);
  }

  async generateSummary(id, type) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error('Job not found');
    }
    const supported = ['tldr', 'bullets', 'storyArc'];
    if (!supported.includes(type)) {
      throw new Error(`Unsupported summary type: ${type}`);
    }
    if (job.status === 'scheduled' || job.status === 'pending') {
      throw new Error('Job has not started yet');
    }

    const current = job.summaryTasks?.[type];
    if (current?.status === 'running') {
      throw new Error(`${type} summary already running`);
    }
    job.summaryTasks[type] = {
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      error: null
    };
    this.#pushEvent(job, 'summary_running', { type });
    job.updatedAt = new Date().toISOString();

    this.#runSummary(job, type);
    return { type, status: 'running' };
  }

  async #runSummary(job, type) {
    try {
      const entries = await this.#readJobEntries(job);
      if (!entries.length) {
        throw new Error('No transcript entries available yet');
      }

      const config = { ...this.baseConfig };
      try {
        config.promptSet = await loadExtensionPromptSet();
      } catch (error) {
        if (config.strictPromptParity && !config.allowPromptFallback) {
          throw new Error(`Prompt parity enforcement failed: ${error.message}`);
        }
      }

      const transcript = entries.map((entry) => `[${entry.timestampLabel}]\n${entry.content}`).join('\n\n');
      const estimatedInputTokens = estimateTokenCount(transcript);
      const useMapReduce = estimatedInputTokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS;
      job.summaryTasks[type].estimatedInputTokens = estimatedInputTokens;
      job.summaryTasks[type].mode = useMapReduce ? 'map_reduce' : 'single_pass';
      this.#pushEvent(job, 'summary_plan', {
        type,
        estimatedInputTokens,
        mode: job.summaryTasks[type].mode
      });

      let text = '';
      if (type === 'tldr') {
        text = useMapReduce
          ? await generateTldrMapReduce(transcript, config, async (p) => {
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateTldr(transcript, config);
      } else if (type === 'bullets') {
        text = useMapReduce
          ? await generateBulletPointsMapReduce(transcript, config, async (p) => {
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateBulletPoints(transcript, config);
      } else {
        text = useMapReduce
          ? await generateStoryArcMapReduce(transcript, config, async (p) => {
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateStoryArc(entries, config, async (p) => {
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            });
      }

      await fs.mkdir(config.outputDir, { recursive: true });
      const outPath = path.join(config.outputDir, `meet-${type}-${job.id}.txt`);
      const title = type === 'storyArc' ? 'Story Arc' : type === 'tldr' ? 'TL;DR' : 'Bullet Points';
      const header = [
        `Google Meet - ${title}`,
        '===========================',
        `Generated: ${new Date().toISOString()}`,
        `Meet URL: ${job.meetUrl}`,
        ''
      ].join('\n');
      await fs.writeFile(outPath, `${header}\n${text}\n`, 'utf8');

      job.summaryArtifacts[type] = {
        localPath: outPath,
        generatedAt: new Date().toISOString()
      };
      job.summaryTasks[type] = {
        status: 'completed',
        progress: 100,
        startedAt: job.summaryTasks[type]?.startedAt || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        error: null,
        estimatedInputTokens: job.summaryTasks[type]?.estimatedInputTokens,
        mode: job.summaryTasks[type]?.mode || 'single_pass'
      };
      this.#pushEvent(job, 'summary_generated', { type, localPath: outPath });
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.summaryTasks[type] = {
        status: 'failed',
        progress: job.summaryTasks[type]?.progress || 0,
        startedAt: job.summaryTasks[type]?.startedAt || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        error: error.message
      };
      this.#pushEvent(job, 'summary_failed', { type, error: error.message });
      job.updatedAt = new Date().toISOString();
    }
  }

  async #readJobEntries(job) {
    const statePath = job.checkpoint?.statePath;
    if (statePath) {
      try {
        const raw = await fs.readFile(statePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.entries)) {
          return parsed.entries;
        }
      } catch (_error) {
        // Fallback below.
      }
    }
    return [];
  }

  cancelJob(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.timer) {
      clearTimeout(job.timer);
      job.timer = null;
    }
    if (job.status === 'scheduled' || job.status === 'pending') {
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      job.lastEvent = 'cancelled';
      this.#pushEvent(job, 'cancelled');
      return true;
    }
    if (job.status === 'running' && job.abortController) {
      job.abortController.abort();
      job.status = 'cancelling';
      job.updatedAt = new Date().toISOString();
      job.lastEvent = 'cancelling';
      this.#pushEvent(job, 'cancelling');
      return true;
    }
    return false;
  }

  #scheduleOrRun(id) {
    const job = this.jobs.get(id);
    if (!job) return;

    if (job.scheduledAt) {
      const delay = Math.max(0, new Date(job.scheduledAt).getTime() - Date.now());
      job.timer = setTimeout(() => {
        this.#startRun(id);
      }, delay);
      return;
    }
    this.#startRun(id);
  }

  #startRun(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.timer) {
      clearTimeout(job.timer);
      job.timer = null;
    }

    const config = {
      ...this.baseConfig,
      meetUrl: job.meetUrl,
      enableTldr: false,
      enableBullets: false,
      enableStoryArc: false
    };
    const abortController = new AbortController();
    job.abortController = abortController;

    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    job.lastEvent = 'starting';
    this.#pushEvent(job, 'starting');

    job.runnerPromise = runMeetingBot(config, {
      runId: id,
      checkpointPrefix: `jobs/${id}/checkpoints`,
      finalPrefix: `jobs/${id}/final`,
      abortSignal: abortController.signal,
      onStatus: (event, payload) => {
        job.updatedAt = new Date().toISOString();
        job.heartbeatAt = job.updatedAt;
        job.lastEvent = event;
        this.#pushEvent(job, event, payload);

        if (event === 'checkpoint_uploaded') {
          job.latestCheckpointLinks = payload.files || [];
        }
        if (event === 'final_upload_complete') {
          job.finalLinks = payload.files || [];
        }
        if (event === 'local_output_written') {
          job.localPaths = payload.localPaths || null;
        }
        if (event === 'checkpoint_initialized') {
          job.checkpoint = payload.checkpoint || null;
        }
        if (event === 'failed') {
          job.error = payload.error || 'Unknown failure';
        }
      }
    })
      .then((result) => {
        job.status = result.cancelled ? 'cancelled' : 'completed';
        job.endedAt = new Date().toISOString();
        job.updatedAt = job.endedAt;
        job.localPaths = result.localPaths;
        job.checkpoint = result.checkpoint || job.checkpoint;
        job.latestCheckpointLinks = result.latestCheckpointUpload?.files || job.latestCheckpointLinks;
        job.finalLinks = result.finalUpload?.files || job.finalLinks;
        this.#pushEvent(job, result.cancelled ? 'cancelled' : 'completed', { entriesCount: result.entriesCount });
      })
      .catch((error) => {
        const wasCancelled = job.lastEvent === 'cancelling';
        job.status = wasCancelled ? 'cancelled' : 'failed';
        job.error = error.message;
        job.endedAt = new Date().toISOString();
        job.updatedAt = job.endedAt;
        this.#pushEvent(job, wasCancelled ? 'cancelled' : 'failed', { error: error.message });
      })
      .finally(() => {
        job.abortController = null;
      });
  }
}
