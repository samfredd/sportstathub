"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { useUpgradeModal } from "@/context/UpgradeModalContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdSlide {
  id: string;
  type?: "announcement" | "promo" | "ad" | "feature" | "prediction";

  // Custom fully-rendered content (skips all built-in layouts)
  custom?: React.ReactNode;

  // Hero variant fields
  badge?: string;                          // "Live Platform" pill (hero only)
  badgeColor?: string;                     // "badge-live" | custom Tailwind text class
  headline?: string;                       // large display title (hero)
  subline?: string;                        // smaller line below headline (hero, desktop)
  glowColor?: string;                      // CSS rgba string for right ambient glow
  glowColor2?: string;                     // CSS rgba string for left ambient glow

  // Shared fields
  label?: string;                          // "PRO" | "NEW" | "AD" badge chip
  eyebrow?: string;                        // small text above title (banner/sidebar)
  title: string;                           // main text (banner / sidebar / feed)
  body?: string;                           // supporting text
  cta?: { label: string; href: string; external?: boolean };
  cta2?: { label: string; href: string };  // secondary button (hero + banner)
  icon?: React.ReactNode;

  // Colour theming — Tailwind utility strings
  bg?: string;
  border?: string;
  text?: string;
  accent?: string;                         // e.g. "text-accent"
}

interface AdCarouselProps {
  slides: AdSlide[];
  variant?: "hero" | "banner" | "sidebar" | "feed";
  autoplayMs?: number;
  className?: string;
  showArrows?: boolean;
  size?: "sm" | "lg";   // sidebar only: "lg" = more prominent
}

// ─── Slide data ───────────────────────────────────────────────────────────────

export const HERO_SLIDES: AdSlide[] = [
  {
    id: "hero-platform",
    type: "announcement",
    badge: "Live Platform",
    headline: "Expert Tips. Real Creators.",
    subline: "50k+ analysts · Africa's #1 betting intelligence",
    title: "Expert Tips. Your Edge.",
    body: "Africa's #1 betting intelligence platform",
    cta: { label: "Today's Tips", href: "/predictions" },
    cta2: { label: "Browse Codes", href: "/codes" },
    accent: "text-accent",
    glowColor: "rgba(59,130,246,0.10)",
    glowColor2: "rgba(245,158,11,0.06)",
  },
  {
    id: "hero-pro",
    type: "promo",
    badge: "Limited Offer",
    badgeColor: "text-accent",
    headline: "Unlock Pro Access.",
    subline: "Live AI · Unlimited picks · Expert community",
    title: "Unlock unlimited picks & live insights",
    body: "Join 50k+ analysts already on Pro",
    cta: { label: "Go PRO →", href: "/auth/register" },
    cta2: { label: "See what's inside", href: "/contact" },
    label: "PRO",
    accent: "text-accent",
    bg: "bg-accent/5",
    glowColor: "rgba(59,130,246,0.14)",
    glowColor2: "rgba(59,130,246,0.06)",
  },
  {
    id: "hero-creator",
    type: "feature",
    badge: "New Program",
    badgeColor: "text-accent-gold",
    headline: "Share Picks. Build Your Brand. Earn.",
    subline: "Verified creators earn on every prediction shared",
    title: "Become a Verified Creator",
    body: "Build a following and earn on every code copy",
    cta: { label: "Apply Now →", href: "/forum" },
    cta2: { label: "See creators", href: "/forum" },
    label: "NEW",
    accent: "text-accent-gold",
    bg: "bg-accent-gold-soft",
    glowColor: "rgba(245,158,11,0.12)",
    glowColor2: "rgba(245,158,11,0.05)",
  },
  {
    id: "hero-telegram",
    type: "ad",
    badge: "Free Community",
    badgeColor: "text-[#29B6F6]",
    headline: "50,000+ Bettors Live on Telegram.",
    subline: "Daily picks · Odds alerts · Live match updates",
    title: "Join our Telegram community",
    body: "Free picks, odds alerts, and live match updates",
    cta: { label: "Join Free →", href: "https://t.me/sportintel", external: true },
    label: "FREE",
    accent: "text-[#29B6F6]",
    bg: "bg-[#0088cc]/5",
    glowColor: "rgba(0,136,204,0.12)",
    glowColor2: "rgba(0,136,204,0.05)",
  },
];

