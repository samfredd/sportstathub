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
| 20 | Focused live-data API on football only: `getSports()` marks other sports `comingSoon`; home + sidebar fetch leagues/matches for active sports only; sport selectors render non-football as disabled "Soon" chips — eliminates the per-load multi-sport league fan-out that burned the API-Football daily quota | 2026-06-10 |
| 21 | Hardened football API caching: serve-stale-on-error (24h stale copy) + 429 cooldown marker in `football.service.ts apiFetch`, so quota exhaustion degrades to last-good data instead of 429/502; bumped leagues TTL to 6h | 2026-06-10 |
| 22 | Match detail Smart Analyse now recomputes Data Signals + win-probability model client-side from fetched live stats (`deriveSignals`/`deriveModel` in `_tabs.tsx`) instead of leaving them H2H-only | 2026-06-10 |
| 23 | Fixed `getMatchPlayerStats` defaulting to basketball (service + controller) — now defaults to football | 2026-06-10 |
| 24 | Added shared HTTP cache-header helper (`helpers/http-cache.helpers.ts`): `cache(ttl, scope)` + encapsulated `onSend` hook. Applied to football, odds, and news read routes — public scope for shared data (CDN-cacheable), private scope for pro-gated odds/stats endpoints; `stale-while-revalidate = 4×ttl` pairs with service serve-stale | 2026-06-10 |
| 25 | Fixed xG stat always showing 0 on match pages: `_tabs.tsx` STAT_API_KEY mapped xG to "Expected Goals" but API-Football returns `expected_goals`; now maps correctly with a defensive fallback in extractStat/getRowStatScore. Removed the "Tackles" stat pill (provider never returns tackles). Verified across leagues | 2026-06-10 |
| 26 | Fixed React hydration error on home page: `TrendingHeroCarousel` HeroPredSlide had a `<Link>` ("See all trending") nested inside the card `<Link>` (invalid `<a>`-in-`<a>`); converted the inner link to a `router.push` button. Verified 0 nested anchors in DOM | 2026-06-10 |
| 27 | Fixed UpgradeModal showing "current plan — Free" for paying users: now reads `useSubscription()`, shows the real current plan + its features, and only offers strictly-higher tiers (tier-aware header/upsell). Verified a Pro user hitting the enterprise AI gate sees "current plan — PRO" upselling Enterprise only | 2026-06-10 |
| 28 | Fixed referee search (was 100% broken — API-Football has no `referee`/standalone endpoint): `getRefereeFixtures` now pulls a league+season's fixtures and filters by the `fixture.referee` field, matching full name or surname (API abbreviates first names, e.g. "M. Oliver"). Defaults to top-5 leagues, walks back 3 seasons so recently-inactive refs still resolve. Frontend passes `leagueId` for popular refs (1 call vs 5) and treats `matches: 0` as "no data"; swapped retired Orsato → Massa | 2026-06-27 |
| 29 | Stopped `PremiumGate` auto-opening the UpgradeModal on mount — it slammed a paywall in front of every visitor on page load (home/match/predictions/stats) and bounced back on dismiss when two gates raced. Modal now opens only on explicit click of a locked overlay/badge | 2026-06-27 |
| 30 | Polish: home stats bar shows "—" placeholder until `/api/platform/stats` resolves (no zero-flash); match detail page gained `generateMetadata` ("Home vs Away — SportStatHub"); news featured-card image got `onError` fallback (matched list-variant) so broken article images degrade to a neutral block | 2026-06-27 |
| 31 | Match detail "Last Matches" form guide now defaults to **last 20** (was 5) — `lastN` initial state in `_tabs.tsx`; team fixtures were already fetched with `last=20` so the default fills the window | 2026-06-27 |
| 32 | Tidied frontend caching/auth: removed the dead `localStorage "token"` + `Bearer` path from `communityApi.ts` and `billingApi.ts` (auth is the httpOnly cookie via `credentials:include`); `communityApi` cache scope now keys on `isAuthed()` (was always "anon" off the dead token); cached `getPlatformStats` (60s). Renamed admin `ADMIN_TOKEN_KEY` "token"→"admin_token" so the user session's legacy-"token" purge in `session.ts` can no longer wipe a signed-in admin | 2026-06-27 |
| 33 | **UI redesign — "Bold sporty" direction** to de-genericize the AI-looking light mode. (a) Fonts: actually load them via `next/font` — Inter (body) + Archivo (sporty display) replacing the techy Rajdhani, which was referenced in CSS but never loaded (site was on system fonts). (b) Tokens in `globals.css`: refined deeper non-neon emerald (`#00875A` light / `#12B981` dark), neutral light bg `#F1F3F6`, designed dark slate (`#0B0F17`, not OLED-black), real layered elevation shadows replacing neon `0 0 20px` glows, rounded radius `0.75rem`, heavier (-tracking) headings. (c) Buttons/cards de-glowed (solid brand fills + lift). (d) Components: navbar logo de-greened to solid badge + "Football Analytics" tagline (dropped "PRO TERMINAL"); removed repeated "NO TIP" noise on match rows; AdCarousel amber→gold token + purple→accent (palette now emerald + gold + live-red + Telegram-blue only); hero carousel side-arrows moved bottom-right (were overlapping the headline). Verified both themes across home/rankings | 2026-06-28 |
| 34 | Per-page polish: unified the off-brand page-hero banners (referees slate, h2h indigo, rankings per-league rainbow gradients) to one consistent dark slate→emerald treatment with a subtle brand glow. League-specific rainbow gradients on the standings banner removed | 2026-06-28 |
| 35 | **Fixed match-detail per-fixture stats (corners/cards/fouls/possession/xG/shots) not loading.** Selecting a non-goal stat fired one `/api/matches/:id/stats` per form/H2H fixture — up to ~40 at once — which tripped API-Football's per-second burst limiter (429/500), leaving most cells blank (worsened by the new Last:20 default = 40 fetches). Added `fetchFixtureStatsThrottled` (concurrency 4, progressive fill) used by both LastMatchesTab and H2HTab; results cached per fixture across stat types so the fetch happens once per match view. Verified Corners now populates all rows + averages with no 429 storm. NB: API key is on a 150k/day plan, so the burst (not daily quota) was the constraint | 2026-06-28 |
| 41 | **`/impeccable polish` — navbar contrast (last audit P2).** Tagline "Football Analytics" was `text-muted` 10px over the translucent `bg-background/80` = 3.63:1 (AA fail). Darkened to `text-foreground/70` (now **8.12:1**) and bumped the nav background `/80`→`/90` so all nav text stays legible over scrolled content. (Broader DESIGN.md alignment was already done across the de-rainbow/optimize/adapt/typeset passes.) | 2026-06-28 |
| 40 | **Fixed misleading per-fixture stats on no-coverage competitions.** Lower-tier leagues (MLS Next Pro, USL League Two, Norway 3. Division — all that's live off-season) have no per-match stats in API-Football; the endpoint returns an empty array `[]`. `[]` is truthy, so the `if(!stats)` guard was bypassed and `rawStatVal` returned 0 → every corners/cards/etc. cell showed a misleading **"0-0"** with 0.0 averages (looked like a bug — "stats not showing"). Fix in `_tabs.tsx`: `fetchFixtureStatsThrottled` now normalizes empty `[]`→`null` (rows render "—"), and both LastMatchesTab + H2HTab show an empty-state banner ("<Stat> data isn't available for this competition — the provider only covers it for major leagues"). Verified: no-coverage match shows "—"+banner; covered match (World Cup) still loads real corner values (5-2, 5-4, …), no banner. Typecheck clean | 2026-06-28 |
| 39 | **`/impeccable typeset` — raised the type floor on the home.** Eliminated the sub-9px tier (7px "SOON"/"Ad" labels, 8px weekday chips and micro-labels) → clean 9px floor across the home-rendered components (page, MatchCard, AdCarousel, DatePickerBar, Left/RightSidebar); bumped standalone league-country labels 9→10px. Kept 9px for dense scoreboard micro-labels (the product register explicitly permits density) rather than bloating rows. Left the uppercase usage as-is after review — it's functional status/labels (LIVE/PRO/stat-headers), not the eyebrow-above-every-section reflex. Verified: no sub-9px text remains on home, no overflow, no horizontal scroll, typecheck clean | 2026-06-28 |
| 38 | **`/impeccable adapt` — mobile touch ergonomics + truncation.** Carousel pagination dots were 6×6px (failed WCAG 2.5.8 AA 24px) — kept the small visual but wrapped each in a ≥24×28px hit target (AdCarousel `Dots`). Team names on mobile match rows were truncating to 3 chars ("Col…"); switched `truncate`→`line-clamp-2` and made the empty odds column conditional so names reclaim the space — now "Colorado Rapids II" shows in full (longest names still clip on line 2, an inherent 375px constraint). Bumped the most-tapped mobile controls (ThemeToggle, mobile account avatar) 32→40px. Footer text-links (16–17px) left as-is under 2.5.8's inline/spacing exception. Verified mobile: no horizontal scroll, typecheck clean | 2026-06-28 |
| 37 | **`/impeccable optimize` on the home match feed** (after impeccable init/audit; audit scored Performance 1/4). MatchCard crest `<img>` now `loading="lazy"` + `decoding="async"`, and each row got `content-visibility:auto` + `contain-intrinsic-size` so off-screen cards skip layout/paint/decode. Result: of ~1,446 crest images only ~206 load on first paint (1,332 deferred). Also fixed a real light-mode bug found during the pass — desktop score pill was `text-white` on `bg-accent/20` = **1.31:1** (washed out); now `text-foreground` on `bg-accent/15` = 15.56:1 light / 14.31:1 dark — and removed its off-brand blue neon glow (`shadow-[0_0_10px_rgba(59,130,246,…)]`, a No-Glow-Rule violation the underscore syntax hid from the earlier grep) | 2026-06-28 |
| 36 | **Site-wide colour de-rainbow pass** — replaced decorative off-brand Tailwind palette colours with brand tokens across public pages, components, user dashboard, and admin. Tier badges (was purple/blue) → emerald/soft-gold/solid-gold hierarchy (CreatorBadge, CommentSection, forum, creators); admin StatCard rainbow + all admin status colours → tokens (emerald→success, rose/red→danger, amber/orange→accent-gold, purple/blue/sky→accent); user-dashboard + PredictionsHub "Expert" theming → gold token; auth pages + footer branding → "Football Analytics" (dropped "Pro Terminal"); role badges user=emerald/creator=gold/admin=red. **Intentionally kept** (not AI tells): bookmaker brand gradients, news-source brand colours (BBC/Sky/Guardian/ESPN), podium medal colours, and semantic win/loss/confidence. Typecheck clean; verified forum/creators/predictions in both themes. Palette is now emerald + gold + semantic red/green only | 2026-06-28 |

## Active Work

Football-focus + caching pass completed. Non-football sports parked as "coming soon" (Q3 deferred until a multi-sport data pipeline is built).

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
