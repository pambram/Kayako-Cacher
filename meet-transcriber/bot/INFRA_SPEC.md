# Meet Fleet — Infrastructure Spec & Cost Sheet

**Generated:** March 2026  
**Region:** us-east-1  
**Stack:** `meet-fleet` (CloudFormation / SAM)

---

## Architecture Overview

```
Browser
  │
  ▼
Route53 CNAME: meet-fleet.csaiautomations.com
  │
  ▼
ALB: alb-mcp-oauth (shared, internet-facing, 2 AZs)
  │
  ├── Rule 95 (priority) — path "/" unauthenticated → Landing page
  │
  └── Rule 100 (priority) — all paths → Cognito auth gate
          │
          ├── Unauthenticated → Cognito Hosted UI → Google OAuth → back to ALB
          └── Authenticated → ECS Fargate task (port 3030)

ECS Fargate Task (meet-fleet-cluster)
  ├── Xvfb virtual display (:99)
  ├── Puppeteer + Google Chrome (non-headless, for Meet compatibility)
  └── Node.js Express server (src/start-server.js)
        ├── Dashboard UI (Meet Fleet SPA)
        ├── Job manager (schedule, run, monitor bot sessions)
        └── REST API (/api/*)

Outbound (via NAT gateway nat-0a181c86b3c1d9b8b):
  ├── meet.google.com (join meetings)
  ├── api.anthropic.com / api.openai.com (LLM analysis)
  └── s3.us-east-1.amazonaws.com (transcript upload)
```

---

## Deployed Component Inventory

| Component | Spec | Shared? |
|-----------|------|---------|
| **ECS Fargate** | 2 vCPU / 4 GB RAM, 1 task, always-on | No — dedicated |
| **Container image (ECR)** | 526 MB compressed, `meet-fleet:latest` | No — dedicated |
| **ALB** | `alb-mcp-oauth`, internet-facing, 2 AZs | Yes — 2 of 56 listener rules |
| **Cognito User Pool** | `meet-fleet-auth`, Essentials tier, Google IdP | No — dedicated |
| **S3 bucket** | `meet-transcriber-uploads-899084202472`, prefix `meet-transcriber/bot/` | Yes — shared bucket |
| **CloudWatch Logs** | `/ecs/meet-fleet`, 14-day retention | No — dedicated log group |
| **NAT Gateway** | `nat-0a181c86b3c1d9b8b` (vpc-01f48b79) | Yes — shared with Kayako VPC |
| **ECR repository** | `899084202472.dkr.ecr.us-east-1.amazonaws.com/meet-fleet` | No — dedicated |
| **VPC / Subnets** | `vpc-01f48b79`, private subnets `subnet-9ad3a6d1` + `subnet-ee21528a` | Yes — shared |

---

## ECS Task Definition (Revision 4)

| Parameter | Value |
|-----------|-------|
| Family | `meet-fleet-task` |
| Launch type | Fargate |
| CPU | 2048 units (2 vCPU) |
| Memory | 4096 MiB (4 GB) |
| Network mode | `awsvpc` |
| Assign public IP | Disabled (NAT for egress) |
| Health check | `curl -sf http://localhost:3030/api/health` |
| Health check grace period | 120 s |
| Start period | 90 s |
| Log driver | `awslogs` → `/ecs/meet-fleet` |
| Image size | 526 MB (compressed) |

### Key environment variables

| Variable | Value / Purpose |
|----------|-----------------|
| `HEADLESS` | `false` — Chrome runs against Xvfb virtual display |
| `CHROME_BIN` | `/usr/bin/google-chrome` |
| `DISPLAY` | `:99` — Xvfb screen |
| `OUTPUT_DIR` | `/tmp/bot-output` (ephemeral; transcripts also uploaded to S3) |
| `EMPTY_MEETING_GRACE_SEC` | `60` — seconds to wait after all humans leave before bot exits |
| `CAPTURE_INTERVAL` | `5` — screenshot interval in seconds |
| `BATCH_SIZE` | `6` — screenshots per LLM analysis batch |
| `ANALYSIS_MODEL` | `claude-haiku-4-5` |
| `SUMMARY_MODEL` | `claude-sonnet-4-6` |
| `S3_BUCKET` | `meet-transcriber-uploads-899084202472` |
| `STRICT_PROMPT_PARITY` | `true` — bakes extension prompts into image at build time |

---

## Monthly Cost Breakdown (us-east-1 pricing, March 2026)

### Fixed costs — always-on, regardless of meeting activity

| Item | Calculation | Monthly USD |
|------|-------------|-------------|
| Fargate — 2 vCPU | 730 h × $0.04048/vCPU-h × 2 | **$59.10** |
| Fargate — 4 GB RAM | 730 h × $0.004445/GB-h × 4 | **$12.98** |
| ALB (proportional share) | $16.20/mo base ÷ 56 rules, 2 added | **~$0.60** |
| NAT Gateway (proportional share) | $32.40/mo ÷ ~10 services | **~$3.24** |
| CloudWatch Logs ingestion | ~1 GB/mo × $0.50/GB | **~$0.50** |
| ECR storage | 0.53 GB × $0.10/GB | **~$0.05** |
| Cognito (≤10 k MAUs) | Free tier | **$0.00** |
| **Fixed subtotal** | | **~$76.47 / mo** |