export const SIDEBAR_SLIDES: AdSlide[] = [
  {
    id: "sidebar-pro",
    type: "promo",
    label: "PRO",
    eyebrow: "Upgrade today",
    title: "Upgrade to Pro",
    body: "Unlimited picks · Live AI · Expert access",
    cta: { label: "Upgrade Now", href: "/auth/register" },
    bg: "bg-accent/8",
    border: "border-accent/25",
    accent: "text-accent",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
    ),
  },
  {
    id: "sidebar-h2h",
    type: "feature",
    label: "FREE",
    eyebrow: "New tool",
    title: "Head-to-Head Analyser",
    body: "Compare any two teams — last 10 meetings, form, goals.",
    cta: { label: "Try H2H", href: "/h2h" },
    bg: "bg-accent-soft",
    border: "border-accent/30",
    accent: "text-accent",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent/25 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/>
          <path d="M3 12h2M19 12h2"/>
        </svg>
      </div>
    ),
  },
  {
    id: "sidebar-creators",
    type: "announcement",
    label: "EARN",
    eyebrow: "Creator program",
    title: "Become a Verified Creator",
    body: "Grow your audience. Earn on every prediction shared.",
    cta: { label: "Learn More", href: "/creators" },
    bg: "bg-accent-gold-soft",
    border: "border-accent-gold/30",
    accent: "text-accent-gold",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-accent-gold-soft border border-accent-gold/25 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent-gold" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      </div>
    ),
  },
];

