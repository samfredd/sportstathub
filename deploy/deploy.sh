#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deployment script — run this on the VPS every time you push new code.
# Usage:  bash /var/www/project/deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/project}"
DEPLOY_REF="${DEPLOY_REF:-main}"
DEPLOY_MODE="${DEPLOY_MODE:-build}" # build | pull
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.prod.yml}"
COMPOSE="docker compose -f ${COMPOSE_FILE}"
MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"

cd "$APP_DIR"

echo "════════════════════════════════════════"
echo "  Deploying $(git log -1 --format='%h %s')"
echo "════════════════════════════════════════"

# ── Pull latest code ─────────────────────────────────────────────────────────
echo "▶  Pulling latest code"
git pull --ff-only origin "$DEPLOY_REF"

# ── Ensure Docker network exists ─────────────────────────────────────────────
docker network inspect web >/dev/null 2>&1 || docker network create web

# ── Build or pull images ─────────────────────────────────────────────────────
case "$DEPLOY_MODE" in
  pull)
    echo "▶  Pulling Docker images"
    $COMPOSE pull backend frontend
    ;;
  build)
    echo "▶  Building Docker images"
    $COMPOSE build
    ;;
  *)
    echo "ERROR: DEPLOY_MODE must be 'build' or 'pull'." >&2
    exit 1
    ;;
esac

# ── Start / update all services ───────────────────────────────────────────────
echo "▶  Starting services"
$COMPOSE up -d --remove-orphans

# ── Pull Ollama model (no-op if already present) ──────────────────────────────
echo "▶  Ensuring Ollama model '${MODEL}' is available"
bash "${APP_DIR}/scripts/pull-ollama-model.sh" "$MODEL"

# ── Health check ─────────────────────────────────────────────────────────────
echo "▶  Health check"
sleep 5
if curl -sf --max-time 10 "http://localhost/health" > /dev/null 2>&1 || \
   curl -sfk --max-time 10 "https://localhost/health" > /dev/null 2>&1; then
  echo "  ✓ Backend is healthy"
else
  echo "  ✗ Health check failed — checking logs:"
  $COMPOSE logs --tail=30 backend
  exit 1
fi

echo ""
echo "✓ Deployment complete"
$COMPOSE ps
