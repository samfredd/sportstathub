#!/usr/bin/env bash
# Pull the configured Ollama model into the running container.
# Usage: ./scripts/pull-ollama-model.sh [model]
# Defaults to OLLAMA_MODEL env var, then qwen2.5:1.5b.
set -euo pipefail

MODEL="${1:-${OLLAMA_MODEL:-qwen2.5:1.5b}}"
CONTAINER="${OLLAMA_CONTAINER:-ollama}"
TIMEOUT=300   # seconds to wait for Ollama to be ready

echo "==> Waiting for Ollama container '${CONTAINER}' to be healthy..."
elapsed=0
until docker exec "${CONTAINER}" ollama list >/dev/null 2>&1; do
  if [ "${elapsed}" -ge "${TIMEOUT}" ]; then
    echo "ERROR: Ollama did not become ready within ${TIMEOUT}s." >&2
    exit 1
  fi
  sleep 5
  elapsed=$((elapsed + 5))
  echo "    ...still waiting (${elapsed}s)"
done

echo "==> Pulling model: ${MODEL}"
docker exec "${CONTAINER}" ollama pull "${MODEL}"

echo "==> Done. Verify with:"
echo "    docker exec ${CONTAINER} ollama list"
