"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { adminApi } from "@/lib/adminApi";

const LIMIT = 20;
const STATUSES = ["", "open", "won", "lost", "void"];
const SPORTS = ["Football", "Basketball", "Tennis", "Baseball", "Hockey", "Rugby", "Cricket", "Other"];
const CONFIDENCE = ["low", "medium", "high", "very_high"];
const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", very_high: "Very High",
};

const EMPTY_FORM = {
  sport: "Football",
  leagueName: "",
  leagueCountry: "",
  homeTeam: "",
  awayTeam: "",
  matchDate: "",
  tip: "",
  odds: "",
  confidence: "medium",
  analysis: "",
  isPremium: false,
  isTrending: false,
  tags: "",
};

// ─── Page ─────────────────────────────────────────────────────
export default function AdminPredictionsPage() {
  const [data, setData]         = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null);

  // Composer
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [posting, setPosting]   = useState(false);

  // Status-change modal
  const [editing, setEditing]   = useState<any>(null);
  const [newStatus, setNewStatus] = useState("open");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPredictions({ page, limit: LIMIT, search, status: statusFilter });
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function setField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePost() {
    if (!form.homeTeam || !form.awayTeam || !form.tip) {
      showToast("Home team, away team and tip are required", "error");
      return;
    }
    setPosting(true);
    try {
      await adminApi.createAdminPrediction({
        sport: form.sport,
        league: { name: form.leagueName || "Unknown", country: form.leagueCountry || "" },
        matchData: {
          home_team: form.homeTeam,
          away_team: form.awayTeam,
          date: form.matchDate ? new Date(form.matchDate).toISOString() : new Date().toISOString(),
        },
        prediction: {
          tip: form.tip,
          odds: form.odds ? parseFloat(form.odds) : undefined,
          confidence: form.confidence,
          analysis: form.analysis || undefined,
        },
        isPremium: form.isPremium,
        isTrending: form.isTrending,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      showToast("Prediction posted!");
      setShowComposer(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      showToast(e.message ?? "Failed to post prediction", "error");
    } finally {
      setPosting(false);
    }
  }

  async function handleStatusSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updatePredictionStatus(editing.id, newStatus);
      showToast("Status updated");
      setEditing(null);
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: any) {
    if (!confirm(`Delete prediction #${row.id}? This cannot be undone.`)) return;
    try {
      await adminApi.deletePrediction(row.id);
      showToast("Prediction deleted");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handlePremiumToggle(row: any) {
    try {
      await adminApi.updatePrediction(row.id, { isPremium: !row.is_premium });
      showToast(!row.is_premium ? "Marked Pro" : "Marked Free");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  const columns = [
    {
      key: "id", label: "#", width: 48,
      render: (row: any) => <span className="text-muted text-xs font-mono">#{row.id}</span>,
    },
    {
      key: "match_data", label: "Match",
      render: (row: any) => {
        const m = row.match_data ?? {};
        // homeTeam/awayTeam are stored as { name, shortName, form } objects
        // (see community.schemas.ts), not plain strings — render the name.
        const teamName = (t: any) => (typeof t === "string" ? t : (t?.name ?? "—"));
        return (
          <div>
            <div className="text-sm font-bold text-foreground">{teamName(m.home_team ?? m.homeTeam)} vs {teamName(m.away_team ?? m.awayTeam)}</div>
            <div className="text-xs text-muted">{row.sport}{row.league?.name ? ` · ${row.league.name}` : ""}</div>
          </div>
        );
      },
    },
    {
      key: "prediction", label: "Tip",
      render: (row: any) => {
        const p = row.prediction ?? {};
        return (
          <div className="max-w-[200px]">
            <div className="text-sm font-bold text-foreground">{p.tip ?? "—"}</div>
            {p.odds && <div className="text-xs text-accent-gold font-black">@ {p.odds}x</div>}
            {p.confidence && (
              <div className="text-[10px] text-muted capitalize">{CONFIDENCE_LABELS[p.confidence] ?? p.confidence} confidence</div>
            )}
          </div>
        );
      },
    },
    {
      key: "creator_name", label: "By",
      render: (row: any) => <span className="text-xs text-muted font-medium">{row.creator_name ?? "—"}</span>,
    },
    {
      key: "status", label: "Status",
      render: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      key: "is_premium", label: "Access",
      render: (row: any) => (
        <button
          onClick={() => handlePremiumToggle(row)}
          className={`text-[11px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider transition-all ${
            row.is_premium
              ? "bg-accent/10 text-accent border-accent/25 hover:bg-accent/20"
              : "bg-surface text-muted border-border hover:text-foreground"
          }`}
        >
          {row.is_premium ? "Pro" : "Free"}
        </button>
      ),
    },
    {
      key: "created_at", label: "Posted",
      render: (row: any) => <span className="text-xs text-muted">{new Date(row.created_at).toLocaleDateString("en-GB")}</span>,
    },
    {
      key: "actions", label: "",
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(row); setNewStatus(row.status); }}
            className="text-xs font-bold text-accent hover:underline px-2 py-1 rounded-lg hover:bg-accent/10 transition-all">
            Status
          </button>
          <button onClick={() => handleDelete(row)}
            className="text-xs font-bold text-danger hover:underline px-2 py-1 rounded-lg hover:bg-danger/10 transition-all">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Predictions</h2>
          <p className="text-muted text-sm font-medium mt-1">{total} total predictions</p>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-black rounded-xl transition-all hover:-translate-y-0.5 shadow-sm shrink-0"
        >
          <PlusIcon /> Post Prediction
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by match or sport…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 glass rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                statusFilter === s
                  ? "bg-accent text-white shadow-sm"
                  : "glass border border-border/40 text-muted hover:text-foreground hover:border-accent/30"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        pages={pages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No predictions yet — post one above!"
      />

      {/* ── Composer Modal ── */}
      {showComposer && (
        <Modal title="Post a Prediction" onClose={() => setShowComposer(false)} wide>
          <div className="space-y-5">
            {/* Sport + League row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Sport *</label>
                <select value={form.sport} onChange={(e) => setField("sport", e.target.value)}
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 bg-surface">
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">League</label>
                <input value={form.leagueName} onChange={(e) => setField("leagueName", e.target.value)}
                  placeholder="Premier League"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Country</label>
                <input value={form.leagueCountry} onChange={(e) => setField("leagueCountry", e.target.value)}
                  placeholder="England"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
            </div>

            {/* Teams + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Home Team *</label>
                <input value={form.homeTeam} onChange={(e) => setField("homeTeam", e.target.value)}
                  placeholder="Arsenal"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Away Team *</label>
                <input value={form.awayTeam} onChange={(e) => setField("awayTeam", e.target.value)}
                  placeholder="Chelsea"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Match Date</label>
                <input type="datetime-local" value={form.matchDate} onChange={(e) => setField("matchDate", e.target.value)}
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 [color-scheme:dark]" />
              </div>
            </div>

            {/* Tip + Odds + Confidence */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Tip / Pick *</label>
                <input value={form.tip} onChange={(e) => setField("tip", e.target.value)}
                  placeholder="Home Win, Over 2.5, BTTS…"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Odds</label>
                <input type="number" step="0.01" min="1" value={form.odds} onChange={(e) => setField("odds", e.target.value)}
                  placeholder="1.85"
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Confidence</label>
                <select value={form.confidence} onChange={(e) => setField("confidence", e.target.value)}
                  className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 bg-surface">
                  {CONFIDENCE.map((c) => <option key={c} value={c}>{CONFIDENCE_LABELS[c]}</option>)}
                </select>
              </div>
            </div>

            {/* Analysis */}
            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Analysis / Reasoning</label>
              <textarea value={form.analysis} onChange={(e) => setField("analysis", e.target.value)}
                rows={3} placeholder="Why this tip? Key stats, form, injuries…"
                className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 resize-none placeholder:text-muted/40" />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[10px] font-black text-muted uppercase tracking-wider mb-1">Tags <span className="normal-case font-medium text-muted/60">(comma-separated)</span></label>
              <input value={form.tags} onChange={(e) => setField("tags", e.target.value)}
                placeholder="football, premier-league, arsenal"
                className="w-full glass border border-border/40 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-accent/50 placeholder:text-muted/40" />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <Toggle
                label="Pro subscribers only"
                checked={form.isPremium}
                onChange={(v) => setField("isPremium", v)}
              />
              <Toggle
                label="Mark as Trending"
                checked={form.isTrending}
                onChange={(v) => setField("isTrending", v)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handlePost}
                disabled={posting || !form.homeTeam || !form.awayTeam || !form.tip}
                className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white py-3 rounded-xl text-sm font-black transition-all"
              >
                {posting ? "Posting…" : "Post Prediction"}
              </button>
              <button
                onClick={() => setShowComposer(false)}
                className="px-6 py-3 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Status Modal ── */}
      {editing && (
        <Modal title={`Set Status — #${editing.id}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {["open", "won", "lost", "void"].map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`py-2.5 rounded-xl text-sm font-black capitalize transition-all ${
                    newStatus === s
                      ? "bg-accent text-white shadow-sm"
                      : "glass border border-border/40 text-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleStatusSave}
                disabled={saving || newStatus === editing.status}
                className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {saving ? "Saving…" : "Apply"}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-accent" : "bg-border"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
      </button>
      <span className="text-xs font-bold text-muted">{label}</span>
    </label>
  );
}

// ─── Sub-components ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "text-accent bg-accent/10",
    won:  "text-success bg-success/10",
    lost: "text-danger bg-danger/10",
    void: "text-accent-gold bg-accent-gold/10",
  };
  return (
    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full capitalize ${styles[status] ?? "text-muted bg-surface"}`}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide = false }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className={`glass rounded-2xl border border-border/40 p-5 sm:p-6 w-full shadow-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-foreground text-base">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-all">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold ${
      type === "error" ? "bg-danger text-white" : "bg-success text-white"
    }`}>
      {msg}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
