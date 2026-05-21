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

if [[ -f "${APP_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${APP_DIR}/.env"
  set +a
fi

DOMAIN="${DEPLOY_DOMAIN:-${DOMAIN:-}}"
ACME_EMAIL="${DEPLOY_ACME_EMAIL:-${ACME_EMAIL:-}}"
export DOMAIN ACME_EMAIL

missing=()
for var in DOMAIN ACME_EMAIL DB_PASSWORD REDIS_PASSWORD SECRET_KEY ADMIN_INVITE_KEY; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "ERROR: Missing required deployment env vars: ${missing[*]}" >&2
  echo "Set them in ${APP_DIR}/.env or pass them from the deployment workflow." >&2
  exit 1
fi

echo "════════════════════════════════════════"
echo "  Deploying $(git log -1 --format='%h %s')"
echo "════════════════════════════════════════"

# ── Pull latest code ─────────────────────────────────────────────────────────
echo "▶  Pulling latest code"
git pull --ff-only origin "$DEPLOY_REF"
git submodule update --init --recursive

# ── Ensure Docker network exists ─────────────────────────────────────────────
docker network inspect web >/dev/null 2>&1 || docker network create web

# ── Build or pull images ─────────────────────────────────────────────────────
case "$DEPLOY_MODE" in
  pull)
    echo "▶  Pulling Docker images"
    $COMPOSE pull backend frontend ai-service oddswitch-api oddswitch-worker oddswitch-browser-worker
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
if curl -sfk --max-time 10 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/health" > /dev/null; then
  echo "  ✓ Backend is healthy"
else
  echo "  ✗ Backend health check failed — checking logs:"
  $COMPOSE logs --tail=30 traefik
  $COMPOSE logs --tail=30 backend
  exit 1
fi

if curl -sfk --max-time 10 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/" > /dev/null; then
  echo "  ✓ Frontend is reachable"
else
  echo "  ✗ Frontend health check failed — checking logs:"
  $COMPOSE logs --tail=30 traefik
  $COMPOSE logs --tail=30 frontend
  exit 1
fi

echo ""
echo "✓ Deployment complete"
$COMPOSE ps
