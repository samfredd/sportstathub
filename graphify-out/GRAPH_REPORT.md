# Graph Report - frontend + backend  (2026-04-28)

## Corpus Check
- 100 files · ~51,561 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 351 nodes · 324 edges · 14 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & OAuth Logic|Auth & OAuth Logic]]
- [[_COMMUNITY_UI Utilities & Formatters|UI Utilities & Formatters]]
- [[_COMMUNITY_Frontend Docs & Assets|Frontend Docs & Assets]]
- [[_COMMUNITY_Creator Profile UI|Creator Profile UI]]
- [[_COMMUNITY_Football & Referees API|Football & Referees API]]
- [[_COMMUNITY_Head-to-Head Comparison|Head-to-Head Comparison]]
- [[_COMMUNITY_Match Detail & Transforms|Match Detail & Transforms]]
- [[_COMMUNITY_Admin Backend Module|Admin Backend Module]]
- [[_COMMUNITY_Booking Codes Backend|Booking Codes Backend]]
- [[_COMMUNITY_Forum & Leaderboard|Forum & Leaderboard]]
- [[_COMMUNITY_Booking Code Card|Booking Code Card]]
- [[_COMMUNITY_Comment System|Comment System]]
- [[_COMMUNITY_Admin API Client|Admin API Client]]
- [[_COMMUNITY_Forum Thread View|Forum Thread View]]

## God Nodes (most connected - your core abstractions)
1. `get()` - 9 edges
2. `Frontend README` - 8 edges
3. `PredictionCard()` - 7 edges
4. `useCopyToClipboard()` - 6 edges
5. `useTrackingClick()` - 6 edges
6. `register()` - 6 edges
7. `oauthRoutes()` - 6 edges
8. `MatchDetailPage()` - 5 edges
9. `PredictionDetailPage()` - 5 edges
10. `refereesRoutes()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `refereesRoutes()` --calls--> `get()`  [INFERRED]
  backend/src/modules/referees/referees.routes.js → frontend/src/lib/api.js
- `footballRoutes()` --calls--> `get()`  [INFERRED]
  backend/src/modules/football/football.routes.js → frontend/src/lib/api.js
- `adminRoutes()` --calls--> `get()`  [INFERRED]
  backend/src/modules/admin/admin.routes.js → frontend/src/lib/api.js
- `codesRoutes()` --calls--> `get()`  [INFERRED]
  backend/src/modules/codes/codes.routes.js → frontend/src/lib/api.js
- `File Icon SVG` --conceptually_related_to--> `Frontend README`  [INFERRED]
  frontend/public/file.svg → frontend/README.md

## Hyperedges (group relationships)
- **Next.js + Vercel + Geist Deployment Stack** — nextjs_framework, vercel_platform, geist_font, next_font [INFERRED 0.85]
- **Agent/Claude Guidance Documentation Set** — frontend_agents_md, frontend_claude_md, nextjs_breaking_changes_warning, nextjs_dist_docs [EXTRACTED 0.90]
- **Frontend Public Icon Assets** — file_svg, vercel_svg, next_svg, globe_svg, window_svg [EXTRACTED 0.95]

## Communities

### Community 1 - "Auth & OAuth Logic"
Cohesion: 0.09
Nodes (13): comparePasswords(), generateOTP(), hashPassword(), createOAuthController(), createOAuthRepository(), oauthRoutes(), createOAuthService(), infrastructurePlugin() (+5 more)

### Community 2 - "UI Utilities & Formatters"
Cohesion: 0.12
Nodes (13): fmtCount(), fmtDate(), fmtTime(), platformGrad(), PredictionCard(), StatIcon(), useCopyToClipboard(), useTrackingClick() (+5 more)

### Community 3 - "Frontend Docs & Assets"
Cohesion: 0.16
Nodes (15): create-next-app Bootstrapper, File Icon SVG, Frontend AGENTS.md, Frontend CLAUDE.md, Frontend README, Geist Font Family, Globe Icon SVG, next/font Optimization Module (+7 more)

### Community 4 - "Creator Profile UI"
Cohesion: 0.19
Nodes (4): CreatorProfilePage(), fmtCount(), platformGrad(), PredictionDetailPage()

### Community 6 - "Football & Referees API"
Cohesion: 0.17
Nodes (6): createFootballController(), footballRoutes(), createFootballService(), createRefereesController(), refereesRoutes(), createRefereesService()

### Community 7 - "Head-to-Head Comparison"
Cohesion: 0.24
Nodes (5): computeStats(), H2HPage(), useTeamSearch(), pct(), RefereesPage()

### Community 8 - "Match Detail & Transforms"
Cohesion: 0.27
Nodes (5): fetchJson(), MatchDetailPage(), computeH2HStats(), fixtureToMatch(), parseMatchStats()

### Community 13 - "Admin Backend Module"
Cohesion: 0.25
Nodes (4): createAdminController(), createAdminRepository(), adminRoutes(), createAdminService()

### Community 14 - "Booking Codes Backend"
Cohesion: 0.25
Nodes (4): createCodesController(), createCodesRepository(), codesRoutes(), createCodesService()

### Community 15 - "Forum & Leaderboard"
Cohesion: 0.33
Nodes (2): ThreadCard(), timeAgo()

### Community 21 - "Booking Code Card"
Cohesion: 0.5
Nodes (2): BookingCodeCard(), platformColor()

### Community 22 - "Comment System"
Cohesion: 0.5
Nodes (2): CommentBubble(), timeAgo()

### Community 23 - "Admin API Client"
Cohesion: 0.7
Nodes (4): adminFetch(), decodeJwt(), getStoredUser(), getToken()

### Community 29 - "Forum Thread View"
Cohesion: 1.0
Nodes (2): ForumThreadPage(), timeAgo()

## Knowledge Gaps
- **7 isolated node(s):** `File Icon SVG`, `Vercel Logo SVG`, `Next.js Logo SVG`, `Globe Icon SVG`, `Window / Browser Icon SVG` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Forum & Leaderboard`** (7 nodes): `CreatorOfWeek()`, `ForumPage()`, `LeaderboardRow()`, `SearchIcon()`, `ThreadCard()`, `timeAgo()`, `page.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Booking Code Card`** (5 nodes): `BookingCodeCard()`, `CheckIcon()`, `CopyIcon()`, `platformColor()`, `BookingCodeCard.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Comment System`** (5 nodes): `CommentAuthor()`, `CommentBubble()`, `CommentSection()`, `timeAgo()`, `CommentSection.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Forum Thread View`** (3 nodes): `page.js`, `ForumThreadPage()`, `timeAgo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get()` connect `Auth & OAuth Logic` to `Admin Backend Module`, `Football & Referees API`, `Booking Codes Backend`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `adminRoutes()` connect `Admin Backend Module` to `Auth & OAuth Logic`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `get()` (e.g. with `VerifyOTPContent()` and `register()`) actually correct?**
  _`get()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Frontend README` (e.g. with `Globe Icon SVG` and `Window / Browser Icon SVG`) actually correct?**
  _`Frontend README` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `PredictionCard()` (e.g. with `useCopyToClipboard()` and `useTrackingClick()`) actually correct?**
  _`PredictionCard()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useCopyToClipboard()` (e.g. with `FeaturedPredCard()` and `HotCodeCard()`) actually correct?**
  _`useCopyToClipboard()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useTrackingClick()` (e.g. with `FeaturedPredCard()` and `HotCodeCard()`) actually correct?**
  _`useTrackingClick()` has 5 INFERRED edges - model-reasoned connections that need verification._