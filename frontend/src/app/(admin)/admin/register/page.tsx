"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";

function friendlyError(msg: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("invite key") || m.includes("invalid invite")) return "Invalid invite key. Please check and try again.";
  if (m.includes("not enabled")) return "Admin registration is currently disabled on this server.";
  if (m.includes("already exists")) return "An account with that email or username already exists.";
  if (m.includes("password") && (m.includes("fewer than") || m.includes("minimum"))) return "Password must be at least 12 characters.";
  if (m.includes("email") && m.includes("format")) return "Please enter a valid email address.";
  const schemaMatch = msg.match(/body\/\w+\s+(.+)/i);
  if (schemaMatch) return friendlyError(schemaMatch[1]);
  return msg;
}

const STEPS = [
  { label: "Fill in details", desc: "Username, email, password" },
  { label: "Enter invite key", desc: "Required for admin access" },
  { label: "Access granted",   desc: "Redirected to dashboard" },
];

export default function AdminRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "", inviteKey: "" });
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [done, setDone]             = useState(false);

  const passwordsMatch = form.confirm.length === 0 || form.password === form.confirm;
  const ready =
    form.username.length >= 3 &&
    form.email.length > 0 &&
    form.password.length >= 12 &&
    form.password === form.confirm &&
    form.inviteKey.length > 0;

  const currentStep = !form.username || !form.email || !form.password ? 0
    : !form.inviteKey ? 1
    : done ? 2 : 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setLoading(true);
    try {
      await adminApi.register(
        form.username.trim().toLowerCase(),
        form.email.trim().toLowerCase(),
        form.password,
        form.inviteKey,
      );
      setDone(true);
      setTimeout(() => router.replace("/admin/login"), 1800);
    } catch (err: any) {
      setError(friendlyError(err.message || "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left command panel ── */}
      <AdminPanel
        headline={<>Restricted<br /><span className="text-accent">Access.</span></>}
        sub="Admin accounts are invite-only. You need a valid invite key issued by an existing administrator."
      >
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={s.label} className={`flex items-center gap-3 transition-opacity ${i > currentStep ? "opacity-25" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                i < currentStep  ? "bg-accent text-black" :
                i === currentStep ? "bg-accent/20 border border-accent text-accent" :
                "bg-white/5 border border-white/10 text-white/30"
              }`}>
                {i < currentStep ? "✓" : i + 1}
              </div>
              <div>
                <p className={`text-sm font-black ${i <= currentStep ? "text-white/90" : "text-white/30"}`}>{s.label}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 pt-4 border-t border-white/8">
          {[["Admin", "Role assigned"], ["Instant", "No OTP needed"], ["Logged", "Audit trail"]].map(([n, l]) => (
            <div key={l}>
              <p className="font-black text-accent text-base">{n}</p>
              <p className="text-[10px] text-white/40">{l}</p>
            </div>
          ))}
        </div>
      </AdminPanel>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background relative">
        <div className="absolute top-1/3 right-0 w-64 h-64 bg-accent/4 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-black text-white text-sm">S</div>
            <div>
              <p className="font-black text-foreground text-sm tracking-tight leading-none">SPORTSTATHUB</p>
              <p className="text-[9px] text-accent font-black uppercase tracking-[0.3em]">Admin</p>
            </div>
          </div>

          {done ? (
            <div className="text-center space-y-5 py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl mx-auto">✅</div>
              <div>
                <p className="text-xl font-black text-foreground">Admin account created</p>
                <p className="text-sm text-muted mt-1.5">Redirecting to dashboard…</p>
              </div>
              <div className="flex justify-center">
                <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger/10 border border-danger/20 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                  <span className="text-[10px] font-black text-danger uppercase tracking-widest">Invite Only</span>
                </div>
                <h2 className="text-3xl font-black text-foreground tracking-tight">Create admin account</h2>
                <p className="text-muted mt-1.5 text-sm">You&apos;ll need a valid invite key to complete registration.</p>
              </div>

              {error && <ErrorBanner msg={error} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Username">
                  <InputWrap icon={<UserIcon />}>
                    <input
                      type="text" required autoComplete="username"
                      placeholder="admin_username"
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </InputWrap>
                </Field>

                <Field label="Email">
                  <InputWrap icon={<EmailIcon />}>
                    <input
                      type="email" required autoComplete="email"
                      placeholder="admin@sportintel.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </InputWrap>
                </Field>

                <Field label="Password">
                  <InputWrap icon={<LockIcon />}>
                    <input
                      type={showPw ? "text" : "password"} required autoComplete="new-password"
                      placeholder="At least 12 characters"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className={`${INPUT_CLS} pr-14`}
                    />
                    <ToggleBtn show={showPw} onToggle={() => setShowPw(s => !s)} />
                  </InputWrap>
                </Field>

                <Field label="Confirm password">
                  <InputWrap icon={<LockIcon />} invalid={!passwordsMatch}>
                    <input
                      type={showConfirm ? "text" : "password"} required autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={form.confirm}
                      onChange={e => setForm({ ...form, confirm: e.target.value })}
                      className={`${INPUT_CLS} pr-14`}
                    />
                    <ToggleBtn show={showConfirm} onToggle={() => setShowConfirm(s => !s)} />
                  </InputWrap>
                  {!passwordsMatch && <p className="text-[11px] text-danger font-bold mt-1.5">Passwords do not match</p>}
                </Field>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[9px] text-muted/50 font-black uppercase tracking-widest">Admin Gate</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>

                <Field label="Invite Key">
                  <InputWrap icon={<KeyIcon />}>
                    <input
                      type={showKey ? "text" : "password"} required
                      placeholder="Paste your invite key"
                      value={form.inviteKey}
                      onChange={e => setForm({ ...form, inviteKey: e.target.value })}
                      className={`${INPUT_CLS} pr-14 font-mono tracking-wider`}
                    />
                    <ToggleBtn show={showKey} onToggle={() => setShowKey(s => !s)} />
                  </InputWrap>
                </Field>

                <button
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-black text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/25 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? <Spinner text="Creating account…" /> : <>Create Admin Account <ArrowIcon /></>}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-border/30 flex justify-center">
                <Link href="/admin/login" className="text-[11px] text-muted/60 hover:text-muted font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 group">
                  <svg className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                  Back to admin login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared layout ──────────────────────────────────────────

function AdminPanel({ headline, sub, children }: {
  headline: React.ReactNode;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between p-10 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #05070B 0%, #0B0E14 100%)" }}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent/8 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/6 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/8 to-transparent" />

      <div className="relative z-10 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-accent blur-xl opacity-30 scale-150 rounded-full" />
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent-hover rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg relative">S</div>
        </div>
        <div>
          <p className="font-black text-white text-sm leading-none tracking-tight">SPORTSTATHUB</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1 h-1 rounded-full bg-accent" />
            <p className="text-[9px] text-accent font-black uppercase tracking-[0.35em]">Admin Terminal</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Restricted Access</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.05] tracking-tight">{headline}</h1>
          <p className="text-white/40 mt-3 text-sm leading-relaxed max-w-xs">{sub}</p>
        </div>
        {children}
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[9px] text-white/25 font-black uppercase tracking-[0.3em]">Secure Node</span>
        <div className="h-px flex-1 bg-white/8" />
      </div>
    </div>
  );
}

// ── Form atoms ─────────────────────────────────────────────

const INPUT_CLS = "w-full bg-surface/60 backdrop-blur-sm pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium text-foreground border border-border/60 focus:outline-none focus:border-accent/70 focus:ring-4 focus:ring-accent/8 transition-all placeholder:text-muted/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em]">{label}</label>
      {children}
    </div>
  );
}

function InputWrap({ icon, children, invalid }: { icon: React.ReactNode; children: React.ReactNode; invalid?: boolean }) {
  return (
    <div className={`relative group/input${invalid ? " ring-1 ring-danger/40 rounded-2xl" : ""}`}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted/60 group-focus-within/input:text-accent transition-colors">
        {icon}
      </div>
      {children}
    </div>
  );
}

function ToggleBtn({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" tabIndex={-1} onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted hover:text-foreground transition-colors uppercase tracking-wider">
      {show ? "Hide" : "Show"}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-danger/5 border border-danger/20 text-danger text-sm font-medium">
      <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {text}
    </span>
  );
}

// ── Icons ──────────────────────────────────────────────────
function ArrowIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
function EmailIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>; }
function LockIcon()  { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function UserIcon()  { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function KeyIcon()   { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>; }
