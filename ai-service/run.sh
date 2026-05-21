#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies if uvicorn is missing
if ! python3 -m uvicorn --version &>/dev/null; then
  echo "Installing dependencies..."
  pip3 install -r requirements.txt
fi

echo "Starting AI service on http://localhost:8000"
python3 -m uvicorn app.main:app --reload --port 8000
