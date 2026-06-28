"use client";

import { useState, useEffect, useRef } from "react";
import { fixtureToMatch } from "@/lib/transforms";
import PremiumGate, { ProBadge } from "@/components/PremiumGate";
import { withAuth } from "@/lib/authHeaders";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function H2HPage() {
  const [teamA, setTeamA]           = useState(null);
  const [teamB, setTeamB]           = useState(null);
  const [queryA, setQueryA]         = useState("");
  const [queryB, setQueryB]         = useState("");
  const [suggestionsA, setSuggestionsA] = useState([]);
  const [suggestionsB, setSuggestionsB] = useState([]);
  const [h2hData, setH2hData]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useTeamSearch(queryA, teamA, setSuggestionsA);
  useTeamSearch(queryB, teamB, setSuggestionsB);

  async function handleCompare() {
    if (!teamA || !teamB) return;
    setLoading(true);
    setError(null);
    setH2hData(null);
    try {
      const params = new URLSearchParams({
        team1: String(teamA.id),
        team2: String(teamB.id),
        last: "15",
      });
      const res = await fetch(`${BASE}/api/h2h?${params}`, withAuth());
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || json.message || "Could not fetch H2H data.");
      }
      const data = json.data || [];
      if (!data.length) {
        setError(`No recent head-to-head meetings were found for ${teamA.name} and ${teamB.name}. Try increasing the search scope or choosing different teams.`);
        setH2hData([]);
        return;
      }
      setH2hData(data);
    } catch (e) {
      setError(e?.message || "Could not fetch H2H data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const stats = h2hData ? computeStats(h2hData, teamA?.id) : null;
  const previewMeetings = Array.isArray(h2hData) ? h2hData.slice(0, 5) : [];
  const lockedMeetings = Array.isArray(h2hData) ? h2hData.slice(5) : [];

  function renderMeeting(f) {
    const m = fixtureToMatch(f);
    if (!m) return null;
    const date = new Date(f.fixture.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
    const gh = f.goals?.home, ga = f.goals?.away;
    const aIsHome = f.teams?.home?.id === teamA?.id;
    const aScore = aIsHome ? gh : ga;
    const bScore = aIsHome ? ga : gh;
    const winner = aScore > bScore ? "a" : bScore > aScore ? "b" : "draw";
    return (
      <div key={m.id} className="grid grid-cols-3 items-center hover:bg-surface/30 transition-colors">
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          {m.homeLogo && <img src={m.homeLogo} alt="" className="w-6 h-6 object-contain shrink-0" />}
          <span className={`text-sm font-black truncate text-right ${winner === (aIsHome ? "a" : "b") ? "text-accent" : "text-foreground/70"}`}>{m.homeTeam}</span>
        </div>
        <div className="flex flex-col items-center py-4 gap-1">
          <span className="text-base font-black text-foreground tabular-nums">{m.score ?? "–"}</span>
          <span className="text-[9px] text-muted font-bold">{date}</span>
        </div>
        <div className="flex items-center justify-start gap-3 px-6 py-4">
          {m.awayLogo && <img src={m.awayLogo} alt="" className="w-6 h-6 object-contain shrink-0" />}
          <span className={`text-sm font-black truncate ${winner === (aIsHome ? "b" : "a") ? "text-danger" : "text-foreground/70"}`}>{m.awayTeam}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-12 font-sans space-y-8">

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-800 p-10 md:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,135,90,0.22),transparent_60%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1 mb-5">
              <CrossIcon className="w-3 h-3 text-accent" />
              <span className="text-[10px] text-white font-black uppercase tracking-widest">Comparison Engine</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none mb-3">Head-to-Head</h1>
            <p className="text-white/60 font-medium max-w-lg">
              Select two clubs to generate a full historical comparison across all competitions.
            </p>
          </div>
        </div>

        {/* Team selector */}
        <div className="glass border border-border/30 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
            {/* Team A */}
            <div className="flex-1">
              <TeamPicker
                label="Home Side"
                accentClass="text-accent border-accent/30 bg-accent/5"
                query={queryA}
                onQuery={(v) => { setQueryA(v); setTeamA(null); }}
                selected={teamA}
                suggestions={suggestionsA}
                onSelect={(t) => { setTeamA(t); setQueryA(t.name); setSuggestionsA([]); }}
              />
            </div>

            {/* VS divider */}
            <div className="flex md:flex-col items-center justify-center px-6 gap-3">
              <div className="h-px md:h-8 w-8 md:w-px bg-border/40" />
              <div className="w-10 h-10 rounded-full glass border border-border/40 flex items-center justify-center">
                <span className="text-xs font-black text-muted">VS</span>
              </div>
              <div className="h-px md:h-8 w-8 md:w-px bg-border/40" />
            </div>

            {/* Team B */}
            <div className="flex-1">
              <TeamPicker
                label="Away Side"
                accentClass="text-danger border-danger/30 bg-danger/5"
                query={queryB}
                onQuery={(v) => { setQueryB(v); setTeamB(null); }}
                selected={teamB}
                suggestions={suggestionsB}
                onSelect={(t) => { setTeamB(t); setQueryB(t.name); setSuggestionsB([]); }}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleCompare}
              disabled={!teamA || !teamB || loading}
              className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 px-12 rounded-2xl shadow-sm shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analysing…
                </span>
              ) : "Compare Teams"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="glass border border-danger/20 rounded-2xl p-5 text-danger text-sm font-bold flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Results */}
        {stats && stats.total > 0 && !loading && (
          <div className="space-y-5">
            {/* Score banner */}
            <div className="glass border border-border/30 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3">
                {/* Team A side */}
                <div className="flex flex-col items-center justify-center py-8 px-4 bg-accent/5">
                  {teamA?.logo && <img src={teamA.logo} alt={teamA.name} className="w-14 h-14 object-contain mb-3" />}
                  <p className="text-sm font-black text-accent text-center leading-tight">{teamA?.name}</p>
                  <p className="text-5xl font-black text-accent tabular-nums mt-3">{stats.aWins}</p>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">wins</p>
                </div>
                {/* Centre */}
                <div className="flex flex-col items-center justify-center py-8 border-x border-border/30">
                  <p className="text-4xl font-black text-foreground tabular-nums">{stats.draws}</p>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">draws</p>
                  <div className="my-4 w-px h-6 bg-border/40" />
                  <p className="text-xs text-muted font-bold">{stats.total} matches</p>
                </div>
                {/* Team B side */}
                <div className="flex flex-col items-center justify-center py-8 px-4 bg-danger/5">
                  {teamB?.logo && <img src={teamB.logo} alt={teamB.name} className="w-14 h-14 object-contain mb-3" />}
                  <p className="text-sm font-black text-danger text-center leading-tight">{teamB?.name}</p>
                  <p className="text-5xl font-black text-danger tabular-nums mt-3">{stats.bWins}</p>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">wins</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-6 pb-6">
                <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                  <div className="bg-accent transition-all rounded-l-full" style={{ width: stats.aWinPct }} />
                  <div className="bg-chart-3 transition-all" style={{ width: stats.drawPct }} />
                  <div className="bg-danger transition-all rounded-r-full" style={{ width: stats.bWinPct }} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="text-accent">{stats.aWinPct}</span>
                  <span className="text-chart-3">{stats.drawPct} draws</span>
                  <span className="text-danger">{stats.bWinPct}</span>
                </div>
              </div>
            </div>

            {/* Match history — Pro */}
            <div className="glass border border-border/30 rounded-2xl overflow-hidden">
              <div className="px-7 py-5 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-foreground tracking-tight">Recent Meetings</h3>
                  <ProBadge />
                </div>
                <span className="text-xs text-muted font-bold">{h2hData.length} matches</span>
              </div>
              <div className="px-7 py-3 border-b border-border/20 bg-background/30">
                <p className="text-[11px] text-muted font-bold">
                  Free preview shows the latest five meetings. Pro unlocks the full historical list and deeper patterns.
                </p>
              </div>
              <div className="divide-y divide-border/10">
                {previewMeetings.map(renderMeeting)}
              </div>
              {lockedMeetings.length > 0 && (
                <PremiumGate feature="H2H Analyser" mode="blur" flagKey="h2h_analyser">
                <div className="divide-y divide-border/10">
                  {lockedMeetings.map(renderMeeting)}
                </div>
                </PremiumGate>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!h2hData || h2hData.length === 0) && !loading && !error && (
          <div className="glass border border-border/40 rounded-2xl py-24 text-center flex flex-col items-center gap-5 relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
            <div className="w-20 h-20 rounded-2xl bg-surface border border-border/60 flex items-center justify-center shadow-inner relative z-10 group hover:border-accent/30 transition-colors">
              <CrossIcon className="w-8 h-8 text-accent opacity-80 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="relative z-10">
              <p className="font-black text-foreground text-lg">No comparison yet</p>
              <p className="text-muted text-sm mt-2 max-w-sm mx-auto">Search and select two teams from the inputs above to generate a comprehensive Head-to-Head report.</p>
            </div>
          </div>
        )}

    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function TeamPicker({ label, accentClass, query, onQuery, selected, suggestions, onSelect }) {
  return (
    <div className="relative flex flex-col gap-2">
      <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] px-1">{label}</label>
      <div className={`flex items-center gap-3 glass border rounded-2xl px-4 py-3.5 transition-all ${selected ? accentClass : "border-border/40"}`}>
        {selected?.logo && <img src={selected.logo} alt="" className="w-7 h-7 object-contain shrink-0" />}
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Search ${label}…`}
          aria-label={`Search ${label}`}
          className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none placeholder:text-muted/40"
        />
        {selected && <span className="text-accent text-xs font-black shrink-0">✓</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 glass border border-border/50 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto no-scrollbar">
          {suggestions.map((t) => (
            <button key={t.id} type="button" onClick={() => onSelect(t)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 transition-colors text-left">
              {t.logo && <img src={t.logo} alt="" className="w-6 h-6 object-contain shrink-0" />}
              <div>
                <p className="text-sm font-bold text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted">{t.country}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hooks ──────────────────────────────────────────────────── */

function useTeamSearch(query, selected, setSuggestions) {
  const timer = useRef(null);
  useEffect(() => {
    if (selected || query.length < 3) { setSuggestions([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/teams/search?name=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const { data } = await res.json();
        setSuggestions((data || []).slice(0, 8));
      } catch { setSuggestions([]); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query, selected, setSuggestions]);
}

/* ── Helpers ────────────────────────────────────────────────── */

function computeStats(fixtures, teamAId) {
  let aWins = 0, bWins = 0, draws = 0;
  fixtures.forEach((f) => {
    const gh = f.goals?.home, ga = f.goals?.away;
    if (gh == null) return;
    const aIsHome = f.teams?.home?.id === teamAId;
    const aScore = aIsHome ? gh : ga;
    const bScore = aIsHome ? ga : gh;
    if (aScore > bScore) aWins++;
    else if (aScore < bScore) bWins++;
    else draws++;
  });
  const total = aWins + bWins + draws || 1;
  const pct = (n) => Math.round((n / total) * 100) + "%";
  return { aWins, bWins, draws, total: aWins + bWins + draws, aWinPct: pct(aWins), bWinPct: pct(bWins), drawPct: pct(draws) };
}

function CrossIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>
    </svg>
  );
}
