---
name: SportStatHub
description: Bold, sporty, data-confident football predictions & analytics
colors:
  emerald: "#00875A"
  emerald-deep: "#006E49"
  emerald-bright: "#12B981"
  gold: "#B45309"
  gold-deep: "#92400E"
  live-red: "#DC2626"
  ink: "#0B1220"
  bg: "#F1F3F6"
  surface: "#FFFFFF"
  surface-hover: "#F5F7FA"
  muted: "#5A6776"
  dark-bg: "#0B0F17"
  dark-surface: "#141A24"
  dark-ink: "#F4F7FB"
  dark-muted: "#93A1B5"
typography:
  display:
    fontFamily: "Archivo, Inter, ui-sans-serif, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "7px"
  md: "10px"
  lg: "12px"
  xl: "17px"
  2xl: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.emerald}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.emerald-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
---

# Design System: SportStatHub

## 1. Overview

**Creative North Star: "The Confident Scoreboard"**

SportStatHub looks and feels like a live scoreboard run by someone who actually knows the numbers: decisive, numbers-forward, and momentum-driven, but disciplined and legible — never a flashing-lights betting marquee. Scores, odds, and confidence are stated plainly and boldly; the chrome around them stays quiet so the data carries the screen. It is a **product** system first — design serves the matches, stats, and tools — with enough sporty identity that it never reads as a generic analytics dashboard.

The system commits to one brand voice: a deep, refined **emerald** (`#00875A`), used for primary actions and live signal, paired with a deep **gold** (`#B45309`) reserved strictly for premium and creator surfaces. Everything else is a disciplined neutral ramp. Energy comes from strong display typography (Archivo), a confident scoreline scale, real elevation, and purposeful motion — not from gradients, glows, banners, or gamification. Dark mode is a first-class, matchday-native theme on a designed slate (`#0B0F17`), not pure OLED black.

It explicitly rejects four things, carried verbatim from the product's anti-references: generic AI-generated SaaS (emerald-glow shadows, glassmorphism, gradient text, rainbow stat cards, Inter-for-everything, tiny uppercase eyebrows on every section); cluttered legacy bookmaker sites (banner-heavy, neon, popups); bland gray data-table tools (Statof-style, no identity); and gamified casino aesthetics (coins, confetti, slot-machine flourishes).

**Key Characteristics:**
- One brand voice — refined emerald; gold for premium only; red means live/loss only.
- Numbers-forward: bold Archivo scorelines and tabular figures are the hero.
- Real elevation, never neon glow. Designed dark slate, not OLED black.
- Mobile-first, thumb-first, WCAG AA, full reduced-motion support.
- Colour carries meaning; if a hue isn't saying something, it's a neutral.

## 2. Colors

A disciplined two-accent system (emerald + gold) over a cool neutral ramp, with red reserved for live and loss. Colour is meaning, not decoration.

### Primary
- **Pitch Emerald** (`#00875A` light / `#12B981` dark): The single brand voice. Primary buttons, links, active tabs, "live" pulse, win/success. Deeper and richer than the old neon green; in dark mode it brightens to `#12B981` for legibility against slate. Hover deepens to **Emerald Deep** (`#006E49`).

### Secondary
- **Trophy Gold** (`#B45309` light / `#F59E0B` dark): Reserved strictly for premium, Pro, and creator/earn surfaces (PRO chips, "Become a Creator", verified-creator tiers, booking-code unlocks). A deliberate, deep amber — never a bright decorative accent sprinkled across the UI.

### Tertiary
- **Live Red** (`#DC2626` light / `#F23E4D` dark): Semantic only — the live-match pulse, losses, destructive actions, and errors. Never decorative.

