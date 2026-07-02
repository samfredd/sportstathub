"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import CreatorBadge from "@/components/CreatorBadge";
import CommentSection from "@/components/CommentSection";
import PredictionCard from "@/components/PredictionCard";
import StatsTable from "@/components/StatsTable";
import PremiumGate, { ProBadge } from "@/components/PremiumGate";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTrackingClick } from "@/hooks/useTrackingClick";
import { communityApi } from "@/lib/communityApi";

const FORM_COLORS = {
  W: "bg-success/20 text-success",
  D: "bg-accent-gold/20 text-accent-gold",
  L: "bg-danger/20 text-danger",
};

const PLATFORM_COLORS = {
  bet9ja:    "from-green-600 to-green-700",
  sportybet: "from-orange-500 to-orange-700",
  "1xbet":   "from-blue-600 to-blue-800",
  bet365:    "from-emerald-600 to-emerald-800",
  betway:    "from-green-500 to-teal-700",
  betking:   "from-purple-600 to-purple-800",
  melbet:    "from-sky-500 to-sky-700",
  parimatch: "from-yellow-600 to-orange-600",
};
function platformGrad(name = "") {
  return PLATFORM_COLORS[name.toLowerCase().replace(/\s+/g, "")] ?? "from-accent to-accent-hover";
}

const STATUS_LABELS = {
  open: { label: "Open",   cls: "bg-accent/15 text-accent border-accent/25" },
  won:  { label: "Won ✓",  cls: "bg-success/15 text-success border-success/25" },
  lost: { label: "Lost",   cls: "bg-danger/15 text-danger border-danger/25" },
  void: { label: "Void",   cls: "bg-muted/15 text-muted border-border" },
};

const SPORT_EMOJI = {
  football: "⚽",
  basketball: "🏀",
  baseball: "⚾",
  hockey: "🏒",
  tennis: "🎾",
  volleyball: "🏐",
};

