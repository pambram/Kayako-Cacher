#!/usr/bin/env bash
# deploy.sh - Build and deploy Meet Fleet to ECS Fargate
#
# Prerequisites (one-time manual steps):
#   1. Create Google OAuth 2.0 app in Google Cloud Console
#      - Application type: Web application
#      - Add authorized redirect URI:
#        https://meet-fleet-auth-899084202472.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
#      - Copy the client ID and secret (set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET below)
#   2. Verify SES sender: aws ses verify-email-identity --email-address pablo.ambram@trilogy.com
#
# Usage:
#   ./deploy.sh                    # full build + deploy
#   ./deploy.sh --push-only        # rebuild and push Docker image only (no SAM)
#   ./deploy.sh --sam-only         # SAM deploy only (skip Docker build, use existing image)
#   ./deploy.sh --force-ecs-deploy # force ECS rolling update using the already-pushed image (no build, no SAM)

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
AWS_REGION="us-east-1"
AWS_ACCOUNT="899084202472"
ECR_REPO="meet-fleet"
ECR_URI="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
STACK_NAME="meet-fleet"
SAM_BUCKET="${SAM_BUCKET:-aws-sam-cli-managed-default-samclisourcebucket-5p08inc14avx}"

# Route53 hosted zone for csaiautomations.com
HOSTED_ZONE_ID="Z05812782MGOP8T3KWCNL"
# ALB DNS (existing alb-mcp-oauth)
ALB_DNS="alb-mcp-oauth-2089582848.us-east-1.elb.amazonaws.com"
# Wildcard cert ARN for *.csaiautomations.com
WILDCARD_CERT_ARN="arn:aws:acm:us-east-1:899084202472:certificate/9c1a3ced-cab6-4e2b-8213-b99d18b7f2da"
# Existing ALB HTTPS listener
ALB_HTTPS_LISTENER_ARN="arn:aws:elasticloadbalancing:us-east-1:899084202472:listener/app/alb-mcp-oauth/1b879f9413ed8a71/4921e48343dd5863"

# ─── Secrets ────────────────────────────────────────────────────
# All modes load missing values from .env automatically.
# You can also export them in your shell before running.

MODE="${1:-}"
PUSH_ONLY="$MODE"
SAM_ONLY="$MODE"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ─── --force-ecs-deploy: skip build and SAM, just cycle the ECS service ───
if [[ "$MODE" == "--force-ecs-deploy" ]]; then
  echo "==> Meet Fleet — force ECS rolling update  [cluster=${STACK_NAME}-cluster  service=${STACK_NAME}]"
  aws ecs update-service \
    --cluster "${STACK_NAME}-cluster" \
    --service "$STACK_NAME" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    --query 'service.{Running:runningCount,Desired:desiredCount,Status:status}' \
    --output json
  echo ""
  echo "==> Done. ECS will pull the latest image and perform a rolling replacement."
  echo "    Watch progress: aws ecs wait services-stable --cluster ${STACK_NAME}-cluster --services ${STACK_NAME} --region ${AWS_REGION}"
  exit 0
fi

# Load any missing values from the local .env file first.
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  _env_val() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | sed "s/^${1}=//" | tr -d "'" | tr -d '"'; }
  [[ -z "${GOOGLE_OAUTH_CLIENT_ID:-}" ]]    && GOOGLE_OAUTH_CLIENT_ID=$(_env_val GOOGLE_OAUTH_CLIENT_ID)
  [[ -z "${GOOGLE_OAUTH_CLIENT_SECRET:-}" ]] && GOOGLE_OAUTH_CLIENT_SECRET=$(_env_val GOOGLE_OAUTH_CLIENT_SECRET)
  [[ -z "${GOOGLE_EMAIL:-}" ]]              && GOOGLE_EMAIL=$(_env_val GOOGLE_EMAIL)
  [[ -z "${GOOGLE_PASSWORD:-}" ]]           && GOOGLE_PASSWORD=$(_env_val GOOGLE_PASSWORD)
  [[ -z "${ANTHROPIC_API_KEY:-}" ]]         && ANTHROPIC_API_KEY=$(_env_val ANTHROPIC_API_KEY)
  [[ -z "${OPENAI_API_KEY:-}" ]]            && OPENAI_API_KEY=$(_env_val OPENAI_API_KEY)
  [[ -z "${GEMINI_API_KEY:-}" ]]            && GEMINI_API_KEY=$(_env_val GEMINI_API_KEY)
  [[ -z "${MEDIA_API_REFRESH_TOKEN:-}" ]]   && MEDIA_API_REFRESH_TOKEN=$(_env_val MEDIA_API_REFRESH_TOKEN)
  # Read the credentials JSON content from the file referenced by MEDIA_API_CREDENTIALS_PATH
  if [[ -z "${MEDIA_API_CREDENTIALS_JSON:-}" ]]; then
    _creds_path=$(_env_val MEDIA_API_CREDENTIALS_PATH)
    if [[ -n "$_creds_path" && -f "$_creds_path" ]]; then
      MEDIA_API_CREDENTIALS_JSON=$(cat "$_creds_path")
    fi
  fi
  [[ -z "${CAPTURE_MODE:-}" ]]              && CAPTURE_MODE=$(_env_val CAPTURE_MODE)
  [[ -z "${TRANSCRIPTION_MODE:-}" ]]        && TRANSCRIPTION_MODE=$(_env_val TRANSCRIPTION_MODE)
