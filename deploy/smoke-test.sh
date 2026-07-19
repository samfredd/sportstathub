#!/bin/sh
# Business-level smoke tests run against a just-deployed production release,
# from the production host itself (see .github/workflows/production.yml).
# Exits non-zero on the first failing check; the caller decides whether to
# roll back. Deliberately POSIX sh, no bashisms — matches the deploy script.
set -eu

BASE_URL="${1:?usage: smoke-test.sh <base-url>}"
TIMEOUT="${SMOKE_TEST_TIMEOUT:-10}"

fail() {
  echo "::error::smoke test failed: $1" >&2
  exit 1
}

get_ok() {
  # $1 = path, $2 = human label
  curl -fsS --max-time "$TIMEOUT" "${BASE_URL}${1}" >/dev/null 2>&1 || fail "$2 ($1) did not return 2xx"
}

status_between() {
  # $1 = path, $2 = method, $3 = min status, $4 = max status, $5 = label
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" -X "$2" "${BASE_URL}${1}" -H 'Content-Type: application/json' -d '{}')"
  if [ "$code" -lt "$3" ] || [ "$code" -ge "$4" ]; then
    fail "$5 ($1) returned unexpected status $code"
  fi
}

echo "Running business smoke tests against ${BASE_URL} ..."

get_ok "/health/live" "liveness"
get_ok "/health/ready" "readiness (DB + Redis connectivity)"
get_ok "/" "homepage"
get_ok "/api/leagues?popular=true" "public leagues endpoint"
get_ok "/api/matches/live" "public live matches endpoint"
get_ok "/api/subscription-plans" "non-destructive subscription-plan read"
get_ok "/favicon.ico" "frontend static asset"

# Auth endpoint availability: a malformed login must fail cleanly (4xx) —
# not hang, not 5xx, not an unreachable connection — proving the auth route
# itself is up without needing real credentials.
status_between "/auth/login" "POST" 400 500 "auth endpoint availability"

# OddSwitch health, when the feature is deployed, is already verified by the
# per-service Docker healthcheck loop earlier in the deploy script (this
# repo doesn't expose an OddSwitch HTTP health path through the public
# domain to check independently here — see item 6 in the production
# hardening backlog for wiring that up properly).

echo "All business smoke tests passed."
