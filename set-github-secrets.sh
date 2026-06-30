#!/usr/bin/env bash
# Push every KEY=VALUE from the production .env to GitHub Secrets.
# Run this ONCE on your production server after:
#   1. sudo apt install -y gh
#   2. gh auth login  (use a PAT with repo scope)
#
# Usage:  bash set-github-secrets.sh

set -euo pipefail

REPO="samfredd/sportstathub"
ENV_FILE="${1:-/var/www/project/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found — pass the path as the first argument if it differs." >&2
  exit 1
fi

echo "Reading secrets from $ENV_FILE → github.com/$REPO"
echo ""

count=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blank lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && { ((skipped++)) || true; continue; }

  # Must contain '='
  [[ "$line" != *=* ]] && { ((skipped++)) || true; continue; }

  key="${line%%=*}"
  value="${line#*=}"

  # Key must be non-empty and a valid identifier
  [[ -z "$key" || ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && { ((skipped++)) || true; continue; }

  printf '  %-30s ' "$key"
  printf '%s' "$value" | gh secret set "$key" --repo "$REPO" 2>&1 && echo "✓" || echo "✗ (check token permissions)"
  ((count++)) || true

done < "$ENV_FILE"

echo ""
echo "Done — $count secret(s) set, $skipped line(s) skipped."
echo "Verify: https://github.com/$REPO/settings/secrets/actions"
echo ""
echo "Next steps:"
echo "  1. Push to main (or trigger the workflow manually) to deploy with the new secrets."
echo "  2. The deploy job writes a fresh .env from those secrets — the old file is replaced."
echo "  3. Confirm the app is healthy, then you're done."