export default function PredictionDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [prediction, setPrediction] = useState(null);
  const [related, setRelated] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const { trackCodeCopy, trackBookmakerOpen } = useTrackingClick();

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    try {
      const updated = await communityApi.likePrediction(prediction.id);
      setPrediction(updated);
    } catch (err: any) {
      if (err?.status === 401) {
        window.location.href = `/auth/login?redirect=/predictions/${prediction.id}`;
      }
    } finally {
      setLiking(false);
    }
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    Promise.all([
      communityApi.getPrediction(id),
      communityApi.getPredictions(),
      communityApi.getComments('prediction', id).catch(() => []),
    ])
      .then(([data, list, loadedComments]) => {
        if (!active) return;
        setPrediction(data);
        setRelated((Array.isArray(list) ? list : [])
          .filter(p => p.id !== data.id && (p.sport === data.sport || p.creator.id === data.creator.id))
          .slice(0, 3));
        setComments(Array.isArray(loadedComments) ? loadedComments : []);
      })
      .catch(() => {
        if (active) setPrediction(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-muted font-bold tracking-widest text-sm uppercase">Loading prediction...</div>;
  }

  if (!prediction) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-foreground">Prediction not found</h1>
        <Link href="/predictions" className="text-accent text-sm font-bold mt-4 inline-block">Back to predictions</Link>
      </div>
    );
  }

  const { match, prediction: pred, creator, bookingCode, status, sport, league, stats } = prediction;

  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.open;
  const grad = platformGrad(bookingCode?.bookmaker);

  const statsRows = [
    { key: "form",   label: "Recent Form (last 5)", home: match.homeTeam.form?.join(" ") ?? "—", away: match.awayTeam.form?.join(" ") ?? "—" },
  ];

  const h2hRows = [];

  const keyFactors = [
    { positive: true, text: `${pred.type} at ${pred.odds.toFixed(2)} odds` },
    { positive: true, text: `${pred.confidence}% creator confidence` },
    ...(prediction.tags ?? []).slice(0, 3).map(tag => ({ positive: true, text: `Tagged: ${tag}` })),
  ];

  const oddsComparison = [
    bookingCode ? { bookmaker: bookingCode.bookmaker, market: pred.type, odds: pred.odds } : null,
  ].filter(Boolean);

  function handleCopy() {
    copy(bookingCode.code);
    trackCodeCopy(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.code, prediction.id, creator.id);
  }

  function handleOpen() {
    trackBookmakerOpen(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.affiliateUrl, prediction.id, creator.id);
    if (bookingCode.affiliateUrl && bookingCode.affiliateUrl !== '#') {
      window.open(bookingCode.affiliateUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="px-4 lg:px-6 pb-28 lg:pb-10 pt-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-muted mb-5">
        <Link href="/predictions" className="hover:text-accent transition-colors">Predictions</Link>
        <span>/</span>
        <span className="text-foreground truncate">{match.homeTeam.name} vs {match.awayTeam.name}</span>
      </nav>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Match header card */}
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm">{SPORT_EMOJI[sport?.toLowerCase?.()] ?? "🏆"}</span>
              <span className="text-[12px] text-muted font-bold uppercase tracking-wider">{league.name} · {league.country}</span>
              <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>

            {/* Teams */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <TeamBlock team={match.homeTeam} align="left" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-black text-muted">VS</span>
                <span className="text-[10px] text-muted text-center">
                  {new Date(match.date).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                  {" · "}
                  {new Date(match.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {match.venue && <span className="text-[10px] text-muted text-center">{match.venue}</span>}
              </div>
              <TeamBlock team={match.awayTeam} align="right" />
            </div>

            {/* Prediction highlight */}
            <div className="flex items-center gap-3 p-3 bg-accent/10 border border-accent/20 rounded-xl flex-wrap">
              <div className="flex-1">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Prediction</p>
                <p className="text-base font-black text-accent">{pred.type}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Odds</p>
                <p className="text-xl font-black text-foreground">{pred.odds.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Confidence</p>
                <ConfidenceBar value={pred.confidence} />
              </div>
            </div>
          </div>

          {/* Deep Analysis + Stats — Pro */}
          <PremiumGate feature="Full Predictions" mode="blur" flagKey="predictions_full">
            <div className="space-y-5">
              {/* Deep Analysis */}
              <div className="card-premium p-5">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider">Deep Analysis</h2>
                  <ProBadge />
                </div>
                <p className="text-foreground/85 text-sm leading-relaxed">{pred.analysis}</p>

                {/* Key factors */}
                <div className="mt-4 space-y-2">
                  {keyFactors.map((f, i) => (
                    <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl text-[12px] ${f.positive ? "bg-success/8 border border-success/15" : "bg-danger/8 border border-danger/15"}`}>
                      <span className={f.positive ? "text-success mt-0.5" : "text-danger mt-0.5"}>
                        {f.positive ? "▲" : "▼"}
                      </span>
                      <span className={f.positive ? "text-foreground/90" : "text-foreground/70"}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Stats Comparison */}
              <div className="card-premium p-5">
                <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-1">Team Statistics</h2>
                <div className="flex items-center justify-between text-[11px] font-bold text-muted mb-3">
                  <span>{match.homeTeam.shortName}</span>
                  <span className="text-[10px] uppercase tracking-widest">Stored creator data</span>
                  <span>{match.awayTeam.shortName}</span>
                </div>
                <StatsTable rows={statsRows} highlightKey="form" />
              </div>

              {/* Head-to-Head */}
              <div className="card-premium p-5">
                <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-1">Head-to-Head</h2>
                <div className="flex items-center justify-between text-[11px] font-bold text-muted mb-3">
                  <span>{match.homeTeam.shortName}</span>
                  <span className="text-[10px] uppercase tracking-widest">H2H Record</span>
                  <span>{match.awayTeam.shortName}</span>
                </div>
                {h2hRows.length ? <StatsTable rows={h2hRows} /> : (
                  <p className="text-[12px] text-muted leading-relaxed">
                    No backend H2H snapshot is attached to this community prediction. Use the main H2H tool for provider-backed comparisons.
                  </p>
                )}
              </div>

              {/* Odds Comparison */}
              <div className="card-premium p-5">
                <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-1">Odds Comparison</h2>
                <p className="text-[11px] text-muted mb-3">Stored bookmaker odds for this prediction</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-muted text-[10px] uppercase tracking-widest">
                        <th className="text-left pb-2 font-black">Bookmaker</th>
                        <th className="text-center pb-2 font-black">Market</th>
                        <th className="text-right pb-2 font-black">Odds</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {oddsComparison.map((row, i) => (
                        <tr key={i} className={i === 0 ? "bg-accent/5" : ""}>
                          <td className="py-2 font-bold text-foreground">{row.bookmaker}</td>
                          <td className="py-2 text-center text-muted font-bold">{row.market}</td>
                          <td className="py-2 text-right">
                            <span className="font-black px-2 py-0.5 rounded bg-accent text-white text-[11px]">
                              {row.odds.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!oddsComparison.length && <p className="text-[12px] text-muted">No bookmaker code is attached to this prediction.</p>}
              </div>

              {/* Team News */}
              <div className="card-premium p-5">
                <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-3">Team News &amp; Injuries</h2>
                <p className="text-[12px] text-muted leading-relaxed">
                  No injury or team news is attached to this community prediction. Check the creator&apos;s notes in the analysis above.
                </p>
              </div>
            </div>
          </PremiumGate>

          {/* Booking code — gated */}
          {bookingCode && (
            <PremiumGate feature="Full Predictions" mode="replace" flagKey="predictions_full">
            <div className="card-premium overflow-hidden">
              <div className={`h-1 w-full bg-gradient-to-r ${grad}`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Booking Code</p>
                    <p className="text-base font-black text-foreground">{bookingCode.bookmaker}</p>
                    <p className="text-[10px] text-muted mt-0.5">Posted by <Link href={`/creators/${creator.id}`} className="text-accent hover:underline">{creator.name}</Link></p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[9px] text-success font-black uppercase tracking-widest">Active</span>
                  </div>
                </div>

                {/* Code display */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 bg-background/60 border border-border/50 rounded-xl px-4 py-3">
                    <p className="font-mono text-xl font-black text-foreground tracking-[0.2em]">{bookingCode.code}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-4 py-3 rounded-xl font-black text-sm transition-all ${
                      copied ? "bg-success text-white" : "bg-accent hover:bg-accent-hover text-white"
                    }`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>

                {/* Open bookmaker CTA */}
                <button
                  onClick={handleOpen}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-surface border border-border hover:border-accent/40 text-foreground text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5"
                >
                  Open {bookingCode.bookmaker} ↗
                </button>

                {/* Stats bar */}
                <div className="flex items-center justify-between mt-3 text-[11px] text-muted">
                  <span>{bookingCode.clicks.toLocaleString()} total clicks</span>
                  <span className="text-success">{bookingCode.successRate}% success rate</span>
                  {/* Hidden tracking metadata — consumed by tracking service */}
                  <span className="sr-only" data-tracking-id={bookingCode.trackingId} data-conversion-status={bookingCode.conversionStatus ?? 'open'} />
                </div>
              </div>
            </div>
            </PremiumGate>
          )}

          {/* Creator summary */}
          <div className="card-premium p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${creator.avatarColor} flex items-center justify-center text-white font-black text-lg`}>
                  {creator.initials}
                </div>
                <div>
                  <CreatorBadge creator={creator} size="lg" showStats={false} />
                  <p className="text-[12px] text-muted mt-1 max-w-xs line-clamp-2">{creator.bio}</p>
                </div>
              </div>
              <button className="shrink-0 btn-gradient text-[12px] px-4 py-2">Follow</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/40">
              <MiniStat value={`${creator.stats.winRate}%`} label="Win Rate" />
              <MiniStat value={creator.stats.totalPredictions} label="Tips" />
              <MiniStat value={fmtCount(creator.stats.followers)} label="Followers" />
            </div>
          </div>

          {/* Comments */}
          <div className="card-premium p-5">
        <CommentSection comments={comments} predictionId={prediction.id} targetType="prediction" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          {/* Quick copy CTA — sticky on desktop */}
          <div className="sticky top-20 space-y-4">
            {bookingCode && (
              <div className="card-premium p-4">
                <p className="text-[11px] text-muted uppercase tracking-wider font-bold mb-2">Quick Actions</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleCopy}
                    className={`w-full py-3 rounded-xl font-black text-sm transition-all ${copied ? "bg-success text-white" : "btn-gradient"}`}
                  >
                    {copied ? "✓ Code Copied!" : `Copy ${bookingCode.bookmaker} Code`}
                  </button>
                  <button
                    onClick={handleOpen}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-surface border border-border hover:border-accent/40 text-muted hover:text-foreground transition-all"
                  >
                    Open Bookmaker ↗
                  </button>
                </div>
                <p className="text-center text-[10px] text-muted mt-2">
                  Tracking ID: <span className="font-mono">{bookingCode.trackingId}</span>
                </p>
              </div>
            )}

            {/* Social stats */}
            <div className="card-premium p-4">
              <p className="text-[11px] text-muted uppercase tracking-wider font-bold mb-3">Engagement</p>
              <div className="space-y-2">
                <button
                  onClick={handleLike}
                  disabled={liking}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-accent/10 transition-colors group disabled:opacity-50"
                >
                  <span className="text-[12px] text-muted group-hover:text-accent transition-colors">♡ Likes</span>
                  <span className="text-[12px] font-bold text-foreground">{stats.likes.toLocaleString()}</span>
                </button>
                <EngagementRow icon="💬" label="Comments" value={stats.comments} />
                <EngagementRow icon="👁" label="Views" value={stats.views} />
                <EngagementRow icon="↗" label="Shares" value={stats.shares} />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Related predictions */}
      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-4">Related Predictions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map(p => (
              <PredictionCard key={p.id} prediction={p} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamBlock({ team, align }) {
  return (
    <div className={`flex flex-col items-${align === "left" ? "start" : "end"} gap-2`}>
      <div className="w-12 h-12 rounded-2xl bg-surface border border-border/50 flex items-center justify-center">
        <span className="text-lg font-black text-muted">{team.shortName}</span>
      </div>
      <p className="text-base font-black text-foreground">{team.name}</p>
      {team.form && (
        <div className="flex items-center gap-0.5">
          {team.form.map((r, i) => (
            <span key={i} className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${
              r === "W" ? "bg-success/20 text-success" : r === "L" ? "bg-danger/20 text-danger" : "bg-accent-gold/20 text-accent-gold"
            }`}>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ value }) {
  const color = value >= 75 ? "bg-success" : value >= 55 ? "bg-accent-gold" : "bg-danger";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-black text-foreground">{value}%</span>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-base font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

function EngagementRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted">{icon} {label}</span>
      <span className="text-[12px] font-bold text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}

function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
