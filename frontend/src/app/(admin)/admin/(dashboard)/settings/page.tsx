"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminApi, getStoredUser } from "@/lib/adminApi";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const NOTIF_KEY = "admin_notif_prefs";
const DEFAULT_NOTIFS = {
  newUsers:       true,
  subscriptions:  true,
  predictions:    false,
  forumReports:   false,
  dailyDigest:    true,
};

function loadNotifPrefs() {
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    return stored ? { ...DEFAULT_NOTIFS, ...JSON.parse(stored) } : { ...DEFAULT_NOTIFS };
  } catch { return { ...DEFAULT_NOTIFS }; }
}

function saveNotifPrefs(prefs: typeof DEFAULT_NOTIFS) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs)); } catch {}
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))  score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "",          color: "bg-border/30" },
    { label: "Very weak", color: "bg-danger" },
    { label: "Weak",      color: "bg-accent-gold" },
    { label: "Fair",      color: "bg-accent-gold" },
    { label: "Good",      color: "bg-success" },
    { label: "Strong",    color: "bg-success" },
  ];
  return { score, ...levels[score] };
}

function sessionInfo(exp?: number, iat?: number) {
  if (!exp || !iat) return null;
  const now     = Date.now() / 1000;
  const total   = exp - iat;
  const elapsed = now - iat;
  const remaining = exp - now;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const expired = remaining <= 0;
  return { pct, hrs, mins, expired, remaining };
}

function fmtAction(action: string) {
  return action.replace(/\./g, " › ").replace(/_/g, " ");
}

function fmtRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [user, setUser]           = useState<any>(null);
  const [health, setHealth]       = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Profile edit
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail]       = useState("");
  const [profileSaving, setProfileSaving]     = useState(false);
  const [profileDirty, setProfileDirty]       = useState(false);

  // Password form
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS);
  const [notifSaved, setNotifSaved] = useState(false);

  // Recent activity
  const [activity, setActivity]       = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function showToast(msg: string, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (u) {
      setProfileUsername(u.username || "");
      setProfileEmail(u.email || "");
    }
    setNotifs(loadNotifPrefs());
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`${BASE}/health`);
      setHealth(await res.json());
    } catch {
      setHealth({ status: "unreachable" });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const rows = await adminApi.getMyActivity({ limit: 10 });
      setActivity(Array.isArray(rows) ? rows : []);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileUsername.trim() && !profileEmail.trim()) return;
    setProfileSaving(true);
    try {
      const body: Record<string, string> = {};
      if (profileUsername.trim() !== (user?.username || "")) body.username = profileUsername.trim();
      if (profileEmail.trim()    !== (user?.email    || "")) body.email    = profileEmail.trim();
      if (!Object.keys(body).length) { showToast("No changes to save"); setProfileSaving(false); return; }
      await adminApi.updateProfile(body);
      showToast("Profile updated — re-login to see changes in header");
      setProfileDirty(false);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) return showToast("New passwords do not match", "error");
    if (newPw.length < 8)    return showToast("New password must be at least 8 characters", "error");
    setSaving(true);
    try {
      await adminApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      showToast("Password updated successfully");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleNotif(key: keyof typeof DEFAULT_NOTIFS) {
    setNotifs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifPrefs(next);
      return next;
    });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 1800);
  }

  function handleSignOut() {
    try { localStorage.removeItem("token"); } catch {}
    router.replace("/admin/login");
  }

  const strength  = passwordStrength(newPw);
  const session   = sessionInfo(user?.exp, user?.iat);
  const pwMatch   = confirmPw.length > 0 && newPw === confirmPw;
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;

  const issuedAt  = user?.iat ? new Date(user.iat * 1000) : null;
  const expiresAt = user?.exp ? new Date(user.exp * 1000) : null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Settings</h2>
        <p className="text-muted text-sm font-medium mt-1">Manage your account and platform configuration</p>
      </div>

      {/* ── Account Card ── */}
      <Card>
        <CardHeader icon={<UserIcon />} title="Account" />
        <div className="flex items-center gap-5 mb-6">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-accent">{user?.email?.[0]?.toUpperCase() || "A"}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success border-2 border-background flex items-center justify-center">
              <ShieldCheckIcon className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-black text-foreground truncate">{user?.username || user?.email || "Admin"}</div>
            <div className="text-sm text-muted truncate">{user?.email}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-accent-gold/10 text-accent-gold uppercase tracking-wider">
                <StarIcon className="w-2.5 h-2.5" />
                {user?.role || "admin"}
              </span>
              <span className="text-[11px] font-medium text-muted/60">ID #{user?.id}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill label="User ID"    value={`#${user?.id || "—"}`} />
          <StatPill label="Role"       value={user?.role || "admin"} />
          <StatPill label="Session Started" value={issuedAt ? fmtTime(issuedAt) : "—"} />
          <StatPill label="Expires"    value={expiresAt ? fmtTime(expiresAt) : "—"} warn={session?.expired} />
        </div>
      </Card>

      {/* ── Edit Profile ── */}
      <Card>
        <CardHeader icon={<EditIcon />} title="Edit Profile" />
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text"
                value={profileUsername}
                onChange={(e) => { setProfileUsername(e.target.value); setProfileDirty(true); }}
                placeholder="Your username"
                minLength={2}
                maxLength={32}
                className="w-full glass px-4 py-2.5 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:border-accent/50 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => { setProfileEmail(e.target.value); setProfileDirty(true); }}
                placeholder="admin@example.com"
                className="w-full glass px-4 py-2.5 rounded-xl text-sm font-medium text-foreground border border-border/40 focus:border-accent/50 focus:outline-none transition-all"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted/60 font-medium">Changes take effect on next sign-in.</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={profileSaving || !profileDirty}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {profileSaving ? <Spinner /> : <SaveIcon className="w-4 h-4" />}
              {profileSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Card>

      {/* ── Session Card ── */}
      <Card>
        <CardHeader icon={<ClockIcon />} title="Active Session" />
        {session ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted font-medium">Session progress</span>
              <span className={`font-black text-sm ${session.expired ? "text-danger" : session.pct > 80 ? "text-accent-gold" : "text-success"}`}>
                {session.expired
                  ? "Expired — please sign in again"
                  : `${session.hrs}h ${session.mins}m remaining`}
              </span>
            </div>
            <div className="h-2 w-full bg-surface/60 rounded-full overflow-hidden border border-border/20">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  session.expired ? "bg-danger" : session.pct > 80 ? "bg-accent-gold" : "bg-success"
                }`}
                style={{ width: `${session.pct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Issued"  value={issuedAt ? issuedAt.toLocaleString("en-GB") : "—"} />
              <StatPill label="Expires" value={expiresAt ? expiresAt.toLocaleString("en-GB") : "—"} warn={session.expired || session.pct > 80} />
            </div>
            {(session.expired || session.pct > 85) && (
              <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-bold ${session.expired ? "bg-danger/8 border border-danger/20 text-danger" : "bg-accent-gold/8 border border-accent-gold/20 text-accent-gold"}`}>
                <AlertIcon className="w-4 h-4 shrink-0" />
                {session.expired ? "Your session has expired. Sign out and sign back in." : "Session is almost expired. You'll be signed out soon."}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted/60">No session information available.</p>
        )}
      </Card>

      {/* ── Change Password ── */}
      <Card>
        <CardHeader icon={<LockIcon />} title="Change Password" />
        <form onSubmit={handleChangePassword} className="space-y-5">
          <PasswordField
            label="Current Password"
            value={currentPw}
            onChange={setCurrentPw}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((s) => !s)}
            autoComplete="current-password"
            placeholder="Your current password"
          />
          <div className="space-y-2">
            <PasswordField
              label="New Password"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggleShow={() => setShowNew((s) => !s)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {newPw.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.score ? strength.color : "bg-border/30"
                      }`}
                    />
                  ))}
                </div>
                {strength.label && (
                  <p className={`text-xs font-bold ${strength.color.replace("bg-", "text-")}`}>{strength.label}</p>
                )}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  {[
                    ["At least 8 characters", newPw.length >= 8],
                    ["Uppercase letter",       /[A-Z]/.test(newPw)],
                    ["Number",                 /[0-9]/.test(newPw)],
                    ["Special character",      /[^A-Za-z0-9]/.test(newPw)],
                  ].map(([label, met]) => (
                    <li key={label as string} className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${met ? "text-success" : "text-muted/50"}`}>
                      {met ? <CheckIcon className="w-3 h-3" /> : <DotIcon className="w-3 h-3" />}
                      {label as string}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <PasswordField
              label="Confirm New Password"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showNew}
              onToggleShow={() => setShowNew((s) => !s)}
              autoComplete="new-password"
              placeholder="Repeat new password"
              valid={pwMatch}
              invalid={pwMismatch}
            />
            {pwMismatch && <p className="text-xs text-danger font-bold mt-1.5 ml-1">Passwords do not match</p>}
            {pwMatch    && <p className="text-xs text-success font-bold mt-1.5 ml-1">Passwords match</p>}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !currentPw || !newPw || !confirmPw || pwMismatch}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {saving ? <Spinner /> : <LockIcon className="w-4 h-4" />}
              {saving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </Card>

      {/* ── Notification Preferences ── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <CardHeader icon={<BellIcon />} title="Notification Preferences" inline />
          {notifSaved && (
            <span className="text-[11px] font-black text-success flex items-center gap-1">
              <CheckIcon className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-muted font-medium mb-4">Control which in-panel alerts and badges you see.</p>
        <div className="space-y-3">
          {([
            ["newUsers",      "New user registrations",   "Show alerts when new users sign up"],
            ["subscriptions", "Subscription changes",     "Upgrades, downgrades, and cancellations"],
            ["predictions",   "Prediction status updates","When predictions are resolved"],
            ["forumReports",  "Forum activity",           "Pinned threads and reported content"],
            ["dailyDigest",   "Daily stats digest",       "A daily summary badge on the dashboard"],
          ] as [keyof typeof DEFAULT_NOTIFS, string, string][]).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-border/10 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{label}</p>
                <p className="text-xs text-muted font-medium mt-0.5">{desc}</p>
              </div>
              <Toggle on={notifs[key]} onToggle={() => toggleNotif(key)} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Recent Activity ── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <CardHeader icon={<ActivityIcon />} title="My Recent Activity" inline />
          <button
            onClick={fetchActivity}
            disabled={activityLoading}
            className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-all disabled:opacity-50"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${activityLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {activityLoading ? (
          <div className="space-y-2">
            {[0,1,2,3,4].map((i) => <div key={i} className="h-10 rounded-xl bg-surface/60 animate-pulse" />)}
          </div>
        ) : activity.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm font-medium">No activity recorded yet.</div>
        ) : (
          <div className="space-y-1">
            {activity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-surface/40 transition-colors group">
                <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                  <ActionIcon action={log.action} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground capitalize">{fmtAction(log.action)}</p>
                  {log.target_type && (
                    <p className="text-xs text-muted font-medium">
                      {log.target_type} {log.target_id ? `#${log.target_id}` : ""}
                      {log.metadata?.plan && ` · ${log.metadata.plan}`}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-muted/60 font-medium shrink-0 mt-0.5 group-hover:text-muted transition-colors">
                  {fmtRelative(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── System Health ── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <CardHeader icon={<ServerIcon />} title="System Health" inline />
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-all disabled:opacity-50"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {healthLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-surface/60 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <HealthTile
              label="API Server"
              status={health?.status === "ok" ? "online" : "offline"}
              detail={health?.timestamp ? new Date(health.timestamp).toLocaleTimeString("en-GB") : "—"}
            />
            <HealthTile
              label="Redis Cache"
              status={health?.redis === "ready" ? "online" : health?.redis === "unreachable" ? "offline" : "degraded"}
              detail={health?.redis || "—"}
            />
            <HealthTile
              label="Environment"
              status="neutral"
              detail={process.env.NODE_ENV || "production"}
            />
          </div>
        )}
      </Card>

      {/* ── Danger Zone ── */}
      <Card danger>
        <CardHeader icon={<LogOutIcon />} title="Danger Zone" danger />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">Sign out of admin panel</p>
            <p className="text-xs text-muted font-medium mt-0.5">Clears your session token from this browser.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-danger/10 border border-danger/20 text-danger hover:bg-danger/15 hover:border-danger/40 text-sm font-bold rounded-xl transition-all"
          >
            <LogOutIcon className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Layout atoms ────────────────────────────────────────────
function Card({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`glass rounded-2xl border p-6 ${danger ? "border-danger/20" : "border-border/30"}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, danger = false, inline = false }: { icon: React.ReactNode; title: string; danger?: boolean; inline?: boolean }) {
  const el = (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${danger ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>
        {icon}
      </div>
      <h3 className={`font-black text-sm ${danger ? "text-danger" : "text-foreground"}`}>{title}</h3>
    </div>
  );
  return inline ? el : <div className="mb-5">{el}</div>;
}

function StatPill({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-surface/40 rounded-xl px-4 py-3 border border-border/20">
      <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold truncate ${warn ? "text-accent-gold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none ${
        on ? "bg-accent border-accent" : "bg-surface border-border/40"
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function PasswordField({ label, value, onChange, show, onToggleShow, autoComplete, placeholder, valid, invalid }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  autoComplete?: string; placeholder?: string;
  valid?: boolean; invalid?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full glass px-4 py-2.5 pr-20 rounded-xl text-sm font-medium text-foreground border transition-all focus:outline-none ${
            invalid ? "border-danger/50 focus:border-danger/70" :
            valid   ? "border-success/50 focus:border-success/70" :
                      "border-border/40 focus:border-accent/50"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {valid   && <CheckIcon className="w-4 h-4 text-success" />}
          {invalid && <XIcon className="w-4 h-4 text-danger" />}
          <button type="button" tabIndex={-1} onClick={onToggleShow} className="text-[10px] font-black text-muted hover:text-foreground transition-colors uppercase tracking-wider ml-1">
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthTile({ label, status, detail }: { label: string; status: "online" | "offline" | "degraded" | "neutral"; detail: string }) {
  const styles = {
    online:   { dot: "bg-success animate-pulse", text: "text-success", bg: "bg-success/5 border-success/20", label: "Online" },
    offline:  { dot: "bg-danger",   text: "text-danger",   bg: "bg-danger/5 border-danger/20",     label: "Offline" },
    degraded: { dot: "bg-accent-gold",  text: "text-accent-gold",  bg: "bg-accent-gold/5 border-accent-gold/20",   label: "Degraded" },
    neutral:  { dot: "bg-muted/40",   text: "text-muted",      bg: "bg-surface/40 border-border/20",       label: detail },
  }[status];

  return (
    <div className={`rounded-xl border p-4 ${styles.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
        <span className={`text-xs font-black uppercase tracking-wider ${styles.text}`}>
          {status === "neutral" ? detail : styles.label}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground">{label}</p>
      {status !== "neutral" && <p className="text-xs text-muted font-medium mt-0.5 truncate">{detail}</p>}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom duration-300 ${
      type === "error" ? "bg-danger text-white" : "bg-success text-white"
    }`}>
      {msg}
    </div>
  );
}

function Spinner() {
  return <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>;
}

function ActionIcon({ action }: { action: string }) {
  if (action.startsWith("user"))           return <UserIcon className="w-3.5 h-3.5" />;
  if (action.startsWith("forum"))          return <MessageIcon className="w-3.5 h-3.5" />;
  if (action.startsWith("prediction"))     return <StarIcon className="w-3.5 h-3.5" />;
  if (action.startsWith("subscription") || action.startsWith("plan")) return <PackageIcon className="w-3.5 h-3.5" />;
  if (action.startsWith("admin.profile"))  return <EditIcon className="w-3.5 h-3.5" />;
  return <ActivityIcon className="w-3.5 h-3.5" />;
}

// ─── Icons ───────────────────────────────────────────────────
function UserIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function LockIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function ClockIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function ServerIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>; }
function LogOutIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function ShieldCheckIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>; }
function StarIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function CheckIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function XIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function DotIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>; }
function AlertIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function RefreshIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>; }
function EditIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function SaveIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>; }
function BellIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function ActivityIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function MessageIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function PackageIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
