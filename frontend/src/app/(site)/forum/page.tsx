"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Crown, MessageSquare, Eye, Heart, Pin, Search } from "lucide-react";
import CreatorBadge from "@/components/CreatorBadge";
import NewThreadModal from "@/components/forum/NewThreadModal";
import { communityApi } from "@/lib/communityApi";

const BADGE_STYLES = {
  elite: "bg-accent-gold text-white border border-accent-gold/40",
  pro: "bg-accent-gold/15 text-accent-gold border border-accent-gold/30",
  verified: "bg-accent/20 text-accent border border-accent/30",
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
export default function ForumPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [threads, setThreads] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);

  useEffect(() => {
    communityApi.getThreads()
      .then((data) => setThreads(Array.isArray(data) ? data : []))
      .catch(() => setThreads([]));
    communityApi.getLeaderboard()
      .then((data) => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]));
  }, []);

  const categories = useMemo(() => {
    const counts = new Map();
    threads.forEach(thread => counts.set(thread.category, (counts.get(thread.category) ?? 0) + 1));
    return [
      { id: "all", label: "All", count: threads.length },
      ...Array.from(counts, ([label, count]) => ({ id: label, label, count })),
    ];
  }, [threads]);

  const filtered = useMemo(() => {
    let list = [...threads];
    if (activeCategory !== "all") list = list.filter(t => t.category === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
    }
    if (sort === "hot") list.sort((a, b) => b.stats.views - a.stats.views);
    else if (sort === "top") list.sort((a, b) => b.stats.likes - a.stats.likes);
    else list.sort((a, b) => new Date(b.lastReply).getTime() - new Date(a.lastReply).getTime());
    // Pinned always first
    return [...list.filter(t => t.isPinned), ...list.filter(t => !t.isPinned)];
  }, [activeCategory, searchQuery, sort, threads]);

  return (
    <div className="px-4 lg:px-6 pb-28 lg:pb-10 pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pt-2">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Community Forum</h1>
          <p className="text-muted text-sm mt-1 max-w-md">
            Discuss tips, strategies, and today&apos;s matches with analysts worldwide.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/creators"
            className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-hover border border-border/50 hover:border-accent/40 text-muted hover:text-accent text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            <Crown className="w-4 h-4 text-accent-gold" /> Creators
          </Link>
          <button
            onClick={() => setIsNewThreadOpen(true)}
            className="btn-gradient text-sm px-4 py-2.5 flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> New Thread
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="glass p-3 rounded-2xl border-border/50 shadow-sm flex flex-col sm:flex-row gap-3 mb-6 relative z-20">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
          <input
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface/80 border border-border/50 text-sm font-medium outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)] focus:bg-surface"
            placeholder="Search threads, topics..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-surface/80 border border-border/50 rounded-xl p-1.5 shrink-0">
          {[
            { id: "latest", label: "Latest" },
            { id: "hot",    label: "Hot" },
            { id: "top",    label: "Top" },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                sort === s.id ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Category sidebar */}
        <aside className="lg:w-52 shrink-0">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 px-1">Categories</p>
          <div className="space-y-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-bold transition-all ${
                  activeCategory === cat.id
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeCategory === cat.id ? "bg-accent/20 text-accent" : "bg-surface text-muted"}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Creator of the Week — sidebar on desktop */}
          <div className="hidden lg:block mt-6">
            <CreatorOfWeek creator={leaderboard[0]} />
          </div>
        </aside>

        {/* Thread list */}
        <div className="flex-1 min-w-0">
          {/* Creator of the Week — inline on mobile */}
          <div className="lg:hidden mb-4">
            <CreatorOfWeek creator={leaderboard[0]} />
          </div>

          <p className="text-[11px] text-muted mb-3">{filtered.length} threads</p>
          <div className="space-y-2">
            {filtered.map(thread => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
            {filtered.length === 0 && (
              <div className="glass border border-border/40 rounded-2xl py-24 text-center flex flex-col items-center gap-5 relative overflow-hidden shadow-sm mt-2">
                <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 rounded-2xl bg-surface border border-border/60 flex items-center justify-center shadow-inner relative z-10 group hover:border-accent/30 transition-colors">
                  <MessageSquare className="w-8 h-8 text-accent opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="relative z-10">
                  <p className="font-black text-foreground text-lg">No threads found</p>
                  <p className="text-muted text-sm mt-2 max-w-sm mx-auto">Try adjusting your filters or search terms to find what you&apos;re looking for.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Creator leaderboard sidebar — xl+ */}
        <aside className="hidden xl:block w-64 shrink-0 space-y-4">
          <div className="card-premium p-4">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Top Creators</p>
            <div className="space-y-3">
              {leaderboard.map((creator, index) => (
                <LeaderboardRow key={creator.id} creator={creator} rank={index + 1} />
              ))}
              {leaderboard.length === 0 && <p className="text-[11px] text-muted font-bold">No creators ranked yet.</p>}
            </div>
            <Link href="/creators" className="btn-ghost w-full text-center text-[11px] mt-3 py-2 block">
              View All Creators →
            </Link>
          </div>

          <div className="card-premium p-4 bg-gradient-to-br from-accent/5 to-transparent">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Creator Stats</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Active", value: leaderboard.length + "+" },
                { label: "Avg Win", value: leaderboard.length ? (leaderboard.reduce((s, c) => s + c.stats.winRate, 0) / leaderboard.length).toFixed(1) + "%" : "0%" },
                { label: "Tips/Mo", value: leaderboard.reduce((sum, c) => sum + (c.stats.monthlyTotal ?? 0), 0) },
                { label: "Followers", value: leaderboard.reduce((sum, c) => sum + (c.stats.followers ?? 0), 0).toLocaleString() },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-base font-black text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <NewThreadModal isOpen={isNewThreadOpen} onClose={() => setIsNewThreadOpen(false)} />
    </div>
  );
}

function ThreadCard({ thread }) {
  return (
    <Link href={`/forum/${thread.id}`} className="block group">
      <div className="card-premium p-4 hover:border-accent/30 transition-colors">
        <div className="flex items-start gap-3">
          {/* Pin / category dot */}
          <div className="mt-1 shrink-0 flex items-center justify-center w-5">
            {thread.isPinned
              ? <Pin className="w-4 h-4 text-accent fill-accent/20" />
              : <span className="w-1.5 h-1.5 rounded-full bg-border/80 block" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-tight line-clamp-2">
                {thread.title}
              </h3>
            </div>

            {/* Category + tags */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {thread.isPinned && (
                <span className="px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent rounded-md text-[9px] font-black uppercase tracking-wider">
                  Pinned
                </span>
              )}
              <span className="px-2 py-0.5 bg-surface border border-border/50 rounded-md text-[10px] text-muted font-bold">
                {thread.category}
              </span>
              {thread.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-surface-hover text-muted rounded text-[9px] font-bold border border-border/40">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Preview */}
            <p className="text-[12px] text-muted mt-2 line-clamp-2 leading-relaxed">
              {thread.content}
            </p>

            {/* Meta row */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30 gap-2 flex-wrap">
              <CreatorBadge creator={thread.author} size="sm" showStats={false} linkable={false} />
              <div className="flex items-center gap-3.5 text-[11px] text-muted font-medium">
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {thread.stats.replies}</span>
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {thread.stats.views.toLocaleString()}</span>
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {thread.stats.likes}</span>
                <span className="hidden sm:inline opacity-60">· {timeAgo(thread.lastReply)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CreatorOfWeek({ creator }) {
  if (!creator) return null;
  return (
    <div className="card-premium p-4 bg-gradient-to-br from-accent-gold/10 to-transparent border-accent-gold/20 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-gold/10 rounded-full blur-[40px] pointer-events-none" />
      <div className="flex items-center gap-1.5 text-[10px] font-black text-accent-gold uppercase tracking-widest mb-4 relative z-10">
        <Crown className="w-3.5 h-3.5" /> Creator of the Week
      </div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${creator.avatarColor} flex items-center justify-center text-white font-black text-sm shrink-0 border border-white/10 shadow-sm`}>
          {creator.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground truncate">{creator.name}</p>
          <div className="mt-1">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${BADGE_STYLES[creator.badge]}`}>
              {creator.badgeLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
        <div className="text-center bg-surface/50 rounded-xl p-1.5 border border-border/40">
          <p className="text-sm font-black text-success">{creator.stats.winRate}%</p>
          <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Win Rate</p>
        </div>
        <div className="text-center bg-surface/50 rounded-xl p-1.5 border border-border/40">
          <p className="text-sm font-black text-foreground">{creator.stats.currentStreak}</p>
          <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Streak</p>
        </div>
        <div className="text-center bg-surface/50 rounded-xl p-1.5 border border-border/40">
          <p className="text-sm font-black text-foreground">{(creator.stats.followers / 1000).toFixed(1)}k</p>
          <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Followers</p>
        </div>
      </div>
      <div className="w-full bg-border/30 rounded-full h-1.5 mb-4 relative z-10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent" style={{ width: `${creator.stats.winRate}%` }} />
      </div>
      <Link href={`/creators/${creator.id}`} className="btn-gold w-full flex items-center justify-center text-[11px] py-2 relative z-10">
        View Profile →
      </Link>
    </div>
  );
}

function LeaderboardRow({ creator, rank }) {
  const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
  return (
    <Link href={`/creators/${creator.id}`} className="flex items-center gap-2.5 group">
      <span className={`text-[11px] font-black w-4 shrink-0 ${rankColors[rank - 1] ?? "text-muted"}`}>
        #{rank}
      </span>
      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${creator.avatarColor} flex items-center justify-center text-white font-black text-[10px] shrink-0`}>
        {creator.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-foreground group-hover:text-accent transition-colors truncate">{creator.name}</p>
        <p className="text-[10px] text-muted">{creator.stats.totalPredictions} tips</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] font-black text-success">{creator.stats.winRate}%</p>
        {creator.stats.currentStreak > 0 && (
          <p className="text-[9px] text-muted">{creator.stats.currentStreak} streak</p>
        )}
      </div>
    </Link>
  );
}
