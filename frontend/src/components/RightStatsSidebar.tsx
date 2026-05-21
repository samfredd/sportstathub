"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, MessageCircleIcon, XCircleIcon } from "@/components/Icons";
import { communityApi } from "@/lib/communityApi";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTrackingClick } from "@/hooks/useTrackingClick";
import CreatorBadge from "@/components/CreatorBadge";
import PremiumGate, { ProBadge } from "@/components/PremiumGate";
import AdCarousel, { SIDEBAR_SLIDES } from "@/components/AdCarousel";
import SportIcon from "@/components/SportIcon";

function compactNumber(value: any) {
  const n = Number(value ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n * 10) / 10);
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function CopyCodeButton({ prediction }: { prediction: any }) {
  const { bookingCode } = prediction;
  const { copied, copy } = useCopyToClipboard();
  const { trackCodeCopy } = useTrackingClick();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        copy(bookingCode.code);
        trackCodeCopy(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.code, prediction.id, prediction.creator?.id);
      }}
      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
        copied ? "bg-success text-white" : "bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20"
      }`}
    >
      {copied ? "✓" : "Copy"}
    </button>
  );
}

function SidebarPickRow({ prediction }: { prediction: any }) {
  const { match, prediction: pred, sport } = prediction;
  return (
    <Link href={`/predictions/${prediction.id}`} className="flex items-center gap-2.5 group">
      <div className="text-muted shrink-0"><SportIcon sport={sport} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-foreground group-hover:text-accent transition-colors truncate">
          {match.homeTeam.shortName} vs {match.awayTeam.shortName}
        </p>
        <p className="text-[10px] text-muted">{pred.shorthand}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-black text-foreground">@{pred.odds}</p>
        <p className="text-[9px] text-accent">{pred.confidence}%</p>
      </div>
    </Link>
  );
}

function ResultRow({ prediction }: { prediction: any }) {
  const { match, prediction: pred, status, creator } = prediction;
  const won = status === "won";
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${won ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
        {won ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-foreground truncate">
          {match.homeTeam.shortName} vs {match.awayTeam.shortName}
        </p>
        <p className="text-[10px] text-muted">{pred.type} · {creator.name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-black text-foreground">@{pred.odds}</p>
        <p className={`text-[10px] font-black ${won ? "text-success" : "text-danger"}`}>
          {won ? "WON" : "LOST"}
        </p>
      </div>
    </div>
  );
}

export default function RightStatsSidebar() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<any>(null);

  useEffect(() => {
    communityApi.getPredictions()
      .then(data => setPredictions(Array.isArray(data) ? data : []))
      .catch(() => setPredictions([]));

    communityApi.getThreads()
      .then(data => setThreads(Array.isArray(data) ? data : []))
      .catch(() => setThreads([]));

    communityApi.getPlatformStats()
      .then(setPlatformStats)
      .catch(() => setPlatformStats(null));
  }, []);

  const hotCodes = predictions.filter(p => p.bookingCode).slice(0, 3);
  const openPredictions = predictions.filter(p => p.status === "open");
  const decidedPredictions = predictions.filter(p => p.status === "won" || p.status === "lost");
  const wonPredictions = predictions.filter(p => p.status === "won");
  const lostPredictions = predictions.filter(p => p.status === "lost");

  return (
    <aside className="hidden xl:flex flex-col w-[260px] 2xl:w-[280px] shrink-0 gap-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto no-scrollbar">

      {/* Quick Stats */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent w-full" />
        <div className="grid grid-cols-3 divide-x divide-border/50">
          {[
            { label: "Tips Today", value: compactNumber(platformStats?.tipsToday ?? 0), color: "text-accent" },
            { label: "Win Rate",   value: `${platformStats?.winRate ?? 0}%`,            color: "text-foreground" },
            { label: "Live Now",   value: compactNumber(platformStats?.liveMatches ?? 0), color: "text-live" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-3 px-2">
              <span className={`text-[17px] font-black leading-none ${color}`}>{value}</span>
              <span className="text-[9px] text-muted mt-0.5 text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Promo */}
      <AdCarousel slides={SIDEBAR_SLIDES} variant="sidebar" autoplayMs={6500} />

      {/* Hot Codes */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent-gold w-full" />
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Hot Codes</span>
            <ProBadge />
          </div>
          <Link href="/codes" className="text-[10px] text-accent font-bold flex items-center gap-0.5 hover:underline">All <ArrowRightIcon className="w-3 h-3" /></Link>
        </div>
        <div className="divide-y divide-border/40">
          {hotCodes.length === 0
            ? <p className="px-4 py-3 text-[11px] text-muted">No hot codes today.</p>
            : <>
              {/* First code — free */}
              {hotCodes.slice(0, 1).map(p => (
                <div key={p.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground truncate">{p.bookingCode.bookmaker}</p>
                    <p className="text-[10px] text-muted truncate">{p.match.homeTeam.shortName} vs {p.match.awayTeam.shortName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-black text-success">{p.bookingCode.successRate}%</span>
                    <CopyCodeButton prediction={p} />
                  </div>
                </div>
              ))}
              {/* Remaining codes — gated */}
              {hotCodes.length > 1 && (
                <PremiumGate feature="Full Hot Codes" mode="blur" flagKey="hot_codes_full">
                  {hotCodes.slice(1).map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate">{p.bookingCode.bookmaker}</p>
                        <p className="text-[10px] text-muted truncate">{p.match.homeTeam.shortName} vs {p.match.awayTeam.shortName}</p>
                      </div>
                      <span className="text-[10px] font-black text-success shrink-0">{p.bookingCode.successRate}%</span>
                    </div>
                  ))}
                </PremiumGate>
              )}
            </>
          }
        </div>
      </div>

      {/* Today's Picks */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent w-full" />
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Today&apos;s Picks</span>
            <ProBadge />
          </div>
          <Link href="/predictions" className="text-[10px] text-accent font-bold hover:underline">All</Link>
        </div>
        <div className="divide-y divide-border/40">
          {openPredictions.length === 0
            ? <p className="px-4 py-3 text-[11px] text-muted">No open picks yet.</p>
            : <>
              {/* First 2 picks — free */}
              {openPredictions.slice(0, 2).map(p => (
                <div key={p.id} className="px-4 py-2.5 hover:bg-surface-hover transition-colors">
                  <SidebarPickRow prediction={p} />
                </div>
              ))}
              {/* Remaining picks — gated */}
              {openPredictions.length > 2 && (
                <PremiumGate feature="Unlimited Daily Picks" mode="blur" flagKey="picks_unlimited">
                  {openPredictions.slice(2, 5).map(p => (
                    <div key={p.id} className="px-4 py-2.5">
                      <SidebarPickRow prediction={p} />
                    </div>
                  ))}
                </PremiumGate>
              )}
            </>
          }
        </div>
      </div>

      {/* Recent Results */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent w-full" />
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Recent Results</span>
          <Link href="/predictions?status=won" className="text-[10px] text-accent font-bold flex items-center gap-0.5 hover:underline">All <ArrowRightIcon className="w-3 h-3" /></Link>
        </div>
        <div className="divide-y divide-border/40">
          {decidedPredictions.length === 0
            ? <p className="px-4 py-3 text-[11px] text-muted">No settled results yet.</p>
            : decidedPredictions.slice(0, 4).map(p => (
              <div key={p.id} className="px-4 hover:bg-surface-hover transition-colors">
                <ResultRow prediction={p} />
              </div>
            ))
          }
        </div>
        {decidedPredictions.length > 0 && (
          <div className="grid grid-cols-4 divide-x divide-border/50 border-t border-border/50">
            {[
              { label: "Won",  value: wonPredictions.length,  color: "text-success" },
              { label: "Lost", value: lostPredictions.length, color: "text-danger"  },
              { label: "Open", value: openPredictions.length, color: "text-accent"  },
              { label: "Rate", value: `${platformStats?.winRate ?? 0}%`, color: "text-foreground" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center py-2.5">
                <span className={`text-[13px] font-black ${color}`}>{value}</span>
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hot Discussions */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent w-full" />
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Discussions</span>
          <Link href="/forum" className="text-[10px] text-accent font-bold flex items-center gap-0.5 hover:underline">Forum <ArrowRightIcon className="w-3 h-3" /></Link>
        </div>
        <div className="divide-y divide-border/40">
          {threads.length === 0
            ? <p className="px-4 py-3 text-[11px] text-muted">No discussions yet.</p>
            : threads.slice(0, 3).map(thread => (
              <Link key={thread.id} href={`/forum/${thread.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors group">
                <div className={`w-7 h-7 rounded-lg shrink-0 bg-gradient-to-br ${thread.author.avatarColor} flex items-center justify-center text-[9px] font-black text-white`}>
                  {thread.author.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                    {thread.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted">
                    <span className="font-bold">{thread.category}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><MessageCircleIcon className="w-2.5 h-2.5" />{thread.stats.replies}</span>
                    <span>· {timeAgo(thread.lastReply)}</span>
                  </div>
                </div>
              </Link>
            ))
          }
        </div>
        <div className="border-t border-border/50">
          <Link href="/forum" className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-muted hover:text-accent hover:bg-surface-hover transition-all">
            Join the Discussion <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>

    </aside>
  );
}
