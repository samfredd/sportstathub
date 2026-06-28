"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { setSessionUser } from "@/lib/session";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function friendlyError(msg: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("password") && (m.includes("fewer than") || m.includes("minimum") || m.includes("must not have fewer")))
    return "Password must be at least 12 characters long.";
  if (m.includes("password") && (m.includes("more than") || m.includes("maximum")))
    return "Password is too long.";
  if (m.includes("email") && m.includes("format")) return "Please enter a valid email address.";
  if (m.includes("email") && m.includes("already")) return "An account with this email already exists.";
  if (m.includes("username") && m.includes("already")) return "That username is taken. Please choose another.";
  if (m.includes("username") && (m.includes("fewer than") || m.includes("minimum")))
    return "Username must be at least 2 characters.";
  if (m.includes("invalid credentials") || m.includes("incorrect password")) return "Email or password is incorrect.";
  if (m.includes("not verified") || m.includes("unverified")) return "Please verify your email before signing in.";
  if (m.includes("not found")) return "No account found with that email.";
  if (m.includes("expired")) return "Your code has expired. Please request a new one.";
  if (m.includes("invalid") && m.includes("otp")) return "That code is incorrect. Please check and try again.";
  if (m.includes("too many") || m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Connection error. Please check your internet and try again.";
  // Strip raw JSON Schema noise: "body/password must NOT have fewer than 12 characters" → strip prefix
  const schemaMatch = msg.match(/body\/\w+\s+(.+)/i);
  if (schemaMatch) return friendlyError(schemaMatch[1]);
  return msg;
}

const PERKS = [
  { icon: "🔓", label: "Free forever tier", sub: "Core stats and live scores at no cost" },
  { icon: "📡", label: "Real-time alerts", sub: "Goals, cards, and lineup changes as they happen" },
  { icon: "🧠", label: "AI predictions", sub: "Machine-learning tips updated before kick-off" },
  { icon: "🤝", label: "Creator network", sub: "Follow verified tipsters and compare records" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (form.password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${BASE}/auth/register`, {
        method: "POST",
        credentials: "include", // let the browser store the httpOnly auth cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyError(data.error || data.message || "Registration failed"));
      // OTP disabled: backend sets the auth cookie and returns the user → log in.
      if (data.data?.token || data.data?.user) {
        setSessionUser(data.data?.user ?? null);
        router.push("/");
      } else {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const passwordsMatch = confirm.length === 0 || form.password === confirm;
  const ready = form.username.length >= 2 && form.email && form.password.length >= 12 && confirm === form.password;

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-surface border-r border-border/40 p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/8 rounded-full blur-[80px] pointer-events-none translate-x-1/3 translate-y-1/3" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg">S</div>
          <div>
            <p className="font-black text-foreground text-base leading-none tracking-tight">SportStatHub</p>
            <p className="text-[10px] text-muted font-semibold mt-1">Football Analytics</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
              Join the<br />
              <span className="text-accent">network.</span>
            </h1>
            <p className="text-muted mt-4 text-base leading-relaxed max-w-sm">
              Get access to the tools that serious analysts and tipsters use every matchday.
            </p>
          </div>

          <div className="space-y-4">
            {PERKS.map(p => (
              <div key={p.label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-base shrink-0">{p.icon}</div>
                <div>
                  <p className="font-black text-foreground text-sm">{p.label}</p>
                  <p className="text-[12px] text-muted mt-0.5">{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 flex items-center gap-6 pt-4 border-t border-border/30">
          {[["Free", "Always"], ["2 min", "To set up"], ["No card", "Required"]].map(([n, l]) => (
            <div key={l}>
              <p className="font-black text-accent text-lg">{n}</p>
              <p className="text-[11px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute top-1/3 right-0 w-72 h-72 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-black text-white text-sm">S</div>
            <p className="font-black text-foreground tracking-tight">SportStatHub</p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-foreground tracking-tight">Create account</h2>
            <p className="text-muted mt-1.5">It&apos;s free — no card required</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 p-4 bg-danger/8 border border-danger/20 rounded-2xl">
              <span className="text-danger text-lg shrink-0">⚠</span>
              <p className="text-danger text-sm font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Username">
              <input
                type="text" required autoComplete="username"
                placeholder="pro_analyst"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="auth-input"
              />
            </Field>

            <Field label="Email address">
              <input
                type="email" required autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="auth-input"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={show ? "text" : "password"} required autoComplete="new-password"
                  placeholder="At least 12 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="auth-input pr-12"
                />
                <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
                  aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label="Confirm password">
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"} required autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={`auth-input pr-12 ${!passwordsMatch ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]" : ""}`}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
                  aria-label={showConfirm ? "Hide password" : "Show password"}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!passwordsMatch && (
                <p className="text-[11px] text-danger font-bold mt-1.5">Passwords do not match</p>
              )}
            </Field>

            <button type="submit" disabled={loading || !ready} className="auth-btn">
              {loading ? <Spinner /> : "Create account →"}
            </button>
          </form>

          <Divider />

          <a href={`${BASE}/auth/google`} className="auth-social-btn">
            <GoogleIcon />
            Continue with Google
          </a>

          <p className="mt-8 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-accent font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] text-muted font-black uppercase tracking-widest">or</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Please wait…
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
