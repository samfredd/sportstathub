"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import PredictionCard from "@/components/PredictionCard";
import { communityApi } from "@/lib/communityApi";

const BADGE_STYLES = {
  elite:    { bg: "bg-purple-500/15 border-purple-500/25 text-purple-300", label: "★ Elite Creator" },
  pro:      { bg: "bg-blue-500/15 border-blue-500/25 text-blue-300", label: "◆ Pro Creator" },
  verified: { bg: "bg-accent/15 border-accent/25 text-accent", label: "✓ Verified Creator" },
};

const PREDICTION_TABS = [
  { id: "all",  label: "All Tips" },
  { id: "open", label: "Open" },
  { id: "won",  label: "Won" },
  { id: "lost", label: "Lost" },
];

export default function CreatorProfilePage() {
  const params = useParams();
  const id = String(params.id);
  const [creator, setCreator] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [tab, setTab] = useState("all");
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      communityApi.getCreator(id),
      communityApi.getPredictions({ creatorId: id }),
    ])
      .then(([remoteCreator, remotePredictions]) => {
        if (!active) return;
        setCreator(remoteCreator);
        setFollowerCount(remoteCreator?.stats?.followers ?? 0);
        setPredictions(Array.isArray(remotePredictions) ? remotePredictions : []);
      })
      .catch(() => {
        if (!active) return;
        setCreator(null);
        setPredictions([]);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!creator) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-foreground">Creator not found</h1>
        <Link href="/forum" className="text-accent text-sm font-bold mt-4 inline-block">Back to forum</Link>
      </div>
    );
  }

  const filtered = tab === "all" ? predictions : predictions.filter(p => p.status === tab);

  const badgeInfo = BADGE_STYLES[creator.badge] ?? BADGE_STYLES.verified;
  const winPct = creator.stats.winRate;
  const lossPct = 100 - winPct - 5;

  async function handleFollow() {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const result = await communityApi.followCreator(creator.id);
      setFollowing(result.following);
      setFollowerCount(result.followers);
    } catch {
      // unauthenticated — silently fail so the button doesn't break
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <div className="px-4 lg:px-6 pb-28 lg:pb-10 pt-4">
      {/* Profile header */}
      <div className="card-premium p-5 sm:p-6 mb-6 overflow-hidden relative">
        {/* Background glow */}
        <div className={`absolute inset-0 bg-gradient-to-br opacity-5 pointer-events-none ${creator.avatarColor}`} />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${creator.avatarColor} flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-xl`}>
            {creator.initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-foreground">{creator.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeInfo.bg}`}>
                    {badgeInfo.label}
                  </span>
                </div>
                <p className="text-muted text-[12px] mt-0.5">@{creator.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-5 py-2 rounded-xl text-sm font-black transition-all disabled:opacity-60 ${
                    following
                      ? "bg-surface border border-accent/30 text-accent"
                      : "btn-gradient"
                  }`}
                >
                  {followLoading ? "..." : following ? "✓ Following" : "Follow"}
                </button>
                <button className="p-2 rounded-xl bg-surface border border-border hover:border-accent/30 text-muted hover:text-foreground transition-all">
                  <ShareIcon />
                </button>
              </div>
            </div>
            <p className="text-foreground/80 text-sm mt-2 leading-relaxed">{creator.bio}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {creator.sports.map(s => (
                <span key={s} className="px-2 py-0.5 bg-surface border border-border/50 rounded-lg text-[11px] text-muted font-bold">
                  {s === "Football" ? "⚽" : s === "Basketball" ? "🏀" : "🎾"} {s}
                </span>
              ))}
              <span className="text-[11px] text-muted">Member since {new Date(creator.joinDate).toLocaleDateString([], { year: "numeric", month: "short" })}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/40">
          <ProfileStat
            value={`${creator.stats.winRate}%`}
            label="Win Rate"
            sub={`${creator.stats.monthlyWins}/${creator.stats.monthlyTotal} this month`}
            highlight
          />
          <ProfileStat
            value={creator.stats.totalPredictions}
            label="Total Tips"
            sub={`${creator.stats.currentStreak} win streak 🔥`}
          />
          <ProfileStat
            value={fmtCount(followerCount)}
            label="Followers"
            sub={`+${Math.round(followerCount * 0.03)} this week`}
          />
          <ProfileStat
            value={`₦${fmtCount(creator.stats.earnings)}`}
            label="Earnings"
            sub="Est. affiliate revenue"
          />
        </div>
      </div>

      {/* Win rate visual */}
      <div className="card-premium p-5 mb-5">
        <h2 className="text-[13px] font-black text-foreground uppercase tracking-wider mb-4">Performance Breakdown</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden">
              <div className="bg-success rounded-l-full h-full transition-all" style={{ width: `${winPct}%` }} />
              <div className="bg-yellow-500 h-full" style={{ width: "5%" }} />
              <div className="bg-danger rounded-r-full h-full" style={{ width: `${lossPct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-success font-bold">Won {winPct}%</span>
              <span className="text-[10px] text-yellow-500 font-bold">Void 5%</span>
              <span className="text-[10px] text-danger font-bold">Lost {lossPct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-2xl font-black text-foreground">{creator.stats.currentStreak}</p>
            <p className="text-[10px] text-muted">Win streak</p>
            <p className="text-base">🔥</p>
          </div>
        </div>
      </div>

      {/* Predictions */}
      <div>
        {/* Tab bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          {PREDICTION_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${
                tab === t.id
                  ? "bg-accent text-white"
                  : "bg-surface text-muted hover:text-foreground border border-border/50"
              }`}
            >
              {t.label}
              {t.id === "all" && ` (${predictions.length})`}
              {t.id === "won" && ` (${predictions.filter(p => p.status === "won").length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted">
            <p className="text-3xl mb-2">📊</p>
            <p className="font-bold">No predictions in this category.</p>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map(p => (
            <PredictionCard key={p.id} prediction={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ value, label, sub, highlight = false }) {
  return (
    <div className="p-3 bg-background/60 rounded-xl border border-border/40">
      <p className={`text-xl font-black ${highlight ? "text-accent" : "text-foreground"}`}>{value}</p>
      <p className="text-[12px] font-bold text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