### Variable costs — per meeting

**Assumptions per meeting:**
- Duration: 45 minutes
- Screenshot interval: 5 s → 540 screenshots
- Screenshot size: ~70 KB JPEG compressed → ~37 MB/meeting
- LLM batches: 1 per 6 screenshots = 90 analysis calls (claude-haiku-4-5)
- Summaries: TL;DR + Bullets + Story Arc (claude-sonnet-4-6), ~4 k tokens each
- Storage: ~37 MB screenshots + ~50 KB text per meeting
- 2 SES lifecycle emails per meeting

| Item | Per meeting | Notes |
|------|-------------|-------|
| Anthropic — analysis (haiku) | ~$0.08 | 90 batches × ~900 input + 500 output tokens |
| Anthropic — summaries (sonnet) | ~$0.15 | 3 summaries × ~4 k tokens in + 1 k out |
| S3 storage | ~$0.002 | 37 MB retained per meeting |
| S3 PUT requests | ~$0.002 | ~600 PUTs (screenshots + checkpoints + final) |
| NAT data transfer | ~$0.004 | ~40 MB × $0.09/GB egress |
| SES (2 emails) | ~$0.00002 | $0.10 per 1,000 emails |
| **Per-meeting subtotal** | **~$0.24** | |

### Total monthly cost by activity level

| Meetings/day | Meetings/month | LLM + infra variable | Fixed | **Total/mo** |
|-------------|----------------|----------------------|-------|-------------|
| 1 | 30 | $7.20 | $76.47 | **~$84** |
| 3 | 90 | $21.60 | $76.47 | **~$98** |
| 5 | 150 | $36.00 | $76.47 | **~$112** |
| 10 | 300 | $72.00 | $76.47 | **~$148** |
| 20 | 600 | $144.00 | $76.47 | **~$220** |

---

## Per-User Cost Estimate

Assumes 5 meetings/user/month (one per week, plus occasional extras).

| Team size | Meetings/mo | Fixed (allocated) | Variable | **Per user/mo** |
|-----------|------------|-------------------|----------|----------------|
| 1 | 5 | $76.47 | $1.20 | **~$78** |
| 5 | 25 | $76.47 | $6.00 | **~$16.50** |
| 10 | 50 | $76.47 | $12.00 | **~$8.85** |
| 20 | 100 | $76.47 | $24.00 | **~$5.02** |
| 50 | 250 | $76.47 | $60.00 | **~$2.73** |

> **Note:** The fixed Fargate cost dominates at low usage. The crossover point where always-on becomes more expensive than on-demand-tasks is approximately **4 meetings/day**. Below that threshold, spinning up a new Fargate task per meeting would be cheaper but adds a ~90 s cold start before each session.

---

## Cost Reduction Options

| Option | Estimated saving | Tradeoff |
|--------|-----------------|----------|
| **Fargate Spot instances** | ~70% on compute → **~$50/mo saved** | Risk of 2-min interruption notice (task killed mid-meeting) |
| **Graviton (ARM64) Fargate** | ~20% on compute → **~$14/mo saved** | Requires ARM64 Docker build (needs `--platform linux/arm64`) |
| **Scale-to-zero** (on-demand task per meeting) | **~$60/mo saved** on idle time | ~90 s cold start per meeting (Xvfb + Chrome init) |
| **Reduce screenshot interval to 10 s** | ~$0.04/meeting (halve analysis calls) | Less temporal transcript detail |
| **Use haiku for all summaries** | ~$0.12/meeting saved | Lower quality TL;DR / Story Arc output |
| **S3 lifecycle rule** (delete screenshots after 30 days) | Depends on volume | Transcripts retained, screenshots cheaper |

---

## Key Limits & Scaling Notes

| Limit | Current | Notes |
|-------|---------|-------|
| Concurrent meetings | **1** (1 Fargate task, 1 Chrome instance) | Increase `desiredCount` + Chrome sessions to scale |
| Max meeting duration | 240 min (configurable) | Set via `MAX_MEETING_MINUTES` |
| S3 transcript retention | 90-day lifecycle rule | Configurable in template |
| ALB listener rules | 2 added of 100 max | Room to grow |
| Cognito MAUs free tier | 10,000 | Effectively unlimited at current scale |
| ECS tasks per cluster | 500 | No concern at current scale |

---

## Deploy Reference

```bash
# Code change only (fast, ~5 min including rollover)
./deploy.sh --push-only

# CloudFormation config change only (no Docker rebuild, ~3 min)
./deploy.sh --sam-only

# Full deploy: rebuild image + push + update stack (~10 min)
./deploy.sh

# Tail live logs
aws logs tail /ecs/meet-fleet --follow --region us-east-1
```
