# Progress Tracker

This document tracks implementation progress for the MultiSport Predictions Platform. Update after each meaningful change.

## Architecture Decision (Canonical)

- **Frontend:** Next.js 13 App Router (`src/app/`), React 18, TypeScript — no Pages Router, no Clerk, no Prisma
- **Backend:** Fastify 5 + PostgreSQL (raw `pg`) + JWT (`@fastify/jwt`) — no ORM, no external auth provider
- **Auth:** Fastify JWT stored in `localStorage`; frontend reads via `communityApi.js` and admin/auth hooks

## Current Phase

Phase 3 — Auth-unified, Prisma/Clerk-free platform. Community module active. TypeScript throughout.

## Completed

| ID | Task | Date |
|----|------|------|
| 1 | Created community migration adding `predictions`, `forum_threads`, `comments`, `tracking_events`, `subscriptions` tables | 2026-05-02 |
| 2 | Verified `/api/teams/search` is fully implemented (controller, service, schema, route) | 2026-05-02 |
| 3 | Removed ClerkProvider from `layout.tsx`; simplified to plain HTML layout | 2026-05-02 |
| 4 | Replaced Clerk middleware with pass-through `middleware.ts` | 2026-05-02 |
| 5 | Rewrote `PredictionsHub.tsx` to call Fastify `/api/predictions` (community shape) | 2026-05-02 |
| 6 | Rewrote `CodeHub.tsx` to call Fastify `/api/codes` (actual `booking_codes` schema) | 2026-05-02 |
| 7 | Fixed `forum/[id]/page.tsx` — loads real comments from `communityApi.getComments('thread', id)` | 2026-05-02 |
| 8 | Fixed `predictions/[id]/page.tsx` — real comments, removed hardcoded fake TeamNewsBlock data | 2026-05-02 |
| 9 | Deleted `pages/`, `src/services/`, `prisma/`, `clerk-auth.ts`, `cache.ts`, `http.ts`, `prisma.ts`, `redis.ts`, `platform.ts` | 2026-05-02 |
| 10 | Updated `package.json`: removed `@clerk/nextjs`, `@prisma/client`, `prisma`, `ioredis`; removed prisma scripts | 2026-05-02 |
| 11 | Updated `context/architecture.md` to reflect final stack (Next.js App Router + Fastify + PostgreSQL + JWT) | 2026-05-02 |
| 12 | Converted all 53 `.js`/`.jsx` files in `frontend/src/` to `.ts`/`.tsx` — zero JS files remain | 2026-05-03 |
| 13 | Resolved migration conflict: deleted duplicate `002_community.sql`; canonical sequence is `001` → `002_admin_subscriptions` → `003_community_content` → `004_follows` | 2026-05-03 |
| 14 | Full functionality audit — identified 3 broken items: forum/new auth guard, prediction like button, creator follow | 2026-05-03 |
| 15 | Added auth guard to `forum/new/page.tsx` — redirects unauthenticated users to `/auth/login?redirect=/forum/new` | 2026-05-03 |
| 16 | Wired prediction like button to `communityApi.likePrediction(id)` — optimistic update with `liking` loading state | 2026-05-03 |
| 17 | Implemented creator follow full stack: `004_follows.sql` migration → `toggleFollow`/`isFollowing` repo fns → service → controller → `POST /api/creators/:id/follow` route → `communityApi.followCreator` → creator profile page | 2026-05-03 |
| 18 | Updated all context files to reflect current architecture | 2026-05-03 |
| 19 | Added backend premium access control: central auth/pro/admin guards, active subscription checks, feature-flag route enforcement, premium prediction masking, and admin premium toggles | 2026-05-15 |

## Active Work

Premium access audit completed.

## Next Steps

| ID | Task | Priority |
|----|------|----------|
| N1 | Run `npm install` in `frontend/` to clean up removed packages from `node_modules` | High |
| N2 | Run `npm run migrate` on the backend to apply `003_community_content.sql` and `004_follows.sql` | High |
| N3 | Verify frontend builds cleanly (`npm run build` in `frontend/`) | High |
| N4 | Add sport/category filtering to `/api/codes` backend endpoint (currently only `bookmaker` filter) | Medium |
| N5 | Add tracking pixel / click counting to `booking_codes` table (add `usage_count` column) | Medium |
| N6 | Add subscription management UI (plan upgrades, status display) | Low |
| N7 | Add bookmaker deep-link templates for Bet9ja, SportyBet, BetKing, etc. | Low |
| N8 | Integrate payment provider webhooks so subscription status changes are driven by verified payments instead of manual admin updates | High |

## Open Questions

| ID | Question | Status |
|----|----------|--------|
| Q1 | Payment provider (Paystack/Flutterwave) integration for subscriptions and creator payouts not yet implemented | Open |
| Q2 | Bookmaker deep-link URL templates per bookmaker not specified — `affiliateUrl` is stored as JSONB but templates vary | Open |
| Q3 | Live sports data provider for multi-sport (non-football) not yet specified beyond API-Football free tier | Open |

## Architecture Decisions

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| AD1 | No Clerk, no Prisma — Fastify JWT + raw pg only | User explicitly requested this stack; eliminates the dual-auth and dual-DB conflict that broke the app | 2026-05-02 |
| AD2 | App Router only, no Pages Router | User explicitly requested Next.js App Router + `src/` directory; Pages Router coexistence caused API conflicts | 2026-05-02 |
| AD3 | Community data shapes come from Fastify mapper (`mapPrediction`, `mapThread`, etc.) | Single source of truth in backend; frontend components adapted to these shapes directly | 2026-05-02 |
| AD4 | `booking_codes` table has no `deepLink` or `usageCount` — CodeHub simplified accordingly | Schema-driven; avoid phantom fields | 2026-05-02 |
