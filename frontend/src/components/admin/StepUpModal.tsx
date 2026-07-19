"use client";

import { useState } from "react";

interface StepUpModalProps {
  onVerify: (code: string, isRecovery: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function StepUpModal({ onVerify, onCancel }: StepUpModalProps) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !value) return;
    setSubmitting(true);
    setError(null);
    try {
      await onVerify(value, useRecovery);
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
    >
      <div className="glass rounded-2xl border border-border/40 p-6 w-full max-w-sm shadow-2xl">
        <h3 id="step-up-title" className="font-black text-foreground text-base mb-1">
          Verify it&rsquo;s you
        </h3>
        <p className="text-xs text-muted font-medium mb-5">
          This action is sensitive and requires a fresh authentication code.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">
              {useRecovery ? "Recovery code" : "Authenticator code"}
            </label>
            <input
              type="text"
              inputMode={useRecovery ? "text" : "numeric"}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.trim())}
              placeholder={useRecovery ? "XXXXXXXXXXXX" : "000000"}
              className="w-full glass px-4 py-2.5 rounded-xl text-sm font-mono font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-bold text-danger">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !value}
              className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all"
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setUseRecovery((v) => !v); setValue(""); setError(null); }}
            className="w-full text-center text-xs font-bold text-accent hover:underline"
          >
            {useRecovery ? "Use authenticator code instead" : "Use a recovery code instead"}
          </button>
        </form>
      </div>
    </div>
  );
}
