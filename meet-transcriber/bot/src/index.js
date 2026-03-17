import 'dotenv/config';
import { parseCliArgs, loadConfig } from './config.js';
import { runMeetingBot } from './runner.js';

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const config = loadConfig(cliArgs);
  console.log('Meet bot starting with config:', {
    meetUrl: config.meetUrl,
    captureIntervalSec: config.captureIntervalSec,
    batchSize: config.batchSize,
    analysisModel: config.analysisModel,
    tldrModel: config.tldrModel,
    arcModel: config.arcModel,
    bulletsModel: config.bulletsModel
  });

  const result = await runMeetingBot(config, {
    onStatus: (event, payload) => {
      if (event === 'capturing') {
        const current = Math.min(payload.screenshotCount || 0, payload.batchSize || 0);
        console.log(
          `Capture tick ${payload.timestamp} capturing ${current}/${payload.batchSize || '?'} fails=${payload.consecutiveScreenshotFailures || 0}`
        );
        return;
      }
      if (event === 'batch_processing') {
        console.log(
          `Analyzing batch ${payload.startedAtIso} -> ${payload.endedAtIso}`
        );
        return;
      }
      if (event === 'batch_analyzed') {
        console.log(`Batch analysis complete. Transcript entries total: ${payload.entriesCount}`);
        return;
      }
      if (event === 'screenshot_classifier_running') {
        console.log(`KT screenshot classifier running for batch #${payload.batchNumber} (${payload.screenshots} screenshots)`);
        return;
      }
      if (event === 'screenshot_classifier_selected') {
        console.log(
          `KT screenshot selected for batch #${payload.batchNumber}: index=${payload.selectedIndex}, reason="${payload.reason}", url=${payload.imageUrl}`
        );
        return;
      }
      if (event === 'screenshot_classifier_skipped') {
        console.log(`KT screenshot skipped for batch #${payload.batchNumber}: ${payload.reason}`);
        return;
      }
      if (event === 'screenshot_classifier_error') {
        console.warn(`KT screenshot classifier failed for batch #${payload.batchNumber}: ${payload.error}`);
        return;
      }
      if (event === 'summary_progress' && payload.type === 'storyArc') {
        const pct = Math.floor((payload.progress.current / payload.progress.total) * 100);
        console.log(`Story arc progress: ${payload.progress.current}/${payload.progress.total} (${pct}%)`);
        return;
      }
      if (event === 'checkpoint_initialized') {
        console.log('Live checkpoint files initialized:', payload.checkpoint);
        return;
      }
      if (event === 'checkpoint_uploaded') {
        console.log(`Checkpoint uploaded (${payload.force ? 'forced' : 'periodic'})`);
        return;
      }
      if (event === 'prompt_source') {
        console.log(`Prompt source: ${payload.source}`);
        return;
      }
      if (event === 'analysis_error') {
        console.error('Batch analysis failed, continuing with next batch:', payload.error);
        return;
      }
      if (event === 'completed') {
        console.log('Run complete:', {
          runId: payload.runId,
          entriesCount: payload.entriesCount,
          localPaths: payload.localPaths
        });
      }
    }
  });
  console.log('Final result:', {
    runId: result.runId,
    entriesCount: result.entriesCount
  });
}

main().catch((error) => {
  console.error('Meet bot failed:', error);
  process.exitCode = 1;
});
