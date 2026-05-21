Architecture Context

This document describes the actual system architecture implemented in this repository. It supersedes earlier microservices planning documents.

## 1. Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 13 App Router (`src/app/`), React 18, TypeScript, Tailwind CSS v4 |
| Backend | Fastify 5, Node.js ES modules |
| Database | PostgreSQL 16 (raw `pg` driver, no ORM) |
| Cache | Redis 7 (non-fatal, optional) |
| Auth | Fastify JWT (`@fastify/jwt`) — token stored in `localStorage` |
| Sports data | API-Football (`api-sports.io`) |

There is no Clerk, no Prisma, no Pages Router, no microservices gateway, and no separate AI service in production.

## 2. Repository Layout

```
project/
  frontend/          Next.js 13 App Router
  backend/           Fastify 5 API server
  context/           Documentation (this folder)
```

## 3. Frontend Architecture

**Routing:** App Router only (`src/app/`). No `pages/` directory.

**Path alias:** `@/` → `src/`

**Key directories:**
- `src/app/` — pages and layouts
  - `(site)/` — public-facing routes
  - `(auth)/` — login, register, verify-otp, oauth-callback
  - `(admin)/` — admin dashboard
- `src/components/` — shared UI components
- `src/lib/` — helpers: `api.ts`, `communityApi.ts`, `adminApi.ts`, `transforms.ts`, `utils.ts`, `env.ts`
- `src/types/` — TypeScript types (`domain.ts`)
- `src/hooks/` — React custom hooks

**Auth pattern:** After login the JWT is stored in `localStorage` under the key `token`. Components read it directly or via hooks. The `communityApi.ts` lib reads it automatically and adds the `Authorization: Bearer` header.

**Data fetching:**
- Football/sports data → `src/lib/api.ts` → `NEXT_PUBLIC_API_URL/api/...`
- Community data (predictions, forum, creators) → `src/lib/communityApi.ts` → `NEXT_PUBLIC_API_URL/api/...`
- Admin data → `src/lib/adminApi.ts` → `NEXT_PUBLIC_API_URL/...`

**Environment variable:** `NEXT_PUBLIC_API_URL` (`.env.local`) — Fastify backend URL, defaults to `http://localhost:4000`.

## 4. Backend Architecture

**Entry point:** `backend/server.js`

**Plugin registration order:**
1. Infrastructure (`src/config/db.js`) — PostgreSQL + Redis with exponential-backoff retry
2. CORS
3. `@fastify/jwt` with `config.secretKey`
4. `authenticate` plugin (`src/plugins/authenticate.js`) — decorates `fastify.authenticate`
5. Feature route plugins

**Module layout:**
```
src/modules/<feature>/
  *.routes.ts      → Fastify plugin, route registration
  *.controller.ts  → request/response boundary
  *.service.ts     → business logic
  *.repository.ts  → SQL queries only
  *.schemas.ts     → Fastify JSON Schema validation
```

**Modules:**
- `auth` — register, verify-otp, login, Google OAuth2
- `football` — API-Football wrapper with Redis caching
- `codes` — booking codes CRUD
- `referees` — referee stats
- `community` — predictions, forum threads, comments, creators, tracking
- `admin` — admin dashboard
- `contact` — contact form

## 5. Database Schema

Migrations live in `backend/src/migrations/` and run via `npm run migrate` (sorted alphabetically).

**001_initial.sql:** `users`, `booking_codes`

**002_admin_subscriptions.sql:** `subscriptions` — plan `'free' | 'pro' | 'enterprise'`, status `'active' | 'cancelled' | 'expired'`

**003_community_content.sql:** `predictions`, `forum_threads`, `comments`, `tracking_events`

**004_follows.sql:** `creator_follows` — `(follower_id, creator_id)` unique pair with cascade delete

Key invariants:
- `users.role` is `'user' | 'creator' | 'admin'`
- Community tables reference `users(id)` with `ON DELETE SET NULL`
- `predictions.league`, `predictions.match_data`, `predictions.prediction`, `predictions.booking_code` are JSONB columns
- `comments` is polymorphic: `target_type = 'prediction' | 'thread'`
- `creator_follows` has a `UNIQUE(follower_id, creator_id)` constraint; `toggleFollow` uses INSERT + ON CONFLICT DO NOTHING or DELETE

## 6. Auth Flow

