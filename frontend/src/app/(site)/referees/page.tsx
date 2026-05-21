"use client";

import { useState } from "react";
import PremiumGate from "@/components/PremiumGate";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POPULAR = [
  { name: "Michael Oliver",     league: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Anthony Taylor",     league: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Jesus Gil Manzano",  league: "La Liga",        flag: "🇪🇸" },
  { name: "Daniele Orsato",     league: "Serie A",        flag: "🇮🇹" },
  { name: "Felix Zwayer",       league: "Bundesliga",     flag: "🇩🇪" },
  { name: "Clement Turpin",     league: "Ligue 1",        flag: "🇫🇷" },
];

export default function RefereesPage() {
  const [query, setQuery]   = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [searched, setSearched] = useState("");

  async function doSearch(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(trimmed);
    try {
      const res = await fetch(`${BASE}/api/referees?name=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setResult(data);
    } catch {
      setError("No data found. Try a different name.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 lg:px-6 py-12 font-sans space-y-8">

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-10 md:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-accent/5 rounded-full" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1 mb-5">
              <WhistleIcon className="w-3 h-3 text-accent" />
              <span className="text-[10px] text-white font-black uppercase tracking-widest">Official Data</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none mb-3">
              Referee Analytics
            </h1>
            <p className="text-white/60 font-medium max-w-lg">
              Search any referee to explore their fixture history, goals profile, and match patterns.
            </p>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); doSearch(query); }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Michael Oliver" or "Daniele Orsato"'
              className="w-full glass border border-border/40 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-foreground focus:outline-none focus:border-accent/50 transition-all placeholder:text-muted/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-7 py-4 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-black rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95 shrink-0"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="glass border border-danger/20 rounded-2xl p-5 flex items-center gap-3 text-danger text-sm font-bold">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
              <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
            <span className="text-muted font-bold">Fetching referee data…</span>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Referee identity — free */}
            <div className="glass border border-border/30 rounded-3xl p-7 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <WhistleIcon className="w-7 h-7 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">{result.name}</h2>
                <p className="text-muted text-sm font-medium mt-0.5">{result.stats.matches} matches analysed</p>
              </div>
            </div>

            {/* Stat cards + fixtures — pro */}
            <PremiumGate feature="Referee Analytics" mode="replace" flagKey="referee_search">
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Matches"    value={result.stats.matches}           color="accent" />
                  <StatCard label="Avg Goals / Game" value={result.stats.avgGoalsPerMatch}  color="success" />
                  <StatCard label="Home Wins"        value={`${result.stats.homeWins} (${pct(result.stats.homeWins, result.stats.matches)}%)`} color="blue" />
                  <StatCard label="Away Wins"        value={`${result.stats.awayWins} (${pct(result.stats.awayWins, result.stats.matches)}%)`} color="purple" />
                </div>

                <div className="glass border border-border/30 rounded-3xl overflow-hidden">
                  <div className="px-7 py-5 border-b border-border/30 flex items-center justify-between">
                    <h3 className="font-black text-foreground tracking-tight">Recent Fixtures</h3>
                    <span className="text-xs text-muted font-bold">{result.recentFixtures.length} matches</span>
                  </div>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[560px]">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">League</th>
                          <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Match</th>
                          <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.recentFixtures.map((f) => (
                          <tr key={f.id} className="border-b border-border/10 hover:bg-surface/40 transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-muted tabular-nums whitespace-nowrap">
                              {new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-muted">{f.league.name}</td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-foreground">{f.homeTeam.name}</span>
                              <span className="text-muted/60 mx-2 font-black">·</span>
                              <span className="text-sm font-bold text-muted">{f.awayTeam.name}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-block font-black text-sm text-accent bg-accent/10 border border-accent/20 rounded-xl px-3 py-1 tabular-nums">
                                {f.score.home ?? "–"} – {f.score.away ?? "–"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </PremiumGate>
          </div>
        )}

        {/* Initial state */}
        {!result && !loading && !error && (
          <div className="space-y-5">
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] px-1">Popular referees</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {POPULAR.map((ref) => (
                <button
                  key={ref.name}
                  type="button"
                  onClick={() => { setQuery(ref.name); doSearch(ref.name); }}
                  className="group glass border border-border/30 rounded-2xl p-5 hover:border-accent/40 hover:bg-surface-hover/40 transition-all duration-200 flex items-center gap-4 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-surface border border-border/40 flex items-center justify-center text-xl shrink-0 group-hover:bg-accent/10 group-hover:border-accent/30 transition-all">
                    {ref.flag}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground group-hover:text-accent transition-colors truncate">{ref.name}</p>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wide">{ref.league}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted/30 group-hover:text-accent ml-auto shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    accent:  "text-accent  bg-accent/10  border-accent/20",
    success: "text-success bg-success/10 border-success/20",
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple:  "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  return (
    <div className={`glass border rounded-2xl p-5 ${colors[color] ?? colors.accent}`}>
      <span className="text-[10px] font-black uppercase tracking-widest block mb-2 opacity-70">{label}</span>
      <span className="text-2xl font-black tabular-nums">{value}</span>
    </div>
  );
}

function pct(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

function WhistleIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22 2 2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
    </svg>
  );
}
