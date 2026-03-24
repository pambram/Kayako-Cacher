# Meet Fleet — Remote Bot & Dashboard

Meet Fleet is an always-on ECS Fargate service that joins Google Meet calls as a bot, captures screenshots and captions, and produces AI-powered transcripts, summaries, and story arcs. It runs alongside the Meet Transcriber Chrome extension and shares the same prompt set from `../background.js`.

---

## Quick start — local development

```bash
cd meet-transcriber/bot
npm install

# Copy and fill in your credentials
cp .env.example .env
# Edit .env — at minimum: ANTHROPIC_API_KEY, GOOGLE_EMAIL, GOOGLE_PASSWORD

# Start the local scheduler dashboard
npm run start:server
# → http://localhost:3030
```

The local server stays alive between meetings. It does **not** require Google credentials to start — they are only used when a bot session is actually launched.

---

## Dashboard features

- **Fleet view** — status dots (green = active, yellow = setup, red = failed), created timestamp, duration, checks (mic/cam/captions)
- **New Meeting tab** — paste a Meet URL or meeting code (e.g. `zzo-gpgq-okp`), schedule for later, enable intelligent screenshot capture
- **Event Log** — live event stream with quick-filter presets (📸 Screenshots, 📝 Batches, ⚠️ Errors, 🟢 Join events)
- **Configuration tab** — all model + capture settings, auto-summary, saved to `.env`
- **On-demand summaries** — Generate TL;DR / Bullets / Story Arc per job with live progress
- **Live transcript** — rolling checkpoint accessible at `/api/jobs/:id/live-transcript`

---

## What the bot does

1. Launches Chrome with Puppeteer (non-headless, behind Xvfb virtual display)
2. Joins the Meet URL as a guest (or signed-in account if configured)
3. Dismisses pre-join media consent dialog, disables mic/camera, enables captions
4. Handles post-join consent dialogs (Gemini/Read AI transcription warnings)
5. Captures screenshots every `CAPTURE_INTERVAL` seconds and scrapes live captions
6. Analyses each batch with an LLM (default: claude-haiku-4-5)
7. Writes a live rolling transcript to disk and uploads to S3 every `CHECKPOINT_UPLOAD_MINUTES` minutes
8. Detects when all human participants have left; waits `EMPTY_MEETING_GRACE_SEC` then exits
9. On finish/leave: uploads final artifacts to S3, sends SES lifecycle email with transcript link
10. Summaries (TL;DR, Bullets, Story Arc) are generated on demand from the dashboard

---

## Configuration reference

All values can be set in `.env` or as environment variables. The dashboard Configuration tab persists changes back to `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required |
| `OPENAI_API_KEY` | — | Optional; enables GPT models |
| `GOOGLE_EMAIL` | — | Bot Google account for signed-in join mode |
| `GOOGLE_PASSWORD` | — | Bot Google account password |
| `GUEST_NAME` | `Meet Bot` | Display name when joining as guest |
| `FORCE_GOOGLE_SIGNIN` | `false` | Force signed-in join even when guest join is available |
| `CAPTURE_INTERVAL` | `5` | Seconds between screenshots |
| `BATCH_SIZE` | `6` | Screenshots per LLM analysis call |
| `SCREENSHOT_QUALITY` | `70` | JPEG quality (5–100, step 5) |
| `ANALYSIS_MODEL` | `claude-haiku-4-5` | Model for batch screenshot analysis |
| `SUMMARY_MODEL` | `claude-sonnet-4-6` | Model for auto-summaries |
| `TLDR_MODEL` | `claude-opus-4-6` | Model for TL;DR generation |
| `ARC_MODEL` | `claude-sonnet-4-6` | Model for Story Arc |
| `BULLETS_MODEL` | `claude-sonnet-4-6` | Model for Bullet Points |
| `MAX_MEETING_MINUTES` | `240` | Hard timeout before bot exits |
| `EMPTY_MEETING_GRACE_SEC` | `60` | Seconds to wait after all humans leave |
| `JOIN_WAIT_SEC` | `600` | Max seconds to wait for host admission |
| `TECHNICAL_MODE` | `true` | Ultra-technical analysis mode |
| `ENABLE_META_ANALYSIS` | `false` | Periodic rolling auto-summary during meeting |
| `META_ANALYSIS_INTERVAL` | `5` | Trigger auto-summary every N batches |
| `META_ANALYSIS_WINDOW` | `5` | Minutes of recent transcript to summarise |
| `ENABLE_SCREENSHOT_CLASSIFIER` | `false` | AI classifier selects key KT screenshots |
| `SCREENSHOT_CLASSIFIER_MODEL` | `claude-haiku-4-5` | Model for screenshot classification |
| `MEETING_OBJECTIVE` | — | Context for screenshot classifier |
| `S3_BUCKET` | — | S3 bucket for transcript/artifact uploads |
| `S3_PREFIX` | `meet-transcriber/bot` | Key prefix inside the bucket |
| `CHECKPOINT_UPLOAD_ENABLED` | `true` | Upload live transcripts to S3 periodically |
| `CHECKPOINT_UPLOAD_MINUTES` | `5` | Upload interval |
| `NOTIFY_EMAIL` | — | Email address for lifecycle notifications (SES) |
| `SES_FROM_EMAIL` | — | Verified SES sender identity |
| `OUTPUT_DIR` | `./bot-output` | Local directory for transcript files |
| `CHROME_BIN` | auto-detected | Path to Chrome (auto-detects on macOS/Linux/Windows) |

---

## Deployment — Meet Fleet on ECS Fargate

The bot runs as an always-on Fargate service behind `https://meet-fleet.csaiautomations.com` protected by Google OAuth (Cognito).