1. `POST /auth/register` — inserts user, generates OTP, stores hashed OTP in Redis (15-min TTL)
2. `POST /auth/verify-otp` — verifies OTP, marks user verified, returns JWT
3. `POST /auth/login` — password login, returns JWT
4. Google OAuth2 — PKCE flow via `/auth/google` → `/auth/google/callback`, upserts user, returns JWT

JWT payload: `{ id, email, role }`. Secret key from `JWT_SECRET` env var.

## 6.1 Premium Access Control

Premium access is enforced on the Fastify backend, not by frontend state. The `authenticate` plugin centralises `requireAuth`, `requireAdmin`, `requireProAccess`, `optionalAuth`, `requireFeatureAccess`, `isSubscriptionActive`, and content checks.

Access rules:
- Guests have no premium access and receive `401` on direct premium detail/API requests.
- Free users and inactive paid users receive `403`.
- Active `pro` / `enterprise` subscriptions are valid only when `status = 'active'` and `expires_at` is null or in the future.
- `cancelled`, `expired`, `pending`, and `failed` subscriptions are denied.
- Admin users bypass premium gates.

Premium prediction list responses may include teaser rows, but full odds, confidence, analysis, and booking codes are stripped unless the user has access. Direct premium prediction detail and comments require access. Feature-flagged APIs such as H2H, advanced stats, AI analysis, referee search, and booking-code access use `feature_flags.required_plan`, so admin changes to free/pro/enterprise are enforced server-side.

## 7. API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register + send OTP |
| POST | `/auth/verify-otp` | — | Verify OTP, return JWT |
| POST | `/auth/login` | — | Password login |
| GET | `/auth/google` | — | Google OAuth2 start |
| GET | `/auth/google/callback` | — | OAuth2 callback |
| GET | `/api/matches/live` | — | Live fixtures |
| GET | `/api/matches?date=` | — | Fixtures by date |
| GET | `/api/matches/:id` | — | Fixture detail |
| GET | `/api/matches/:id/stats` | — | Match stats |
| GET | `/api/matches/:id/lineups` | — | Lineups |
| GET | `/api/matches/:id/events` | — | Timeline events |
| GET | `/api/leagues?popular=true` | — | Leagues |
| GET | `/api/leagues/:id/standings` | — | Standings |
| GET | `/api/leagues/:id/scorers` | — | Top scorers |
| GET | `/api/h2h?team1=&team2=` | — | Head-to-head |
| GET | `/api/teams/search?name=` | — | Team search |
| GET | `/api/referees?name=` | — | Referee stats |
| GET | `/api/codes?bookmaker=&limit=` | — | Booking codes |
| POST | `/api/codes` | JWT | Submit a code |
| DELETE | `/api/codes/:id` | JWT | Delete own code |
| GET | `/api/predictions?sport=&limit=` | — | Community predictions |
| GET | `/api/predictions/:id` | — | Single prediction |
| POST | `/api/predictions` | JWT | Create prediction |
| GET | `/api/forum/threads` | — | Forum threads |
| GET | `/api/forum/threads/:id` | — | Single thread |
| POST | `/api/forum/threads` | JWT | Create thread |
| GET | `/api/comments?targetType=&targetId=` | — | Comments |
| POST | `/api/comments` | JWT | Post a comment |
| GET | `/api/creators` | — | Creator list |
| GET | `/api/creators/leaderboard` | — | Creator leaderboard |
| GET | `/api/creators/:id` | — | Creator profile |
| POST | `/api/creators/:id/follow` | JWT | Toggle follow/unfollow creator |
| GET | `/api/platform/stats` | — | Platform stats |
| GET | `/api/dashboard/creator` | JWT | Creator dashboard |
| GET | `/api/dashboard/me` | JWT | User dashboard |
| POST | `/api/tracking/click` | — | Track event |
| GET | `/health` | — | Server health |

## 8. Caching Strategy (Football module)

Redis keys follow `football:<endpoint>:<query>`. TTLs:
- Live fixtures: 60 s
- Fixtures by date/detail: 5 min
- Match stats/events: 2 min
- Standings, H2H, leagues, lineups: 1 h
- Top scorers: 30 min

Redis failures are non-fatal; the service falls through to the live API.

## 9. Infrastructure (Docker)

`backend/docker-compose.yaml`:
- PostgreSQL 16 — port 5432, credentials `project/project123`, db `me`
- Redis 7 — port 6379, password via `REDIS_PASSWORD` env var
