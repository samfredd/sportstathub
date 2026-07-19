"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { sanitizeText } from "@/lib/text";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
}

const SOURCES = ["All", "BBC Sport", "Sky Sports", "Guardian", "ESPN"] as const;
type SourceFilter = (typeof SOURCES)[number];

const SOURCE_COLOR: Record<string, string> = {
  "BBC Sport":  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Sky Sports": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Guardian":   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "ESPN":       "bg-red-500/10 text-red-400 border-red-500/20",
};

function timeAgo(iso: string): string {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return "Date unavailable";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const sourceCls = SOURCE_COLOR[item.source] ?? "bg-muted/10 text-muted border-border";
  const href = `/news/${item.id}`;

  if (featured) {
    return (
      <Link
        href={href}
        className="relative rounded-2xl overflow-hidden border border-border/50 hover:border-accent/40 transition-all group block"
      >
        {item.imageUrl ? (
          <div className="relative h-48 sm:h-56 bg-surface">
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 bg-surface" />
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${sourceCls}`}>
              {item.source}
            </span>
            <span className="text-[10px] text-muted">{timeAgo(item.publishedAt)}</span>
          </div>
          <h2 className="text-[15px] font-black text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-3">
            {item.title}
          </h2>
          {item.description && (
            <p className="text-[12px] text-muted leading-relaxed line-clamp-2">{sanitizeText(item.description)}</p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="flex gap-3 p-3.5 rounded-xl bg-surface border border-border/40 hover:border-accent/30 hover:bg-surface-hover transition-all group"
    >
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover shrink-0 bg-surface"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${sourceCls}`}>
            {item.source}
          </span>
          <span className="text-[10px] text-muted">{timeAgo(item.publishedAt)}</span>
        </div>
        <p className="text-[13px] font-bold text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {item.title}
        </p>
        {item.description && (
          <p className="text-[11px] text-muted leading-relaxed line-clamp-1">{sanitizeText(item.description)}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex gap-3 p-3.5 rounded-xl bg-surface border border-border/40 animate-pulse">
      <div className="w-16 h-16 rounded-lg bg-border/20 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-2.5 w-16 rounded bg-border/20" />
        <div className="h-4 rounded bg-border/20" />
        <div className="h-3 w-4/5 rounded bg-border/20" />
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [all,       setAll]       = useState<NewsItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [source,    setSource]    = useState<SourceFilter>("All");
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState("");

  const PER_PAGE = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/news?limit=60&page=${p}`);
      const json = await res.json();
      const items: NewsItem[] = json?.data?.items ?? [];
      setAll(prev => p === 1 ? items : [...prev, ...items]);
      setTotal(json?.data?.total ?? 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(1); }, [load]);

  const filtered = all.filter(item => {
    if (source !== "All" && item.source !== source) return false;
    if (search) {
      const q = search.toLowerCase();
      const description = sanitizeText(item.description).toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !description.includes(q)) return false;
    }
    return true;
  });

  const featured = filtered.slice(0, 3);
  const rest     = filtered.slice(3);
  const hasMore  = all.length < total;

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Football News</h1>
          <p className="text-sm text-muted mt-0.5">Live feed from BBC Sport, Sky Sports, Guardian &amp; ESPN</p>
        </div>
        <button
          onClick={() => { setAll([]); load(1); }}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-surface-hover transition-colors text-muted hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                source === s
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface border border-border/60 text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="flex-1 min-w-0 px-3.5 py-1.5 rounded-xl bg-surface border border-border/60 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {loading && (
        <div className="space-y-2.5">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-sm font-black text-foreground">No articles found</p>
          <p className="text-xs text-muted mt-1">Try a different filter or search term</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {/* Featured row */}
          {!search && featured.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {featured.map(item => <NewsCard key={item.id} item={item} featured />)}
            </div>
          )}

          {/* Article list */}
          <div className="space-y-2.5">
            {rest.map(item => <NewsCard key={item.id} item={item} />)}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  load(next);
                }}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-surface border border-border/60 text-sm font-bold text-muted hover:text-foreground hover:border-accent/40 transition-all disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
