# ── Stage 1: Build TypeScript ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY server.ts migrate.ts seed-admin.ts ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 fastify

# Only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Compiled output
COPY --from=builder /app/dist ./dist

# SQL migration files (not compiled by tsc, must be copied separately)
COPY --from=builder /app/src/migrations ./dist/src/migrations

# Startup script: starts the server only. Migrations run as a separate
# one-off container in the deploy workflow, not on every container start
# (see docker-entrypoint.sh).
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER fastify
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
