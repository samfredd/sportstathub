"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { communityApi } from "@/lib/communityApi";
import { getSessionUser, logout as sessionLogout } from "@/lib/session";

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))  score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "",          color: "bg-border/30" },
    { label: "Very weak", color: "bg-danger" },
    { label: "Weak",      color: "bg-orange-500" },
    { label: "Fair",      color: "bg-amber-400" },
    { label: "Good",      color: "bg-success" },
    { label: "Strong",    color: "bg-success" },
  ];
  return { score, ...levels[score] };
}

function sessionInfo(exp?: number, iat?: number) {
  if (!exp || !iat) return null;
  const now = Date.now() / 1000;
  const total = exp - iat;
  const elapsed = now - iat;
  const remaining = exp - now;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const hrs  = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  return { pct, hrs, mins, expired: remaining <= 0 };
}

export default function UserSettingsPage() {
  const router = useRouter();
  const [user, setUser]             = useState<any>(null);

  // Password
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function showToast(msg: string, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    // Show stored descriptor immediately, then refresh from the server.
    setUser(getSessionUser());
    communityApi.getMe().then((me: any) => setUser(me)).catch(() => {});
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) return showToast("Passwords do not match", "error");
    if (newPw.length < 8)    return showToast("Password must be at least 8 characters", "error");
    setSaving(true);
    try {
      await communityApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      showToast("Password updated");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    void sessionLogout().finally(() => router.push("/"));
  }

  const strength   = passwordStrength(newPw);
  const session    = sessionInfo(user?.exp, user?.iat);
  const pwMatch    = confirmPw.length > 0 && newPw === confirmPw;
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;

  const issuedAt  = user?.iat ? new Date(user.iat * 1000) : null;
  const expiresAt = user?.exp ? new Date(user.exp * 1000) : null;

  return (
    <div className="space-y-6 h-full">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Settings</h2>
        <p className="text-muted text-sm font-medium mt-1">Security and account preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column — Account + Session */}
        <div className="space-y-6">
          {/* Account summary */}
          <Card>
            <SectionLabel icon={<UserIcon />} title="Account" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-accent/15 border-2 border-accent/30 flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-accent">{user?.email?.[0]?.toUpperCase() || "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black text-foreground truncate">{user?.username || user?.email || "User"}</p>
                <p className="text-sm text-muted truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={user?.role || "user"} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="User ID"    value={`#${user?.id || "—"}`} />
              <StatPill label="Role"       value={user?.role || "user"} />
              <StatPill label="Session"    value={issuedAt ? fmt(issuedAt) : "—"} />
              <StatPill label="Expires"    value={expiresAt ? fmt(expiresAt) : "—"} warn={session?.expired} />
            </div>
          </Card>

          {/* Session */}
          <Card>
            <SectionLabel icon={<ClockIcon />} title="Active Session" />
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted font-medium">Session progress</span>
                  <span className={`font-black text-sm ${session.expired ? "text-danger" : session.pct > 80 ? "text-amber-400" : "text-success"}`}>
                    {session.expired ? "Expired — please sign in again" : `${session.hrs}h ${session.mins}m remaining`}
                  </span>
                </div>
                <div className="h-2 w-full bg-surface/60 rounded-full overflow-hidden border border-border/20">
                  <div className={`h-full rounded-full transition-all duration-500 ${session.expired ? "bg-danger" : session.pct > 80 ? "bg-amber-400" : "bg-success"}`} style={{ width: `${session.pct}%` }} />
                </div>
                {(session.expired || session.pct > 85) && (
                  <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-bold ${session.expired ? "bg-danger/8 border border-danger/20 text-danger" : "bg-amber-500/8 border border-amber-500/20 text-amber-400"}`}>
                    <AlertIcon className="w-4 h-4 shrink-0" />
                    {session.expired ? "Your session has expired. Sign out and sign back in." : "Session expiring soon. You'll be signed out shortly."}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted/60">No session information available.</p>
            )}
          </Card>
        </div>

        {/* Right column — Password + System Health + Sign Out */}
        <div className="space-y-6">
          {/* Change password */}
          <Card>
            <SectionLabel icon={<LockIcon />} title="Change Password" />
            <form onSubmit={handleChangePassword} className="space-y-5">
              <PasswordField label="Current Password" value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggleShow={() => setShowCurrent((s) => !s)} autoComplete="current-password" placeholder="Your current password" />
              <div className="space-y-2">
                <PasswordField label="New Password" value={newPw} onChange={setNewPw} show={showNew} onToggleShow={() => setShowNew((s) => !s)} autoComplete="new-password" placeholder="At least 8 characters" />
                {newPw.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-border/30"}`} />
                      ))}
                    </div>
                    {strength.label && <p className={`text-xs font-bold ${strength.color.replace("bg-","text-")}`}>{strength.label}</p>}
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                      {[["At least 8 characters", newPw.length >= 8],["Uppercase letter", /[A-Z]/.test(newPw)],["Number", /[0-9]/.test(newPw)],["Special character", /[^A-Za-z0-9]/.test(newPw)]].map(([label, met]) => (
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
                <PasswordField label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} show={showNew} onToggleShow={() => setShowNew((s) => !s)} autoComplete="new-password" placeholder="Repeat new password" valid={pwMatch} invalid={pwMismatch} />
                {pwMismatch && <p className="text-xs text-danger font-bold mt-1.5 ml-1">Passwords do not match</p>}
                {pwMatch    && <p className="text-xs text-success font-bold mt-1.5 ml-1">Passwords match</p>}
              </div>
              <button type="submit" disabled={saving || !currentPw || !newPw || !confirmPw || pwMismatch} className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20 disabled:hover:translate-y-0">
                {saving ? <Spinner /> : <LockIcon className="w-4 h-4" />}
                {saving ? "Updating…" : "Update Password"}
              </button>
            </form>
          </Card>

          {/* Sign out */}
          <Card danger>
            <SectionLabel icon={<LogOutIcon />} title="Sign Out" danger />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted font-medium">Clears your session from this browser.</p>
              <button onClick={handleSignOut} className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-danger/10 border border-danger/20 text-danger hover:bg-danger/15 hover:border-danger/40 text-sm font-bold rounded-xl transition-all">
                <LogOutIcon className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </Card>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold ${toast.type === "error" ? "bg-danger" : "bg-success"} text-white`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function fmt(d: Date) { return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }

function Card({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return <div className={`glass rounded-2xl border p-6 ${danger ? "border-danger/20" : "border-border/30"}`}>{children}</div>;
}

function SectionLabel({ icon, title, danger = false, inline = false }: { icon: React.ReactNode; title: string; danger?: boolean; inline?: boolean }) {
  const el = (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${danger ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{icon}</div>
      <h3 className={`font-black text-sm ${danger ? "text-danger" : "text-foreground"}`}>{title}</h3>
    </div>
  );
  return inline ? el : <div className="mb-5">{el}</div>;
}

function StatPill({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-surface/40 rounded-xl px-4 py-3 border border-border/20">
      <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold truncate ${warn ? "text-amber-400" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggleShow, autoComplete, placeholder, valid, invalid }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  autoComplete?: string; placeholder?: string; valid?: boolean; invalid?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-black text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input type={show ? "text" : "password"} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full glass px-4 py-2.5 pr-20 rounded-xl text-sm font-medium text-foreground border transition-all focus:outline-none ${invalid ? "border-danger/50 focus:border-danger/70" : valid ? "border-success/50 focus:border-success/70" : "border-border/40 focus:border-accent/50"}`} />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {valid   && <CheckIcon className="w-4 h-4 text-success" />}
          {invalid && <XIcon className="w-4 h-4 text-danger" />}
          <button type="button" tabIndex={-1} onClick={onToggleShow} className="text-[10px] font-black text-muted hover:text-foreground transition-colors uppercase tracking-wider ml-1">{show ? "Hide" : "Show"}</button>
        </div>
      </div>
    </div>
  );
}


function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = { admin: "bg-danger/10 text-danger border-danger/20", creator: "bg-accent-gold/10 text-accent-gold border-accent-gold/20", user: "bg-surface text-muted border-border/40" };
  return <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${styles[role] ?? styles.user}`}>{role}</span>;
}

function Spinner() { return <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>; }

function UserIcon({ className = "w-4 h-4" }: { className?: string })    { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function LockIcon({ className = "w-4 h-4" }: { className?: string })    { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function ClockIcon({ className = "w-4 h-4" }: { className?: string })   { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function LogOutIcon({ className = "w-4 h-4" }: { className?: string })  { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function CheckIcon({ className = "w-4 h-4" }: { className?: string })   { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function XIcon({ className = "w-4 h-4" }: { className?: string })       { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function DotIcon({ className = "w-4 h-4" }: { className?: string })     { return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>; }
function AlertIcon({ className = "w-4 h-4" }: { className?: string })   { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
