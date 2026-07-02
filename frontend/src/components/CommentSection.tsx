"use client";
import { useEffect, useState } from "react";
import { communityApi } from "@/lib/communityApi";
import { hasAuthToken } from "@/lib/authHeaders";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const BADGE_STYLES: Record<string, string> = {
  elite:    "bg-accent-gold text-white border-accent-gold/40",
  pro:      "bg-accent-gold/15 text-accent-gold border-accent-gold/30",
  verified: "bg-accent/15 text-accent border-accent/25",
};

interface CommentAuthorData {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  badge?: string | null;
}

interface Comment {
  id: string | number;
  author: CommentAuthorData;
  content: string;
  likes: number;
  timestamp: string;
  replies?: Comment[];
  parentId?: string;
}

interface CommentAuthorProps {
  author: CommentAuthorData;
}

function CommentAuthor({ author }: CommentAuthorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${author.avatarColor || 'from-accent to-accent-hover'} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
        {author.initials}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-bold text-foreground">{author.name}</span>
        {author.badge && (
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${BADGE_STYLES[author.badge]}`}>
            {author.badge}
          </span>
        )}
      </div>
    </div>
  );
}

interface CommentBubbleProps {
  comment: Comment;
  depth?: number;
  onReply?: (parentId: string | number, content: string) => Promise<void>;
  onLike?: (commentId: string | number) => Promise<void>;
}

function CommentBubble({ comment, depth = 0, onReply, onLike }: CommentBubbleProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(comment.likes);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  async function handleLike() {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
    if (!liked && !String(comment.id).startsWith("local_")) {
      await onLike?.(comment.id);
    }
  }

  async function handleReply() {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      await onReply?.(comment.id, replyText.trim());
      setReplyText("");
      setShowReply(false);
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className={depth > 0 ? "ml-8 mt-2" : ""}>
      <div className={`p-3 rounded-xl transition-colors ${depth === 0 ? "bg-surface border border-border/40" : "bg-background/60 border border-border/30"}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CommentAuthor author={comment.author} />
          <span className="text-[10px] text-muted shrink-0">{timeAgo(comment.timestamp)}</span>
        </div>
        <p className="text-[13px] text-foreground/90 leading-relaxed pl-9">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2 pl-9">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${liked ? "text-accent" : "text-muted hover:text-foreground"}`}
          >
            {liked ? "♥" : "♡"} {likes}
          </button>
          {depth === 0 && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-[11px] font-bold text-muted hover:text-foreground transition-colors"
            >
              Reply
            </button>
          )}
        </div>
        {showReply && (
          <div className="mt-2 pl-9 flex gap-2">
            <input
              className="input-premium flex-1 text-[12px] py-1.5"
              placeholder="Write a reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || submittingReply}
              className="px-3 py-1.5 bg-accent text-white text-[11px] font-black rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {submittingReply ? "Posting" : "Post"}
            </button>
          </div>
        )}
      </div>
      {comment.replies?.map(reply => (
        <CommentBubble key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} onLike={onLike} />
      ))}
    </div>
  );
}

interface CommentSectionProps {
  comments?: Comment[];
  predictionId?: string | number;
  targetType?: string;
}

export default function CommentSection({ comments = [], predictionId, targetType = "prediction" }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState<Comment[]>(comments);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  useEffect(() => {
    if (!predictionId) return;
    communityApi.getComments(targetType, predictionId)
      .then((remote: unknown) => setLocalComments(Array.isArray(remote) ? remote : []))
      .catch(() => {});
  }, [predictionId, targetType]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setFeedback("");
    if (!hasAuthToken()) {
      setFeedback("Please sign in to comment.");
      return;
    }
    setSubmitting(true);
    // Optimistic add
    const optimistic: Comment = {
      id: `local_${Date.now()}`,
      author: { id: 'me', name: 'You', initials: 'ME', avatarColor: 'from-accent to-accent-hover', badge: null },
      content: newComment,
      likes: 0,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setLocalComments(prev => [optimistic, ...prev]);
    setNewComment("");
    try {
      const saved = await communityApi.createComment({
        targetType,
        targetId: String(predictionId),
        content: optimistic.content,
      });
      setLocalComments(prev => prev.map(c => c.id === optimistic.id ? saved : c));
    } catch (error: any) {
      setLocalComments(prev => prev.filter(c => c.id !== optimistic.id));
      setFeedback(error?.message || "Could not post your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: string | number, content: string) {
    setFeedback("");
    if (!hasAuthToken()) {
      setFeedback("Please sign in to reply.");
      return;
    }
    const optimistic: Comment = {
      id: `local_${Date.now()}`,
      parentId: String(parentId),
      author: { id: 'me', name: 'You', initials: 'ME', avatarColor: 'from-accent to-accent-hover', badge: null },
      content,
      likes: 0,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setLocalComments(prev => addReply(prev, String(parentId), optimistic));
    try {
      const saved = await communityApi.createComment({
        targetType,
        targetId: String(predictionId),
        parentId: String(parentId),
        content,
      });
      setLocalComments(prev => replaceComment(prev, optimistic.id, saved));
    } catch (error: any) {
      setLocalComments(prev => removeComment(prev, optimistic.id));
      setFeedback(error?.message || "Could not post your reply. Please try again.");
    }
  }

  async function handleLike(commentId: string | number) {
    try {
      const saved = await communityApi.likeComment(commentId);
      setLocalComments(prev => replaceComment(prev, String(commentId), saved));
    } catch (err: any) {
      if (err?.status === 401 && typeof window !== "undefined") {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
        Comments <span className="text-muted font-bold">({localComments.length})</span>
      </h3>

      {/* Post a comment */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-[10px] font-black text-white shrink-0">
          ME
        </div>
        <div className="flex-1 flex gap-2">
          <input
            className="input-premium flex-1 text-sm"
            placeholder="Add to the discussion..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="btn-gradient px-4 text-sm disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </form>
      {feedback && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300" role="status">
          {feedback}
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-3">
        {localComments.length === 0 && (
          <p className="text-center text-muted text-sm py-8">Be the first to comment.</p>
        )}
        {localComments.map(comment => (
          <CommentBubble key={comment.id} comment={comment} onReply={handleReply} onLike={handleLike} />
        ))}
      </div>
    </div>
  );
}

function addReply(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map(comment => {
    if (String(comment.id) === parentId) {
      return { ...comment, replies: [...(comment.replies ?? []), reply] };
    }
    return { ...comment, replies: addReply(comment.replies ?? [], parentId, reply) };
  });
}

function replaceComment(comments: Comment[], id: string | number, next: Comment): Comment[] {
  return comments.map(comment => {
    if (String(comment.id) === String(id)) return { ...next, replies: comment.replies ?? next.replies ?? [] };
    return { ...comment, replies: replaceComment(comment.replies ?? [], id, next) };
  });
}

function removeComment(comments: Comment[], id: string | number): Comment[] {
  return comments
    .filter(comment => String(comment.id) !== String(id))
    .map(comment => ({ ...comment, replies: removeComment(comment.replies ?? [], id) }));
}
