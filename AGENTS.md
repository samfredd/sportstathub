# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Full-stack football analytics platform. Frontend is Next.js 16 + React 19; backend is Fastify 5 (Node.js ES modules). The two are independent apps that communicate over HTTP.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev    # Dev server on port 3000
npm run build  # Production build
npm run lint   # ESLint
```

### Backend (`/backend`)
```bash
# First-time setup
cp .env.example .env          # fill in values
docker compose up db redis -d  # start PostgreSQL + Redis
npm install
npm run migrate               # create tables (run once)

npm run dev                   # nodemon + pino-pretty
npm run start                 # production
```

## Architecture

### Frontend
Next.js App Router (`src/app/`). Path alias `@/` maps to `src/`. Backend URL is `NEXT_PUBLIC_API_URL` (set in `.env.local`).

- `src/app/` — pages: `/`, `/match/[id]`, `/codes`, `/referees`, `/h2h`, `/rankings`, `/contact`
- `src/components/` — shared UI (Navbar, MatchCard, Tabs, Icons, etc.)
- `src/lib/api.js` — centralized fetch wrapper for all backend calls; passes `next: { revalidate }` for SSR caching
- `src/lib/transforms.js` — maps API-Football raw fixture/standings objects to UI shapes (`fixtureToMatch`, `standingToRank`, `computeH2HStats`)
- `src/data/mock.js` — used as fallback when the backend is unavailable (codes page, sidebar leagues)

**Data flow per page:**
- `/` (home) — client component; `useEffect` fetches `/api/matches/live` or `/api/matches?date=` on tab/date change. Date buttons are dynamically generated (yesterday → +4 days)
- `/match/[id]` — server component; fetches match + H2H in sequence server-side; shows real goal events for live/finished matches
- `/codes` — server component with mock fallback; maps `bookmaker` → `platform`
- `/referees` — client component; search-first UI; calls `/api/referees?name=`
- `/h2h` — client component; debounced `/api/teams/search` autocomplete → compare button → `/api/h2h`
- `/rankings` — client component; league tab selector (PL/La Liga/Serie A/Bundesliga/Ligue 1/UCL) → `/api/leagues/:id/standings`

**Next.js 16 / React 19 caveat**: Breaking changes from older releases. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the relevant guide (`frontend/AGENTS.md` contains this warning).

### Backend
Fastify plugin system. Entry point: `server.js`. Registration order matters:

1. **Infrastructure** (`src/config/db.js`) — PostgreSQL + Redis with exponential-backoff retry
2. **CORS / JWT**
3. **`authenticate` plugin** (`src/plugins/authenticate.js`) — decorates `fastify.authenticate`, a `preHandler` that calls `request.jwtVerify()`
4. **Feature routes** — `authRoutes`, `oauthRoutes`, `footballRoutes`, `codesRoutes`, `refereesRoutes`

All errors thrown with a `.statusCode` property are caught by the global `setErrorHandler` in `server.js`.

Module layout:
```
src/modules/<feature>/
  *.routes.js      → Fastify plugin, registers routes, wires DI chain
  *.controller.js  → request/response boundary, calls service
  *.service.js     → business logic
  *.repository.js  → SQL queries only
  *.schemas.js     → Fastify JSON Schema objects
```

Shared helpers live in `src/helpers/auth.helpers.js` (re-exports from `src/modules/auth/auth.helpers.js` and adds `normalizeEmail` / `normalizeUsername`).

#### Football data — API-Football (`api-sports.io`)
Free tier: 100 requests/day. Set `FOOTBALL_API_KEY` in `.env`.

`src/modules/football/football.service.js` wraps every API call with Redis caching:
- Live fixtures: 60 s TTL
- Fixtures by date / detail: 5 min
- Match stats/events: 2 min
- Standings, H2H, leagues, lineups: 1 h
- Top scorers: 30 min

Cache keys follow the pattern `football:<endpoint>:<query-string>`. Redis failures are non-fatal (the service falls through to the live API).

#### API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register + send OTP |
| POST | `/auth/verify-otp` | — | Verify OTP, return JWT |
| POST | `/auth/login` | — | Password login, return JWT |
| GET | `/auth/google` | — | Start Google OAuth2 flow |
| GET | `/auth/google/callback` | — | OAuth2 callback |
| GET | `/api/matches/live` | — | All live fixtures |
| GET | `/api/matches?date=&league=&season=` | — | Fixtures by date |
| GET | `/api/matches/:id` | — | Fixture detail |
| GET | `/api/matches/:id/stats` | — | Match statistics |
| GET | `/api/matches/:id/lineups` | — | Lineups |
| GET | `/api/matches/:id/events` | — | Timeline events |
| GET | `/api/leagues?popular=true` | — | Leagues (add `popular=true` for top 9) |
| GET | `/api/leagues/:id/standings?season=` | — | Standings |
| GET | `/api/leagues/:id/scorers?season=` | — | Top scorers |
| GET | `/api/h2h?team1=&team2=&last=` | — | Head-to-head |
| GET | `/api/referees?name=&league=&season=` | — | Referee stats + recent fixtures |
| GET | `/api/codes?bookmaker=&limit=&offset=` | — | Booking codes list |
| GET | `/api/codes/:id` | — | Single booking code |
| POST | `/api/codes` | JWT | Submit a booking code |
| DELETE | `/api/codes/:id` | JWT | Remove own code (admin removes any) |
| GET | `/health` | — | Server + Redis status |

#### Auth flow
1. `POST /auth/register` → inserts user (unverified), generates OTP, stores hashed OTP in Redis with 15-min TTL, logs OTP in dev mode.
2. `POST /auth/verify-otp` → compares OTP hash, marks user verified, returns JWT.
3. `POST /auth/login` → password login; rejects unverified accounts.
4. Google OAuth2 with PKCE: start at `/auth/google`, lands at `/auth/google/callback`, upserts user by email, returns JWT.

### Infrastructure (Docker)
`backend/docker-compose.yaml`:
- PostgreSQL 16 — port 5432, user/pass `project`/`project123`, db `me`
- Redis 7 — port 6379, password via `REDIS_PASSWORD` env var

DB schema is in `src/migrations/001_initial.sql` (users + booking_codes tables). Run with `npm run migrate`.

Config: `src/config/env.config.js`. All env vars documented in `.env.example`.
