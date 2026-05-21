"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { withAuth } from "@/lib/authHeaders";
import PremiumGate from "@/components/PremiumGate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const BOOKMAKERS = [
  "Bet9ja", "SportyBet", "BetKing", "1XBet", "Betway",
  "Melbet", "Parimatch", "22Bet", "MSport", "NairaBet",
];

/** Bookmakers the OddSwitch engine can translate between */
const ODDSWITCH_BOOKMAKERS = ["SportyBet", "Bet9ja"] as const;
type OddswitchBookmaker = (typeof ODDSWITCH_BOOKMAKERS)[number];

const BOOKMAKER_META: Record<OddswitchBookmaker, {
  logoSrc: string;
  border: string;
  shape: "square" | "wide";
}> = {
  SportyBet: {
    logoSrc: "/logos/sportybet.png",
    border:  "border-red-500/20",
    shape:   "square",
  },
  Bet9ja: {
    logoSrc: "/logos/bet9ja.png",
    border:  "border-green-600/20",
    shape:   "wide",
  },
};

type BookingCode = {
  id: number;
  code: string;
  bookmaker: string;
  description: string | null;
  total_odds: string | null;
  stake_type: string | null;
  category: string | null;
  expires_at: string | null;
  created_at: string;
  submitter_name: string | null;
};

type Tab = "converter" | "browse";

