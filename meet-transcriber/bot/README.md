# Meet Bot (Remote Agent)

This bot joins a Google Meet call, captures screenshots + captions, runs LLM analysis, and produces:

- transcript
- TL;DR
- story arc
- bullet points

It is designed to live next to the extension code so you can reuse prompts and models in one project.
Prompt parity is enforced by extracting prompts directly from `../background.js`.

## What it does

1. Launches Chrome with Puppeteer
2. Optionally signs in with Google account credentials
3. Joins the provided Meet URL
4. Turns on captions
5. Captures screenshot windows + caption text
6. Analyzes each batch with Anthropic
7. Builds post-meeting TL;DR, story arc, and bullet points
8. Writes local output files
9. Periodically uploads live checkpoints to S3 (default every 5 minutes, if S3 configured)
10. Uploads final artifacts to S3 and optionally sends SNS email notification

## Local run

```bash
cd meet-transcriber/bot
npm install

MEET_URL="https://meet.google.com/xxx-yyy-zzz" \
GOOGLE_EMAIL="meetbot@yourorg.com" \
GOOGLE_PASSWORD="secret" \
ANTHROPIC_API_KEY="sk-ant-..." \
node src/index.js
```

Optional delivery env vars:

- `S3_BUCKET`
- `S3_PREFIX` (default: `meet-bot`)
- `SNS_TOPIC_ARN`
- `AWS_REGION`
- `CHECKPOINT_UPLOAD_ENABLED` (default `true`)
- `CHECKPOINT_UPLOAD_MINUTES` (default `5`)

## Local scheduler UI

Run a minimal localhost UI + API to schedule jobs and track heartbeat/artifacts:

```bash
cd meet-transcriber/bot
npm install
npm run start:server
```

Open `http://localhost:3030`.

UI features:
- schedule or run immediate job by Meet URL
- generate summaries on demand (TL;DR, Bullet Points, Story Arc) with live status
- heartbeat/last-event status
- latest checkpoint links and final artifact links (S3 presigned URLs)

## Useful config env vars

- `CAPTURE_INTERVAL` (default: `10`)
- `BATCH_SIZE` (default: `6`)
- `ANALYSIS_MODEL` (default: `claude-haiku-4-5`)
- `TLDR_MODEL` (default: `claude-sonnet-4-5`)
- `ARC_MODEL` (default: `claude-sonnet-4-5`)
- `BULLETS_MODEL` (default: `claude-sonnet-4-5`)
- `MAX_MEETING_MINUTES` (default: `240`)
- `HEADLESS` (default: `false`)
- `CHROME_BIN` (default: auto-detected)
- `NOTIFY_EMAIL` + `SES_FROM_EMAIL` (optional SES lifecycle emails on join/finish)

## Output

Files are written to `bot-output/` by default:

- `meet-transcript-YYYY-MM-DD.txt`
- `meet-story-arc-YYYY-MM-DD.txt`
- `meet-bullet-points-YYYY-MM-DD.txt`
- `meet-transcript-live-<run>.txt` (incremental checkpoint file)
- `meet-transcript-state-<run>.json` (incremental state)

## Docker

```bash
cd meet-transcriber/bot
docker build -t meet-bot .
docker run --rm \
  -e MEET_URL="https://meet.google.com/xxx-yyy-zzz" \
  -e GOOGLE_EMAIL="meetbot@yourorg.com" \
  -e GOOGLE_PASSWORD="secret" \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  meet-bot
```

## AWS deployment scaffold

`template.yaml` includes starter resources for:

- S3 bucket for outputs
- SNS topic for notifications
- ECS cluster + Fargate task definition
- Lambda + HTTP API trigger (`POST /join`)

Before deploying, you must set real VPC subnet values and image URI.

## Notes

- Google login can fail with CAPTCHA/2FA in automated environments.
- For production reliability, use a dedicated Meet bot account and stable sign-in strategy.
- If your meetings block guests, account sign-in is required.
- Strict prompt parity is on by default. If extracting prompts from `background.js` fails, startup fails unless `ALLOW_PROMPT_FALLBACK=true`.
