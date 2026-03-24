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
#   ./deploy.sh              # full build + deploy
#   ./deploy.sh --push-only  # rebuild and push Docker image only (no SAM)
#   ./deploy.sh --sam-only   # SAM deploy only (skip Docker build, use existing image)

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

# ─── Secrets (export these in your shell or set here) ──────────
: "${GOOGLE_OAUTH_CLIENT_ID:?Need to set GOOGLE_OAUTH_CLIENT_ID}"
: "${GOOGLE_OAUTH_CLIENT_SECRET:?Need to set GOOGLE_OAUTH_CLIENT_SECRET}"
: "${GOOGLE_EMAIL:?Need to set GOOGLE_EMAIL}"
: "${GOOGLE_PASSWORD:?Need to set GOOGLE_PASSWORD}"
: "${ANTHROPIC_API_KEY:?Need to set ANTHROPIC_API_KEY}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

PUSH_ONLY="${1:-}"
SAM_ONLY="${1:-}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

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
    echo "==> Push complete. Skipping SAM deploy (--push-only)."
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
    "OpenAIApiKey=${OPENAI_API_KEY}"

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

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Meet Fleet deployed successfully                            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Dashboard : https://meet-fleet.csaiautomations.com         ║"
echo "║  Auth      : Google OAuth (trilogy.com accounts)            ║"
echo "║  Logs      : aws logs tail /ecs/meet-fleet --follow         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  If this is the first deploy, allow ~3 min for:"
echo "    1. ECS task to start (Xvfb + Chrome init)"
echo "    2. ALB health checks to pass"
echo "    3. DNS propagation (CNAME)"
