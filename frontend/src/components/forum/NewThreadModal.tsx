"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { communityApi } from "@/lib/communityApi";
import { isAuthed } from "@/lib/session";

const CATEGORIES = ["General Discussion", "Match Analysis", "Betting Strategy", "Injury News", "Bookmaker Codes"];

interface NewThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewThreadModal({ isOpen, onClose }: NewThreadModalProps) {
  const router = useRouter();

  // Lock scroll and check auth
  useEffect(() => {
    if (isOpen) {
      if (!isAuthed()) {
        router.push("/auth/login?redirect=/forum");
      }
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, router]);

  // Handle escape key
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const [form, setForm] = useState({
    category: CATEGORIES[0],
    title: "",
    content: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const thread = await communityApi.createThread({
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });

      // Reset form after successful submission
      setForm({ category: CATEGORIES[0], title: "", content: "", tags: "" });
      onClose();
      router.push(`/forum/${thread.id}`);
    } catch (err: any) {
      setError(err.message || "Could not create thread. Sign in and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet */}
      <div
        className="fixed z-50 bg-surface flex flex-col shadow-2xl transition-all duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[90vh] border-t border-border/50 animate-in slide-in-from-bottom-full
          md:top-1/2 md:left-1/2 md:right-auto md:bottom-auto md:w-full md:max-w-lg md:rounded-2xl md:max-h-[85vh] md:border md:-translate-x-1/2 md:-translate-y-1/2 md:slide-in-from-bottom-0 md:zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
          <h2 id="modal-title" className="text-lg font-black text-foreground tracking-tight">
            Start a Thread
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface-hover text-muted hover:text-foreground hover:bg-border/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-bold">
              {error}
            </div>
          )}

          <form id="new-thread-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="input-premium text-sm w-full"
              >
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Title</label>
              <input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                required
                maxLength={160}
                className="input-premium text-sm w-full"
                placeholder="What should the community discuss?"
              />
            </div>

            <div>
              <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Post</label>
              <textarea
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
                required
                rows={6}
                maxLength={5000}
                className="input-premium text-sm w-full resize-none"
                placeholder="Share your analysis, question, or strategy..."
              />
            </div>

            <div>
              <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
                className="input-premium text-sm w-full"
                placeholder="e.g. Premier League, Arsenal, Strategy"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 bg-surface/50 rounded-b-2xl">
          <button
            type="submit"
            form="new-thread-form"
            disabled={saving || form.title.trim().length < 5 || form.content.trim().length < 10}
            className="btn-gradient w-full py-3.5 disabled:opacity-50 text-sm font-bold flex items-center justify-center shadow-sm"
          >
            {saving ? "Posting..." : "Post Thread"}
          </button>
        </div>
      </div>
    </>
  );
}
