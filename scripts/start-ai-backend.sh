#!/usr/bin/env bash
# Start the Ollama AI container and the Fastify backend (via PM2).
#
# Usage (from project root):
#   ./scripts/start-ai-backend.sh
#
# What it does:
#   1. Starts Ollama via docker-compose.ollama.yml (no prod secrets needed)
#   2. Also ensures db + redis are up (uses backend/docker-compose.yaml for dev,
#      or docker-compose.prod.yml on the VPS when --prod flag is passed)
#   3. Waits for Ollama to pass its healthcheck
#   4. Pulls the model if it isn't already in the volume
#   5. Ensures backend/.env has OLLAMA_BASE_URL=http://localhost:11434
#      (PM2 runs on the host, not inside Docker, so it resolves via the bound port)
#   6. Starts or reloads the PM2 "backend" process
#   7. Verifies the backend health endpoint

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OLLAMA_COMPOSE="$ROOT_DIR/docker-compose.ollama.yml"
INFRA_COMPOSE="$ROOT_DIR/backend/docker-compose.yaml"       # dev: db + redis only
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"            # VPS: full stack
BACKEND_ENV="$ROOT_DIR/backend/.env"
PM2_ECOSYSTEM="$ROOT_DIR/deploy/ecosystem.config.cjs"

PROD_MODE=false
for arg in "$@"; do [[ "$arg" == "--prod" ]] && PROD_MODE=true; done

# Resolve model: CLI arg → root .env → backend .env → default
OLLAMA_MODEL="${OLLAMA_MODEL:-}"
for env_file in "$ROOT_DIR/.env" "$BACKEND_ENV"; do
  if [[ -z "$OLLAMA_MODEL" && -f "$env_file" ]]; then
    OLLAMA_MODEL="$(grep -E '^OLLAMA_MODEL=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)"
  fi
done
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"

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

start_ollama() {
  if ! docker image inspect ollama/ollama:latest >/dev/null 2>&1; then
    echo ""
    echo "  ────────────────────────────────────────────────────"
    echo "  The Ollama image is not downloaded yet (~2 GB)."
    echo ""
    echo "  Pull it first in a separate terminal, then re-run"
    echo "  this script:"
    echo ""
    echo "      docker pull ollama/ollama:latest"
    echo ""
    echo "  Tip: if it gets stuck at 0 B, restart Docker Desktop"
    echo "  and try the pull again."
    echo "  ────────────────────────────────────────────────────"
    echo ""
    exit 1
  fi

  ok "ollama/ollama:latest already present locally"
  log "Starting Ollama container..."
  docker compose -f "$OLLAMA_COMPOSE" up -d
  ok "Ollama container started"
}

wait_healthy() {
  local elapsed=0
  log "Waiting for Ollama healthcheck (up to ${HEALTH_TIMEOUT}s)..."
  until docker compose -f "$OLLAMA_COMPOSE" ps ollama 2>/dev/null | grep -q "(healthy)"; do
    if [[ $elapsed -ge $HEALTH_TIMEOUT ]]; then
      err "Ollama did not become healthy within ${HEALTH_TIMEOUT}s."
      err "Check logs: docker compose -f docker-compose.ollama.yml logs ollama"
      exit 1
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    printf "    ...%ds\r" "$elapsed"
  done
  echo ""
  ok "Ollama is healthy"
}

ensure_model_pulled() {
  log "Checking if model '$OLLAMA_MODEL' is available..."
  if docker exec ollama ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
    ok "Model '$OLLAMA_MODEL' already present"
  else
    log "Pulling model '$OLLAMA_MODEL' (this may take a few minutes on first run)..."
    docker exec ollama ollama pull "$OLLAMA_MODEL"
    ok "Model pulled"
  fi
}

patch_backend_env() {
  if [[ ! -f "$BACKEND_ENV" ]]; then
    err "backend/.env not found. Copy backend/.env.example first:"
    err "  cp backend/.env.example backend/.env"
    exit 1
  fi

  local target="http://localhost:11434"

  # Update or append OLLAMA_BASE_URL
  if grep -qE '^OLLAMA_BASE_URL=' "$BACKEND_ENV"; then
    local current
    current="$(grep -E '^OLLAMA_BASE_URL=' "$BACKEND_ENV" | head -1 | cut -d= -f2-)"
    if [[ "$current" != "$target" ]]; then
      sed -i.bak "s|^OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=$target|" "$BACKEND_ENV"
      ok "OLLAMA_BASE_URL updated → $target"
    else
      ok "OLLAMA_BASE_URL already correct ($target)"
    fi
  else
    echo "OLLAMA_BASE_URL=$target" >> "$BACKEND_ENV"
    ok "OLLAMA_BASE_URL added to backend/.env"
  fi

  # Update or append OLLAMA_MODEL
  if grep -qE '^OLLAMA_MODEL=' "$BACKEND_ENV"; then
    sed -i.bak "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=$OLLAMA_MODEL|" "$BACKEND_ENV"
  else
    echo "OLLAMA_MODEL=$OLLAMA_MODEL" >> "$BACKEND_ENV"
  fi
  ok "OLLAMA_MODEL set to $OLLAMA_MODEL"

  rm -f "${BACKEND_ENV}.bak"
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
echo "  Starting Ollama + Backend"
echo "  Model : $OLLAMA_MODEL"
echo "  Mode  : $( [[ "$PROD_MODE" == true ]] && echo production || echo dev )"
echo "════════════════════════════════════════"

start_infra          # 1. db + redis
start_ollama         # 2. ollama (no prod secrets needed)
wait_healthy         # 3. healthcheck
ensure_model_pulled  # 4. pull model if missing
patch_backend_env    # 5. write correct URL into backend/.env
start_backend_pm2    # 6. start / reload PM2 process
check_backend_health # 7. verify

echo ""
echo "  ✓ All services running"
echo ""
echo "  Test AI   : curl http://localhost:${BACKEND_PORT}/api/ai/test"
echo "  API logs  : pm2 logs backend"
echo "  AI logs   : docker compose -f docker-compose.ollama.yml logs -f ollama"
echo "  Stop all  : pm2 stop backend && docker compose -f docker-compose.ollama.yml stop"
