#!/usr/bin/env bash
# OddSwitch Engine — start script
# Starts the API + Celery translation worker + Celery browser worker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[OddSwitch]${NC} $*"; }
warn()  { echo -e "${YELLOW}[OddSwitch]${NC} $*"; }

# ── Dependencies ─────────────────────────────────────────────────────────────
info "Checking dependencies..."

if ! python3 -c "import uvicorn" 2>/dev/null; then
  warn "Installing API dependencies..."
  pip3 install -r requirements/api.txt --quiet
fi
if ! python3 -c "import celery" 2>/dev/null; then
  warn "Installing worker dependencies..."
  pip3 install -r requirements/worker.txt --quiet
fi
if ! python3 -c "import playwright" 2>/dev/null; then
  warn "Installing browser dependencies..."
  pip3 install -r requirements/browser.txt --quiet
  python3 -m playwright install chrome 2>/dev/null || warn "playwright install chrome failed — Bet9ja extraction may not work"
fi

# ── Copy env file if missing ──────────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env created from .env.example — edit it with your settings before continuing"
  fi
fi

# ── DB migrations ─────────────────────────────────────────────────────────────
info "Running database migrations..."
python3 -m alembic upgrade head

# ── Background workers ────────────────────────────────────────────────────────
info "Starting Celery translation worker..."
python3 -m celery -A app.queue.celery_app worker \
  --loglevel=warning --queues=translation --concurrency=2 &
CELERY_PID=$!

info "Starting Celery browser worker..."
python3 -m celery -A app.queue.celery_app worker \
  --loglevel=warning --queues=browser --concurrency=1 &
BROWSER_PID=$!

# ── Cleanup on exit ───────────────────────────────────────────────────────────
trap 'info "Shutting down workers..."; kill $CELERY_PID $BROWSER_PID 2>/dev/null || true' EXIT INT TERM

# ── API ───────────────────────────────────────────────────────────────────────
info "Starting OddSwitch API on http://localhost:8001"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