fi

GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID:-}"
GOOGLE_OAUTH_CLIENT_SECRET="${GOOGLE_OAUTH_CLIENT_SECRET:-}"
GOOGLE_EMAIL="${GOOGLE_EMAIL:-}"
GOOGLE_PASSWORD="${GOOGLE_PASSWORD:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
MEDIA_API_REFRESH_TOKEN="${MEDIA_API_REFRESH_TOKEN:-}"
MEDIA_API_CREDENTIALS_JSON="${MEDIA_API_CREDENTIALS_JSON:-}"
CAPTURE_MODE="${CAPTURE_MODE:-media-api}"
TRANSCRIPTION_MODE="${TRANSCRIPTION_MODE:-whisper}"

# Validate that the minimum required secrets are present for modes that need them.
if [[ "$PUSH_ONLY" != "--push-only" ]]; then
  [[ -z "$GOOGLE_OAUTH_CLIENT_ID" ]]  && { echo "Error: GOOGLE_OAUTH_CLIENT_ID not set (add to .env or export)"; exit 1; }
  [[ -z "$GOOGLE_EMAIL" ]]            && { echo "Error: GOOGLE_EMAIL not set (add to .env or export)"; exit 1; }
  [[ -z "$ANTHROPIC_API_KEY" ]]       && { echo "Error: ANTHROPIC_API_KEY not set (add to .env or export)"; exit 1; }
fi

echo "==> Meet Fleet deploy  [region=${AWS_REGION}  account=${AWS_ACCOUNT}]"

# ─── Step 1: Ensure ECR repository exists ──────────────────────
if [[ "$SAM_ONLY" != "--sam-only" ]]; then
  echo ""
  echo "── Step 1/5: ECR repository ─────────────────────────────────"
  aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" > /dev/null 2>&1 || \
    aws ecr create-repository \
      --repository-name "$ECR_REPO" \
      --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true \
      --output json > /dev/null
  echo "    ECR repo: ${ECR_URI}"

  # ─── Step 2: Copy background.js for Docker build ─────────────
  echo ""
  echo "── Step 2/5: Prepare build context ─────────────────────────"
  cp ../background.js ./background.js
  echo "    Copied background.js into bot/ (will be baked into image)"

  # ─── Step 3: Build + push Docker image ───────────────────────
  echo ""
  echo "── Step 3/5: Docker build + push ────────────────────────────"
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  # Build using buildx with --load so the image lands in the Docker daemon.
  # Then save to a tar and push via crane — this avoids the M1 Mac docker push bug
  # where amd64 cross-compiled layers get stuck at "Preparing".
  docker buildx use meet-fleet-builder 2>/dev/null || \
    docker buildx create --name meet-fleet-builder --driver docker-container --use
  docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --load \
    -t meet-fleet-local:latest \
    .

  echo "    Saving image to tar..."
  docker save meet-fleet-local:latest -o /tmp/meet-fleet.tar
  echo "    Saved $(du -sh /tmp/meet-fleet.tar | cut -f1)"

  # crane handles cross-platform manifest push correctly
  which crane > /dev/null 2>&1 || brew install crane
  aws ecr get-login-password --region "$AWS_REGION" | \
    crane auth login "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com" --username AWS --password-stdin
  crane push /tmp/meet-fleet.tar "${ECR_URI}:${IMAGE_TAG}"
  rm -f /tmp/meet-fleet.tar
  echo "    Pushed: ${ECR_URI}:${IMAGE_TAG}"

  # Clean up temporary copy
  rm -f ./background.js

  if [[ "$PUSH_ONLY" == "--push-only" ]]; then
    echo ""
    echo "── Push complete. Forcing ECS rolling update..."
    aws ecs update-service \
      --cluster meet-fleet-cluster \
      --service meet-fleet \
      --force-new-deployment \
      --region "$AWS_REGION" \
      --query 'service.{Running:runningCount,Desired:desiredCount}' \
      --output json
    echo "==> Done. ECS will pull the new image and roll over."
    exit 0
  fi