export function CodeHub() {
  const [tab, setTab] = useState<Tab>("converter");

  return (
    <div className="flex w-full flex-col gap-0 px-4 py-6 pb-28 lg:px-8 lg:pb-12 relative">

      {/* Header */}
      <div className="mb-8 glass p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-foreground tracking-tight drop-shadow-md">Betting Codes</h1>
          <p className="text-sm text-muted mt-1.5 max-w-lg">
            Convert codes between bookmakers or browse community-submitted codes seamlessly.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex p-1.5 bg-surface/80 backdrop-blur-md border border-border/50 rounded-2xl mb-8 shadow-inner relative w-full">
        <button
          onClick={() => setTab("converter")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-bold transition-all duration-300 cursor-pointer relative z-10 ${
            tab === "converter" ? "text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {tab === "converter" && <div className="absolute inset-0 bg-accent rounded-xl -z-10" />}
          🔄 Converter
        </button>
        <button
          onClick={() => setTab("browse")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-bold transition-all duration-300 cursor-pointer relative z-10 ${
            tab === "browse" ? "text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {tab === "browse" && <div className="absolute inset-0 bg-accent rounded-xl -z-10" />}
          📋 Browse Codes
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PremiumGate feature="Booking Codes" mode="replace" flagKey="booking_codes_copy">
          {tab === "converter" ? <ConverterTab /> : <BrowseTab />}
        </PremiumGate>
      </div>
    </div>
  );
}

// ─── CONVERTER ────────────────────────────────────────────────────────────────

type ConversionLeg = {
  event: string;
  market: string;
  selection: string;
  source_odds: number;
  target_odds: number;
  confidence: number;
  status: "exact" | "approximate" | "missing";
};

type ConversionResult = {
  translated_code: string;
  confidence: number;
  status: "semantically_equivalent" | "approximate" | "partial";
  source_odds: number;
  target_odds: number;
  odds_delta: number;
  legs: ConversionLeg[];
};

type JobState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "polling"; jobId: string; attempts: number }
  | { phase: "done"; result: ConversionResult; from: string; to: string }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS  = 2500;
const MAX_POLL_ATTEMPTS = 40; // ~100 s

function confidenceConfig(status: string) {
  if (status === "semantically_equivalent")
    return { label: "High Confidence", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (status === "approximate")
    return { label: "Approximate",     cls: "bg-amber-500/15  text-amber-400  border-amber-500/30"  };
  return                 { label: "Partial Match",   cls: "bg-danger/15      text-danger      border-danger/30"      };
}

function legStatusCls(s: string) {
  if (s === "exact")       return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "approximate") return "bg-amber-500/10  text-amber-400  border-amber-500/20";
  return                          "bg-danger/10      text-danger      border-danger/20";
}

function ConverterTab() {
  const [code, setCode]         = useState("");
  const [from, setFrom]         = useState<OddswitchBookmaker>("SportyBet");
  const [to,   setTo]           = useState<OddswitchBookmaker>("Bet9ja");
  const [jobState, setJobState] = useState<JobState>({ phase: "idle" });
  const [copied,   setCopied]   = useState(false);
  const [legsOpen, setLegsOpen] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  function swap() {
    setFrom(to);
    setTo(from);
    setJobState({ phase: "idle" });
  }

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setJobState({ phase: "idle" });
    setCopied(false);
    setLegsOpen(false);
  }

  async function poll(jobId: string, attempts: number) {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      setJobState({ phase: "error", message: "Translation timed out. The engine may be busy — please try again." });
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/api/codes/convert/${jobId}`, withAuth());
      const json = await res.json();
      const job  = json.data;

      if (job.status === "completed" && job.result) {
        setJobState({ phase: "done", result: job.result, from, to });
        return;
      }
      if (job.status === "failed") {
        setJobState({ phase: "error", message: job.error?.message ?? "Translation failed on the engine." });
        return;
      }
      setJobState({ phase: "polling", jobId, attempts: attempts + 1 });
      pollTimer.current = setTimeout(() => poll(jobId, attempts + 1), POLL_INTERVAL_MS);
    } catch {
      setJobState({ phase: "error", message: "Lost connection to the conversion engine." });
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || from === to) return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setJobState({ phase: "submitting" });
    setCopied(false);
    setLegsOpen(false);

    try {
      const res  = await fetch(`${API_BASE}/api/codes/convert`, withAuth({
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: code.trim(), fromBookmaker: from, toBookmaker: to }),
      }));
      const json = await res.json();
      if (!res.ok) {
        setJobState({ phase: "error", message: json.message ?? "Submission failed." });
        return;
      }
      const job = json.data;
      if (job.status === "completed" && job.result) {
        setJobState({ phase: "done", result: job.result, from, to });
        return;
      }
      setJobState({ phase: "polling", jobId: job.job_id, attempts: 0 });
      pollTimer.current = setTimeout(() => poll(job.job_id, 0), POLL_INTERVAL_MS);
    } catch {
      setJobState({ phase: "error", message: "Could not reach the conversion service." });
    }
  }

  const isLoading = jobState.phase === "submitting" || jobState.phase === "polling";
  const canSubmit = code.trim().length > 0 && from !== to && !isLoading;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">

      {/* Engine badge */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-accent/5 border border-accent/15">
        <span className="text-accent text-lg shrink-0">⚡</span>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          <span className="font-black text-foreground">Live code translation</span> — resolves your full bet slip and generates a real booking code on the target platform. Supports <span className="text-emerald-400 font-bold">SportyBet</span> ↔ <span className="text-violet-400 font-bold">Bet9ja</span>. Results in 10–30 s.
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={handleConvert} className="glass rounded-3xl p-6 sm:p-8 space-y-7 border-border/50 shadow-premium">

        {/* Code input */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-muted uppercase tracking-[0.18em]">
            Booking Code
          </label>
          <input
            className="w-full px-5 py-4 rounded-2xl bg-surface border border-border/60 text-foreground text-2xl font-mono tracking-[0.25em] outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)] uppercase placeholder:tracking-normal placeholder:text-base placeholder:font-sans placeholder:text-muted/40 disabled:opacity-50"
            placeholder="Enter code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={100}
            disabled={isLoading}
          />
        </div>

        {/* Bookmaker direction — perfectly symmetric grid */}
        <div className="grid grid-cols-[1fr_52px_1fr] items-center gap-3">

          <BookmakerCard name={from} role="From" disabled={isLoading} />

          {/* Swap button — centered between the two equal-height cards */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={swap}
              disabled={isLoading}
              title="Swap bookmakers"
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-border/60 text-muted hover:text-accent hover:border-accent/40 hover:-rotate-180 transition-all duration-500 cursor-pointer disabled:opacity-40 shadow-sm group z-10"
            >
              <ArrowRightLeft className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>
          </div>

          <BookmakerCard name={to} role="To" disabled={isLoading} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-gradient w-full py-4 rounded-2xl disabled:opacity-50 disabled:grayscale-[40%] text-[14px] font-black tracking-wide relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative z-10 flex items-center justify-center gap-2.5">
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
            )}
            {jobState.phase === "submitting" ? "Submitting…"
              : jobState.phase === "polling"  ? `Translating… (${jobState.attempts + 1})`
              : "Convert Code →"}
          </span>
        </button>
      </form>

      {/* Progress steps */}
      {isLoading && (
        <div className="glass rounded-2xl p-5 border-border/50 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Translation Pipeline</p>
            <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          </div>
          {([
            { label: "Job queued",                               done: true },
            { label: `Resolving ${from} bet slip`,               done: jobState.phase === "polling" },
            { label: "Normalising selections",                   done: jobState.phase === "polling" && (jobState as any).attempts > 1 },
            { label: "Matching events cross-bookmaker",          done: jobState.phase === "polling" && (jobState as any).attempts > 3 },
            { label: `Generating ${to} code`,                    done: false },
          ] as { label: string; done: boolean }[]).map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center text-[10px] font-black transition-all duration-500 ${
                step.done
                  ? "bg-accent border-accent text-white"
                  : "border-border/50 bg-surface"
              }`}>
                {step.done ? "✓" : <span className="w-1.5 h-1.5 rounded-full bg-border/60" />}
              </div>
              <span className={`text-[12px] transition-colors duration-300 ${step.done ? "text-foreground font-bold" : "text-muted"}`}>
                {step.label}
              </span>
            </div>
          ))}
          <p className="text-[10px] text-muted/60 pt-1.5 border-t border-border/30 mt-1">
            This usually takes 10–30 seconds. The engine is working.
          </p>
        </div>
      )}

      {/* Error */}
      {jobState.phase === "error" && (
        <div className="flex items-start gap-4 p-5 bg-danger/8 border border-danger/20 rounded-2xl animate-in fade-in duration-300">
          <div className="w-9 h-9 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-danger text-sm font-black">✗</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground text-sm mb-1">Conversion failed</p>
            <p className="text-[12px] text-muted leading-relaxed">{jobState.message}</p>
          </div>
          <button
            onClick={reset}
            className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black border border-border text-muted hover:text-accent hover:border-accent/30 transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Result */}
      {jobState.phase === "done" && (
        <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-400">

          {/* Main result card */}
          <div className="glass rounded-3xl overflow-hidden border border-accent/25 shadow-premium">

            {/* Card header strip */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                  <span className="text-accent text-[12px] font-black">✓</span>
                </div>
                <div>
                  <p className="text-[12px] font-black text-foreground leading-tight">Code converted</p>
                  <p className="text-[10px] text-muted">{jobState.from} → {jobState.to}</p>
                </div>
              </div>
              {(() => {
                const cfg = confidenceConfig(jobState.result.status);
                return (
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide shrink-0 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                );
              })()}
            </div>

            <div className="p-6 space-y-5">

              {/* Code hero */}
              <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-[0.22em] text-center mb-3">
                  Your {jobState.to} Code
                </p>
                <div className="relative flex items-center gap-3 rounded-2xl bg-background/60 border border-border/50 px-5 py-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/4 to-transparent rounded-2xl pointer-events-none" />
                  <code className="relative z-10 flex-1 text-center text-3xl sm:text-4xl font-black font-mono tracking-[0.22em] text-foreground">
                    {jobState.result.translated_code}
                  </code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(jobState.result.translated_code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`relative z-10 shrink-0 px-5 py-2.5 rounded-xl text-[12px] font-black border transition-all duration-200 cursor-pointer ${
                      copied
                        ? "bg-accent text-white border-accent"
                        : "bg-surface border-border/60 text-muted hover:text-accent hover:border-accent/40"
                    }`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Odds — 3 equal columns */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface/60 rounded-2xl p-4 text-center border border-border/40">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 truncate">{jobState.from}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">{jobState.result.source_odds.toFixed(2)}</p>
                  <p className="text-[9px] text-muted/60 mt-1">odds</p>
                </div>
                <div className="bg-surface/60 rounded-2xl p-4 text-center border border-border/40">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 truncate">{jobState.to}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">{jobState.result.target_odds.toFixed(2)}</p>
                  <p className="text-[9px] text-muted/60 mt-1">odds</p>
                </div>
                <div className={`rounded-2xl p-4 text-center border ${
                  jobState.result.odds_delta >= 0
                    ? "bg-emerald-500/8 border-emerald-500/20"
                    : "bg-danger/8 border-danger/20"
                }`}>
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Delta</p>
                  <p className={`text-2xl font-black tabular-nums ${
                    jobState.result.odds_delta >= 0 ? "text-emerald-400" : "text-danger"
                  }`}>
                    {jobState.result.odds_delta >= 0 ? "+" : ""}{jobState.result.odds_delta.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted/60 mt-1">change</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low-confidence warning */}
          {jobState.result.confidence < 0.7 && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-2xl">
              <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                <span className="font-black text-amber-400">Low confidence match.</span>{" "}
                Some selections may not be exact. Review the bet on {jobState.to} before placing.
              </p>
            </div>
          )}

          {/* Legs accordion */}
          {jobState.result.legs.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden border-border/50">
              <button
                onClick={() => setLegsOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover/50 transition-colors cursor-pointer"
              >
                <span className="text-[12px] font-black text-foreground">
                  {jobState.result.legs.length} Selection{jobState.result.legs.length !== 1 ? "s" : ""}
                </span>
                <span className="text-muted text-xs">{legsOpen ? "▲" : "▼"}</span>
              </button>

              {legsOpen && (
                <div className="border-t border-border/40 divide-y divide-border/20">
                  {jobState.result.legs.map((leg, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-background/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate">{leg.event}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {leg.market} · <span className="text-accent font-bold">{leg.selection}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black text-foreground">{leg.target_odds.toFixed(2)}</p>
                        <p className="text-[10px] text-muted line-through">{leg.source_odds.toFixed(2)}</p>
                      </div>
                      <span className={`self-center shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-wide ${legStatusCls(leg.status)}`}>
                        {leg.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reset */}
          <button
            onClick={reset}
            className="w-full py-3.5 rounded-2xl border border-border/50 text-[13px] font-bold text-muted hover:text-accent hover:border-accent/30 transition-all cursor-pointer"
          >
            ← Convert another code
          </button>
        </div>
      )}
    </div>
  );
}

/** Visual bookmaker card used in the FROM / TO selector. */
function BookmakerCard({
  name,
  role,
  disabled,
}: {
  name: OddswitchBookmaker;
  role: string;
  disabled?: boolean;
}) {
  const m = BOOKMAKER_META[name];
  return (
    <div className={`rounded-2xl border ${m.border} bg-surface py-5 px-4 flex flex-col items-center gap-4 text-center transition-opacity duration-200 ${disabled ? "opacity-50" : ""}`}>
      <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">{role}</p>
      <img
        src={m.logoSrc}
        alt={name}
        draggable={false}
        className={m.shape === "square" ? "w-12 h-12 rounded-xl object-cover" : "h-8 w-auto max-w-[120px] object-contain"}
      />
    </div>
  );
}

// ─── BROWSE ───────────────────────────────────────────────────────────────────

function BrowseTab() {
  const [bookmaker, setBookmaker] = useState("");
  const [search, setSearch]       = useState("");
  const [codes, setCodes]         = useState<BookingCode[]>([]);
  const [state, setState]         = useState<"loading" | "ready" | "error">("loading");
  const [copied, setCopied]       = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    const params = new URLSearchParams({ limit: "40" });
    if (bookmaker) params.set("bookmaker", bookmaker);

    fetch(`${API_BASE}/api/codes?${params}`, withAuth({ signal: controller.signal }))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { setCodes(j.data ?? []); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });

    return () => controller.abort();
  }, [bookmaker]);

  const filtered = useMemo(() => {
    if (!search.trim()) return codes;
    const q = search.toLowerCase();
    return codes.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.bookmaker.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    );
  }, [codes, search]);

  const metrics = useMemo(() => [
    { label: "Active Codes", value: codes.length },
    { label: "Bookmakers",   value: new Set(codes.map(c => c.bookmaker)).size },
    { label: "With Odds",    value: codes.filter(c => c.total_odds != null).length },
  ], [codes]);

  function copyCode(id: number, codeStr: string) {
    void navigator.clipboard.writeText(codeStr);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="glass p-5 rounded-2xl text-center relative overflow-hidden group hover:shadow-premium transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-surface/50 to-transparent pointer-events-none" />
            <p className="text-3xl font-black text-foreground drop-shadow-sm relative z-10">{m.value}</p>
            <p className="text-[11px] font-bold text-muted mt-1 uppercase tracking-wider relative z-10">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass p-4 rounded-2xl border-border/50 shadow-sm flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
          <input
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface/80 border border-border/50 text-sm font-medium outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] focus:bg-surface"
            placeholder="Search descriptions, categories, codes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64 shrink-0">
          <BookmakerSelect value={bookmaker} onChange={setBookmaker} placeholder="All bookmakers" allowEmpty />
        </div>
      </div>

      {/* List */}
      {state === "loading" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="glass p-6 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-surface-hover rounded w-1/3" />
              <div className="h-3 bg-surface-hover rounded w-1/2" />
              <div className="h-10 bg-surface-hover rounded-xl w-32 mt-4" />
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="card-premium p-8 text-center">
          <p className="text-2xl mb-2">⚠</p>
          <p className="font-bold text-foreground">Could not load codes</p>
        </div>
      )}

      {state === "ready" && filtered.length === 0 && (
        <div className="glass p-16 rounded-3xl text-center border-border/50">
          <div className="w-20 h-20 mx-auto bg-surface rounded-3xl flex items-center justify-center border border-border shadow-sm mb-5">
            <p className="text-4xl">📋</p>
          </div>
          <p className="text-lg font-black text-foreground">No codes found</p>
          <p className="text-sm text-muted mt-2 max-w-sm mx-auto">Try different filters or clear the search to see more community codes.</p>
        </div>
      )}

      {state === "ready" && filtered.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map(code => (
            <div key={code.id} className="card-premium p-4">
              <CodeRow code={code} onCopy={copyCode} copied={copied} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function CodeRow({
  code,
  onCopy,
  copied,
}: {
  code: BookingCode;
  onCopy: (id: number, code: string) => void;
  copied: number | null;
}) {
  const isCopied = copied === code.id;
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
      <div className="flex-1 min-w-0 space-y-2 w-full">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent rounded-md text-[11px] font-black uppercase tracking-wider">
            {code.bookmaker}
          </span>
          {code.category && (
            <span className="px-2 py-0.5 bg-surface border border-border/50 rounded-md text-[10px] text-muted font-bold uppercase tracking-wide shadow-sm">
              {code.category}
            </span>
          )}
          {code.stake_type && (
            <span className="px-2 py-0.5 bg-surface-hover border border-border/50 rounded-md text-[10px] font-bold text-foreground uppercase tracking-wide">
              {code.stake_type}
            </span>
          )}
          {code.total_odds && (
            <span className="px-2 py-0.5 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold rounded-md text-[11px] font-black">
              @{code.total_odds}
            </span>
          )}
        </div>
        {code.description && (
          <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-relaxed">{code.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted font-bold">
          {code.submitter_name && (
            <span className="flex items-center gap-1.5"><ZapIcon className="w-3 h-3 text-accent" /> by {code.submitter_name}</span>
          )}
          {code.expires_at && (
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-border" />
              exp {new Date(code.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 bg-surface/50 p-1.5 rounded-xl border border-border/50 w-full sm:w-auto">
        <code className="flex-1 sm:flex-none text-center font-mono text-sm font-black text-foreground bg-surface border border-border/60 px-4 py-2 rounded-lg tracking-wider shadow-inner">
          {code.code}
        </code>
        <button
          onClick={() => onCopy(code.id, code.code)}
          className={`shrink-0 flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-black border transition-all duration-300 cursor-pointer shadow-sm ${
            isCopied
              ? "bg-success/15 border-success/30 text-success"
              : "bg-surface border-border/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-surface-hover active:scale-95"
          }`}
        >
          {isCopied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
  );
}

function BookmakerSelect({
  value,
  onChange,
  exclude,
  placeholder,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return <BookmakerSelectComponent value={value} onChange={onChange} exclude={exclude} placeholder={placeholder} allowEmpty={allowEmpty} />;
}

function BookmakerSelectComponent({
  value,
  onChange,
  exclude,
  placeholder,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const options = BOOKMAKERS.filter(b => b !== exclude);
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-5 py-4 rounded-2xl bg-surface/80 border border-border/50 text-foreground text-sm font-bold outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] focus:bg-surface cursor-pointer appearance-none"
      >
        <option value="" disabled={!allowEmpty}>{placeholder ?? "Select bookmaker"}</option>
        {allowEmpty && value && <option value="">All bookmakers</option>}
        {options.map(b => (
          <option key={b} value={b} className="bg-surface text-foreground">{b}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
