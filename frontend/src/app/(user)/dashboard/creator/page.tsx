"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/communityApi";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])) as any; } catch { return null; }
}

const BENEFITS = [
  { icon: "💰", title: "Earn commissions",    desc: "Get paid for every user who places a bet through your booking codes." },
  { icon: "📊", title: "Track performance",   desc: "See clicks, conversions, win rate and earnings in your creator dashboard." },
  { icon: "👥", title: "Build a following",   desc: "Users can follow you, subscribe to your tips and receive alerts." },
  { icon: "🏆", title: "Creator leaderboard", desc: "Top pundits are featured on the platform's public leaderboard." },
  { icon: "📡", title: "Publish predictions", desc: "Post tips with detailed analysis, markets and booking codes attached." },
  { icon: "🔖", title: "Manage your codes",   desc: "Create, track and optimise your affiliate booking codes in one place." },
];

const SPORTS  = ["Football","Basketball","Tennis","Baseball","Hockey","Volleyball","Cricket","Rugby"];
const MARKETS = ["1X2","Over 2.5","Under 2.5","BTTS","Over 3.5","AH -1","AH +1","Draw No Bet","Both Teams to Score","Custom"];
const BOOKS   = ["Bet9ja","SportyBet","1XBet","Bet365","Betway","BetKing","Melbet","Parimatch"];
const LEAGUES: Record<string, string[]> = {
  Football:   ["Premier League","La Liga","Serie A","Bundesliga","Ligue 1","Champions League","Europa League","FA Cup","Nations League","AFCON Qualifiers"],
  Basketball: ["NBA","EuroLeague","EuroCup","FIBA World Cup","NCAA"],
  Tennis:     ["ATP Tour","WTA Tour","Grand Slams","Davis Cup","ATP Finals"],
  Baseball:   ["MLB","NPB (Japan)","KBO (Korea)"],
  Hockey:     ["NHL","KHL","SHL"],
  Volleyball: ["Nations League","CEV Champions League","Italian Serie A1"],
  Cricket:    ["IPL","Test Series","ODI","T20 World Cup"],
  Rugby:      ["Six Nations","Rugby Championship","Top 14","Premiership"],
};

