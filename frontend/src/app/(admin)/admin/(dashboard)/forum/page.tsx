"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { adminApi } from "@/lib/adminApi";

const LIMIT = 20;

type Thread = {
  id: number;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  stats: { replies: number; views: number; likes: number };
  created_at: string;
  author_name: string;
  author_id: number;
  comment_count: number;
};

type Comment = {
  id: number;
  content: string;
  likes: number;
  created_at: string;
  parent_id: number | null;
  user_id: number;
  username: string;
  avatar_url: string | null;
};

type ThreadDetail = Thread & { comments: Comment[] };

export default function AdminForumPage() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function openThread(id: number) {
    try {
      const data = await adminApi.getThread(id);
      setActiveThread(data);
      setView("detail");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  function goBack() {
    setView("list");
    setActiveThread(null);
  }

  return (
    <div className="space-y-6">
      {view === "list" ? (
        <ThreadList showToast={showToast} onOpenThread={openThread} />
      ) : (
        <ThreadDetail
          thread={activeThread!}
          onBack={goBack}
          showToast={showToast}
          onRefresh={async () => {
            if (activeThread) {
              try {
                const data = await adminApi.getThread(activeThread.id);
                setActiveThread(data);
              } catch {}
            }
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Thread List ─────────────────────────────────────────────
function ThreadList({
  showToast,
  onOpenThread,
}: {
  showToast: (m: string, t?: string) => void;
  onOpenThread: (id: number) => void;
}) {
  const [data, setData]         = useState<Thread[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getThreads({ page, limit: LIMIT, search });
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [data]);

  async function handleDelete(row: Thread) {
    if (!confirm(`Delete thread "${row.title}" by ${row.author_name}? All replies will also be removed.`)) return;
    try {
      await adminApi.deleteThread(row.id);
      showToast("Thread deleted");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handleTogglePin(row: Thread) {
    try {
      await adminApi.togglePinThread(row.id);
      showToast(row.is_pinned ? "Thread unpinned" : "Thread pinned");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  function toggleSelectAll() {
    if (selected.size === data.length && data.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((t) => t.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} threads? All replies will also be removed. This cannot be undone.`)) return;
    try {
      for (const id of selected) {
        await adminApi.deleteThread(id);
      }
      showToast(`${selected.size} thread(s) deleted`);
      setSelected(new Set());
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && selected.size < data.length;

  const columns = [
    {
      key: "select", label: (
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-accent cursor-pointer"
          checked={allSelected}
          ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someSelected; }}
          onChange={toggleSelectAll}
        />
      ), width: 40,
      render: (row: Thread) => (
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-accent cursor-pointer"
          checked={selected.has(row.id)}
          onChange={() => toggleSelect(row.id)}
        />
      ),
    },
    {
      key: "id", label: "#", width: 60,
      render: (row: Thread) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-muted text-xs font-mono">#{row.id}</span>
          {row.is_pinned && <PinIcon className="w-3 h-3 text-accent-gold" />}
        </div>
      ),
    },
    {
      key: "title", label: "Thread",
      render: (row: Thread) => (
        <button className="text-left max-w-[240px] group" onClick={() => onOpenThread(row.id)}>
          <div className="text-sm font-bold text-foreground group-hover:text-accent transition-colors truncate">{row.title}</div>
          <div className="text-xs text-muted font-medium line-clamp-1 mt-0.5">{row.content}</div>
        </button>
      ),
    },
    {
      key: "author_name", label: "Author",
      render: (row: Thread) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-accent">{row.author_name?.[0]?.toUpperCase() ?? "?"}</span>
          </div>
          <span className="text-sm font-bold text-foreground">{row.author_name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "category", label: "Category",
      render: (row: Thread) => row.category ? <CategoryBadge category={row.category} /> : <span className="text-xs text-muted/50 font-medium">—</span>,
    },
    {
      key: "comment_count", label: "Replies",
      render: (row: Thread) => (
        <div className="flex items-center gap-1.5">
          <ChatIcon className="w-3.5 h-3.5 text-muted" />
          <span className="text-sm font-bold text-foreground">{row.comment_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: "created_at", label: "Posted",
      render: (row: Thread) => <span className="text-xs text-muted font-medium">{new Date(row.created_at).toLocaleDateString("en-GB")}</span>,
    },
    {
      key: "actions", label: "Actions",
      render: (row: Thread) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenThread(row.id)}
            className="text-xs font-bold text-accent hover:underline px-2 py-1 rounded-lg hover:bg-accent/10 transition-all"
          >
            View
          </button>
          <button
            onClick={() => handleTogglePin(row)}
            className={`text-xs font-bold px-2 py-1 rounded-lg transition-all ${row.is_pinned ? "text-accent-gold hover:bg-accent-gold/10" : "text-muted hover:text-accent-gold hover:bg-accent-gold/10"}`}
            title={row.is_pinned ? "Unpin" : "Pin"}
          >
            {row.is_pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-xs font-bold text-danger hover:underline px-2 py-1 rounded-lg hover:bg-danger/10 transition-all"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Forum</h2>
          <p className="text-muted text-sm font-medium mt-1">{total} total threads</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by title, body, or author…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 glass rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-sm">
          <span className="font-black text-foreground">{selected.size} threads selected</span>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-danger bg-danger/10 hover:bg-danger/20 transition-all"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-bold text-muted hover:text-foreground transition-colors"
          >
            Deselect all
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        pages={pages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No forum threads found"
      />
    </>
  );
}

// ─── Thread Detail ────────────────────────────────────────────
function ThreadDetail({
  thread,
  onBack,
  showToast,
  onRefresh,
}: {
  thread: ThreadDetail;
  onBack: () => void;
  showToast: (m: string, t?: string) => void;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting]             = useState<number | null>(null);
  const [pinning, setPinning]               = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);

  // Bulk comment selection
  const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set());

  async function handleDeleteComment(comment: Comment) {
    if (!confirm(`Delete this reply by ${comment.username}?`)) return;
    setDeleting(comment.id);
    try {
      await adminApi.deleteComment(comment.id);
      showToast("Reply deleted");
      onRefresh();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleTogglePin() {
    setPinning(true);
    try {
      await adminApi.togglePinThread(thread.id);
      showToast(thread.is_pinned ? "Thread unpinned" : "Thread pinned");
      onRefresh();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setPinning(false);
    }
  }

  async function handleDeleteThread() {
    if (!confirm(`Delete thread "${thread.title}"? All ${thread.comments.length} replies will also be removed.`)) return;
    setDeletingThread(true);
    try {
      await adminApi.deleteThread(thread.id);
      showToast("Thread deleted");
      onBack();
    } catch (e: any) {
      showToast(e.message, "error");
      setDeletingThread(false);
    }
  }

  function toggleSelectComment(id: number) {
    setSelectedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllComments() {
    if (selectedComments.size === thread.comments.length && thread.comments.length > 0) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(thread.comments.map((c) => c.id)));
    }
  }

  async function handleBulkDeleteComments() {
    if (!selectedComments.size) return;
    if (!confirm(`Delete ${selectedComments.size} comment(s)? This cannot be undone.`)) return;
    try {
      for (const id of selectedComments) {
        await adminApi.deleteComment(id);
      }
      showToast(`${selectedComments.size} comment(s) deleted`);
      setSelectedComments(new Set());
      onRefresh();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  const topLevelComments = thread.comments.filter((c) => !c.parent_id);
  const replies = thread.comments.filter((c) => c.parent_id);
  const allCommentsSelected = thread.comments.length > 0 && selectedComments.size === thread.comments.length;
  const someCommentsSelected = selectedComments.size > 0 && selectedComments.size < thread.comments.length;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-foreground transition-colors">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Threads
        </button>
      </div>

      {/* Thread card */}
      <div className="glass rounded-2xl border border-border/40 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {thread.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded-full">
                  <PinIcon className="w-2.5 h-2.5" /> Pinned
                </span>
              )}
              {thread.category && <CategoryBadge category={thread.category} />}
            </div>
            <h3 className="text-lg font-black text-foreground leading-snug">{thread.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTogglePin}
              disabled={pinning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                thread.is_pinned
                  ? "text-accent-gold border-accent-gold/30 hover:bg-accent-gold/10"
                  : "text-muted border-border/40 hover:text-accent-gold hover:border-accent-gold/30 hover:bg-accent-gold/10"
              }`}
            >
              <PinIcon className="w-3.5 h-3.5" />
              {thread.is_pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={handleDeleteThread}
              disabled={deletingThread}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-danger border border-danger/20 hover:bg-danger/10 transition-all disabled:opacity-50"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete Thread
            </button>
          </div>
        </div>

        {/* Author + meta */}
        <div className="flex items-center gap-3 py-3 border-y border-border/20">
          <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-accent">{thread.author_name?.[0]?.toUpperCase() ?? "?"}</span>
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{thread.author_name}</div>
            <div className="text-xs text-muted">{new Date(thread.created_at).toLocaleString("en-GB")}</div>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted font-medium">
            <span className="flex items-center gap-1"><ChatIcon className="w-3.5 h-3.5" /> {thread.comments.length} replies</span>
            <span className="flex items-center gap-1"><HeartIcon className="w-3.5 h-3.5" /> {thread.stats?.likes ?? 0} likes</span>
            <span className="flex items-center gap-1"><EyeIcon className="w-3.5 h-3.5" /> {thread.stats?.views ?? 0} views</span>
          </div>
        </div>

        {/* Content */}
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{thread.content}</div>
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h4 className="font-black text-foreground text-base">
              Replies <span className="text-muted font-bold text-sm ml-1">({thread.comments.length})</span>
            </h4>
            {thread.comments.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-muted font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                  checked={allCommentsSelected}
                  ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someCommentsSelected; }}
                  onChange={toggleSelectAllComments}
                />
                Select all
              </label>
            )}
          </div>
        </div>

        {/* Bulk comment action bar */}
        {selectedComments.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-sm">
            <span className="font-black text-foreground">{selectedComments.size} selected</span>
            <button
              onClick={handleBulkDeleteComments}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-danger bg-danger/10 hover:bg-danger/20 transition-all"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedComments(new Set())}
              className="ml-auto text-xs font-bold text-muted hover:text-foreground transition-colors"
            >
              Deselect all
            </button>
          </div>
        )}

        {thread.comments.length === 0 ? (
          <div className="glass rounded-2xl border border-border/30 p-8 text-center">
            <ChatIcon className="w-8 h-8 text-muted/40 mx-auto mb-2" />
            <p className="text-muted text-sm font-medium">No replies yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topLevelComments.map((comment) => {
              const nested = replies.filter((r) => r.parent_id === comment.id);
              return (
                <div key={comment.id}>
                  <CommentRow
                    comment={comment}
                    onDelete={() => handleDeleteComment(comment)}
                    isDeleting={deleting === comment.id}
                    isReply={false}
                    isSelected={selectedComments.has(comment.id)}
                    onToggleSelect={() => toggleSelectComment(comment.id)}
                  />
                  {nested.map((r) => (
                    <div key={r.id} className="ml-8 mt-2">
                      <CommentRow
                        comment={r}
                        onDelete={() => handleDeleteComment(r)}
                        isDeleting={deleting === r.id}
                        isReply
                        isSelected={selectedComments.has(r.id)}
                        onToggleSelect={() => toggleSelectComment(r.id)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Orphaned replies (parent deleted) */}
            {replies.filter((r) => !topLevelComments.find((c) => c.id === r.parent_id)).map((r) => (
              <div key={r.id} className="ml-8">
                <CommentRow
                  comment={r}
                  onDelete={() => handleDeleteComment(r)}
                  isDeleting={deleting === r.id}
                  isReply
                  isSelected={selectedComments.has(r.id)}
                  onToggleSelect={() => toggleSelectComment(r.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  onDelete,
  isDeleting,
  isReply,
  isSelected,
  onToggleSelect,
}: {
  comment: Comment;
  onDelete: () => void;
  isDeleting: boolean;
  isReply: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div className={`glass rounded-xl border border-border/30 p-4 flex gap-3 group ${isReply ? "border-dashed" : ""} ${isSelected ? "bg-accent/5 border-accent/20" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-accent cursor-pointer mt-1 shrink-0"
          checked={isSelected}
          onChange={onToggleSelect}
        />
        <div className="w-8 h-8 rounded-full bg-surface border border-border/30 flex items-center justify-center shrink-0">
          {comment.avatar_url ? (
            <img src={comment.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-xs font-black text-muted">{comment.username?.[0]?.toUpperCase() ?? "?"}</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{comment.username ?? "Deleted user"}</span>
            {isReply && <span className="text-[10px] text-muted/60 font-bold uppercase tracking-wider">reply</span>}
            <span className="text-xs text-muted">{new Date(comment.created_at).toLocaleString("en-GB")}</span>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center gap-1 text-xs text-muted font-medium">
              <HeartIcon className="w-3 h-3" /> {comment.likes}
            </span>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="text-xs font-bold text-danger hover:underline px-2 py-0.5 rounded-lg hover:bg-danger/10 transition-all disabled:opacity-50"
            >
              {isDeleting ? "…" : "Delete"}
            </button>
          </div>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{comment.content}</p>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    general:     "text-accent bg-accent/10",
    predictions: "text-accent bg-accent/10",
    analysis:    "text-accent bg-accent/10",
    tips:        "text-success bg-success/10",
    news:        "text-accent-gold bg-accent-gold/10",
  };
  return <span className={`text-[11px] font-black px-2.5 py-1 rounded-full capitalize ${colorMap[category?.toLowerCase()] ?? "text-muted bg-surface"}`}>{category}</span>;
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${type === "error" ? "bg-danger text-white" : "bg-success text-white"}`}>
      {msg}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function ChatIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function PinIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>; }
function TrashIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>; }
function ArrowLeftIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>; }
function HeartIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function EyeIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