### Neutral
- **Ink** (`#0B1220` light / `#F4F7FB` dark): Primary text and scorelines. Near-black slate, not pure black.
- **Body Bg** (`#F1F3F6` light / `#0B0F17` dark): The page canvas — a cool neutral grey (light) and a designed slate (dark, not OLED `#000`).
- **Surface** (`#FFFFFF` light / `#141A24` dark): Cards, panels, nav, inputs. Lifts off the canvas with a 1px border + soft elevation.
- **Muted** (`#5A6776` light / `#93A1B5` dark): Secondary text, labels, metadata. Meets ≥4.5:1 on surface — never lighter "for elegance".
- **Border** (`rgba(11,18,32,0.10)` light / `rgba(255,255,255,0.09)` dark): Hairline separation between surfaces.

### Named Rules
**The One Green Rule.** Emerald is the only brand colour that appears freely. Gold is allowed only on premium/creator surfaces; red only on live/loss/error. If a third decorative hue (purple, blue, indigo, sky) is creeping in, it is a bug — remove it. Distinct colour earns its place by carrying meaning, never by differentiating cards.

**The Designed-Slate Rule.** Dark mode is `#0B0F17` canvas / `#141A24` surface, never pure `#000000`. OLED-black reads as the AI-terminal default; the slate reads as designed.

## 3. Typography

**Display Font:** Archivo (with Inter, system-ui fallback) — loaded via `next/font`.
**Body Font:** Inter (with system-ui fallback) — loaded via `next/font`.
**Label/Numeric:** Inter with `tabular-nums` for all scores, odds, and stats.

**Character:** A sporty contrast pairing — Archivo's broad, confident grotesk for headings and scorelines against Inter's neutral, highly-legible body. One geometric-ish display + one humanist-ish body; never two near-identical sans. Rajdhani (the old "terminal" face) is removed.

### Hierarchy
- **Display** (Archivo 800, `clamp(2rem, 5vw, 3.5rem)`, line-height 1.05, letter-spacing -0.02em): Hero headlines, big scorelines (e.g. `0 - 0` on the match page). Capped well under the 6rem shouting ceiling.
- **Headline** (Archivo 800, 1.5rem, -0.01em): Page titles ("Predictions Hub", "Community Forum"), section heroes.
- **Title** (Inter 700, ~1.0625rem): Card titles, team names, thread titles.
- **Body** (Inter 400–500, 0.9375rem, line-height 1.5): Descriptions and prose. Cap measure at 65–75ch.
- **Label** (Inter 800, 0.6875rem, +0.04em, sometimes uppercase): Stat labels, status chips, metadata. Use sparingly — see the rule below.

### Named Rules
**The No-Eyebrow-Reflex Rule.** Tiny uppercase tracked labels are a real token (stat headers, "LIVE", "PRO") but are forbidden as a default scaffold above every section. One named kicker as a deliberate system is voice; an eyebrow on every heading is the AI tell. Prefer a strong Archivo headline that carries the section on its own.

**The Tabular Score Rule.** Every number that compares — scores, odds, percentages, table positions — uses `tabular-nums` so columns align and figures don't jitter between states.

## 4. Elevation

The system uses **real, layered drop shadows for elevation, never decorative glow.** Surfaces sit on the canvas with a 1px border plus a soft two-layer shadow; depth increases on interaction (hover lift, modals), not as ambient decoration. The previous neon "glow" shadows (`box-shadow: 0 0 20px <colour>`) are banned outright.

### Shadow Vocabulary
- **Resting elevation** (`box-shadow: 0 1px 2px rgba(11,18,32,0.04), 0 6px 16px rgba(11,18,32,0.07)`): Default for cards, panels, dropdowns. Dark mode uses a deeper pair (`0 2px 6px rgba(0,0,0,0.30), 0 12px 32px rgba(0,0,0,0.40)`).
- **Hover lift** (`0 2px 4px rgba(11,18,32,0.05), 0 10px 24px rgba(11,18,32,0.10)` + `translateY(-1px)`): Interactive cards and primary buttons on hover.
- **Focus ring** (`0 0 0 3px var(--accent-soft)`): Inputs and focusable controls. The only "glow-shaped" value allowed, and it is a functional focus affordance, not decoration.

### Named Rules
**The No-Glow Rule.** Forbidden: `box-shadow: 0 0 Npx <colour>` as a neon halo on buttons, cards, or text. Depth is conveyed by layered elevation and a 1px border, full stop. The only `0 0 0 Npx` permitted is the 3px focus ring.

