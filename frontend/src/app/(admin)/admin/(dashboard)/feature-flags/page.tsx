"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { invalidateFlagCache } from "@/hooks/useFeatureFlags";

interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description: string | null;
  required_plan: "free" | "pro";
  is_enabled: boolean;
  updated_at: string;
}

const PLAN_OPTIONS: { value: FeatureFlag["required_plan"]; label: string; color: string }[] = [
  { value: "free", label: "Free", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  { value: "pro",  label: "Pro",  color: "text-accent bg-accent/10 border-accent/30" },
];

function planStyle(plan: string) {
  return PLAN_OPTIONS.find((p) => p.value === plan)?.color ?? "";
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Local edits: key → { required_plan?, is_enabled? }
  const [edits, setEdits] = useState<Record<string, Partial<FeatureFlag>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getFeatureFlags();
      setFlags(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e: any) {
      setError(e.message ?? "Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setEdit(key: string, patch: Partial<FeatureFlag>) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function getField<K extends keyof FeatureFlag>(flag: FeatureFlag, field: K): FeatureFlag[K] {
    const edit = edits[flag.key];
    return (edit && field in edit ? edit[field] : flag[field]) as FeatureFlag[K];
  }

  function isDirty(flag: FeatureFlag) {
    const edit = edits[flag.key];
    if (!edit) return false;
    return (
      (edit.required_plan !== undefined && edit.required_plan !== flag.required_plan) ||
      (edit.is_enabled    !== undefined && edit.is_enabled    !== flag.is_enabled)
    );
  }

  async function save(flag: FeatureFlag) {
    const edit = edits[flag.key];
    if (!edit) return;
    const body: { required_plan?: string; is_enabled?: boolean } = {};
    if (edit.required_plan !== undefined && edit.required_plan !== flag.required_plan)
      body.required_plan = edit.required_plan;
    if (edit.is_enabled !== undefined && edit.is_enabled !== flag.is_enabled)
      body.is_enabled = edit.is_enabled;
    if (!Object.keys(body).length) return;

    setSaving((s) => ({ ...s, [flag.key]: true }));
    setSuccess(null);
    setError(null);
    try {
      const updated: FeatureFlag = await adminApi.updateFeatureFlag(flag.key, body);
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? updated : f)));
      setEdits((prev) => { const n = { ...prev }; delete n[flag.key]; return n; });
      // Bust the client-side flag cache so PremiumGate picks up changes
      invalidateFlagCache();
      setSuccess(`"${updated.name}" updated`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving((s) => ({ ...s, [flag.key]: false }));
    }
  }

  function discard(flagKey: string) {
    setEdits((prev) => { const n = { ...prev }; delete n[flagKey]; return n; });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Feature Flags</h1>
          <p className="text-sm text-muted mt-1">
            Control which features are gated behind paid plans. Changes take effect within 5 minutes for all users.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-black border border-border/60 bg-surface hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Toast messages */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm font-bold">
          <CheckIcon /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm font-bold">
          <XIcon /> {error}
        </div>
      )}

      {/* Plan legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-black text-muted uppercase tracking-wider">Plan key:</span>
        {PLAN_OPTIONS.map((p) => (
          <span key={p.value} className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${p.color}`}>
            {p.label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted text-sm">Loading feature flags…</div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <span className="text-muted text-sm">No feature flags found.</span>
            <span className="text-[11px] text-muted/60">Run the migration: <code className="font-mono bg-surface-hover px-1.5 py-0.5 rounded text-accent">npm run migrate</code></span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-background/50">
                <th className="text-left px-5 py-3 text-[10px] font-black text-muted uppercase tracking-wider">Feature</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-muted uppercase tracking-wider w-36">
                  Required Plan
                  <div className="text-[9px] font-bold text-muted/50 normal-case tracking-normal mt-0.5">(who can access)</div>
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-black text-muted uppercase tracking-wider w-24">
                  Enabled
                  <div className="text-[9px] font-bold text-muted/50 normal-case tracking-normal mt-0.5">(gates the feature)</div>
                </th>
                <th className="text-right px-5 py-3 text-[10px] font-black text-muted uppercase tracking-wider w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {flags.map((flag) => {
                const plan    = getField(flag, "required_plan");
                const enabled = getField(flag, "is_enabled");
                const dirty   = isDirty(flag);
                const busy    = saving[flag.key];

                return (
                  <tr key={flag.key} className={`transition-colors ${dirty ? "bg-accent/3" : "hover:bg-surface-hover/50"}`}>
                    {/* Feature info */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground text-[13px]">{flag.name}</div>
                      {flag.description && (
                        <div className="text-[11px] text-muted mt-0.5">{flag.description}</div>
                      )}
                      <code className="text-[10px] font-mono text-muted/60 mt-0.5 block">{flag.key}</code>
                    </td>

                    {/* Plan selector */}
                    <td className="px-5 py-4">
                      <select
                        value={plan}
                        onChange={(e) => setEdit(flag.key, { required_plan: e.target.value as FeatureFlag["required_plan"] })}
                        className={`text-[11px] font-black px-2.5 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors ${planStyle(plan)}`}
                      >
                        {PLAN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Toggle */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => setEdit(flag.key, { is_enabled: !enabled })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          enabled ? "bg-accent" : "bg-border"
                        }`}
                        title={enabled ? "Disable gating" : "Enable gating"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-[18px]" : "translate-x-[2px]"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      {dirty ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => discard(flag.key)}
                            disabled={busy}
                            className="text-[11px] font-bold text-muted hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            Discard
                          </button>
                          <button
                            onClick={() => save(flag)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Help text */}
      <div className="glass rounded-xl border border-border/30 px-5 py-4 space-y-1.5">
        <div className="text-[11px] text-muted font-medium">
          <span className="font-black text-foreground">Required Plan:</span> sets which subscription tier can access this feature
        </div>
        <div className="text-[11px] text-muted font-medium">
          <span className="font-black text-foreground">Enabled toggle:</span> when OFF, the feature is open to ALL users regardless of plan
        </div>
        <div className="text-[10px] text-muted/50 pt-0.5">Changes are cached for up to 5 minutes.</div>
      </div>
    </div>
  );
}

// ─── Mini icons ──────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
