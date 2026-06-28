"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";

// ─── Types ────────────────────────────────────────────────────
interface Creator {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
  total_predictions: number;
  won: number;
  lost: number;
  avg_odds: number;
  followers: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function hitRate(won: number, lost: number): number {
  const total = won + lost;
  if (total === 0) return 0;
  return Math.round((won / total) * 100);
}

function HitBadge({ rate }: { rate: number }) {
  const color =
    rate > 70
      ? "bg-success/10 text-success border-success/20"
      : rate > 50
      ? "bg-accent-gold/10 text-accent-gold border-accent-gold/20"
      : "bg-danger/10 text-danger border-danger/20";
  return (
    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${color}`}>
      {rate}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    "bg-success/10 text-success border-success/20",
    suspended: "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
    banned:    "bg-danger/10 text-danger border-danger/20",
  };
  const cls = map[status] ?? "bg-surface text-muted border-border/30";
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function Avatar({ creator }: { creator: Creator }) {
  return (
    <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 overflow-hidden">
      {creator.avatar_url ? (
        <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-black text-accent">{creator.username?.[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="border-b border-border/30">
          {Array.from({ length: 9 }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-3 rounded-full bg-surface animate-pulse" style={{ width: `${40 + Math.random() * 50}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi.getCreators()
      .then((res: any) => {
        const arr: Creator[] = Array.isArray(res) ? res : (res?.data ?? []);
        // Sort by followers desc as default ranking
        arr.sort((a, b) => b.followers - a.followers);
        setCreators(arr);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived summary stats
  const totalCreators    = creators.length;
  const totalPredictions = creators.reduce((s, c) => s + c.total_predictions, 0);
  const avgHitRate       = totalCreators === 0
    ? 0
    : Math.round(creators.reduce((s, c) => s + hitRate(c.won, c.lost), 0) / totalCreators);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Creator Leaderboard</h2>
          <p className="text-muted text-sm font-medium mt-1">
            Ranked by followers — hit rate, predictions, and performance stats
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-black bg-surface border border-border/40 text-muted hover:text-foreground hover:bg-surface-hover transition-all disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass border border-danger/20 rounded-2xl p-5 text-danger text-sm font-medium">
          &#9888; Failed to load creators: {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass border border-border/30 rounded-2xl p-5">
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Total Creators</div>
          <div className="text-2xl font-black text-foreground">{totalCreators.toLocaleString()}</div>
        </div>
        <div className="glass border border-border/30 rounded-2xl p-5">
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Avg Hit Rate</div>
          <div className="text-2xl font-black text-accent">{avgHitRate}%</div>
        </div>
        <div className="glass border border-border/30 rounded-2xl p-5">
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Total Predictions</div>
          <div className="text-2xl font-black text-foreground">{totalPredictions.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="glass border border-border/30 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border/30 bg-surface/30">
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-left w-10">#</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-left">Creator</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-left">Status</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-right">Followers</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-right">Predictions</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-center">Won / Lost</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-center">Hit Rate</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-right">Avg Odds</th>
                <th className="text-[10px] font-black text-muted uppercase tracking-wider px-5 py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : creators.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted text-sm py-16">
                    No creators found
                  </td>
                </tr>
              ) : (
                creators.map((c, idx) => {
                  const rate = hitRate(c.won, c.lost);
                  const flagRow = rate < 40 && c.total_predictions > 5;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border/30 hover:bg-surface-hover/30 transition-colors ${
                        flagRow ? "border-l-2 border-l-rose-500/50" : ""
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-5 py-4 text-[13px] font-black text-muted">
                        {idx + 1}
                      </td>

                      {/* Creator */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar creator={c} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-black text-foreground truncate">{c.username}</div>
                            <div className="text-[11px] text-muted truncate">{c.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={c.status} />
                      </td>

                      {/* Followers */}
                      <td className="px-5 py-4 text-right text-[13px] font-black text-foreground">
                        {Number(c.followers).toLocaleString()}
                      </td>

                      {/* Predictions */}
                      <td className="px-5 py-4 text-right text-[13px] font-black text-foreground">
                        {Number(c.total_predictions).toLocaleString()}
                      </td>

                      {/* Won / Lost */}
                      <td className="px-5 py-4 text-center text-[13px] font-black">
                        <span className="text-success">{c.won}W</span>
                        <span className="text-muted mx-1">/</span>
                        <span className="text-danger">{c.lost}L</span>
                      </td>

                      {/* Hit Rate */}
                      <td className="px-5 py-4 text-center">
                        <HitBadge rate={rate} />
                      </td>

                      {/* Avg Odds */}
                      <td className="px-5 py-4 text-right text-[13px] font-black text-accent">
                        {Number(c.avg_odds).toFixed(2)}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-right text-[11px] text-muted font-medium whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