### Prerequisites (one-time)

1. Verify SES sender: `aws ses verify-email-identity --email-address pablo.ambram@trilogy.com`
2. Confirm the Google OAuth redirect URI is added in Google Cloud Console:
   `https://meet-fleet-auth-899084202472.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`

### Deploy commands

```bash
cd meet-transcriber/bot

# Full deploy: rebuild Docker image + push to ECR + update CloudFormation stack
./deploy.sh

# Code change only — rebuild image, push, force ECS rolling update (~5 min)
./deploy.sh --push-only

# CloudFormation/config change only — no Docker rebuild (~3 min)
./deploy.sh --sam-only
```

All three modes load credentials automatically from `.env` — no shell exports needed.

### Adding a new config item to ECS

If you add a new env var that requires a non-default value in production:
1. Add it to `template-service.yaml` under `ContainerDefinitions[0].Environment`
2. Run `./deploy.sh --sam-only`

If the new key has a sensible default in `config.js`, `./deploy.sh --push-only` is sufficient.

### Monitoring

```bash
# Tail live ECS logs
aws logs tail /ecs/meet-fleet --follow --region us-east-1

# Check service health
aws ecs describe-services --cluster meet-fleet-cluster --services meet-fleet \
  --query 'services[0].{Running:runningCount,Event:events[0].message}' --output json
```

---

## Docker (manual build)

The Dockerfile runs Xvfb as a background daemon then starts the Express server. This lets the server respond to health checks immediately while Chrome can use the virtual display when a meeting starts.

```bash
# Build (from bot/ directory)
docker buildx build --platform linux/amd64 --provenance=false --load \
  -t meet-fleet-local:latest .

# Run locally for testing
docker run --rm -p 3030:3030 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e S3_BUCKET=your-bucket \
  -e OUTPUT_DIR=/tmp/bot-output \
  meet-fleet-local:latest
```

> **Note for M1/M2 Mac:** `docker push` hangs on cross-compiled amd64 layers. Use `crane` to push:
> ```bash
> docker save meet-fleet-local:latest -o /tmp/meet-fleet.tar
> crane push /tmp/meet-fleet.tar <ECR_URI>:latest
> ```

---

## Prompt parity

The bot loads analysis, TL;DR, bullet-point, and story-arc prompts directly from `../background.js` at startup (via `src/extension-compat.js`). This keeps the bot's output in sync with the Chrome extension without manual copying.

- In production (Docker), `background.js` is baked into the image at build time by `deploy.sh`.
- In local dev, the bot looks one directory up (`../background.js`) automatically.
- `STRICT_PROMPT_PARITY=true` + `ALLOW_PROMPT_FALLBACK=true` is the production default — if extraction fails, built-in fallback prompts are used instead of crashing.

---

## Notes

- Bot joins meetings as a guest by default. If the meeting restricts guests, set `FORCE_GOOGLE_SIGNIN=true` and provide `GOOGLE_EMAIL`/`GOOGLE_PASSWORD`.
- Mic and camera are always disabled — only explicit "turn off" UI controls are clicked; no keyboard toggle shortcuts are used.
- Google Meet's "Do you want people to see and hear you?" consent dialog is handled automatically.
- The bot exits after `EMPTY_MEETING_GRACE_SEC` when all humans leave, or immediately when you click **Leave meeting** in the dashboard.
- For full cost and infrastructure details, see `INFRA_SPEC.md`.