export const FEED_SLIDES: AdSlide[] = [
  {
    id: "feed-pro",
    type: "promo",
    label: "PRO",
    title: "See win probability on every match",
    body: "Unlock AI insights with Pro",
    cta: { label: "Try Free", href: "/auth/register" },
    bg: "bg-accent/6",
    border: "border-accent/20",
    accent: "text-accent",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
    ),
  },
  {
    id: "feed-codes",
    type: "announcement",
    label: "HOT",
    title: "Today's top booking codes are live",
    body: "Slip codes from 40+ verified creators",
    cta: { label: "View Codes", href: "/codes" },
    bg: "bg-accent-gold-soft",
    border: "border-accent-gold/25",
    accent: "text-accent-gold",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-accent-gold-soft border border-accent-gold/25 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-accent-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdCarousel({
  slides,
  variant = "banner",
  autoplayMs = 5000,
  className = "",
  showArrows = false,
  size,
}: AdCarouselProps) {
  const [idx, setIdx]             = useState(0);
  const [leaving, setLeaving]     = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX               = useRef<number | null>(null);
  const { openUpgradeModal }      = useUpgradeModal();

  const advance = useCallback((dir: 1 | -1 = 1) => {
    setDirection(dir);
    setLeaving(true);
    setTimeout(() => {
      setIdx(i => (i + dir + slides.length) % slides.length);
      setLeaving(false);
    }, 240);
  }, [slides.length]);

  const startTimer = useCallback(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => advance(1), autoplayMs);
  }, [advance, autoplayMs, slides.length]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => { startTimer(); return stopTimer; }, [startTimer, stopTimer]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 44) { stopTimer(); advance(delta < 0 ? 1 : -1); }
    touchStartX.current = null;
  }

  if (!slides.length) return null;

  const slide = slides[idx];
  const isHero    = variant === "hero";
  const isSidebar = variant === "sidebar";
  const isFeed    = variant === "feed";

  // Slide-out direction
  const slideOutClass = leaving
    ? `opacity-0 ${direction === 1 ? "-translate-x-4" : "translate-x-4"}`
    : "opacity-100 translate-x-0";

  const isPlansTrigger = (cta?: AdSlide["cta"]) => slide.type === "promo" && !cta?.external;
  const openPlans = () => {
    stopTimer();
    openUpgradeModal();
  };

  const renderCta = (cta: AdSlide["cta"], className: string) => {
    if (!cta) return null;

    if (isPlansTrigger(cta)) {
      return (
        <button type="button" onClick={openPlans} className={className}>
          {cta.label}
        </button>
      );
    }

    if (cta.external) {
      return (
        <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>
          {cta.label}
        </a>
      );
    }

    return (
      <Link href={cta.href} className={className}>
        {cta.label}
      </Link>
    );
  };

  const renderLabel = (label: string, className: string) => {
    if (slide.type !== "promo") return <span className={className}>{label}</span>;

    return (
      <button type="button" onClick={openPlans} className={`${className} cursor-pointer hover:opacity-80 transition-opacity`}>
        {label}
      </button>
    );
  };

  // ── DOT NAV shared ────────────────────────────────────────────────────────
  const Dots = ({ centered = false }: { centered?: boolean }) => (
    <div className={`flex items-center ${centered ? "justify-center" : ""}`}>
      {slides.map((_, i) => {
        const accentBg = slide.accent?.replace("text-", "bg-") ?? "bg-accent";
        return (
          // Visible dot stays small, but the button is a ≥24px touch target.
          <button
            key={i}
            onClick={() => { stopTimer(); setDirection(i > idx ? 1 : -1); setLeaving(true); setTimeout(() => { setIdx(i); setLeaving(false); }, 240); }}
            aria-label={`Slide ${i + 1}`}
            className="group/dot flex items-center justify-center min-h-[28px] min-w-[24px] cursor-pointer"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === idx ? `h-1.5 w-5 ${accentBg}` : "h-1.5 w-1.5 bg-muted/30 group-hover/dot:bg-muted/60"
              }`}
            />
          </button>
        );
      })}
    </div>
  );

  // ── HERO VARIANT ──────────────────────────────────────────────────────────
  if (isHero) {
    const accentText   = slide.accent ?? "text-accent";
    const accentBg     = accentText.replace("text-", "bg-");
    const accentBorder = accentText.replace("text-", "border-");

    return (
      <div
        className={`relative overflow-hidden border-b border-border/30 ${slide.bg ?? "bg-gradient-to-br from-background via-surface to-background"} ${className}`}
        onMouseEnter={stopTimer}
        onMouseLeave={startTimer}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label="Announcements"
      >
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-[400px] h-[300px] rounded-full blur-[100px] pointer-events-none transition-all duration-700"
             style={{ background: slide.glowColor ?? "rgba(59,130,246,0.08)" }} />
        <div className="absolute bottom-0 left-1/4 w-[250px] h-[200px] rounded-full blur-[80px] pointer-events-none transition-all duration-700"
             style={{ background: slide.glowColor2 ?? "rgba(245,158,11,0.05)" }} />

        {/* ── Slide body ── */}
        {slide.custom ? (
          /* Custom content (e.g. prediction card) */
          <div className={`relative z-10 transition-all duration-240 ease-out ${slideOutClass}`}>
            {slide.custom}
          </div>
        ) : (
          /* Standard ad / announcement layout */
          <div className={`relative z-10 px-4 lg:px-6 py-4 sm:py-6 lg:py-8 transition-all duration-240 ease-out ${slideOutClass}`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-8">

              {/* Left: badge + headline + CTAs */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  {slide.badge && (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                      slide.badge === "Live Platform"
                        ? "badge-live"
                        : `${accentText} ${accentBg}/15 ${accentBorder}/30`
                    }`}>
                      {slide.badge === "Live Platform" && <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />}
                      {slide.badge}
                    </div>
                  )}
                  {slide.subline && <span className="hidden sm:inline text-[11px] text-muted">{slide.subline}</span>}
                </div>

                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-foreground leading-tight mb-3"
                    style={{ fontFamily: "var(--font-display, inherit)" }}>
                  <span className="sm:hidden">
                    {slide.title.split(". ").map((part, i, arr) => (
                      <span key={i}>{i === arr.length - 1 ? <span className={accentText}>{part}</span> : `${part}. `}</span>
                    ))}
                  </span>
                  <span className="hidden sm:block">
                    {(slide.headline ?? slide.title).split(". ").map((part, i, arr) => (
                      <span key={i}>{i === arr.length - 1 ? <span className={accentText}>{part.replace(/\.$/, "")}</span> : `${part}. `}</span>
                    ))}
                  </span>
                </h1>

                <div className="flex items-center gap-2 flex-wrap">
                  {renderCta(slide.cta, "btn-gradient text-[12px] px-4 py-2 sm:px-5 sm:py-2.5")}
                  {slide.cta2 && (
                    <Link href={slide.cta2.href} className="px-3 py-2 sm:px-4 sm:py-2.5 bg-surface border border-border/60 text-muted hover:text-foreground hover:border-accent/30 rounded-xl text-[12px] font-black transition-all">
                      {slide.cta2.label}
                    </Link>
                  )}
                </div>
              </div>

              {/* Right: label chip + dots (desktop) */}
              <div className="hidden lg:flex flex-col items-end gap-3 shrink-0 self-end pb-1">
                {slide.label && (
                  renderLabel(slide.label, `text-[9px] font-black uppercase tracking-[0.25em] px-2 py-1 rounded-lg border ${accentText} ${accentBg}/15 ${accentBorder}/25`)
                )}
                <Dots />
              </div>
            </div>
          </div>
        )}

        {/* Dots — mobile/tablet */}
        <div className="lg:hidden absolute bottom-3 right-4 z-20"><Dots /></div>

        {/* Prev / Next arrows — grouped bottom-right so they never overlap the
            headline; dot indicators handle the rest. */}
        {slides.length > 1 && (
          <div className="hidden sm:flex absolute bottom-3 right-4 z-20 items-center gap-1.5">
            <button onClick={() => { stopTimer(); advance(-1); }}
              className="flex w-7 h-7 rounded-full bg-surface/70 backdrop-blur-sm border border-border/60 items-center justify-center text-muted hover:text-foreground hover:border-accent/40 transition-all cursor-pointer"
              aria-label="Previous">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={() => { stopTimer(); advance(1); }}
              className="flex w-7 h-7 rounded-full bg-surface/70 backdrop-blur-sm border border-border/60 items-center justify-center text-muted hover:text-foreground hover:border-accent/40 transition-all cursor-pointer"
              aria-label="Next">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {slide.type === "ad" && (
          <span className="absolute top-2 right-10 text-[9px] font-black text-muted/30 uppercase tracking-widest pointer-events-none z-20">Ad</span>
        )}
      </div>
    );
  }

  // ── SIDEBAR VARIANT ───────────────────────────────────────────────────────
  if (isSidebar) {
    const accentText   = slide.accent ?? "text-accent";
    const accentBg     = accentText.replace("text-", "bg-");
    const accentBorder = accentText.replace("text-", "border-");

    return (
      <div
        className={`relative overflow-hidden rounded-xl border ${slide.bg ?? "bg-accent/8"} ${slide.border ?? "border-accent/20"} ${className}`}
        onMouseEnter={stopTimer}
        onMouseLeave={startTimer}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label="Promotion"
      >
        {size === "lg" ? (
          /* ── Large / prominent sidebar ── */
          <div className={`flex flex-col items-center text-center px-4 pt-5 pb-4 transition-all duration-240 ease-out ${slideOutClass}`}>
            {slide.icon && (
              <div className="mb-3 [&>div]:w-12 [&>div]:h-12 [&>div]:rounded-xl [&>svg]:w-6 [&>svg]:h-6">
                {slide.icon}
              </div>
            )}
            <div className="w-full">
              {slide.label && (
                <span className={`text-[9px] font-black uppercase tracking-[0.22em] px-2 py-0.5 rounded border text-foreground ${accentBg}/20 ${accentBorder}/30 inline-block mb-1.5`}>
                  {slide.label}
                </span>
              )}
              {slide.eyebrow && <p className="text-[10px] text-muted mb-1">{slide.eyebrow}</p>}
              <p className={`text-[13px] font-black leading-tight ${slide.text ?? "text-foreground"} mb-1.5`}>{slide.title}</p>
              {slide.body && <p className="text-[11px] text-muted leading-snug">{slide.body}</p>}
            </div>
            {slide.cta && (
              renderCta(slide.cta, `w-full flex items-center justify-center mt-3 py-2 rounded-lg text-[12px] font-black border transition-all hover:opacity-90 text-foreground ${accentBg}/15 ${accentBorder}/25`)
            )}
          </div>
        ) : (
          /* ── Compact / default sidebar ── */
          <div className={`flex flex-col items-center text-center px-4 pt-4 pb-3 transition-all duration-240 ease-out ${slideOutClass}`}>
            {slide.icon && <div className="mb-2">{slide.icon}</div>}
            <div className="w-full">
              {slide.label && (
                <span className={`text-[9px] font-black uppercase tracking-[0.22em] px-1.5 py-0.5 rounded border text-foreground ${accentBg}/20 ${accentBorder}/30 inline-block mb-1`}>
                  {slide.label}
                </span>
              )}
              {slide.eyebrow && <p className="text-[9px] text-muted mb-0.5">{slide.eyebrow}</p>}
              <p className={`text-[12px] font-black leading-tight ${slide.text ?? "text-foreground"} mb-1`}>{slide.title}</p>
              {slide.body && <p className="text-[10px] text-muted leading-snug">{slide.body}</p>}
            </div>
            {slide.cta && (
              renderCta(slide.cta, `w-full flex items-center justify-center mt-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all hover:opacity-90 text-foreground ${accentBg}/15 ${accentBorder}/25`)
            )}
          </div>
        )}
        {slides.length > 1 && (
          <div className="flex justify-center pb-2.5">
            <Dots centered />
          </div>
        )}
        {slide.type === "ad" && (
          <span className="absolute top-1.5 right-2.5 text-[9px] font-black text-muted/35 uppercase tracking-widest pointer-events-none">
            Ad
          </span>
        )}
      </div>
    );
  }

  // ── BANNER / FEED VARIANT ─────────────────────────────────────────────────
  const accentText   = slide.accent ?? "text-accent";
  const accentBg     = accentText.replace("text-", "bg-");
  const accentBorder = accentText.replace("text-", "border-");

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${slide.bg ?? "bg-accent/8"} ${slide.border ?? "border-accent/20"} ${className}`}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-label="Announcement"
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${accentBg} opacity-60`} />

      <div className={`flex items-center gap-3 pl-5 pr-3 ${isFeed ? "py-2.5" : "py-3"} transition-all duration-240 ease-out ${slideOutClass}`}>
        {slide.icon && <div className="shrink-0">{slide.icon}</div>}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {slide.label && (
              renderLabel(slide.label, `text-[9px] font-black uppercase tracking-[0.22em] px-1.5 py-0.5 rounded border text-foreground ${accentBg}/20 ${accentBorder}/30`)
            )}
            {slide.eyebrow && <span className="text-[9px] text-muted font-bold truncate">{slide.eyebrow}</span>}
          </div>
          <p className={`font-black leading-tight ${slide.text ?? "text-foreground"} ${isFeed ? "text-[11px]" : "text-[12px]"}`}>{slide.title}</p>
          {slide.body && <p className="text-[10px] text-muted leading-tight mt-0.5 truncate">{slide.body}</p>}
        </div>

        {slide.cta && (
          renderCta(slide.cta, `shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all text-foreground ${accentBg}/15 ${accentBorder}/25 hover:${accentBg}/25`)
        )}
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 right-3">
          <Dots />
        </div>
      )}

      {/* Arrows (optional) */}
      {showArrows && slides.length > 1 && (
        <>
          <button onClick={() => { stopTimer(); advance(-1); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/60 border border-border/60 flex items-center justify-center text-muted hover:text-foreground transition-all cursor-pointer" aria-label="Previous">
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { stopTimer(); advance(1); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background/60 border border-border/60 flex items-center justify-center text-muted hover:text-foreground transition-all cursor-pointer" aria-label="Next">
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {slide.type === "ad" && (
        <span className="absolute top-1.5 right-2.5 text-[9px] font-black text-muted/35 uppercase tracking-widest pointer-events-none">Ad</span>
      )}
    </div>
  );
}
