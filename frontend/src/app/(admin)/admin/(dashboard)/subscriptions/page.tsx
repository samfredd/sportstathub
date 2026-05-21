"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "@/components/admin/DataTable";
import { adminApi } from "@/lib/adminApi";

// ─── Types ───────────────────────────────────────────────────
type Plan = {
  id: number;
  slug: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string[];
  limits: Record<string, unknown>;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  subscriber_count: number;
};

const LIMIT = 20;
const SUB_STATUSES = ["active", "cancelled", "expired"];
const EMPTY_SUB = { userId: "", plan: "pro", status: "active", expiresAt: "", notes: "" };
const EMPTY_PLAN: Omit<Plan, "id" | "subscriber_count" | "created_at" | "updated_at"> = {
  slug: "", display_name: "", description: "",
  price_monthly: 0, price_yearly: 0, currency: "USD",
  features: [], limits: {}, is_active: true, is_popular: false, sort_order: 0,
};

function toApiDateTime(v: string) { return v ? new Date(v).toISOString() : undefined; }
function fmt(n: number, currency = "USD") {
  return n === 0 ? "Free" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(n));
}

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<"packages" | "subscribers">("packages");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header + tabs */}
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Subscriptions</h2>
        <p className="text-muted text-sm font-medium mt-1">Manage subscription packages and subscriber assignments</p>
      </div>
      <div className="flex gap-1 p-1 glass rounded-xl border border-border/30 w-fit">
        {(["packages", "subscribers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
              tab === t ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "packages"
        ? <PackagesTab showToast={showToast} />
        : <SubscribersTab showToast={showToast} />
      }

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Packages Tab ────────────────────────────────────────────
function PackagesTab({ showToast }: { showToast: (m: string, t?: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [planForm, setPlanForm] = useState<typeof EMPTY_PLAN>({ ...EMPTY_PLAN });
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setPlanForm({
      slug: plan.slug,
      display_name: plan.display_name,
      description: plan.description ?? "",
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      currency: plan.currency,
      features: plan.features,
      limits: plan.limits,
      is_active: plan.is_active,
      is_popular: plan.is_popular,
      sort_order: plan.sort_order,
    });
    setFeaturesText((plan.features ?? []).join("\n"));
  }

  function openCreate() {
    setPlanForm({ ...EMPTY_PLAN });
    setFeaturesText("");
    setCreateOpen(true);
  }

  function buildPlanPayload() {
    const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
    return {
      slug: planForm.slug,
      displayName: planForm.display_name,
      description: planForm.description || null,
      priceMonthly: Number(planForm.price_monthly),
      priceYearly: Number(planForm.price_yearly),
      currency: "USD",
      features,
      limits: planForm.limits,
      isActive: planForm.is_active,
      isPopular: planForm.is_popular,
      sortOrder: Number(planForm.sort_order),
    };
  }

  async function handleCreatePlan() {
    if (!planForm.slug || !planForm.display_name) return showToast("Slug and name are required", "error");
    setSaving(true);
    try {
      await adminApi.createPlan(buildPlanPayload());
      showToast("Plan created");
      setCreateOpen(false);
      loadPlans();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setSaving(false); }
  }

  async function handleUpdatePlan() {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const { slug: _slug, ...payload } = buildPlanPayload();
      await adminApi.updatePlan(editingPlan.id, payload);
      showToast("Plan updated");
      setEditingPlan(null);
      loadPlans();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setSaving(false); }
  }

  async function handleToggleActive(plan: Plan) {
    try {
      await adminApi.updatePlan(plan.id, { isActive: !plan.is_active });
      showToast(plan.is_active ? "Plan deactivated" : "Plan activated");
      loadPlans();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handleDeletePlan(plan: Plan) {
    if (!confirm(`Delete plan "${plan.display_name}"? This cannot be undone.`)) return;
    try {
      await adminApi.deletePlan(plan.id);
      showToast("Plan deleted");
      loadPlans();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass rounded-2xl border border-border/40 p-6 animate-pulse space-y-3">
            <div className="h-4 bg-surface-hover rounded w-1/2" />
            <div className="h-8 bg-surface-hover rounded w-2/3" />
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((j) => <div key={j} className="h-3 bg-surface-hover rounded" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 shadow-sm"
        >
          <PlusIcon /> New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() => openEdit(plan)}
            onToggleActive={() => handleToggleActive(plan)}
            onDelete={() => handleDeletePlan(plan)}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editingPlan && (
        <Modal title={`Edit Plan — ${editingPlan.display_name}`} onClose={() => setEditingPlan(null)} wide>
          <PlanForm
            form={planForm} setForm={setPlanForm}
            featuresText={featuresText} setFeaturesText={setFeaturesText}
            onSubmit={handleUpdatePlan} onCancel={() => setEditingPlan(null)}
            saving={saving} submitLabel="Save Changes" isEdit
          />
        </Modal>
      )}

      {/* Create modal */}
      {createOpen && (
        <Modal title="Create New Plan" onClose={() => setCreateOpen(false)} wide>
          <PlanForm
            form={planForm} setForm={setPlanForm}
            featuresText={featuresText} setFeaturesText={setFeaturesText}
            onSubmit={handleCreatePlan} onCancel={() => setCreateOpen(false)}
            saving={saving} submitLabel="Create Plan" isEdit={false}
          />
        </Modal>
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onToggleActive, onDelete }: {
  plan: Plan;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const planColors: Record<string, string> = {
    free:       "from-muted/20 to-surface border-border/30",
    pro:        "from-accent/10 to-purple-500/5 border-accent/30",
    enterprise: "from-amber-500/10 to-orange-500/5 border-amber-500/30",
  };
  const accent: Record<string, string> = {
    free:       "text-muted",
    pro:        "text-accent",
    enterprise: "text-amber-400",
  };

  const colorKey = plan.slug in planColors ? plan.slug : "free";

  return (
    <div className={`relative glass rounded-2xl border bg-gradient-to-br p-6 flex flex-col gap-4 ${planColors[colorKey]} ${!plan.is_active ? "opacity-60" : ""}`}>
      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-accent text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">Most Popular</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-black text-foreground">{plan.display_name}</div>
            <div className="text-xs text-muted font-mono mt-0.5">{plan.slug}</div>
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${plan.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-muted bg-surface"}`}>
            {plan.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        {plan.description && <p className="text-xs text-muted mt-2 leading-relaxed">{plan.description}</p>}
      </div>

      {/* Pricing */}
      <div className="space-y-1">
        <div className={`text-2xl font-black ${accent[colorKey]}`}>
          {fmt(plan.price_monthly, plan.currency)}
          {plan.price_monthly > 0 && <span className="text-sm font-bold text-muted"> /mo</span>}
        </div>
        {plan.price_yearly > 0 && (
          <div className="text-xs text-muted font-medium">{fmt(plan.price_yearly, plan.currency)} / year</div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {(plan.features ?? []).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 font-medium">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      {/* Stats */}
      <div className="flex items-center gap-2 py-2 border-t border-border/20">
        <UsersIcon className="w-3.5 h-3.5 text-muted" />
        <span className="text-xs text-muted font-medium">{plan.subscriber_count} active subscriber{plan.subscriber_count !== 1 ? "s" : ""}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onEdit} className="flex-1 py-2 glass rounded-xl text-xs font-bold text-accent border border-accent/20 hover:bg-accent/10 transition-all">
          Edit
        </button>
        <button
          onClick={onToggleActive}
          className={`flex-1 py-2 glass rounded-xl text-xs font-bold border transition-all ${
            plan.is_active ? "text-amber-400 border-amber-500/20 hover:bg-amber-500/10" : "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
          }`}
        >
          {plan.is_active ? "Deactivate" : "Activate"}
        </button>
        <button onClick={onDelete} className="py-2 px-3 glass rounded-xl text-xs font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 transition-all">
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PlanForm({ form, setForm, featuresText, setFeaturesText, onSubmit, onCancel, saving, submitLabel, isEdit }: any) {
  function setField(k: string, v: unknown) { setForm((p: any) => ({ ...p, [k]: v })); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {!isEdit && (
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Slug *</label>
            <input type="text" value={form.slug} onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="e.g. pro" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
        )}
        <div className={isEdit ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Display Name *</label>
          <input type="text" value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} placeholder="e.g. Pro" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Description</label>
        <input type="text" value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} placeholder="Short description" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Price / Month (USD)</label>
          <input type="number" min={0} value={form.price_monthly} onChange={(e) => setField("price_monthly", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Price / Year (USD)</label>
          <input type="number" min={0} value={form.price_yearly} onChange={(e) => setField("price_yearly", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Currency</label>
          <div className="w-full glass px-3 py-2.5 rounded-xl text-sm font-black text-foreground border border-border/40 bg-surface/40">
            USD
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Features (one per line)</label>
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={5}
          placeholder={"Unlimited code copies\nAI match predictions\nPriority support"}
          className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center justify-between py-2.5 px-4 glass rounded-xl border border-border/30 col-span-1">
          <span className="text-xs font-black text-muted uppercase tracking-wider">Active</span>
          <Toggle checked={form.is_active} onChange={(v: boolean) => setField("is_active", v)} />
        </div>
        <div className="flex items-center justify-between py-2.5 px-4 glass rounded-xl border border-border/30 col-span-1">
          <span className="text-xs font-black text-muted uppercase tracking-wider">Popular</span>
          <Toggle checked={form.is_popular} onChange={(v: boolean) => setField("is_popular", v)} />
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Sort Order</label>
          <input type="number" value={form.sort_order} onChange={(e) => setField("sort_order", parseInt(e.target.value))} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onSubmit} disabled={saving} className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
        <button onClick={onCancel} className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all">Cancel</button>
      </div>
    </div>
  );
}

// ─── Subscribers Tab ─────────────────────────────────────────
function SubscribersTab({ showToast }: { showToast: (m: string, t?: string) => void }) {
  const [data, setData]         = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [form, setForm]         = useState({ ...EMPTY_SUB });
  const [saving, setSaving]     = useState(false);
  const [plans, setPlans]       = useState<Plan[]>([]);

  useEffect(() => {
    adminApi.getPlans().then((d) => setPlans(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const planSlugs = plans.length > 0 ? plans.map((p) => p.slug) : ["free", "pro", "enterprise"];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSubscriptions({ page, limit: LIMIT, search });
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

  function setField(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  function buildPayload() {
    return {
      userId: form.userId ? parseInt(form.userId) : undefined,
      plan: form.plan,
      status: form.status,
      expiresAt: toApiDateTime(form.expiresAt),
      notes: form.notes || undefined,
    };
  }

  async function handleCreate() {
    if (!form.userId || !form.plan) return showToast("User ID and Plan are required", "error");
    setSaving(true);
    try {
      await adminApi.createSubscription(buildPayload());
      showToast("Subscription created");
      setCreateOpen(false);
      setForm({ ...EMPTY_SUB });
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateSubscription(editing.id, { plan: form.plan, status: form.status, expiresAt: toApiDateTime(form.expiresAt), notes: form.notes || undefined });
      showToast("Subscription updated");
      setEditing(null);
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setSaving(false); }
  }

  async function handleCancel(sub: any) {
    if (!confirm(`Cancel subscription for ${sub.username}?`)) return;
    try {
      await adminApi.updateSubscription(sub.id, { status: "cancelled" });
      showToast("Subscription cancelled");
      load();
    } catch (e: any) { showToast(e.message, "error"); }
  }

  async function handleDelete(sub: any) {
    if (!confirm(`Delete this subscription for ${sub.username}?`)) return;
    try {
      await adminApi.deleteSubscription(sub.id);
      showToast("Subscription deleted");
      load();
    } catch (e: any) { showToast(e.message, "error"); }
  }

  function openEdit(sub: any) {
    setEditing(sub);
    setForm({ userId: sub.user_id, plan: sub.plan, status: sub.status, expiresAt: sub.expires_at ? sub.expires_at.slice(0, 16) : "", notes: sub.notes || "" });
  }

  const columns = [
    { key: "id", label: "#", width: 60, render: (r: any) => <span className="text-muted text-xs font-mono">#{r.id}</span> },
    { key: "user", label: "User", render: (r: any) => <div><div className="text-sm font-bold text-foreground">{r.username}</div><div className="text-xs text-muted">{r.email}</div></div> },
    { key: "plan", label: "Plan", render: (r: any) => <PlanBadge plan={r.plan} plans={plans} /> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "started_at", label: "Started", render: (r: any) => <span className="text-xs text-muted font-medium">{new Date(r.started_at).toLocaleDateString("en-GB")}</span> },
    { key: "expires_at", label: "Expires", render: (r: any) => r.expires_at ? <span className={`text-xs font-medium ${new Date(r.expires_at) < new Date() ? "text-rose-400" : "text-muted"}`}>{new Date(r.expires_at).toLocaleDateString("en-GB")}</span> : <span className="text-muted/50 text-xs">Never</span> },
    {
      key: "actions", label: "Actions",
      render: (r: any) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => openEdit(r)} className="text-xs font-bold text-accent hover:underline px-2 py-1 rounded-lg hover:bg-accent/10 transition-all">Edit</button>
          {r.status === "active" && <button onClick={() => handleCancel(r)} className="text-xs font-bold text-amber-400 hover:underline px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-all">Cancel</button>}
          <button onClick={() => handleDelete(r)} className="text-xs font-bold text-rose-400 hover:underline px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-muted text-sm font-medium">{total} total subscriptions</p>
        <button onClick={() => { setCreateOpen(true); setForm({ ...EMPTY_SUB }); }} className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 shadow-sm">
          <PlusIcon /> Assign Plan
        </button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Search by user, email or plan…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2.5 glass rounded-xl text-sm font-medium text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
      </div>

      <DataTable columns={columns} data={data} loading={loading} page={page} pages={pages} total={total} onPageChange={setPage} emptyMessage="No subscriptions yet" />

      {createOpen && (
        <Modal title="Assign Subscription" onClose={() => setCreateOpen(false)}>
          <SubForm form={form} setField={setField} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} saving={saving} submitLabel="Assign" showUserId planSlugs={planSlugs} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit — ${editing.username}`} onClose={() => setEditing(null)}>
          <SubForm form={form} setField={setField} onSubmit={handleUpdate} onCancel={() => setEditing(null)} saving={saving} submitLabel="Save Changes" showUserId={false} planSlugs={planSlugs} />
        </Modal>
      )}
    </div>
  );
}

function SubForm({ form, setField, onSubmit, onCancel, saving, submitLabel, showUserId, planSlugs }: any) {
  return (
    <div className="space-y-4">
      {showUserId && (
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">User ID *</label>
          <input type="number" value={form.userId} onChange={(e) => setField("userId", e.target.value)} placeholder="Enter user ID" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Plan *</label>
          <select value={form.plan} onChange={(e) => setField("plan", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all">
            {planSlugs.map((p: string) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Status</label>
          <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all">
            {SUB_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Expires At</label>
        <input type="datetime-local" value={form.expiresAt} onChange={(e) => setField("expiresAt", e.target.value)} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Notes</label>
        <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} placeholder="Internal notes…" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 transition-all resize-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSubmit} disabled={saving} className="flex-1 bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">{saving ? "Saving…" : submitLabel}</button>
        <button onClick={onCancel} className="px-6 py-2.5 glass rounded-xl text-sm font-bold text-muted hover:text-foreground border border-border/40 transition-all">Cancel</button>
      </div>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────
function PlanBadge({ plan, plans }: { plan: string; plans: Plan[] }) {
  const found = plans.find((p) => p.slug === plan);
  const label = found?.display_name ?? plan;
  const styles: Record<string, string> = {
    pro:        "text-purple-400 bg-purple-500/10",
    enterprise: "text-amber-400 bg-amber-500/10",
    free:       "text-muted bg-surface",
  };
  return <span className={`text-[11px] font-black px-2.5 py-1 rounded-full capitalize ${styles[plan] ?? styles.free}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = { active: "text-emerald-400 bg-emerald-500/10", cancelled: "text-rose-400 bg-rose-500/10", expired: "text-muted/70 bg-surface" };
  return <span className={`text-[11px] font-black px-2.5 py-1 rounded-full capitalize ${s[status] ?? s.expired}`}>{status}</span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-all duration-300 ${checked ? "bg-accent" : "bg-muted/30"}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${checked ? "left-4" : "left-0.5"}`} />
    </button>
  );
}

function Modal({ title, onClose, children, wide = false }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`glass rounded-2xl border border-border/40 p-6 w-full shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? "max-w-xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
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
  return <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${type === "error" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"}`}>{msg}</div>;
}

function PlusIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function SearchIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function CheckIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function UsersIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function TrashIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>; }