fi

IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

# ─── Step 4: SAM deploy (ECS + Cognito) ───────────────────────
echo ""
echo "── Step 4/5: SAM deploy ─────────────────────────────────────"
sam deploy \
  --template-file template-service.yaml \
  --stack-name "$STACK_NAME" \
  --s3-bucket "$SAM_BUCKET" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-confirm-changeset \
  --parameter-overrides \
    "MeetBotImageUri=${IMAGE_URI}" \
    "GoogleOAuthClientId=${GOOGLE_OAUTH_CLIENT_ID}" \
    "GoogleOAuthClientSecret=${GOOGLE_OAUTH_CLIENT_SECRET}" \
    "GoogleEmail=${GOOGLE_EMAIL}" \
    "GooglePassword=${GOOGLE_PASSWORD}" \
    "AnthropicApiKey=${ANTHROPIC_API_KEY}" \
    "OpenAIApiKey=${OPENAI_API_KEY}" \
    "GeminiApiKey=${GEMINI_API_KEY}" \
    "CaptureMode=${CAPTURE_MODE}" \
    "MediaApiCredentialsJson=$(echo -n "${MEDIA_API_CREDENTIALS_JSON}" | base64)" \
    "MediaApiRefreshToken=${MEDIA_API_REFRESH_TOKEN}" \
    "TranscriptionMode=${TRANSCRIPTION_MODE}"

# ─── Step 5: DNS + TLS wiring (idempotent) ────────────────────
echo ""
echo "── Step 5/5: DNS + TLS ──────────────────────────────────────"

# Add wildcard cert to ALB listener if not already present
EXISTING_CERTS=$(aws elbv2 describe-listener-certificates \
  --listener-arn "$ALB_HTTPS_LISTENER_ARN" \
  --query 'Certificates[*].CertificateArn' \
  --output text --region "$AWS_REGION")

if echo "$EXISTING_CERTS" | grep -q "$WILDCARD_CERT_ARN"; then
  echo "    Wildcard cert already on ALB listener — skipping"
else
  aws elbv2 add-listener-certificates \
    --listener-arn "$ALB_HTTPS_LISTENER_ARN" \
    --certificates "CertificateArn=${WILDCARD_CERT_ARN}" \
    --region "$AWS_REGION"
  echo "    Added *.csaiautomations.com cert to ALB listener"
fi

# Upsert Route53 CNAME for meet-fleet.csaiautomations.com
EXISTING_RECORD=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='meet-fleet.csaiautomations.com.'].Name" \
  --output text 2>/dev/null || true)

if [[ -n "$EXISTING_RECORD" ]]; then
  echo "    Route53 CNAME already exists — skipping"
else
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"meet-fleet.csaiautomations.com.\",
          \"Type\": \"CNAME\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"${ALB_DNS}\"}]
        }
      }]
    }"
  echo "    Created CNAME: meet-fleet.csaiautomations.com → ${ALB_DNS}"
fi

# Upsert Route53 CNAME for witness.csaiautomations.com
WITNESS_RECORD=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='witness.csaiautomations.com.'].Name" \
  --output text 2>/dev/null || true)

if [[ -n "$WITNESS_RECORD" ]]; then
  echo "    Route53 CNAME witness.csaiautomations.com already exists — skipping"
else
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"witness.csaiautomations.com.\",
          \"Type\": \"CNAME\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"${ALB_DNS}\"}]
        }
      }]
    }"
  echo "    Created CNAME: witness.csaiautomations.com → ${ALB_DNS}"
fi

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Meet Fleet deployed successfully                            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Dashboard : https://witness.csaiautomations.com            ║"
echo "║  Alias     : https://meet-fleet.csaiautomations.com         ║"
echo "║  Auth      : Google OAuth (trilogy.com accounts)            ║"
echo "║  Logs      : aws logs tail /ecs/meet-fleet --follow         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  If this is the first deploy, allow ~3 min for:"
echo "    1. ECS task to start (Xvfb + Chrome init)"
echo "    2. ALB health checks to pass"
echo "    3. DNS propagation (CNAME)"
