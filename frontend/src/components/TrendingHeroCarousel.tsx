"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { communityApi } from "@/lib/communityApi";
import AdCarousel, { HERO_SLIDES } from "@/components/AdCarousel";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTrackingClick } from "@/hooks/useTrackingClick";
import CreatorBadge from "@/components/CreatorBadge";
import { ArrowRightIcon } from "@/components/Icons";
import SportIcon from "@/components/SportIcon";

function HeroPredSlide({ prediction, totalSlides }: { prediction: any; totalSlides: number }) {
  const { match, prediction: pred, creator, sport, league, bookingCode, status } = prediction;
  const { copied, copy } = useCopyToClipboard();
  const { trackCodeCopy } = useTrackingClick();
  const router = useRouter();

  const statusColour = {
    open: { text: "text-accent",   bg: "bg-accent/10",   border: "border-accent/20"   },
    won:  { text: "text-success",  bg: "bg-success/10",  border: "border-success/20"  },
    lost: { text: "text-danger",   bg: "bg-danger/10",   border: "border-danger/20"   },
  }[status] ?? { text: "text-accent", bg: "bg-accent/10", border: "border-accent/20" };

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    if (bookingCode) {
      copy(bookingCode.code);
      trackCodeCopy(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.code);
    }
  }

  return (
    <Link href={`/predictions/${prediction.id}`} className="block group">
      <div className="px-4 lg:px-6 py-4 sm:py-5 lg:py-7">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-10">

          {/* Left: match + prediction info */}
          <div className="flex-1 min-w-0">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-live/30 bg-live/10 text-live text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
                Trending Pick
              </div>
              <span className="hidden sm:inline text-[11px] text-muted">
                <SportIcon sport={sport} className="w-3 h-3 inline mr-1 opacity-60" />
                {league?.name}
              </span>
            </div>

            {/* Match headline */}
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-foreground leading-tight mb-2 group-hover:text-accent transition-colors"
                style={{ fontFamily: "var(--font-display, inherit)" }}>
              {match?.homeTeam?.shortName} <span className="text-muted/40 text-lg sm:text-2xl">vs</span> {match?.awayTeam?.shortName}
            </h1>

            {/* Prediction + odds */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[12px] sm:text-[13px] font-black rounded-xl">
                {pred?.shorthand}
              </span>
              <span className="text-[18px] sm:text-[22px] font-black text-foreground">@{pred?.odds}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusColour.text} ${statusColour.bg} ${statusColour.border} uppercase tracking-wide`}>
                {status}
              </span>
              {pred?.confidence && (
                <span className="text-[11px] text-muted font-bold">{pred.confidence}% confidence</span>
              )}
            </div>

            {/* Creator + copy button row */}
            <div className="flex items-center gap-3 flex-wrap">
              <CreatorBadge creator={creator} size="sm" showStats={false} linkable={false} />
              {bookingCode && (
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer border ${
                    copied
                      ? "bg-success text-white border-success/30"
                      : "bg-accent/10 border-accent/20 text-accent hover:bg-accent hover:text-white"
                  }`}
                >
                  {copied ? "Copied!" : `Copy ${bookingCode.bookmaker} Code`}
                </button>
              )}
            </div>
          </div>

          {/* Right: confidence ring + see all link (desktop) */}
          {/* Rendered as a button (not a Link) because this card is already
              wrapped in a Link — a nested <a> is invalid HTML and triggers a
              React hydration error. */}
          <div className="hidden lg:flex flex-col items-end gap-3 shrink-0 self-end pb-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push("/predictions?filter=trending"); }}
              className="text-[11px] text-accent font-black hover:underline flex items-center gap-1 cursor-pointer"
            >
              See all trending <ArrowRightIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TrendingHeroCarousel() {
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    communityApi.getPredictions()
      .then(data => setPredictions(Array.isArray(data) ? data : []))
      .catch(() => setPredictions([]));
  }, []);

  const featuredPredictions = predictions.filter(p => p.isTrending).slice(0, 5);

  const heroSlides = useMemo(() => {
    const predSlides = featuredPredictions.map(p => ({
      id: `pred-${p.id}`,
      type: "prediction" as const,
      title: `${p.match?.homeTeam?.shortName ?? ""} vs ${p.match?.awayTeam?.shortName ?? ""}`,
      glowColor: "rgba(59,130,246,0.08)",
      glowColor2: "rgba(245,158,11,0.04)",
      custom: <HeroPredSlide prediction={p} totalSlides={HERO_SLIDES.length + featuredPredictions.length} />,
    }));

    const result: typeof HERO_SLIDES = [];
    let ai = 0, pi = 0;
    while (ai < HERO_SLIDES.length || pi < predSlides.length) {
      if (ai < HERO_SLIDES.length) result.push(HERO_SLIDES[ai++]);
      if (ai < HERO_SLIDES.length) result.push(HERO_SLIDES[ai++]);
      if (pi < predSlides.length)  result.push(predSlides[pi++]);
    }
    return result.length > 0 ? result : HERO_SLIDES;
  }, [featuredPredictions]);

  return <AdCarousel slides={heroSlides} variant="hero" autoplayMs={6000} />;
}