## 5. Components

### Buttons
- **Shape:** Rounded (12px, `{rounded.lg}`).
- **Primary:** Solid Pitch Emerald (`#00875A`) fill, white text, `10px 20px` padding. The confident default CTA.
- **Hover / Focus:** Background deepens to `#006E49`, `translateY(-1px)` with a soft elevation shadow — a lift, never a glow.
- **Gold:** Solid Trophy Gold (`#B45309`) fill, white text — premium/creator actions only.
- **Ghost:** Transparent, muted text, emerald-soft tint on hover. Secondary/tertiary actions.

### Chips
- **Style:** Pill (`{rounded.full}`), soft-tinted background of a semantic colour + matching text + hairline border. `bg-accent/10 text-accent` for brand, `live-soft`/`live` for LIVE, `gold-soft`/`gold` for PRO.
- **State:** Active filter chips fill solid emerald with white text; inactive are surface + border.

### Cards / Containers
- **Corner Style:** Generous round (17px, `{rounded.xl}`) for cards; 12px for inner controls.
- **Background:** Surface (`#FFFFFF` / `#141A24`).
- **Shadow Strategy:** Resting elevation at rest; hover lift on interactive cards (see Elevation). Never nest a card inside a card.
- **Border:** 1px hairline `--border`.
- **Internal Padding:** `16–20px` (`{spacing.md}`–`20px`).

### Inputs / Fields
- **Style:** Surface fill, 1px `--border`, 12px radius, Inter body text.
- **Focus:** Emerald border + 3px `--accent-soft` ring. No glow beyond the ring.
- **Error:** Live-red border + red helper text.

### Navigation
- **Style:** Sticky top bar, `bg-background/80` + backdrop blur, 1px bottom border. Solid emerald logo badge + "Football Analytics" wordmark (Archivo). Links are muted Inter; the active link is emerald with an underline indicator. Mobile: collapses to a drawer / bottom tabs.

### Signature Component — Match Card & Score Header
The product's hero pattern. A match row shows time, team crests, names, and a tabular score in a tinted pill; live matches carry a pulsing red dot + elapsed minute. The match-detail **Score Header** blows the scoreline up to Display size (`0 - 0` in Archivo 800, `tabular-nums`), flanked by crests, with a LIVE chip and referee. No prediction noise ("NO TIP") on empty rows — the row stays clean and clickable.

## 6. Do's and Don'ts

### Do:
- **Do** use Pitch Emerald (`#00875A`) as the single brand voice; reserve Trophy Gold (`#B45309`) for premium/creator and Live Red (`#DC2626`) for live/loss/error only.
- **Do** convey depth with layered elevation + a 1px border, and lift interactive elements on hover.
- **Do** set every comparing number in `tabular-nums`; lead match pages with a bold Archivo scoreline.
- **Do** keep body text ≥4.5:1 (large ≥3:1); when contrast is close, push toward Ink, never toward light gray.
- **Do** ship a `prefers-reduced-motion: reduce` alternative for every animation, and design mobile-first.
- **Do** keep dark mode on designed slate (`#0B0F17` / `#141A24`).

### Don't:
- **Don't** ship the generic AI-SaaS look: no neon glow shadows (`0 0 20px`), no glassmorphism-by-default, no gradient text (`background-clip: text`), no rainbow stat cards, no Inter-for-everything, no tiny uppercase eyebrow above every section.
- **Don't** drift into cluttered bookmaker aesthetics: no banner spam, neon, aggressive popups, or ad takeovers that bury content.
- **Don't** fall back to a bland gray data-table tool with no identity (the Statof trap) — data still gets hierarchy, colour-with-meaning, and energy.
- **Don't** add casino gamification: no coins, confetti, or slot-machine flourishes.
- **Don't** introduce a third decorative hue (purple/blue/indigo/sky) to differentiate cards — that's a bug; remove it.
- **Don't** use a colored `border-left`/`border-right` > 1px as a side-stripe accent, or nest a card inside a card.
