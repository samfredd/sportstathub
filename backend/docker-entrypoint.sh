#!/bin/sh
set -e
# Migrations are NOT run here by default. Running them on every container
# start meant every replica in a multi-instance deploy raced to apply the
# same migrations concurrently, and a bad migration could crash-loop the
# whole fleet instead of failing a single, visible deploy step. The
# production deploy workflow (.github/workflows/production.yml) instead
# runs `docker compose run --rm backend node dist/migrate.js` once, before
# starting this release — which passes that command as CMD args to this
# entrypoint. Any args passed here MUST be exec'd, not ignored, or a `run`
# invocation like that silently starts the server instead of doing what it
# was asked to do (and then hangs, since a server process never exits).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
echo "▶ Starting server..."
exec node dist/server.js
