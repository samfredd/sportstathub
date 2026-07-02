"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageSquare, Eye, Heart, Share, Flag, Pin } from "lucide-react";
import CreatorBadge from "@/components/CreatorBadge";
import CommentSection from "@/components/CommentSection";
import { communityApi } from "@/lib/communityApi";

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ForumThreadPage() {
  const params = useParams();
  const id = String(params.id);
  const [thread, setThread] = useState(null);
  const [relatedThreads, setRelatedThreads] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    communityApi.getThread(id)
      .then((data) => {
        if (!active) return;
        setThread(data);
        setLoading(false);
        void Promise.all([
          communityApi.getThreads().catch(() => []),
          communityApi.getComments('thread', id).catch(() => []),
        ]).then(([threads, loadedComments]) => {
          if (!active) return;
          setRelatedThreads((Array.isArray(threads) ? threads : [])
            .filter(t => t.id !== data.id && t.category === data.category)
            .slice(0, 3));
          setComments(Array.isArray(loadedComments) ? loadedComments : []);
        });
      })
      .catch(() => {
        if (active) setThread(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-muted font-bold tracking-widest text-sm uppercase">Loading thread...</div>;
  }

  if (!thread) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-foreground">Thread not found</h1>
        <Link href="/forum" className="text-accent text-sm font-bold mt-4 inline-block">Back to forum</Link>
      </div>
    );
  }

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    try {
      const updated = await communityApi.likeThread(thread.id);
      setThread(updated);
    } catch (err: any) {
      if (err?.status === 401) {
        window.location.href = `/auth/login?redirect=/forum/${thread.id}`;
      }
    } finally {
      setLiking(false);
    }
  }

  function trackThreadAction(eventName) {
    communityApi.trackClick({
      eventName,
      trackingId: `thread_${thread.id}`,
      ts: Date.now(),
    }).catch(() => {});
  }

  return (
    <div className="px-4 lg:px-6 pb-28 lg:pb-10 pt-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-muted mb-5">
        <Link href="/forum" className="hover:text-accent transition-colors">Forum</Link>
        <span>/</span>
        <span className="text-muted">{thread.category}</span>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{thread.title}</span>
      </nav>

      {/* Thread card */}
      <div className="card-premium p-5 sm:p-6 mb-5">
        {/* Category + tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[11px] font-black rounded-lg">
            {thread.category}
          </span>
          {thread.isPinned && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
              <Pin className="w-3 h-3 fill-yellow-400/20" /> Pinned
            </span>
          )}
          {thread.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-surface border border-border/50 text-muted text-[10px] font-bold rounded-lg">
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight mb-4">{thread.title}</h1>

        {/* Body */}
        <p className="text-foreground/85 text-sm leading-relaxed">{thread.content}</p>

        {/* Author + meta */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40 flex-wrap gap-3">
          <CreatorBadge creator={thread.author} size="md" />
          <div className="flex items-center gap-4 text-[11px] text-muted font-medium">
            <span>Posted {timeAgo(thread.timestamp)}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {thread.stats.replies} replies</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {thread.stats.views.toLocaleString()}</span>
          </div>
        </div>

        {/* Engagement */}
        <div className="flex items-center gap-2 mt-4">
          <button onClick={handleLike} disabled={liking} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border/50 hover:border-accent/30 text-muted hover:text-accent rounded-xl text-[12px] font-bold transition-all disabled:opacity-50 group">
            <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" /> {thread.stats.likes} Likes
          </button>
          <button onClick={() => trackThreadAction("thread_share")} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border/50 hover:border-border text-muted hover:text-foreground rounded-xl text-[12px] font-bold transition-all group">
            <Share className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> Share
          </button>
          <button onClick={() => trackThreadAction("thread_report")} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border/50 hover:border-danger/30 text-muted hover:text-danger rounded-xl text-[12px] font-bold transition-all group">
            <Flag className="w-4 h-4 group-hover:scale-110 transition-transform" /> Report
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="card-premium p-5">
        <CommentSection comments={comments} predictionId={thread.id} targetType="thread" />
      </div>

      {/* Related threads */}
      <div className="mt-6">
        <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3">More in {thread.category}</h3>
        <div className="space-y-2">
          {relatedThreads
            .map(related => (
              <Link
                key={related.id}
                href={`/forum/${related.id}`}
                className="flex items-start gap-3 p-3 bg-surface border border-border/40 rounded-xl hover:border-accent/30 transition-colors group"
              >
                <span className="text-accent text-lg shrink-0 mt-0.5">›</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">{related.title}</p>
                  <p className="text-[10px] text-muted mt-0.5">{related.stats.replies} replies · {timeAgo(related.lastReply)}</p>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