export default function CreatorPage() {
  const [role, setRole]           = useState<string>("user");
  const [dashboard, setDashboard] = useState<any>(null);
  const [view, setView]           = useState<"overview" | "tips" | "post">("overview");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    const u = decodeJwt(token);
    setRole(u?.role ?? "user");
    if (u?.role === "creator") {
      communityApi.getCreatorDashboard().then(setDashboard).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isCreator = role === "creator";

  if (!isCreator) {
    return <BecomeCreator onSuccess={(r) => { setRole(r); setView("overview"); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Creator Tools</h2>
          <p className="text-muted text-sm font-medium mt-1">Manage your tips and track performance</p>
        </div>
        <div className="flex items-center gap-2">
          {(["overview","tips","post"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${view === v ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground bg-surface border border-border/60 hover:bg-surface-hover"}`}>
              {v === "post" ? "+ New Tip" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === "overview" && <CreatorOverview dashboard={dashboard} onViewTips={() => setView("tips")} />}
      {view === "tips"     && <TipsView dashboard={dashboard} />}
      {view === "post"     && <PostTip onPost={() => setView("tips")} />}
    </div>
  );
}

function CreatorOverview({ dashboard, onViewTips }: { dashboard: any; onViewTips: () => void }) {
  const overview = dashboard?.overview;
  if (!overview) return (
    <div className="glass rounded-2xl p-10 border border-border/30 text-center">
      <p className="text-muted font-medium">No creator data yet. Post your first tip to get started.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Clicks",      value: Number(overview.totalClicks ?? 0).toLocaleString() },
          { label: "Conversions", value: Number(overview.totalConversions ?? 0).toLocaleString() },
          { label: "Earnings",    value: `${overview.currency ?? "$"}${Number(overview.estimatedEarnings ?? 0).toLocaleString()}` },
          { label: "Win Rate",    value: `${overview.winRate ?? 0}%`, accent: true },
        ].map((k: any) => (
          <div key={k.label} className={`glass rounded-2xl p-5 border ${k.accent ? "border-accent/20 bg-accent/5" : "border-border/30"}`}>
            <p className={`text-2xl font-black tabular-nums ${k.accent ? "text-accent" : "text-foreground"}`}>{k.value}</p>
            <p className="text-[11px] text-muted mt-0.5 font-medium">{k.label}</p>
          </div>
        ))}
      </div>

      {(dashboard?.predictions ?? []).length > 0 && (
        <div className="glass rounded-2xl p-6 border border-border/30">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black text-muted uppercase tracking-widest">Recent Tips</p>
            <button onClick={onViewTips} className="text-sm font-bold text-accent hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {(dashboard.predictions as any[]).slice(0, 4).map((pred: any) => (
              <div key={pred.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface/40 border border-border/20">
                <div className={`w-1 self-stretch rounded-full shrink-0 ${pred.status === "won" ? "bg-emerald-400" : pred.status === "lost" ? "bg-rose-400" : "bg-accent"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{pred.match?.homeTeam?.name} vs {pred.match?.awayTeam?.name}</p>
                  <p className="text-[10px] text-muted mt-0.5">{pred.prediction?.type} · @{pred.prediction?.odds}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                  pred.status === "won" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  pred.status === "lost" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                  "text-accent bg-accent/10 border-accent/20"
                }`}>{pred.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TipsView({ dashboard }: { dashboard: any }) {
  const predictions: any[] = dashboard?.predictions ?? [];
  const won  = predictions.filter((p) => p.status === "won").length;
  const lost = predictions.filter((p) => p.status === "lost").length;
  const open = predictions.filter((p) => p.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 border border-border/30 flex items-center gap-5 text-sm">
        <span className="text-muted font-medium">{predictions.length} tips total</span>
        <span className="text-emerald-400 font-black">✓ {won} won</span>
        <span className="text-rose-400 font-black">✗ {lost} lost</span>
        <span className="text-accent font-black">● {open} open</span>
      </div>

      {predictions.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center border border-border/30">
          <p className="text-3xl mb-3">📊</p>
          <p className="font-black text-foreground">No tips posted yet</p>
          <p className="text-sm text-muted mt-1">Switch to &quot;+ New Tip&quot; to publish your first prediction.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {predictions.map((pred: any) => (
            <div key={pred.id} className="glass rounded-2xl p-4 border border-border/30 flex items-start gap-4">
              <div className={`w-1 self-stretch rounded-full shrink-0 ${pred.status === "won" ? "bg-emerald-400" : pred.status === "lost" ? "bg-rose-400" : "bg-accent"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{pred.match?.homeTeam?.name} vs {pred.match?.awayTeam?.name}</p>
                  <span className={`text-[11px] font-black uppercase shrink-0 ${pred.status === "won" ? "text-emerald-400" : pred.status === "lost" ? "text-rose-400" : "text-accent"}`}>{pred.status}</span>
                </div>
                <p className="text-[11px] text-muted mt-0.5">{pred.prediction?.type} · @{pred.prediction?.odds} · {pred.prediction?.confidence}% conf</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
                  <span>♡ {pred.stats?.likes ?? 0}</span>
                  <span>💬 {pred.stats?.comments ?? 0}</span>
                  {pred.bookingCode?.code && <span className="font-mono text-accent">{pred.bookingCode.code}</span>}
                </div>
              </div>
              <Link href={`/predictions/${pred.id}`} className="text-[11px] text-accent hover:underline shrink-0">View ↗</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostTip({ onPost }: { onPost: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sport:"Football", league:"", homeTeam:"", awayTeam:"",
    market:"", odds:"", confidence:"50", analysis:"",
    bookmaker:"", code:"", affiliateUrl:"",
  });

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSub(true); setError("");
    try {
      await communityApi.createPrediction({
        sport: form.sport,
        league: { name: form.league, country: "", id: null },
        match: { id: `manual_${Date.now()}`, homeTeam: { name: form.homeTeam, shortName: form.homeTeam.slice(0,3).toUpperCase(), form: [] }, awayTeam: { name: form.awayTeam, shortName: form.awayTeam.slice(0,3).toUpperCase(), form: [] }, date: new Date().toISOString(), venue: "" },
        prediction: { type: form.market, shorthand: form.market, odds: Number(form.odds), confidence: Number(form.confidence), analysis: form.analysis },
        bookingCode: { id: `code_${Date.now()}`, bookmaker: form.bookmaker, code: form.code, clicks: 0, successRate: 0, trackingId: `tk_${Date.now()}`, affiliateUrl: form.affiliateUrl || "#", conversionStatus: null },
        status: "open", stats: { likes: 0, comments: 0, views: 0, shares: 0 }, tags: [form.league, form.market].filter(Boolean),
      });
      onPost();
    } catch (err: any) { setError(err.message || "Could not publish tip"); } finally { setSub(false); }
  }

  const steps = ["Match", "Prediction", "Booking Code"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${step > i+1 ? "bg-emerald-500 border-emerald-500 text-white" : step === i+1 ? "bg-accent border-accent text-white" : "border-border text-muted"}`}>
              {step > i+1 ? "✓" : i+1}
            </div>
            <span className={`text-sm font-bold ${step >= i+1 ? "text-foreground" : "text-muted"}`}>{label}</span>
            {i < 2 && <span className="text-border mx-1">→</span>}
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold">{error}</div>}

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="glass rounded-2xl p-5 border border-border/30 space-y-4">
            <p className="text-sm font-black text-foreground uppercase tracking-wider">Match Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sport *"><select className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" value={form.sport} onChange={(e) => { set("sport", e.target.value); set("league", ""); }}>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="League *"><select className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" value={form.league} onChange={(e) => set("league", e.target.value)}><option value="">Select…</option>{(LEAGUES[form.sport]??[]).map((l) => <option key={l}>{l}</option>)}</select></Field>
              <Field label="Home Team *"><input className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" placeholder="Arsenal" value={form.homeTeam} onChange={(e) => set("homeTeam", e.target.value)} /></Field>
              <Field label="Away Team *"><input className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" placeholder="Chelsea" value={form.awayTeam} onChange={(e) => set("awayTeam", e.target.value)} /></Field>
            </div>
            <button type="button" disabled={!form.sport || !form.league || !form.homeTeam || !form.awayTeam} onClick={() => setStep(2)} className="w-full py-3 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{ background: "var(--accent-gradient)" }}>Next: Prediction →</button>
          </div>
        )}
        {step === 2 && (
          <div className="glass rounded-2xl p-5 border border-border/30 space-y-4">
            <p className="text-sm font-black text-foreground uppercase tracking-wider">Your Prediction</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Market *"><select className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" value={form.market} onChange={(e) => set("market", e.target.value)}><option value="">Select…</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Odds *"><input type="number" step="0.01" min="1.01" className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" placeholder="1.85" value={form.odds} onChange={(e) => set("odds", e.target.value)} /></Field>
            </div>
            <Field label={`Confidence: ${form.confidence}%`}>
              <input type="range" min="10" max="99" className="w-full accent-accent" value={form.confidence} onChange={(e) => set("confidence", e.target.value)} />
              <div className="flex justify-between text-[9px] text-muted mt-0.5"><span>Low</span><span>Medium</span><span>High</span></div>
            </Field>
            <Field label="Analysis *"><textarea rows={4} maxLength={1000} className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50 resize-none" placeholder="Explain your reasoning…" value={form.analysis} onChange={(e) => set("analysis", e.target.value)} /><p className="text-[10px] text-right text-muted mt-0.5">{form.analysis.length}/1000</p></Field>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-border/40 text-muted hover:text-foreground transition-all">← Back</button>
              <button type="button" disabled={!form.market || !form.odds || !form.analysis} onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{ background: "var(--accent-gradient)" }}>Next: Booking Code →</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="glass rounded-2xl p-5 border border-border/30 space-y-4">
            <p className="text-sm font-black text-foreground uppercase tracking-wider">Booking Code</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bookmaker *"><select className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" value={form.bookmaker} onChange={(e) => set("bookmaker", e.target.value)}><option value="">Select…</option>{BOOKS.map((b) => <option key={b}>{b}</option>)}</select></Field>
              <Field label="Code *"><input className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground font-mono border border-border/40 focus:outline-none focus:border-accent/50" placeholder="BET9JA7R9X" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /></Field>
            </div>
            <Field label="Affiliate URL (optional)"><input className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50" placeholder="https://bookmaker.com?ref=YOUR_ID" value={form.affiliateUrl} onChange={(e) => set("affiliateUrl", e.target.value)} /></Field>
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl">
              <p className="text-[10px] text-accent font-black uppercase tracking-wider mb-2">Preview</p>
              <div className="flex items-center justify-between gap-2">
                <div><p className="text-sm font-bold text-foreground">{form.homeTeam} vs {form.awayTeam}</p><p className="text-[11px] text-muted">{form.market} · @{form.odds} · {form.confidence}% conf</p></div>
                <div className="text-right"><p className="text-sm font-black text-foreground">{form.bookmaker}</p><p className="font-mono text-sm text-accent">{form.code}</p></div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-border/40 text-muted hover:text-foreground transition-all">← Back</button>
              <button type="submit" disabled={!form.bookmaker || !form.code || submitting} className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{ background: "var(--accent-gradient)" }}>{submitting ? "Publishing…" : "Publish Tip ✓"}</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function BecomeCreator({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [agreed, setAgreed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function handleApply() {
    if (!agreed) return;
    setLoading(true); setError("");
    try {
      const result = await communityApi.becomeCreator() as { role: string };
      setDone(true);
      setTimeout(() => onSuccess(result.role ?? "creator"), 1800);
    } catch (err: any) { setError(err.message || "Could not process your request"); } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 bg-emerald-500/15 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl">🎉</div>
        <h2 className="text-2xl font-black text-foreground">You&apos;re now a Creator!</h2>
        <p className="text-muted text-sm">Setting up your creator dashboard…</p>
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Creator Program</h2>
        <p className="text-muted text-sm font-medium mt-1">Monetise your football knowledge</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — Hero + Agreement */}
        <div className="space-y-5">
          <div className="glass rounded-2xl p-7 border border-purple-500/20 bg-gradient-to-br from-purple-500/8 to-transparent">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 mb-3">Creator Program</span>
            <h3 className="text-xl font-black text-foreground">Earn from your predictions</h3>
            <p className="text-sm text-muted mt-2 leading-relaxed">Post predictions, share booking codes and earn affiliate commissions every time a user places a bet through your code.</p>
            <div className="flex items-center gap-6 mt-5 pt-5 border-t border-border/30">
              {[["Free","To join"],["20%","Revenue share"],["Real-time","Analytics"]].map(([n,l]) => (
                <div key={l}><p className="font-black text-accent text-lg leading-none">{n}</p><p className="text-[11px] text-muted mt-0.5">{l}</p></div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-border/30 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div onClick={() => setAgreed((a) => !a)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${agreed ? "bg-accent border-accent" : "border-border"}`}>
                {agreed && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              <span className="text-sm text-foreground font-medium">I agree to the Creator Terms of Service and understand that my predictions and codes are public.</span>
            </label>
            {error && <p className="text-rose-400 text-sm font-bold">{error}</p>}
            <button onClick={handleApply} disabled={!agreed || loading} className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:-translate-y-0.5 disabled:opacity-40" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}>
              {loading ? "Activating creator account…" : "Become a Creator →"}
            </button>
          </div>
        </div>

        {/* Right — Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="glass rounded-2xl p-4 border border-border/30">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{b.icon}</span>
                <div><p className="text-sm font-black text-foreground">{b.title}</p><p className="text-sm text-muted mt-0.5">{b.desc}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-muted font-black uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Tailwind class workaround for the input style used inline via className="w-full glass px-3 py-2.5 rounded-xl text-sm text-foreground border border-border/40 focus:outline-none focus:border-accent/50"
// These are defined as utility classes — the actual styling comes from globals or inline
// Since we can't use @apply here, we'll use a real component instead
declare module "react" {
  interface HTMLAttributes<T> { className?: string; }
}
