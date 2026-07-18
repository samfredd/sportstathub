#!/usr/bin/env bash
# Start the Fastify backend (via PM2). AI predictions call the hosted
# NVIDIA AI API directly, so there is no local model container to manage.
#
# Usage (from project root):
#   ./scripts/start-ai-backend.sh
#
# What it does:
#   1. Ensures db + redis are up (uses backend/docker-compose.yaml for dev,
#      or docker-compose.prod.yml on the VPS when --prod flag is passed)
#   2. Checks that backend/.env has NVIDIA_API_KEY set
#   3. Starts or reloads the PM2 "backend" process
#   4. Verifies the backend health endpoint

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_COMPOSE="$ROOT_DIR/backend/docker-compose.yaml"       # dev: db + redis only
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"            # VPS: full stack
BACKEND_ENV="$ROOT_DIR/backend/.env"
PM2_ECOSYSTEM="$ROOT_DIR/deploy/ecosystem.config.cjs"

PROD_MODE=false
for arg in "$@"; do [[ "$arg" == "--prod" ]] && PROD_MODE=true; done

HEALTH_TIMEOUT=120
BACKEND_PORT=4000

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "▶  $*"; }
ok()   { echo "  ✓ $*"; }
err()  { echo "  ✗ $*" >&2; }

start_infra() {
  if [[ "$PROD_MODE" == true ]]; then
    log "Starting db + redis (prod compose)..."
    # Load .env so docker compose doesn't warn about missing vars
    set -a; [[ -f "$ROOT_DIR/.env" ]] && source "$ROOT_DIR/.env"; set +a
    docker compose -f "$PROD_COMPOSE" up -d db redis
  else
    log "Starting db + redis (dev compose)..."
    docker compose -f "$INFRA_COMPOSE" up -d
  fi
  ok "db + redis up"
}

check_nvidia_api_key() {
  if [[ ! -f "$BACKEND_ENV" ]]; then
    err "backend/.env not found. Copy backend/.env.example first:"
    err "  cp backend/.env.example backend/.env"
    exit 1
  fi

  local key
  key="$(grep -E '^NVIDIA_API_KEY=' "$BACKEND_ENV" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  if [[ -z "$key" ]]; then
    err "NVIDIA_API_KEY is not set in backend/.env."
    err "Get an API key at https://build.nvidia.com and add it to backend/.env."
    exit 1
  fi
  ok "NVIDIA_API_KEY is set"
}

start_backend_pm2() {
  if ! command -v pm2 &>/dev/null; then
    err "pm2 not found. Install it: npm install -g pm2"
    err "Then re-run this script."
    exit 1
  fi

  if pm2 list 2>/dev/null | grep -q " backend "; then
    log "Reloading existing PM2 'backend' process..."
    pm2 reload "$PM2_ECOSYSTEM" --only backend --update-env
  else
    log "Starting PM2 'backend' process..."
    pm2 start "$PM2_ECOSYSTEM" --only backend
  fi
  pm2 save --force >/dev/null
  ok "PM2 backend process running"
}

check_backend_health() {
  log "Waiting for backend to accept connections..."
  local elapsed=0
  until curl -sf "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; do
    if [[ $elapsed -ge 30 ]]; then
      err "Backend did not respond within 30s."
      err "Check logs: pm2 logs backend --lines 50"
      exit 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf "    ...%ds\r" "$elapsed"
  done
  echo ""
  ok "Backend is up at http://localhost:${BACKEND_PORT}"
}

# ── Main ──────────────────────────────────────────────────────────────────────
cd "$ROOT_DIR"

echo "════════════════════════════════════════"
echo "  Starting Backend (NVIDIA AI)"
echo "  Mode  : $( [[ "$PROD_MODE" == true ]] && echo production || echo dev )"
echo "════════════════════════════════════════"

start_infra            # 1. db + redis
check_nvidia_api_key   # 2. verify NVIDIA_API_KEY is configured
start_backend_pm2      # 3. start / reload PM2 process
check_backend_health   # 4. verify

echo ""
echo "  ✓ All services running"
echo ""
echo "  Test AI   : curl http://localhost:${BACKEND_PORT}/api/ai/test"
echo "  API logs  : pm2 logs backend"
echo "  Stop all  : pm2 stop backend"
