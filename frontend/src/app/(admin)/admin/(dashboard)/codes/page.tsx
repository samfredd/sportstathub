"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { adminApi } from "@/lib/adminApi";

const LIMIT = 20;
const BOOKMAKERS = ["Bet9ja", "1xBet", "SportyBet", "Betway", "BetKing", "NairaBet", "MerryBet", "Other"];
const CATEGORIES = ["Football", "Basketball", "Tennis", "Multi", "Other"];
const STAKE_TYPES = ["Single", "Accumulator", "System", "Lucky"];

const EMPTY_FORM = {
  code: "", bookmaker: "", description: "", totalOdds: "", stakeType: "",
  category: "", expiresAt: "", userId: "",
};

function toApiDateTime(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-rose-400 bg-rose-500/10 border-rose-500/20">Expired</span>;
  }
  if (diffDays <= 3) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-orange-400 bg-orange-500/10 border-orange-500/20">Expiring Soon</span>;
  }
  return null;
}

function PerformanceBadge({ rate }: { rate: number }) {
  if (rate >= 70) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">{rate}% ✓</span>;
  }
  if (rate >= 40) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-amber-400 bg-amber-500/10 border-amber-500/20">{rate}%</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-rose-400 bg-rose-500/10 border-rose-500/20">{rate}% ✗</span>;
}

