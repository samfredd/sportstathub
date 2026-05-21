"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";

const LIMIT = 50;

const ACTION_COLORS = {
  "user.updated":            "text-blue-400 bg-blue-500/10",
  "user.deleted":            "text-rose-400 bg-rose-500/10",
  "code.created":            "text-emerald-400 bg-emerald-500/10",
  "code.updated":            "text-blue-400 bg-blue-500/10",
  "code.deleted":            "text-rose-400 bg-rose-500/10",
  "subscription.created":   "text-purple-400 bg-purple-500/10",
  "subscription.updated":   "text-blue-400 bg-blue-500/10",
  "subscription.deleted":   "text-rose-400 bg-rose-500/10",
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs]       = useState([]);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom]     = useState("");
  const [filterTo, setFilterTo]         = useState("");
  const [activeFilters, setActiveFilters] = useState<{ action: string; from: string; to: string } | null>(null);

  const hasFilters = !!(activeFilters?.action || activeFilters?.from || activeFilters?.to);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rows;
      if (hasFilters) {
        const params: Record<string, string | number> = { page, limit: LIMIT };
        if (activeFilters.action) params.action = activeFilters.action;
        if (activeFilters.from)   params.dateFrom = activeFilters.from;
        if (activeFilters.to)     params.dateTo = activeFilters.to;
        const result = await adminApi.getFilteredAuditLogs(params);
        rows = result.data ?? [];
        setHasMore(page < (result.pages ?? 1));
      } else {
        rows = await adminApi.getAuditLogs({ page, limit: LIMIT });
        setHasMore(rows.length === LIMIT);
      }
      setLogs(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, hasFilters, activeFilters]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() {
    setActiveFilters({ action: filterAction, from: filterFrom, to: filterTo });
    setPage(1);
  }

  function clearFilters() {
    setFilterAction("");
    setFilterFrom("");
    setFilterTo("");
    setActiveFilters(null);
    setPage(1);
  }

  function exportCsv() {
    const headers = ["id", "action", "admin", "target_type", "target_id", "created_at"];
    const rows = logs.map((log: any) => [
      log.id,
      log.action,
      log.admin_name || log.admin_id || "",
      log.target_type || "",
      log.target_id || "",
      log.created_at,
    ]);
    const csvContent = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Audit Logs</h2>
          <p className="text-muted text-sm font-medium mt-1">Record of all admin actions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2.5 glass border border-border/40 text-muted hover:text-foreground text-sm font-bold rounded-xl transition-all"
          >
            <DownloadIcon /> Export CSV
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 glass border border-border/40 text-muted hover:text-foreground text-sm font-bold rounded-xl transition-all"
          >
            <RefreshIcon /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap items-end glass rounded-2xl border border-border/30 p-4">
        <div className="flex-1 min-w-40">
          <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">Action type</label>
          <input
            type="text"
            placeholder="e.g. user.deleted"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full glass px-3 py-2 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">Date from</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="glass px-3 py-2 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">Date to</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="glass px-3 py-2 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all"
          >
            Apply
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 glass border border-border/40 text-muted hover:text-foreground text-sm font-bold rounded-xl transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="glass border border-rose-500/20 rounded-2xl p-5 text-rose-400 text-sm font-medium">
          Failed to load audit logs: {error}
        </div>
      )}

      {/* Log Table */}
      <div className="glass rounded-2xl border border-border/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-surface/30">
                {["#", "Action", "Admin", "Target", "Metadata", "Time"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black text-muted uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted font-medium">Loading…</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted text-sm font-medium">No audit logs yet</td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-surface/40 transition-colors duration-150">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-muted text-xs font-mono">#{log.id}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${ACTION_COLORS[log.action] || "text-muted bg-surface"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-foreground">{log.admin_name || log.admin_id || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {log.target_type ? (
                        <span className="text-xs text-muted font-medium">
                          {log.target_type} <span className="text-foreground font-bold">#{log.target_id}</span>
                        </span>
                      ) : (
                        <span className="text-muted/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {log.metadata ? (
                        <span className="text-xs text-muted/70 font-mono truncate block">
                          {JSON.stringify(log.metadata)}
                        </span>
                      ) : (
                        <span className="text-muted/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-muted font-medium">
                        {new Date(log.created_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
            <span className="text-xs text-muted font-medium">Page <span className="font-black text-foreground">{page}</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 glass rounded-xl text-xs font-bold text-muted hover:text-foreground border border-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ‹ Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="px-4 py-2 glass rounded-xl text-xs font-bold text-muted hover:text-foreground border border-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
