"use client";
import Link from "next/link";

const BADGE_STYLES: Record<string, string> = {
  elite: "bg-accent-gold text-white border-accent-gold/40",
  pro:   "bg-accent-gold/15 text-accent-gold border-accent-gold/30",
  verified: "bg-accent/15 text-accent border-accent/25",
};

const BADGE_ICONS: Record<string, string> = {
  elite:    "★",
  pro:      "◆",
  verified: "✓",
};

interface CreatorStats {
  winRate: number;
  totalPredictions: number;
  currentStreak: number;
}

interface Creator {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  badge?: string;
  badgeLabel?: string;
  stats: CreatorStats;
}

interface CreatorBadgeProps {
  creator: Creator;
  size?: "sm" | "md" | "lg";
  showStats?: boolean;
  linkable?: boolean;
}

export default function CreatorBadge({ creator, size = "md", showStats = true, linkable = true }: CreatorBadgeProps) {
  const avatarSizes = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-[11px]",
    lg: "w-12 h-12 text-sm",
  };
  const nameSizes = {
    sm: "text-[11px]",
    md: "text-[13px]",
    lg: "text-sm",
  };

  const content = (
    <div className="flex items-center gap-2.5">
      <div className={`${avatarSizes[size]} rounded-full bg-gradient-to-br ${creator.avatarColor || 'from-accent to-accent-hover'} flex items-center justify-center font-black text-white shrink-0`}>
        {creator.initials}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${nameSizes[size]} font-bold text-foreground leading-none truncate`}>
            {creator.name}
          </span>
          {creator.badge && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${BADGE_STYLES[creator.badge]}`}>
              <span>{BADGE_ICONS[creator.badge]}</span>
              {creator.badgeLabel}
            </span>
          )}
        </div>
        {showStats && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-accent font-bold">
              {creator.stats.winRate}% win
            </span>
            <span className="text-[10px] text-muted">·</span>
            <span className="text-[10px] text-muted">
              {creator.stats.totalPredictions} tips
            </span>
            {creator.stats.currentStreak > 2 && (
              <>
                <span className="text-[10px] text-muted">·</span>
                <span className="text-[10px] text-accent-gold font-bold">
                  🔥 {creator.stats.currentStreak}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (linkable) {
    return (
      <Link href={`/creators/${creator.id}`} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}