export default function AdminCodesPage() {
  const [data, setData]                 = useState([]);
  const [total, setTotal]               = useState(0);
  const [pages, setPages]               = useState(1);
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);

  // Dynamic enums with hardcoded fallback
  const [enums, setEnums] = useState({
    bookmakers: BOOKMAKERS,
    categories: CATEGORIES,
    stakeTypes: STAKE_TYPES,
  });

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  // Load enums on mount
  useEffect(() => {
    (adminApi as any).getEnums?.().then((d: any) => {
      if (d?.bookmakers) {
        setEnums({ bookmakers: d.bookmakers, categories: d.categories, stakeTypes: d.stakeTypes });
      }
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCodes({ page, limit: LIMIT, search, includeInactive: showInactive });
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, showInactive]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function buildPayload() {
    return {
      code: form.code.trim(),
      bookmaker: form.bookmaker.trim(),
      description: form.description || undefined,
      totalOdds: form.totalOdds ? parseFloat(form.totalOdds) : undefined,
      stakeType: form.stakeType || undefined,
      category: form.category || undefined,
      expiresAt: toApiDateTime(form.expiresAt),
      userId: form.userId ? parseInt(form.userId) : undefined,
    };
  }

  async function handleCreate() {
    if (!form.code || !form.bookmaker) return showToast("Code and Bookmaker are required", "error");
    setSaving(true);
    try {
      await adminApi.createCode(buildPayload());
      showToast("Booking code created");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateCode(editing.id, buildPayload());
      showToast("Code updated");
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(code) {
    try {
      await adminApi.updateCode(code.id, { isActive: !code.is_active });
      showToast(code.is_active ? "Code deactivated" : "Code activated");
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function handleDelete(code) {
    if (!confirm(`Permanently delete code "${code.code}"?`)) return;
    try {
      await adminApi.deleteCode(code.id);
      showToast("Code deleted");
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  function openEdit(code) {
    setEditing(code);
    setForm({
      code: code.code,
      bookmaker: code.bookmaker,
      description: code.description || "",
      totalOdds: code.total_odds || "",
      stakeType: code.stake_type || "",
      category: code.category || "",
      expiresAt: code.expires_at ? code.expires_at.slice(0, 16) : "",
      userId: code.user_id || "",
    });
  }

  const successRate = (row) => {
    const r = row.success_rate ?? row.successRate;
    return r != null ? Math.round(Number(r)) : null;
  };

  const clickCount = (row) => row.clicks ?? row.click_count ?? null;

  const columns = [
    {
      key: "id", label: "#", width: 60,
      render: (row) => <span className="text-muted text-xs font-mono">#{row.id}</span>,
    },
    {
      key: "code", label: "Code",
      render: (row) => {
        const rate = successRate(row);
        const clicks = clickCount(row);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${row.is_active ? "bg-emerald-400" : "bg-muted/40"}`} />
              <span className="text-sm font-bold font-mono text-foreground">{row.code}</span>
              {row.expires_at && <ExpiryBadge expiresAt={row.expires_at} />}
              {rate != null && <PerformanceBadge rate={rate} />}
            </div>
            {clicks != null && (
              <span className="text-[10px] text-muted/60 font-medium ml-4">{clicks} clicks</span>
            )}
          </div>
        );
      },
    },
    {
      key: "bookmaker", label: "Bookmaker",
      render: (row) => <span className="text-sm font-bold text-foreground">{row.bookmaker}</span>,
    },
    {
      key: "category", label: "Category",
      render: (row) => row.category
        ? <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400">{row.category}</span>
        : <span className="text-muted/50 text-xs">—</span>,
    },
    {
      key: "total_odds", label: "Odds",
      render: (row) => row.total_odds
        ? <span className="text-sm font-black text-amber-400">{row.total_odds}x</span>
        : <span className="text-muted/50 text-xs">—</span>,
    },
    {
      key: "submitter_name", label: "Submitted by",
      render: (row) => <span className="text-xs text-muted font-medium">{row.submitter_name || "—"}</span>,
    },
    {
      key: "expires_at", label: "Expires",
      render: (row) => row.expires_at
        ? <span className="text-xs text-muted font-medium">{new Date(row.expires_at).toLocaleDateString("en-GB")}</span>
        : <span className="text-muted/50 text-xs">Never</span>,
    },
    {
      key: "created_at", label: "Created",
      render: (row) => <span className="text-xs text-muted font-medium">{new Date(row.created_at).toLocaleDateString("en-GB")}</span>,
    },
    {
      key: "actions", label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => handleToggle(row)} className={`text-xs font-bold px-2 py-1 rounded-lg transition-all ${row.is_active ? "text-amber-400 hover:bg-amber-500/10" : "text-emerald-400 hover:bg-emerald-500/10"}`}>
            {row.is_active ? "Deactivate" : "Activate"}
          </button>
          <button onClick={() => openEdit(row)} className="text-xs font-bold text-accent hover:underline px-2 py-1 rounded-lg hover:bg-accent/10 transition-all">Edit</button>
          <button onClick={() => handleDelete(row)} className="text-xs font-bold text-rose-400 hover:underline px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Booking Codes</h2>
          <p className="text-muted text-sm font-medium mt-1">{total} total codes</p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 shadow-sm"
        >
          <PlusIcon /> Add Code
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search codes, bookmakers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 glass rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${showInactive ? "bg-accent/10 border-accent/20 text-accent" : "glass border-border/40 text-muted hover:text-foreground"}`}
        >
          {showInactive ? "Showing All" : "Active Only"}
        </button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={data} loading={loading} page={page} pages={pages} total={total} onPageChange={setPage} emptyMessage="No booking codes found" />

      {/* Create Modal */}
      {createOpen && (
        <Modal title="Add Booking Code" onClose={() => setCreateOpen(false)}>
          <CodeForm form={form} setField={setField} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} saving={saving} submitLabel="Create Code" enums={enums} />
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Code — ${editing.code}`} onClose={() => setEditing(null)}>
          <CodeForm form={form} setField={setField} onSubmit={handleUpdate} onCancel={() => setEditing(null)} saving={saving} submitLabel="Save Changes" enums={enums} />
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

function CodeForm({ form, setField, onSubmit, onCancel, saving, submitLabel, enums }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Code *</label>
          <input value={form.code} onChange={(e) => setField("code", e.target.value)} placeholder="e.g. ABC123" className="w-full glass px-3 py-2.5 rounded-xl text-sm font-mono text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Bookmaker *</label>
          <select value={form.bookmaker} onChange={(e) => setField("bookmaker", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all">
            <option value="">Select…</option>
            {enums.bookmakers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Odds</label>
          <input type="number" step="0.01" value={form.totalOdds} onChange={(e) => setField("totalOdds", e.target.value)} placeholder="e.g. 5.50" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Stake Type</label>
          <select value={form.stakeType} onChange={(e) => setField("stakeType", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all">
            <option value="">None</option>
            {enums.stakeTypes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Category</label>
          <select value={form.category} onChange={(e) => setField("category", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all">
            <option value="">None</option>
            {enums.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Description</label>
        <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} placeholder="Optional notes about this code…" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Expires At</label>
          <input type="datetime-local" value={form.expiresAt} onChange={(e) => setField("expiresAt", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">User ID (optional)</label>
          <input type="number" value={form.userId} onChange={(e) => setField("userId", e.target.value)} placeholder="Assign to user" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSubmit} disabled={saving} className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">{saving ? "Saving…" : submitLabel}</button>
        <button onClick={onCancel} className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all">Cancel</button>
      </div>
    </div>
  );
}

// Shared UI
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl border border-border/40 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-foreground text-base">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-all">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${type === "error" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"}`}>
      {msg}
    </div>
  );
}

function PlusIcon()   { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function SearchIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
