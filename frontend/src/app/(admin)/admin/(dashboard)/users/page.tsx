"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { adminApi } from "@/lib/adminApi";

const LIMIT = 20;

export default function AdminUsersPage() {
  const [data, setData]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Edit modal
  const [editing, setEditing]         = useState(null);
  const [editRole, setEditRole]        = useState("user");
  const [editVerified, setEditVerified] = useState(false);
  const [editStatus, setEditStatus]    = useState("active");
  const [saving, setSaving]            = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({ page, limit: LIMIT, search, status: statusFilter || undefined });
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Clear selection when data reloads
  useEffect(() => { setSelected(new Set()); }, [data]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateUser(editing.id, { role: editRole, is_verified: editVerified, status: editStatus });
      showToast("User updated successfully");
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteUser(user.id);
      showToast("User deleted");
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  function openEdit(user) {
    setEditing(user);
    setEditRole(user.role);
    setEditVerified(user.is_verified);
    setEditStatus(user.status || "active");
  }

  // ─── Bulk helpers ────────────────────────────────────────────
  function toggleSelectAll() {
    if (selected.size === data.length && data.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((u: any) => u.id)));
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

  async function handleBulkSuspend() {
    if (!selected.size) return;
    try {
      await Promise.all([...selected].map((id) => adminApi.updateUserStatus(id, "suspended")));
      showToast(`${selected.size} user(s) suspended`);
      setSelected(new Set());
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function handleBulkUnsuspend() {
    if (!selected.size) return;
    try {
      await Promise.all([...selected].map((id) => adminApi.updateUserStatus(id, "active")));
      showToast(`${selected.size} user(s) unsuspended`);
      setSelected(new Set());
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} users? This cannot be undone.`)) return;
    try {
      await Promise.all([...selected].map((id) => adminApi.deleteUser(id)));
      showToast(`${selected.size} user(s) deleted`);
      setSelected(new Set());
      load();
    } catch (e) {
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
          ref={(el) => { if (el) el.indeterminate = someSelected; }}
          onChange={toggleSelectAll}
        />
      ), width: 40,
      render: (row) => (
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
      render: (row) => <span className="text-muted text-xs font-mono">#{row.id}</span>,
    },
    {
      key: "username", label: "User",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            {row.avatar_url
              ? <img src={row.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              : <span className="text-xs font-black text-accent">{row.username?.[0]?.toUpperCase()}</span>}
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{row.username}</div>
            <div className="text-xs text-muted">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role", label: "Role",
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: "status", label: "Status",
      render: (row) => <StatusBadge status={row.status || "active"} />,
    },
    {
      key: "is_verified", label: "Verified",
      render: (row) => row.is_verified
        ? <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">Verified</span>
        : <span className="text-[11px] font-black text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full">Pending</span>,
    },
    {
      key: "subscription_plan", label: "Plan",
      render: (row) => row.subscription_plan
        ? <PlanBadge plan={row.subscription_plan} />
        : <span className="text-xs text-muted/50 font-medium">—</span>,
    },
    {
      key: "oauth_provider", label: "Auth",
      render: (row) => row.oauth_provider
        ? <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full capitalize">{row.oauth_provider}</span>
        : <span className="text-xs text-muted font-medium">Email</span>,
    },
    {
      key: "created_at", label: "Joined",
      render: (row) => <span className="text-xs text-muted font-medium">{new Date(row.created_at).toLocaleDateString("en-GB")}</span>,
    },
    {
      key: "actions", label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(row)}
            className="text-xs font-bold text-accent hover:underline px-2 py-1 rounded-lg hover:bg-accent/10 transition-all"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-xs font-bold text-rose-400 hover:underline px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Users</h2>
          <p className="text-muted text-sm font-medium mt-1">{total} total users registered</p>
        </div>
      </div>

      {/* Search + Status Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by username or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 glass rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="glass px-4 py-2.5 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-sm">
          <span className="font-black text-foreground">{selected.size} selected</span>
          <button
            onClick={handleBulkSuspend}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
          >
            Suspend
          </button>
          <button
            onClick={handleBulkUnsuspend}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
          >
            Unsuspend
          </button>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all"
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

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        pages={pages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No users found"
      />

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit User — ${editing.username}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full glass px-4 py-2.5 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
              >
                <option value="user">User</option>
                <option value="creator">Creator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full glass px-4 py-2.5 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2 px-4 glass rounded-xl border border-border/30">
              <div>
                <div className="text-sm font-bold text-foreground">Email Verified</div>
                <div className="text-xs text-muted">Allow login without re-verification</div>
              </div>
              <Toggle checked={editVerified} onChange={setEditVerified} />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────
function RoleBadge({ role }) {
  if (role === "admin") {
    return <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">Admin</span>;
  }
  if (role === "creator") {
    return <span className="text-[11px] font-black text-accent bg-accent/10 px-2.5 py-1 rounded-full">Creator</span>;
  }
  return <span className="text-[11px] font-black text-muted bg-surface px-2.5 py-1 rounded-full">User</span>;
}

function StatusBadge({ status }) {
  if (status === "suspended") {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-orange-400 bg-orange-500/10 border-orange-500/20">Suspended</span>;
  }
  if (status === "banned") {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-rose-400 bg-rose-500/10 border-rose-500/20">Banned</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Active</span>;
}

function PlanBadge({ plan }) {
  const styles = {
    pro:        "text-purple-400 bg-purple-500/10",
    enterprise: "text-amber-400 bg-amber-500/10",
    free:       "text-muted bg-surface",
  };
  return (
    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full capitalize ${styles[plan] || styles.free}`}>
      {plan}
    </span>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${checked ? "bg-accent" : "bg-muted/30"}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl border border-border/40 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${
      type === "error" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
    }`}>
      {msg}
    </div>
  );
}

function SearchIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
}
