"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

const SOURCE_COLOR: Record<string, string> = {
  "BBC Sport":  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Sky Sports": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Guardian":   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "ESPN":       "bg-red-500/10 text-red-400 border-red-500/20",
};

const SOURCE_ACCENT: Record<string, string> = {
  "BBC Sport":  "text-amber-400",
  "Sky Sports": "text-blue-400",
  "Guardian":   "text-emerald-400",
  "ESPN":       "text-red-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function RelatedCard({ item }: { item: NewsItem }) {
  const sourceCls = SOURCE_COLOR[item.source] ?? "bg-muted/10 text-muted border-border";
  return (
    <Link
      href={`/news/${item.id}`}
      className="flex gap-3 p-3 rounded-xl bg-surface border border-border/40 hover:border-accent/30 hover:bg-surface-hover transition-all group"
    >
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="w-14 h-14 rounded-lg object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${sourceCls}`}>
          {item.source}
        </span>
        <p className="text-[12px] font-bold text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {item.title}
        </p>
        <p className="text-[10px] text-muted">{timeAgo(item.publishedAt)}</p>
      </div>
    </Link>
  );
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [related, setRelated] = useState<NewsItem[]>([]);
  const [status, setStatus]   = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    setStatus("loading");
    fetch(`${BASE}/api/news/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.status !== "success") throw new Error(json.error || "Not found");
        setArticle(json.data.article);
        setRelated(json.data.related ?? []);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") {
    return (
      <main className="max-w-[860px] mx-auto px-4 lg:px-6 py-8 space-y-6 animate-pulse">
        <div className="h-4 w-24 rounded bg-border/20" />
        <div className="h-64 rounded-2xl bg-border/20" />
        <div className="space-y-3">
          <div className="h-8 rounded bg-border/20" />
          <div className="h-6 w-3/4 rounded bg-border/20" />
          <div className="h-4 w-1/3 rounded bg-border/20" />
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-4 rounded bg-border/20" />)}
        </div>
      </main>
    );
  }

  if (status === "error" || !article) {
    return (
      <main className="max-w-[860px] mx-auto px-4 lg:px-6 py-20 text-center space-y-4">
        <p className="text-lg font-black text-foreground">Article not found</p>
        <p className="text-sm text-muted">It may have expired from the cache. Try refreshing the news feed.</p>
        <Link href="/news" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors">
          Back to News
        </Link>
      </main>
    );
  }

  const sourceCls   = SOURCE_COLOR[article.source]  ?? "bg-muted/10 text-muted border-border";
  const accentColor = SOURCE_ACCENT[article.source] ?? "text-accent";

  return (
    <main className="max-w-[860px] mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-muted font-bold">
        <Link href="/news" className="hover:text-foreground transition-colors">News</Link>
        <span>/</span>
        <span className={accentColor}>{article.source}</span>
      </div>

      {/* Hero image */}
      {article.imageUrl && (
        <div className="rounded-2xl overflow-hidden border border-border/40 bg-surface">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full max-h-[240px] sm:max-h-[420px] object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </div>
      )}

      {/* Article header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${sourceCls}`}>
            {article.source}
          </span>
          <span className="text-[11px] text-muted">{formatDate(article.publishedAt)}</span>
          <span className="text-[11px] text-muted">·</span>
          <span className="text-[11px] text-muted">{timeAgo(article.publishedAt)}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight tracking-tight">
          {article.title}
        </h1>

        {article.description && (
          <p className="text-base text-foreground/80 leading-relaxed border-l-2 border-accent/40 pl-4">
            {sanitizeText(article.description)}
          </p>
        )}
      </div>

      {/* Read full article CTA */}
      <div className="rounded-2xl bg-surface border border-border/50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">Read the full article</p>
          <p className="text-xs text-muted mt-0.5">
            This story is published by <span className={`font-bold ${accentColor}`}>{article.source}</span>. Click to open the original on their website.
          </p>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-black hover:bg-accent-hover transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
        >
          Read on {article.source} →
        </a>
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-foreground uppercase tracking-tight">More from {article.source}</h2>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {related.map(item => <RelatedCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="pt-2 border-t border-border/30">
        <Link href="/news" className="text-sm text-muted hover:text-foreground font-bold transition-colors">
          ← All News
        </Link>
      </div>
    </main>
  );
}
