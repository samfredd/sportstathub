"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { adminApi, decodeJwt } from "@/lib/adminApi";
import { storeAdminToken } from "@/lib/adminSession";

function friendlyError(msg: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("invalid credentials") || m.includes("incorrect password")) return "Email or password is incorrect.";
  if (m.includes("admin privileges") || m.includes("access denied")) return "This account does not have admin access.";
  if (m.includes("not verified") || m.includes("unverified")) return "Account is not verified.";
  if (m.includes("too many") || m.includes("rate limit")) return "Too many attempts. Please wait a moment.";
  const schemaMatch = msg.match(/body\/\w+\s+(.+)/i);
  if (schemaMatch) return friendlyError(schemaMatch[1]);
  return msg;
}

const CAPABILITIES = [
  { icon: <UsersIcon />, label: "User Management", sub: "Roles, verification, bans" },
  { icon: <ChartIcon />, label: "Platform Analytics", sub: "Live metrics and audit logs" },
  { icon: <CodeIcon />,  label: "Content Control",  sub: "Codes, predictions, creators" },
  { icon: <ShieldIcon />, label: "Security Centre",  sub: "Sessions, access, invite keys" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminApi.login(email.trim().toLowerCase(), password);
      const token = res?.data?.token ?? res?.token;
      if (!token) throw new Error("No token received");
      const payload = decodeJwt(token);
      if (!payload || payload.role !== "admin") throw new Error("Access denied: this account does not have admin privileges");
      storeAdminToken(token);
      router.replace("/admin");
    } catch (err: any) {
      setError(friendlyError(err.message || "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left command panel ── */}
      <AdminPanel
        headline={<>Command<br /><span className="text-accent">Center.</span></>}
        sub="Restricted access — authorised personnel only."
      >
        <div className="space-y-3">
          {CAPABILITIES.map(c => (
            <div key={c.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-accent">
                {c.icon}
              </div>
              <div>
                <p className="text-sm font-black text-white/90">{c.label}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{c.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 pt-4 border-t border-white/8">
          {[["Admin", "Access level"], ["JWT", "Auth method"], ["Logged", "All actions"]].map(([n, l]) => (
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

          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-black text-accent uppercase tracking-widest">Admin Portal</span>
            </div>
            <h2 className="text-3xl font-black text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted mt-1.5 text-sm">Sign in to access the admin dashboard</p>
          </div>

          {sessionExpired && !error && <SessionExpiredBanner />}
          {error && <ErrorBanner msg={error} />}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Email">
              <InputWrap icon={<EmailIcon />}>
                <input
                  type="email" required autoComplete="email"
                  placeholder="admin@sportintel.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={INPUT_CLS}
                />
              </InputWrap>
            </Field>

            <Field label="Password">
              <InputWrap icon={<LockIcon />}>
                <input
                  type={show ? "text" : "password"} required autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${INPUT_CLS} pr-14`}
                />
                <ToggleBtn show={show} onToggle={() => setShow(s => !s)} />
              </InputWrap>
            </Field>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-black text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/25 disabled:cursor-not-allowed"
            >
              {loading ? <Spinner text="Authenticating…" /> : <>Authorize Access <ArrowIcon /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col gap-3 items-center">
            <Link href="/admin/register" className="text-[11px] text-muted hover:text-foreground font-bold uppercase tracking-widest transition-colors">
              Create admin account
            </Link>
            <Link href="/" className="text-[11px] text-muted/50 hover:text-muted font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 group">
              <svg className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Return to public site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
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
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      {/* Glow blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent/8 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/6 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />
      {/* Right border */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/8 to-transparent" />

      {/* Logo */}
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

      {/* Hero */}
      <div className="relative z-10 space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Restricted Access</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.05] tracking-tight">{headline}</h1>
          <p className="text-white/40 mt-3 text-sm leading-relaxed max-w-xs">{sub}</p>
        </div>
        {children}
      </div>

      {/* Bottom badge */}
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

function InputWrap({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative group/input">
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

function SessionExpiredBanner() {
  return (
    <div className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-400 text-sm font-medium">
      <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Your session has expired. Please sign in again.
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-400 text-sm font-medium">
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
function UsersIcon() { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function ChartIcon() { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function CodeIcon()  { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>; }
function ShieldIcon(){ return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function UserIcon()  { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function KeyIcon()   { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>; }
