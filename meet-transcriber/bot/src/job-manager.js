import { runMeetingBot } from './runner.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { loadExtensionPromptSet } from './extension-compat.js';
import {
  generateTldr,
  generateBulletPoints,
  generateBulletPointsIncremental,
  generateStoryArc,
  generateTldrMapReduce,
  generateBulletPointsMapReduce,
  generateStoryArcMapReduce,
  generateKtDocument,
  estimateTokenCount,
  MAX_SINGLE_SUMMARY_INPUT_TOKENS
} from './summarize.js';
import { createGoogleDocFromMarkdown } from './gdocs-export.js';
import { normalizeMeetUrlInput } from './meet-url.js';

function newJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class JobManager {
  constructor(baseConfig, s3Helpers = {}) {
    this.baseConfig = baseConfig;
    this.jobs = new Map();
    this.persistTimer = null;
    this.s3Get = s3Helpers.s3Get || null;
    this.s3Put = s3Helpers.s3Put || null;
    this.jobsStateKey = s3Helpers.jobsStateKey || null;
    this.statePath = path.resolve(
      baseConfig.outputDir || path.resolve(process.cwd(), 'bot-output'),
      'jobs-state.json'
    );
    this.#restoreJobsFromDisk();
    // Restore from S3 in the background; any new local disk state takes precedence.
    this.#restoreJobsFromS3();
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
      // Write local disk copy.
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      // Also write to S3 so state survives container restarts and redeploys.
      if (this.s3Put && this.jobsStateKey) {
        await this.s3Put(this.jobsStateKey, payload).catch((err) => {
          console.warn('Failed to persist jobs-state.json to S3:', err.message);
        });
      }
    } catch (error) {
      console.warn('Failed to persist jobs-state.json:', error.message);
    }
  }

  async #restoreJobsFromS3() {
    if (!this.s3Get || !this.jobsStateKey) return;
    try {
      const payload = await this.s3Get(this.jobsStateKey);
      if (!payload || !Array.isArray(payload.jobs)) return;
      let restored = 0;
      for (const item of payload.jobs) {
        // Only add jobs not already present (disk restore takes precedence).
        if (this.jobs.has(item.id)) continue;
        const job = {
          ...item,
          timer: null,
          runnerPromise: null,
          abortController: null
        };
        if (['running', 'cancelling', 'pending', 'scheduled'].includes(job.status)) {
          job.status = 'failed';
          job.error = job.error || 'Bot server restarted before job completion';
          job.endedAt = job.endedAt || new Date().toISOString();
          job.lastEvent = 'failed';
          job.recentEvents = [
            ...(Array.isArray(job.recentEvents) ? job.recentEvents.slice(-39) : []),
            { ts: new Date().toISOString(), event: 'failed', payload: { error: job.error } }
          ];
        }
        this.jobs.set(job.id, job);
        restored++;
      }
      if (restored > 0) {
        console.log(`Restored ${restored} job(s) from S3.`);
        this.#schedulePersist(); // write merged state back to disk
      }
    } catch (error) {
      console.warn('Failed to restore jobs-state.json from S3:', error.message);
    }
  }

  #stripJob(job) {
    const summaryTasks = job.summaryTasks
      ? Object.fromEntries(
          Object.entries(job.summaryTasks).map(([k, v]) => [k, { ...v, abortController: undefined }])
        )
      : job.summaryTasks;
    return {
      ...job,
      timer: undefined,
      runnerPromise: undefined,
      abortController: undefined,
      summaryTasks
    };
  }

  listJobs() {
    return [...this.jobs.values()].map((job) => this.#stripJob(job));
  }

  getJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return this.#stripJob(job);
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
      classifierConfig: null,
      latestCheckpointLinks: [],
      finalLinks: [],
      localPaths: null,
      checkpoint: null,
      error: null,
      recentEvents: [],
      timer: null,
      runnerPromise: null,
      abortController: null,
      resumeFromJobId: request.resumeFromJobId || null
    };

    this.jobs.set(jobId, job);
    this.#pushEvent(job, 'created', { meetUrl: job.meetUrl, scheduledAt: job.scheduledAt, resumeFromJobId: job.resumeFromJobId });
    this.#scheduleOrRun(jobId);
    return this.getJob(jobId);
  }

  async generateSummary(id, type, options = {}) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error('Job not found');
    }
    const supported = ['tldr', 'bullets', 'storyArc', 'ktDocument'];
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
    const summaryAbort = new AbortController();
    job.summaryTasks[type] = {
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      error: null,
      abortController: summaryAbort
    };
    this.#pushEvent(job, 'summary_running', { type, incremental: Boolean(options.incremental) });
    job.updatedAt = new Date().toISOString();

    this.#runSummary(job, type, summaryAbort.signal, options);
    return { type, status: 'running', incremental: Boolean(options.incremental) };
  }

  cancelSummary(id, type) {
    const job = this.jobs.get(id);
    if (!job) return false;
    const task = job.summaryTasks?.[type];
    if (task?.status !== 'running') return false;
    task.abortController?.abort();
    job.summaryTasks[type] = {
      ...task,
      status: 'cancelled',
      endedAt: new Date().toISOString(),
      error: 'Cancelled by user',
      abortController: null
    };
    this.#pushEvent(job, 'summary_cancelled', { type });
    job.updatedAt = new Date().toISOString();
    this.#schedulePersist();
    return true;
  }

  async #runSummary(job, type, abortSignal, options = {}) {
    const isIncremental = Boolean(options.incremental) && type === 'bullets';
    console.log(`[summary:${type}] Starting for job ${job.id}${isIncremental ? ' (incremental)' : ''}`);
    try {
      if (abortSignal?.aborted) return;
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

      // ── Incremental bullets: only process entries newer than the last generation ──
      if (isIncremental) {
        const existingArtifact = job.summaryArtifacts?.bullets;
        let existingBullets = '';
        if (existingArtifact?.localPath) {
          try {
            existingBullets = await fs.readFile(existingArtifact.localPath, 'utf8');
          } catch (_err) {
            existingBullets = '';
          }
        }

        // If no previous bullets, fall through to full generation below.
        if (existingBullets) {
          const cutoff = existingArtifact?.generatedAt || null;
          const newEntries = cutoff
            ? entries.filter((e) => e.timestamp > cutoff)
            : entries;

          const newTranscript = newEntries
            .map((e) => `[${e.timestampLabel}]\n${e.content}`)
            .join('\n\n');

          if (!newTranscript.trim()) {
            // Nothing new since last run — no LLM call needed.
            console.log(`[summary:bullets] Incremental: no new entries since ${cutoff}. Skipping LLM.`);
            job.summaryTasks[type] = {
              status: 'completed',
              progress: 100,
              startedAt: job.summaryTasks[type]?.startedAt || new Date().toISOString(),
              endedAt: new Date().toISOString(),
              error: null,
              mode: 'incremental_noop'
            };
            this.#pushEvent(job, 'summary_generated', {
              type,
              localPath: existingArtifact.localPath,
              incremental: true,
              newEntries: 0
            });
            job.updatedAt = new Date().toISOString();
            this.#schedulePersist();
            return;
          }

          job.summaryTasks[type].mode = 'incremental';
          job.summaryTasks[type].estimatedInputTokens = estimateTokenCount(existingBullets + newTranscript);
          console.log(`[summary:bullets] Incremental: ${newEntries.length} new entries since ${cutoff}`);
          this.#pushEvent(job, 'summary_plan', {
            type,
            mode: 'incremental',
            newEntries: newEntries.length
          });

          const checkAbort = () => {
            if (abortSignal?.aborted) throw new Error('Cancelled by user');
          };

          const text = await generateBulletPointsIncremental(
            existingBullets,
            newTranscript,
            config,
            async (p) => {
              checkAbort();
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            }
          );

          checkAbort();

          const outPath = existingArtifact.localPath;
          await fs.writeFile(outPath, text, 'utf8');
          job.summaryArtifacts[type] = { localPath: outPath, generatedAt: new Date().toISOString() };
          job.summaryTasks[type] = {
            status: 'completed',
            progress: 100,
            startedAt: job.summaryTasks[type]?.startedAt || new Date().toISOString(),
            endedAt: new Date().toISOString(),
            error: null,
            mode: 'incremental'
          };
          console.log(`[summary:bullets] Incremental done → ${outPath}`);
          this.#pushEvent(job, 'summary_generated', { type, localPath: outPath, incremental: true, newEntries: newEntries.length });
          job.updatedAt = new Date().toISOString();
          this.#schedulePersist();
          return;
        }
        // No existing bullets → fall through to full generation.
        console.log('[summary:bullets] Incremental requested but no existing bullets — running full generation.');
      }

      const transcript = entries.map((entry) => `[${entry.timestampLabel}]\n${entry.content}`).join('\n\n');
      const estimatedInputTokens = estimateTokenCount(transcript);
      const useMapReduce = estimatedInputTokens > MAX_SINGLE_SUMMARY_INPUT_TOKENS;
      job.summaryTasks[type].estimatedInputTokens = estimatedInputTokens;
      job.summaryTasks[type].mode = useMapReduce ? 'map_reduce' : 'single_pass';
      console.log(`[summary:${type}] ~${Math.round(estimatedInputTokens / 1000)}k tokens, mode=${job.summaryTasks[type].mode}, entries=${entries.length}`);
      this.#pushEvent(job, 'summary_plan', {
        type,
        estimatedInputTokens,
        mode: job.summaryTasks[type].mode
      });

      const checkAbort = () => {
        if (abortSignal?.aborted) throw new Error('Cancelled by user');
      };

      let text = '';
      if (type === 'ktDocument') {
        job.summaryTasks[type].mode = 'single_pass';
        text = await generateKtDocument(transcript, config);
      } else if (type === 'tldr') {
        text = useMapReduce
          ? await generateTldrMapReduce(transcript, config, async (p) => {
              checkAbort();
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateTldr(transcript, config);
      } else if (type === 'bullets') {
        text = useMapReduce
          ? await generateBulletPointsMapReduce(transcript, config, async (p) => {
              checkAbort();
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateBulletPoints(transcript, config);
      } else {
        text = useMapReduce
          ? await generateStoryArcMapReduce(transcript, config, async (p) => {
              checkAbort();
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            })
          : await generateStoryArc(entries, config, async (p) => {
              checkAbort();
              job.summaryTasks[type].progress = Math.floor((p.current / p.total) * 100);
              job.updatedAt = new Date().toISOString();
            });
      }

      checkAbort();

      await fs.mkdir(config.outputDir, { recursive: true });
      const isMarkdown = type === 'ktDocument';
      const ext = isMarkdown ? 'md' : 'txt';
      const outPath = path.join(config.outputDir, `meet-${type}-${job.id}.${ext}`);
      let fileContent;
      if (isMarkdown) {
        fileContent = text;
      } else {
        const title = type === 'storyArc' ? 'Story Arc' : type === 'tldr' ? 'TL;DR' : 'Bullet Points';
        const header = [
          `Google Meet - ${title}`,
          '===========================',
          `Generated: ${new Date().toISOString()}`,
          `Meet URL: ${job.meetUrl}`,
          ''
        ].join('\n');
        fileContent = `${header}\n${text}\n`;
      }
      await fs.writeFile(outPath, fileContent, 'utf8');

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
      console.log(`[summary:${type}] Done → ${outPath}`);
      this.#pushEvent(job, 'summary_generated', { type, localPath: outPath });
      job.updatedAt = new Date().toISOString();

      // After KT document md is written, create a Google Doc as a separate sequential step.
      if (type === 'ktDocument') {
        this.#createGoogleDocForKt(job, fileContent);
      }
    } catch (error) {
      console.error(`[summary:${type}] FAILED for job ${job.id}: ${error.message}`);
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

  async #createGoogleDocForKt(job, markdownContent) {
    job.gdocsStatus = 'creating';
    this.#pushEvent(job, 'gdocs_creating', {});
    job.updatedAt = new Date().toISOString();
    this.#schedulePersist();
    try {
      const meetCode = (job.meetUrl || '').split('/').pop().split('?')[0] || job.id;
      const dateStr = new Date(job.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `KT Document — ${meetCode} (${dateStr})`;

      // Pass notify/ses emails as fallback share targets if "anyone" sharing is org-blocked.
      const shareEmails = [this.baseConfig.notifyEmail, this.baseConfig.sesFromEmail].filter(Boolean);
      const { docId, docUrl, sharedPublicly } = await createGoogleDocFromMarkdown(title, markdownContent, shareEmails);

      job.summaryArtifacts.ktDocumentGoogleDoc = { docUrl, docId, sharedPublicly, createdAt: new Date().toISOString() };
      job.gdocsStatus = 'done';
      job.gdocsError = null;
      job.updatedAt = new Date().toISOString();
      this.#pushEvent(job, 'gdocs_created', { docUrl });
      console.log(`[gdocs] KT Document available at ${docUrl}`);
      this.#schedulePersist();
    } catch (error) {
      console.error(`[gdocs] Failed to create Google Doc: ${error.message}`);
      job.gdocsStatus = 'failed';
      job.gdocsError = error.message;
      job.updatedAt = new Date().toISOString();
      this.#pushEvent(job, 'gdocs_failed', { error: error.message });
      this.#schedulePersist();
    }
  }

  /** Public: retry Google Doc creation from the saved .md file without regenerating KT content. */
  async retryGoogleDoc(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');

    const md = job.summaryArtifacts?.ktDocument?.localPath;
    if (!md) throw new Error('KT Document (.md) has not been generated yet');

    // Verify the file still exists and log its size so we can confirm we're using the right content.
    let mdContent;
    try {
      mdContent = await fs.readFile(md, 'utf8');
    } catch (err) {
      throw new Error(`KT Document file not readable at ${md}: ${err.message}`);
    }
    console.log(`[gdocs] Retry: reading from ${md} (${Math.round(mdContent.length / 1024)}KB)`);

    // Reset prior Google Doc artifact so UI shows fresh state.
    delete job.summaryArtifacts.ktDocumentGoogleDoc;
    job.gdocsStatus = null;
    job.gdocsError = null;
    this.#createGoogleDocForKt(job, mdContent);
    return { status: 'creating' };
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
      job.userInitiatedLeave = true;
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

  async #startRun(id) {
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
    job.classifierConfig = {
      enabled: Boolean(config.enableScreenshotClassifier),
      model: config.screenshotClassifierModel || '',
      meetingObjective: config.meetingObjective || ''
    };

    // Load prior entries if resuming a previous session.
    let resumeEntries = null;
    let resumePreviousContext = '';
    if (job.resumeFromJobId) {
      const priorJob = this.jobs.get(job.resumeFromJobId);
      if (priorJob) {
        const loadedEntries = await this.#readJobEntries(priorJob);
        if (loadedEntries.length > 0) {
          resumeEntries = loadedEntries;
          resumePreviousContext = loadedEntries[loadedEntries.length - 1]?.content || '';
          console.log(`Resuming job ${id} from ${job.resumeFromJobId} — ${resumeEntries.length} prior entries loaded.`);
        }
      }
    }

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
      resumeEntries,
      resumePreviousContext,
      resumeFromJobId: job.resumeFromJobId || null,
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
        const finalStatus = !result.cancelled
          ? 'completed'
          : job.userInitiatedLeave ? 'ended' : 'cancelled';
        job.status = finalStatus;
        job.endedAt = new Date().toISOString();
        job.updatedAt = job.endedAt;
        job.localPaths = result.localPaths;
        job.checkpoint = result.checkpoint || job.checkpoint;
        job.latestCheckpointLinks = result.latestCheckpointUpload?.files || job.latestCheckpointLinks;
        job.finalLinks = result.finalUpload?.files || job.finalLinks;
        this.#pushEvent(job, finalStatus, { entriesCount: result.entriesCount });
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
