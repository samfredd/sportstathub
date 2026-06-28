UI Context
This document describes the user interface (UI) and user experience (UX) considerations for the multi‑sport predictions platform. It outlines the main pages, navigation flows and design principles to ensure that the product is intuitive, accessible and optimised for mobile devices.
1. Design Principles
Mobile‑first – The majority of users will access the platform via smartphones. The layout scales gracefully from small screens to desktop, using responsive grids and flexible components.
Clarity and minimalism – Present information clearly without clutter. Use whitespace, cards and accordions to organise complex data (e.g., statistics tables). Avoid intrusive ads or pop‑ups that obstruct content.
Dark mode support – Provide a toggle between light and dark themes. Persist the user’s preference in local storage or user settings.
Accessibility – Use semantic HTML, ARIA roles and sufficient colour contrast. Ensure that all interactive elements are reachable via keyboard and screen readers. Provide alt text for images and icons.
Consistency – Maintain consistent typography, colours and component styles across pages. Use a design system with predefined components (buttons, forms, tables, cards).
2. Global Layout and Navigation
The platform uses a tab‑based navigation bar anchored at the bottom on mobile and at the top on desktop. Tabs include: Home, Code Hub, Forum, Stats Explorer, and Account. A contextual action button (e.g., “Create Prediction”) floats above the navigation on creator accounts.
Navigation Items
Tab	Purpose
Home	Displays the multi‑sport predictions hub with filters for sports, leagues, dates and markets. Shows trending predictions and highlights from top creators.
Code Hub	Lists ready‑made booking codes. Each item shows the sport, league, odds range and creator. Clicking reveals slip details and a copy button.
Forum	Hosts discussion boards. Users can join topic‑specific rooms or reply under individual predictions. Includes search and sorting features.
Stats Explorer	Provides interactive tools to view historical statistics. Users can select sports, teams, players and time ranges. Charts and tables update dynamically.
Account	Contains user profile, subscription management, notification settings and (for creators) earnings and analytics.
Primary Actions
Search – A persistent search bar allows users to quickly find teams, players, matches or creators. Auto‑complete suggestions improve discoverability.
Create Prediction / Post – For pundits, a prominent button opens a modal or page where they can assemble a prediction, select markets, generate a booking code and publish to followers.
Notifications – A bell icon displays unread notifications (e.g., new replies, code updates). Clicking opens a drawer showing recent alerts.
3. Page Templates
3.1 Predictions Hub (Home)
Header – Displays the selected sport and date. Dropdowns allow switching sports and adjusting the time horizon (today, tomorrow, next week).
Filter Bar – Chips or tabs let users filter by market type (1X2, Over/Under, Handicap, etc.) and sort predictions by popularity or confidence.
Prediction Cards – Each card shows teams, odds, the recommended outcome, confidence percentage and a small icon indicating if the prediction is AI‑generated or creator‑posted. Clicking a card expands it to reveal rationale, related statistics and comments.
Infinite Scroll – Predictions load on demand as the user scrolls, improving performance on mobile.
3.2 Booking Code Hub
List View – Displays booking codes as rows with columns for sport, league, slip summary and a “Copy Code” button. A secondary button opens the slip in the bookmaker’s app via a deep link.
Filters and Sorting – Users can filter by bookmaker, sport, odds range or creator. Sorting options include newest first, highest odds and popularity.
Code Details Modal – Clicking a row opens a modal showing the full bet slip (events, markets, individual odds) and allows copying the booking code.
3.3 Forum
Channel List – A sidebar or dropdown lists available channels (e.g., “Today’s Matches,” “Basketball Corner,” “Pundit Debate Room”). Users can create new channels if they have sufficient reputation.
Thread View – Within a channel, threads are displayed with the initial post, number of replies and last activity. Selecting a thread opens a conversation view with nested replies.
Editor – A rich‑text editor supports Markdown and emojis. It includes quoting, linking predictions or codes and tagging other users. Posts can be upvoted or reported.
Moderation Tools – Administrators and moderators can pin threads, delete posts or ban users directly from the UI.
3.4 Stats Explorer
Filter Panel – A collapsible panel on the left allows users to select sport, league, teams/players, statistic category and time range. Multi‑select is supported.
Visualisation Area – The main area displays charts (line, bar, heat map) and tables. Users can switch between visualisation types and hover for tooltips. Export functionality (CSV, image) is available to subscribers.
Comparison Mode – A toggle enables side‑by‑side comparison of two teams or players across selected metrics. Differences are highlighted with colour coding.
3.5 Account & Creator Dashboard
Profile Section – Displays avatar, username, bio, follower count and win rate. Users can edit their profile, update email/password and manage privacy settings.
Subscription Management – Shows current plan (free, Pro, Pro Max), renewal date and payment method. Users can upgrade/downgrade and view payment history.
Notifications Settings – Allows toggling push notifications for new predictions, replies, code updates and system announcements.
Creator Analytics – For pundits, a dashboard displays performance: number of published predictions, hit rate, total affiliate revenue, top codes and follower growth. Payout requests can be initiated here.
4. Feedback and Iteration
User feedback is integral to refining the UI. Early prototypes should be tested with a diverse group of Nigerian bettors and pundits to identify pain points, such as unclear labels or overloaded screens. Key metrics to monitor include click‑through rates, session duration, retention and conversion to paid tiers. Feedback loops will inform design tweaks, feature prioritisation and accessibility improvements.
Adhering to the UI context described here will help create a coherent, engaging and accessible interface for the multi‑sport predictions platform.

5. Design System (Tokens & Direction)

Direction: "Bold sporty" (ESPN / 365Scores feel) — confident single brand colour, strong type hierarchy, rounded cards, real elevation. Avoid the generic "AI SaaS" look: no neon glow shadows, no rainbow of tinted accent colours, no terminal/techy branding.

Source of truth: `frontend/src/app/globals.css` (CSS custom properties bridged to Tailwind via `@theme inline`). Always theme through these tokens — do not hardcode hex or use raw Tailwind palette colours (e.g. `bg-amber-500`, `text-purple-400`) for brand UI.

- Brand accent — refined emerald: `--accent` `#00875A` (light) / `#12B981` (dark). Use for primary actions, links, active states. Not for decoration everywhere.
- Premium/creator — deep gold: `--accent-gold` (`#B45309` light). Reserved for Pro/creator/EARN surfaces only.
- Live — red `--live`; Win/Loss — `--success` / `--danger`. Colour carries meaning, not decoration.
- Surfaces: light bg `#F1F3F6` + white cards; dark is a designed slate (`#0B0F17` bg / `#141A24` surface), not OLED black. Separate cards with `--shadow-premium` (layered soft elevation) + a 1px `--border`.
- Radius: `--radius` `0.75rem` (rounded sporty cards).
- Type: body = Inter (`--font-inter`), display/headings/scores = Archivo (`--font-archivo`), both loaded via `next/font` in `layout.tsx`. Headings are weight 800, slightly negative tracking. (Rajdhani was removed.)
- Shadows are elevation only — never `box-shadow: 0 0 Npx <colour>` neon glows.
- Telegram brand blue (`#0088cc`) is allowed only on the explicit "Join Telegram" ad slide.