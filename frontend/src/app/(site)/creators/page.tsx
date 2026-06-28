"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/communityApi";
import CreatorBadge from "@/components/CreatorBadge";
import { TrendingUpIcon, ArrowRightIcon, CrownIcon } from "@/components/Icons";
import PremiumGate from "@/components/PremiumGate";

const BADGE_STYLES = {
  elite:    "bg-accent-gold text-white border-accent-gold/40",
  pro:      "bg-accent-gold/15 border-accent-gold/30 text-accent-gold",
  verified: "bg-accent/15 border-accent/25 text-accent",
};

const BADGE_LABELS = {
  elite:    "★ Elite",
  pro:      "◆ Pro",
  verified: "✓ Verified",
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    communityApi.getCreators?.()
      .then((data: any) => setCreators(Array.isArray(data) ? data : []))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 pb-28 lg:pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <CrownIcon className="w-6 h-6 text-accent-gold" />
            Creators
          </h1>
          <p className="text-sm text-muted mt-0.5">Follow verified tipsters and copy their picks</p>
        </div>
        <PremiumGate feature="Creator Program" inline flagKey="creator_program">
          <Link
            href="/dashboard/creator"
            className="btn-gradient text-[11px] px-4 py-2 hidden sm:flex items-center gap-1.5"
          >
            Become a Creator
          </Link>
        </PremiumGate>
      </div>

      {/* Become creator CTA — mobile */}
      <div className="sm:hidden mb-4 p-4 rounded-xl bg-accent/8 border border-accent/20 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-black text-foreground">Become a Creator</p>
          <p className="text-[10px] text-muted">Share picks &amp; earn rewards</p>
        </div>
        <PremiumGate feature="Creator Program" inline flagKey="creator_program">
          <Link href="/dashboard/creator" className="btn-gradient text-[11px] px-3 py-1.5 shrink-0">
            Apply
          </Link>
        </PremiumGate>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted font-bold uppercase tracking-widest">Loading creators…</span>
        </div>
      ) : creators.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mb-1">
            <CrownIcon className="w-5 h-5 text-muted/40" />
          </div>
          <p className="text-sm font-black text-foreground uppercase tracking-widest">No creators yet</p>
          <p className="text-xs text-muted max-w-[220px]">Be the first verified creator on the platform.</p>
          <Link href="/dashboard/creator" className="btn-gradient text-[12px] px-5 py-2 mt-1">
            Apply Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {creators.map(creator => (
            <Link
              key={creator.id}
              href={`/creators/${creator.id}`}
              className="card-premium p-4 flex items-start gap-3 hover:border-accent/40 transition-all group"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0 overflow-hidden">
                {creator.avatarUrl
                  ? <img src={creator.avatarUrl} alt={creator.username} className="w-full h-full object-cover" />
                  : <span className="text-[15px] font-black text-accent">{creator.username?.[0]?.toUpperCase()}</span>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-black text-foreground truncate group-hover:text-accent transition-colors">
                    @{creator.username}
                  </span>
                  {creator.badge && (
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${BADGE_STYLES[creator.badge] ?? BADGE_STYLES.verified}`}>
                      {BADGE_LABELS[creator.badge] ?? creator.badge}
                    </span>
                  )}
                </div>
                {creator.bio && (
                  <p className="text-[11px] text-muted truncate mb-1.5">{creator.bio}</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted font-bold">
                    <span className="text-foreground font-black">{creator.followers ?? 0}</span> followers
                  </span>
                  {creator.winRate != null && (
                    <span className="text-[10px] text-muted font-bold flex items-center gap-0.5">
                      <TrendingUpIcon className="w-3 h-3 text-accent" />
                      <span className="text-accent font-black">{creator.winRate}%</span> win rate
                    </span>
                  )}
                </div>
              </div>

              <ArrowRightIcon className="w-4 h-4 text-muted/40 group-hover:text-accent shrink-0 mt-1 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
