"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function friendlyError(msg: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("not found")) return "No account found with that email address.";
  if (m.includes("expired")) return "Your reset code has expired. Please request a new one.";
  if (m.includes("invalid") && m.includes("otp")) return "That code is incorrect. Please check and try again.";
  if (m.includes("password") && (m.includes("fewer than") || m.includes("minimum") || m.includes("must not have fewer")))
    return "Password must be at least 12 characters long.";
  if (m.includes("too many") || m.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  const schemaMatch = msg.match(/body\/\w+\s+(.+)/i);
  if (schemaMatch) return friendlyError(schemaMatch[1]);
  return msg;
}

type Step = "email" | "code" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const otp = digits.join("");

  function handleDigit(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyError(data.error || data.message || "Could not send reset code"));
      setStep("code");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyError(data.error || data.message || "Could not reset password"));
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const STEPS: Step[] = ["email", "code", "done"];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-surface border-r border-border/40 p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/8 rounded-full blur-[80px] pointer-events-none translate-x-1/3 translate-y-1/3" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg">S</div>
          <div>
            <p className="font-black text-foreground text-base leading-none tracking-tight">SPORTSTATHUB</p>
            <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em] mt-0.5">Pro Terminal</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
              Locked<br />
              <span className="text-accent">out?</span>
            </h1>
            <p className="text-muted mt-4 text-base leading-relaxed max-w-sm">
              No problem. Enter your email and we&apos;ll send a reset code so you can get back in quickly.
            </p>
          </div>

          {/* Step indicator */}
          <div className="space-y-3">
            {[
              { label: "Enter email", desc: "We locate your account" },
              { label: "Enter code", desc: "Paste the 6-digit code" },
              { label: "New password", desc: "Choose a secure password" },
            ].map((s, i) => (
              <div key={s.label} className={`flex items-center gap-3 transition-opacity ${i > stepIndex ? "opacity-30" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i < stepIndex ? "bg-accent text-white" : i === stepIndex ? "bg-accent/20 border border-accent text-accent" : "bg-border/40 text-muted"}`}>
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <div>
                  <p className={`text-sm font-black ${i <= stepIndex ? "text-foreground" : "text-muted"}`}>{s.label}</p>
                  <p className="text-[11px] text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 pt-4 border-t border-border/30">
          {[["Secure", "Email verified"], ["15 min", "Code valid for"], ["One time", "Code usage"]].map(([n, l]) => (
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
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-black text-white text-sm">S</div>
            <p className="font-black text-foreground tracking-tight">SPORTSTATHUB</p>
          </div>

          {step === "email" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl mb-6">🔑</div>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-foreground tracking-tight">Reset password</h2>
                <p className="text-muted mt-1.5">Enter your email to receive a reset code</p>
              </div>

              {error && <ErrorBanner msg={error} />}

              <form onSubmit={requestCode} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-1.5">Email address</label>
                  <input
                    type="email" required autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="auth-input"
                  />
                </div>
                <button type="submit" disabled={loading || !email} className="auth-btn">
                  {loading ? <Spinner text="Sending…" /> : "Send reset code →"}
                </button>
              </form>
            </>
          )}

          {step === "code" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl mb-6">📬</div>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-foreground tracking-tight">Enter code</h2>
                <p className="text-muted mt-1.5">
                  Code sent to <span className="font-bold text-foreground">{email}</span>
                </p>
              </div>

              {error && <ErrorBanner msg={error} />}

              <form onSubmit={resetPassword} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-3">6-digit code</label>
                  <div className="flex gap-2.5" onPaste={handlePaste}>
                    {digits.map((d, i) => (
                      <input
                        key={i} ref={(node) => { refs.current[i] = node; }}
                        type="text" inputMode="numeric" maxLength={1}
                        value={d}
                        onChange={e => handleDigit(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        className="flex-1 h-14 text-center text-xl font-black rounded-2xl border outline-none transition-all duration-200 bg-surface"
                        style={{
                          borderColor: d ? "var(--accent)" : "var(--border)",
                          boxShadow: d ? "0 0 0 3px var(--accent-soft)" : undefined,
                          color: "var(--foreground)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"} required minLength={8} autoComplete="new-password"
                      placeholder="At least 12 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="auth-input pr-12"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors text-sm font-bold">
                      {show ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading || otp.length !== 6 || password.length < 12} className="auth-btn">
                  {loading ? <Spinner text="Resetting…" /> : "Reset password →"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl mb-6">✅</div>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-foreground tracking-tight">All done!</h2>
                <p className="text-muted mt-1.5">Your password has been reset. You can now sign in.</p>
              </div>
              <button onClick={() => router.push("/auth/login")} className="auth-btn">
                Go to sign in →
              </button>
            </>
          )}

          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/auth/login" className="text-accent font-bold hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-5 flex items-center gap-3 p-4 bg-danger/8 border border-danger/20 rounded-2xl">
      <span className="text-danger text-lg shrink-0">⚠</span>
      <p className="text-danger text-sm font-bold">{msg}</p>
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      {text}
    </span>
  );
}
