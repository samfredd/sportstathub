#!/bin/sh
set -e
# Migrations are NOT run here. Running them on every container start meant
# every replica in a multi-instance deploy raced to apply the same
# migrations concurrently, and a bad migration could crash-loop the whole
# fleet instead of failing a single, visible deploy step. The production
# deploy workflow (.github/workflows/production.yml) runs migrations once,
# in a dedicated one-off container, before starting this release. For local
# development, run `npm run migrate` explicitly (see backend/README or
# CLAUDE.md) before `npm run dev`/`npm start`.
echo "▶ Starting server..."
exec node dist/server.js
