"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setSessionUser } from "@/lib/session";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/verify-otp`, {
        method: "POST",
        credentials: "include", // let the browser store the httpOnly auth cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setSessionUser(data.data?.user ?? null);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
              Almost<br />
              <span className="text-accent">there.</span>
            </h1>
            <p className="text-muted mt-4 text-base leading-relaxed max-w-sm">
              One last step — confirm your email address to unlock your account.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-accent/8 border border-accent/20 space-y-2">
            <p className="text-sm font-black text-foreground">Why verify?</p>
            <ul className="space-y-1.5 text-[13px] text-muted">
              <li className="flex items-center gap-2"><span className="text-accent">✓</span> Protect your account</li>
              <li className="flex items-center gap-2"><span className="text-accent">✓</span> Enable password recovery</li>
              <li className="flex items-center gap-2"><span className="text-accent">✓</span> Unlock creator features</li>
            </ul>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 pt-4 border-t border-border/30">
          {[["6-digit", "Secure code"], ["15 min", "Code valid for"], ["Instant", "Account access"]].map(([n, l]) => (
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

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl mb-6">📬</div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-foreground tracking-tight">Check your inbox</h2>
            <p className="text-muted mt-1.5">
              We sent a 6-digit code to{" "}
              <span className="font-bold text-foreground">{email || "your email"}</span>
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 p-4 bg-danger/8 border border-danger/20 rounded-2xl">
              <span className="text-danger text-lg shrink-0">⚠</span>
              <p className="text-danger text-sm font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-black text-muted uppercase tracking-wider mb-3">
                Verification code
              </label>
              <div className="flex gap-2.5" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(node) => { refs.current[i] = node; }}
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
              <p className="text-[11px] text-muted mt-2">Paste your code or type each digit</p>
            </div>

            <button type="submit" disabled={loading || otp.length !== 6} className="auth-btn">
              {loading ? <Spinner /> : "Verify account →"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Didn&apos;t get a code?{" "}
            <button onClick={() => window.history.back()} className="text-accent font-bold hover:underline">
              Go back
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense>
      <VerifyOTPContent />
    </Suspense>
  );
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Verifying…
    </span>
  );
}
