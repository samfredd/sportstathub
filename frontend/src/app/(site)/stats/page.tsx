"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import StatsTable from "@/components/StatsTable";
import PremiumGate from "@/components/PremiumGate";
import { withAuth } from "@/lib/authHeaders";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TABS = [
  { id: "league", label: "League" },
  { id: "team", label: "Team" },
  { id: "prediction", label: "Prediction" },
  { id: "h2h", label: "H2H" },
] as const;

type TabId = typeof TABS[number]["id"];

const POPULAR_LEAGUES = [
  { id: 39, name: "Premier League", country: "England" },
  { id: 140, name: "La Liga", country: "Spain" },
  { id: 135, name: "Serie A", country: "Italy" },
  { id: 78, name: "Bundesliga", country: "Germany" },
  { id: 61, name: "Ligue 1", country: "France" },
  { id: 2, name: "Champions League", country: "Europe" },
];

const CARD_TABS = [
  { id: "scorers", label: "Top Scorers" },
  { id: "assists", label: "Top Assists" },
  { id: "yellow", label: "Yellow Cards" },
  { id: "red", label: "Red Cards" },
] as const;

const SPORT_OPTIONS = ["Football", "Basketball"];

export default function StatsPage() {
  const [tab, setTab] = useState<TabId>("league");
  const [initialTeamId, setInitialTeamId] = useState<number | null>(null);

  useEffect(() => {
    const requestedTeam = Number(new URLSearchParams(window.location.search).get('team'));
    if (Number.isInteger(requestedTeam) && requestedTeam > 0) {
      setInitialTeamId(requestedTeam);
      setTab('team');
    }
  }, []);

  return (
    <div className="w-full px-4 py-6 pb-28 lg:px-8 lg:pb-12">
      <div className="mb-8 glass p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-foreground tracking-tight drop-shadow-md">Analytics Hub</h1>
          <p className="text-sm text-muted mt-1.5 max-w-lg">League tables, player rankings, team analytics, predictions and H2H comparisons</p>
        </div>
      </div>

      <div role="tablist" aria-label="Analytics views" className="flex p-1.5 bg-surface/80 backdrop-blur-md border border-border/50 rounded-2xl mb-8 shadow-inner overflow-x-auto no-scrollbar gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`analytics-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[80px] py-3 rounded-xl text-[13px] font-bold transition-all duration-200 relative ${
              tab === t.id ? "text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {tab === t.id && <div className="absolute inset-0 bg-accent rounded-xl -z-10" />}
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`analytics-panel-${tab}`} aria-label={`${tab} analytics`}>
        <PremiumGate feature="Advanced Statistics" mode="replace" flagKey="advanced_stats">
          {tab === "league" && <LeagueTab />}
          {tab === "team" && <TeamTab initialTeamId={initialTeamId} />}
          {tab === "prediction" && <PredictionTab />}
          {tab === "h2h" && <H2HTab />}
        </PremiumGate>
      </div>
    </div>
  );
}

// ── League Tab ────────────────────────────────────────────────────────────────

const now = new Date();
// Football seasons start in August; before August the current season is last year's
const CURRENT_YEAR = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear();
const ALL_SEASONS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));

async function apiFetch(url: string) {
  const res = await fetch(url, withAuth());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json.data;
}

function LeagueTab() {
  const [leagueId, setLeagueId] = useState(39);
  const [season, setSeason] = useState(String(CURRENT_YEAR));
  const [cardTab, setCardTab] = useState<"scorers" | "assists" | "yellow" | "red">("scorers");
  const [standings, setStandings] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [standingsError, setStandingsError] = useState("");
  const [playersError, setPlayersError] = useState("");
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const fetchStandings = useCallback(async () => {
    setLoadingStandings(true);
    setStandingsError("");
    try {
      const data = await apiFetch(`${BASE}/api/leagues/${leagueId}/standings?season=${season}`);
      const rows = data?.[0]?.league?.standings?.[0] ?? data ?? [];
      setStandings(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setStandings([]);
      setStandingsError(e.message);
    } finally {
      setLoadingStandings(false);
    }
  }, [leagueId, season]);

  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    setPlayersError("");
    try {
      const endpoint = cardTab === "scorers" ? "scorers" : cardTab === "assists" ? "assists" : cardTab === "yellow" ? "yellow-cards" : "red-cards";
      const data = await apiFetch(`${BASE}/api/leagues/${leagueId}/${endpoint}?season=${season}`);
      setPlayers(Array.isArray(data) ? data.slice(0, 20) : []);
    } catch (e: any) {
      setPlayers([]);
      setPlayersError(e.message);
    } finally {
      setLoadingPlayers(false);
    }
  }, [leagueId, season, cardTab]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);
  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  return (
    <div className="space-y-6">
      <div className="glass p-4 rounded-2xl flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">League</label>
          <select
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent"
            value={leagueId}
            onChange={e => setLeagueId(Number(e.target.value))}
          >
            {POPULAR_LEAGUES.map(l => (
              <option key={l.id} value={l.id}>{l.name} — {l.country}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">Season</label>
          <select
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent"
            value={season}
            onChange={e => setSeason(e.target.value)}
          >
            {ALL_SEASONS.map(s => <option key={s} value={s}>{s}/{String(Number(s) + 1).slice(2)}</option>)}
          </select>
        </div>
      </div>

      {/* Standings */}
      <div className="glass p-5 rounded-2xl">
        <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Standings</h2>
        {loadingStandings ? (
          <Skeleton rows={8} />
        ) : standingsError ? (
          <ApiError message={standingsError} />
        ) : standings.length === 0 ? (
          <EmptyState text="No standings data available" />
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/30">
                  <th className="pb-2 text-left w-8">#</th>
                  <th className="pb-2 text-left">Team</th>
                  <th className="pb-2 text-center">P</th>
                  <th className="pb-2 text-center">W</th>
                  <th className="pb-2 text-center">D</th>
                  <th className="pb-2 text-center">L</th>
                  <th className="pb-2 text-center">GD</th>
                  <th className="pb-2 text-center font-black text-accent">PTS</th>
                  <th className="pb-2 text-center hidden sm:table-cell">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {standings.map((row: any) => {
                  const form: string[] = (row.form || "").split("").slice(-5);
                  return (
                    <tr key={row.rank} className="hover:bg-surface/60 transition-colors">
                      <td className="py-2.5 text-muted font-bold text-[12px]">{row.rank}</td>
                      <td className="py-2.5 flex items-center gap-2">
                        {row.team?.logo && <img src={row.team.logo} className="w-5 h-5 object-contain" alt="" />}
                        <span className="font-bold text-foreground text-[13px]">{row.team?.name}</span>
                      </td>
                      <td className="py-2.5 text-center text-muted text-[12px]">{row.all?.played}</td>
                      <td className="py-2.5 text-center text-[12px]">{row.all?.win}</td>
                      <td className="py-2.5 text-center text-[12px]">{row.all?.draw}</td>
                      <td className="py-2.5 text-center text-[12px]">{row.all?.lose}</td>
                      <td className={`py-2.5 text-center text-[12px] font-bold ${Number(row.goalsDiff) > 0 ? "text-success" : Number(row.goalsDiff) < 0 ? "text-danger" : "text-muted"}`}>
                        {Number(row.goalsDiff) > 0 ? "+" : ""}{row.goalsDiff}
                      </td>
                      <td className="py-2.5 text-center font-black text-accent">{row.points}</td>
                      <td className="py-2.5 text-center hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-0.5">
                          {form.map((f, i) => (
                            <span key={i} className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-black ${
                              f === "W" ? "bg-success/20 text-success" : f === "L" ? "bg-danger/20 text-danger" : "bg-surface-hover text-muted"
                            }`}>{f}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Rankings */}
      <div className="glass p-5 rounded-2xl">
        <div className="flex flex-wrap gap-2 mb-4">
          {CARD_TABS.map(ct => (
            <button
              key={ct.id}
              onClick={() => setCardTab(ct.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
                cardTab === ct.id ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground border border-border/50"
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
        {loadingPlayers ? (
          <Skeleton rows={10} />
        ) : playersError ? (
          <ApiError message={playersError} />
        ) : players.length === 0 ? (
          <EmptyState text="No player data available" />
        ) : (
          <div className="space-y-2">
            {players.map((entry: any, i: number) => {
              const p = entry.player;
              const stat = entry.statistics?.[0];
              const value = cardTab === "scorers" ? stat?.goals?.total :
                cardTab === "assists" ? stat?.goals?.assists :
                cardTab === "yellow" ? stat?.cards?.yellow :
                stat?.cards?.red;
              return (
                <div key={p?.id ?? i} className="flex items-center gap-3 p-3 bg-surface/60 border border-border/30 rounded-xl hover:bg-surface transition-colors">
                  <span className="text-[11px] font-black text-muted w-6 text-right">{i + 1}</span>
                  {p?.photo && <img src={p.photo} className="w-8 h-8 rounded-full object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-foreground truncate">{p?.name}</p>
                    <p className="text-[10px] text-muted">{stat?.team?.name}</p>
                  </div>
                  <span className="text-lg font-black text-accent">{value ?? "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────

function TeamTab({ initialTeamId }: { initialTeamId: number | null }) {
  const [leagueId, setLeagueId] = useState(39);
  const [season, setSeason] = useState(String(CURRENT_YEAR));
  // Teams list from standings — dropdown source
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  // Selected team (from dropdown or search)
  const [team, setTeam] = useState<any>(initialTeamId ? { id: initialTeamId, name: `Team #${initialTeamId}` } : null);
  const preservedInitialTeam = useRef(Boolean(initialTeamId));
  // Stats for selected team
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState("");
  const [loadingStats, setLoadingStats] = useState(false);

  // Load teams for the selected league/season from standings
  useEffect(() => {
    setLoadingTeams(true);
    setLeagueTeams([]);
    if (preservedInitialTeam.current) preservedInitialTeam.current = false;
    else setTeam(null);
    setStats(null);
    setStatsError("");
    fetch(`${BASE}/api/leagues/${leagueId}/standings?season=${season}`)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load teams");
        return json.data;
      })
      .then(data => {
        const rows: any[] = data?.[0]?.league?.standings?.[0] ?? [];
        setLeagueTeams(rows.map((row: any) => ({
          id: row.team.id,
          name: row.team.name,
          logo: row.team.logo,
          rank: row.rank,
          points: row.points,
        })));
      })
      .catch(() => setLeagueTeams([]))
      .finally(() => setLoadingTeams(false));
  }, [leagueId, season]);

  // Load stats when team is chosen
  useEffect(() => {
    if (!team) return;
    setLoadingStats(true);
    setStats(null);
    setStatsError("");
    fetch(`${BASE}/api/teams/${team.id}/statistics?league=${leagueId}&season=${season}`, withAuth())
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `Error ${r.status}`);
        return json.data;
      })
      .then(data => setStats(data))
      .catch((e: any) => setStatsError(e.message))
      .finally(() => setLoadingStats(false));
  }, [team, leagueId, season]);

  const s = stats;
  const fixturesPlayed = s?.fixtures?.played?.total ?? 0;
  const wins = s?.fixtures?.wins?.total ?? 0;
  const draws = s?.fixtures?.draws?.total ?? 0;
  const losses = s?.fixtures?.loses?.total ?? 0;
  const goalsFor = s?.goals?.for?.total?.total ?? 0;
  const goalsAgainst = s?.goals?.against?.total?.total ?? 0;
  const cleanSheets = s?.clean_sheet?.total ?? 0;
  const failedToScore = s?.failed_to_score?.total ?? 0;
  const form: string[] = (s?.form ?? "").split("").slice(-10);
  const avgGoalsFor = fixturesPlayed ? (goalsFor / fixturesPlayed).toFixed(2) : "—";
  const avgGoalsAgainst = fixturesPlayed ? (goalsAgainst / fixturesPlayed).toFixed(2) : "—";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass p-4 rounded-2xl flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">League</label>
          <select className="w-full px-4 py-3 rounded-xl bg-surface border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent"
            value={leagueId} onChange={e => setLeagueId(Number(e.target.value))}>
            {POPULAR_LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">Season</label>
          <select className="w-full px-4 py-3 rounded-xl bg-surface border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent"
            value={season} onChange={e => setSeason(e.target.value)}>
            {ALL_SEASONS.map(s => <option key={s} value={s}>{s}/{String(Number(s) + 1).slice(2)}</option>)}
          </select>
        </div>
      </div>

      {/* Team picker — dropdown list + search filter */}
      <TeamCombobox
        teams={leagueTeams}
        loading={loadingTeams}
        selected={team}
        onSelect={t => { setTeam(t); setStats(null); setStatsError(""); }}
      />

      {!team ? null : loadingStats ? (
        <div className="glass p-5 rounded-2xl"><Skeleton rows={8} /></div>
      ) : statsError ? (
        <ApiError message={statsError} />
      ) : !stats ? (
        <EmptyState text="No statistics found for this team / league / season combination" />
      ) : (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Team header */}
          <div className="glass p-5 rounded-2xl flex items-center gap-4">
            {stats.team?.logo && <img src={stats.team.logo} className="w-16 h-16 object-contain" alt="" />}
            <div>
              <p className="text-2xl font-black text-foreground">{stats.team?.name}</p>
              <p className="text-sm text-muted">{stats.league?.name} · {season}/{Number(season) + 1}</p>
            </div>
          </div>

          {/* Form */}
          {form.length > 0 && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-3">Recent Form (last {form.length})</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {form.map((f, i) => (
                  <span key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border-2 ${
                    f === "W" ? "bg-success/10 text-success border-success/20" :
                    f === "L" ? "bg-danger/10 text-danger border-danger/20" :
                    "bg-surface text-muted border-border"
                  }`}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Key stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <BigStat label="Played" value={fixturesPlayed} />
            <BigStat label="Wins" value={wins} color="text-success" />
            <BigStat label="Draws" value={draws} color="text-muted" />
            <BigStat label="Losses" value={losses} color="text-danger" />
            <BigStat label="Goals For" value={goalsFor} color="text-accent" />
            <BigStat label="Goals Against" value={goalsAgainst} color="text-danger" />
            <BigStat label="Clean Sheets" value={cleanSheets} color="text-success" />
            <BigStat label="Failed to Score" value={failedToScore} color="text-muted" />
          </div>

          {/* Averages */}
          <div className="glass p-5 rounded-2xl grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-surface/50 rounded-xl border border-border/30">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Avg Goals For</p>
              <p className="text-3xl font-black text-accent">{avgGoalsFor}</p>
              <p className="text-[10px] text-muted mt-0.5">per game</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-xl border border-border/30">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Avg Goals Against</p>
              <p className="text-3xl font-black text-danger">{avgGoalsAgainst}</p>
              <p className="text-[10px] text-muted mt-0.5">per game</p>
            </div>
          </div>

          {/* Home vs Away split */}
          {s?.fixtures && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Home vs Away</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Home", data: { played: s.fixtures.played?.home, wins: s.fixtures.wins?.home, draws: s.fixtures.draws?.home, losses: s.fixtures.loses?.home, goalsFor: s.goals?.for?.total?.home, goalsAgainst: s.goals?.against?.total?.home } },
                  { label: "Away", data: { played: s.fixtures.played?.away, wins: s.fixtures.wins?.away, draws: s.fixtures.draws?.away, losses: s.fixtures.loses?.away, goalsFor: s.goals?.for?.total?.away, goalsAgainst: s.goals?.against?.total?.away } },
                ].map(({ label, data }) => (
                  <div key={label} className="p-4 bg-surface/50 border border-border/30 rounded-xl space-y-2">
                    <p className="text-[11px] font-black text-muted uppercase tracking-widest">{label}</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span className="text-muted">Played</span><span className="font-bold text-foreground">{data.played ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">W/D/L</span><span className="font-bold text-foreground">{data.wins ?? 0} / {data.draws ?? 0} / {data.losses ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Goals F/A</span><span className="font-bold text-foreground">{data.goalsFor ?? 0} / {data.goalsAgainst ?? 0}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals Scored + Conceded by minute */}
          {(s?.goals?.for?.minute || s?.goals?.against?.minute) && (
            <div className="glass p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[12px] font-black text-muted uppercase tracking-widest">Goals by Minute</h2>
                <div className="flex gap-3 text-[10px] font-black">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-accent/70 inline-block" /> Scored</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-danger/50 inline-block" /> Conceded</span>
                </div>
              </div>
              <GoalMinuteChart forGoals={s.goals?.for?.minute} againstGoals={s.goals?.against?.minute} />
            </div>
          )}

          {/* 1st half vs 2nd half */}
          {(s?.goals?.for?.minute || s?.goals?.against?.minute) && (() => {
            const forMin = s.goals?.for?.minute ?? {};
            const agMin = s.goals?.against?.minute ?? {};
            const h1For = Object.entries(forMin).filter(([k]) => parseInt(k) <= 45).reduce((t, [, v]: [string, any]) => t + (v?.total ?? 0), 0);
            const h2For = Object.entries(forMin).filter(([k]) => parseInt(k) > 45).reduce((t, [, v]: [string, any]) => t + (v?.total ?? 0), 0);
            const h1Ag = Object.entries(agMin).filter(([k]) => parseInt(k) <= 45).reduce((t, [, v]: [string, any]) => t + (v?.total ?? 0), 0);
            const h2Ag = Object.entries(agMin).filter(([k]) => parseInt(k) > 45).reduce((t, [, v]: [string, any]) => t + (v?.total ?? 0), 0);
            return (
              <div className="glass p-5 rounded-2xl">
                <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Half-Time Breakdown</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "1st Half", for: h1For, against: h1Ag }, { label: "2nd Half", for: h2For, against: h2Ag }].map(h => (
                    <div key={h.label} className="p-4 bg-surface/50 border border-border/30 rounded-xl">
                      <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-3">{h.label}</p>
                      <div className="flex gap-4">
                        <div className="text-center flex-1">
                          <p className="text-2xl font-black text-accent">{h.for}</p>
                          <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-0.5">Scored</p>
                        </div>
                        <div className="w-px bg-border" />
                        <div className="text-center flex-1">
                          <p className="text-2xl font-black text-danger">{h.against}</p>
                          <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-0.5">Conceded</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Biggest results */}
          {(s?.biggest?.wins?.home || s?.biggest?.wins?.away || s?.biggest?.loses?.home || s?.biggest?.loses?.away) && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Biggest Results</h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                {s.biggest.wins?.home && <ResultBadge label="Biggest Home Win" value={s.biggest.wins.home} color="text-success" />}
                {s.biggest.wins?.away && <ResultBadge label="Biggest Away Win" value={s.biggest.wins.away} color="text-success" />}
                {s.biggest.loses?.home && <ResultBadge label="Biggest Home Loss" value={s.biggest.loses.home} color="text-danger" />}
                {s.biggest.loses?.away && <ResultBadge label="Biggest Away Loss" value={s.biggest.loses.away} color="text-danger" />}
              </div>
            </div>
          )}

          {/* Penalty stats */}
          {s?.penalty && (s.penalty.scored?.total > 0 || s.penalty.missed?.total > 0) && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Penalty Record</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <BigStat label="Scored" value={s.penalty.scored?.total ?? 0} color="text-success" />
                <BigStat label="Missed" value={s.penalty.missed?.total ?? 0} color="text-danger" />
                <BigStat label="Success %" value={
                  s.penalty.total ? `${s.penalty.scored?.percentage ?? "0%"}` : "—"
                } color="text-accent" />
              </div>
            </div>
          )}

          {/* First goal analysis */}
          {s?.biggest && (s.biggest.streak?.wins != null || s.biggest.streak?.draws != null || s.biggest.streak?.loses != null) && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Best Streaks (Season)</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                {s.biggest.streak?.wins != null && <BigStat label="Win Streak" value={s.biggest.streak.wins} color="text-success" />}
                {s.biggest.streak?.draws != null && <BigStat label="Draw Streak" value={s.biggest.streak.draws} color="text-muted" />}
                {s.biggest.streak?.loses != null && <BigStat label="Loss Streak" value={s.biggest.streak.loses} color="text-danger" />}
              </div>
            </div>
          )}

          {/* Most used lineups */}
          {s?.lineups?.length > 0 && (
            <div className="glass p-5 rounded-2xl">
              <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Most Used Formations</h2>
              <div className="space-y-2">
                {s.lineups.slice(0, 5).map((l: any) => {
                  const max = s.lineups[0]?.played ?? 1;
                  return (
                    <div key={l.formation} className="flex items-center gap-3">
                      <span className="text-[13px] font-black text-foreground w-16">{l.formation}</span>
                      <div className="flex-1 h-3 bg-surface/60 rounded-full overflow-hidden border border-border/30">
                        <div className="h-full bg-accent/70 rounded-full" style={{ width: `${(l.played / max) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-muted w-10 text-right">{l.played}×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCombobox({ teams, loading, selected, onSelect }: {
  teams: any[]; loading: boolean; selected: any; onSelect: (t: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = query.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : teams;

  return (
    <div ref={ref} className="glass p-4 rounded-2xl">
      <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Team</label>
      <div className="relative">
        {/* Trigger / search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border/50 cursor-text focus-within:border-accent transition-colors"
          onClick={() => setOpen(true)}
        >
          {selected?.logo && !query && (
            <img src={selected.logo} className="w-6 h-6 object-contain shrink-0" alt="" />
          )}
          <input
            className="flex-1 bg-transparent text-foreground text-sm font-bold outline-none placeholder:text-muted"
            placeholder={selected ? selected.name : loading ? "Loading teams…" : "Select or search a team…"}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {selected && !query && (
            <button
              className="text-muted hover:text-foreground text-lg leading-none shrink-0"
              onClick={e => { e.stopPropagation(); onSelect(null); setQuery(""); }}
            >×</button>
          )}
          <svg className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-surface/98 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium overflow-hidden">
            {loading ? (
              <div className="px-4 py-6 text-center text-muted text-sm">Loading teams…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted text-sm">No teams found</div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {filtered.map((t: any) => (
                  <button
                    key={t.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 transition-colors text-left ${selected?.id === t.id ? "bg-accent/10" : ""}`}
                    onClick={() => { onSelect(t); setQuery(""); setOpen(false); }}
                  >
                    {t.logo && <img src={t.logo} className="w-7 h-7 object-contain shrink-0" alt="" />}
                    <span className="flex-1 font-bold text-[13px] text-foreground">{t.name}</span>
                    <span className="text-[10px] font-black text-muted">#{t.rank}</span>
                    <span className="text-[10px] font-black text-accent w-10 text-right">{t.points} pts</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick team chips when no query */}
      {!selected && !open && teams.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {teams.slice(0, 8).map((t: any) => (
            <button
              key={t.id}
              onClick={() => { onSelect(t); setQuery(""); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border/30 hover:border-accent/40 hover:bg-accent/5 transition-colors"
            >
              {t.logo && <img src={t.logo} className="w-4 h-4 object-contain" alt="" />}
              <span className="text-[11px] font-bold text-foreground">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalMinuteChart({ forGoals, againstGoals }: { forGoals?: Record<string, any>; againstGoals?: Record<string, any> }) {
  const periods = Array.from(new Set([...Object.keys(forGoals ?? {}), ...Object.keys(againstGoals ?? {})])).sort((a, b) => parseInt(a) - parseInt(b));
  const maxFor = Math.max(...Object.values(forGoals ?? {}).map((v: any) => v?.total ?? 0), 1);
  const maxAg = Math.max(...Object.values(againstGoals ?? {}).map((v: any) => v?.total ?? 0), 1);
  const max = Math.max(maxFor, maxAg);
  return (
    <div className="flex items-end gap-1 h-24">
      {periods.map(period => {
        const f = forGoals?.[period]?.total ?? 0;
        const a = againstGoals?.[period]?.total ?? 0;
        return (
          <div key={period} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end gap-0.5" style={{ height: "80px" }}>
              <div className="flex-1 bg-accent/70 rounded-sm self-end" style={{ height: `${(f / max) * 72}px`, minHeight: f > 0 ? "3px" : "0" }} />
              <div className="flex-1 bg-danger/50 rounded-sm self-end" style={{ height: `${(a / max) * 72}px`, minHeight: a > 0 ? "3px" : "0" }} />
            </div>
            <span className="text-[7px] text-muted font-bold">{period.split("-")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function BigStat({ label, value, color = "text-foreground" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="glass p-4 rounded-xl text-center">
      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function ResultBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 bg-surface/50 border border-border/30 rounded-xl">
      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

// ── Prediction Tab ────────────────────────────────────────────────────────────

const LIVE_STATUS = new Set(["1H", "2H", "HT", "ET", "BT", "P", "INT", "LIVE"]);
const FINISHED_STATUS = new Set(["FT", "AET", "PEN"]);

function PredictionTab() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<{
    prediction: any; injuries: any[]; matchStats: any[]; lineups: any[]; events: any[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoadingMatches(true);
    setMatches([]);
    setSelected(null);
    setDetail(null);
    fetch(`${BASE}/api/matches?date=${date}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ data }) => setMatches(Array.isArray(data) ? data.slice(0, 40) : []))
      .catch(() => setMatches([]))
      .finally(() => setLoadingMatches(false));
  }, [date]);

  async function loadDetail(match: any) {
    setSelected(match);
    setDetail(null);
    setLoadingDetail(true);
    const id = match.fixture.id;
    const isPlayed = LIVE_STATUS.has(match.fixture.status?.short) || FINISHED_STATUS.has(match.fixture.status?.short);
    try {
      const [predRes, injRes, statsRes, lineupsRes, eventsRes] = await Promise.allSettled([
        fetch(`${BASE}/api/matches/${id}/predictions`, withAuth()).then(r => r.ok ? r.json() : null),
        fetch(`${BASE}/api/matches/${id}/injuries`, withAuth()).then(r => r.ok ? r.json() : null),
        isPlayed ? fetch(`${BASE}/api/matches/${id}/stats`, withAuth()).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        fetch(`${BASE}/api/matches/${id}/lineups`, withAuth()).then(r => r.ok ? r.json() : null),
        isPlayed ? fetch(`${BASE}/api/matches/${id}/events`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      ]);
      setDetail({
        prediction: predRes.status === "fulfilled" ? (predRes.value?.data?.[0] ?? predRes.value?.data ?? null) : null,
        injuries: injRes.status === "fulfilled" && Array.isArray(injRes.value?.data) ? injRes.value.data : [],
        matchStats: statsRes.status === "fulfilled" && Array.isArray(statsRes.value?.data) ? statsRes.value.data : [],
        lineups: lineupsRes.status === "fulfilled" && Array.isArray(lineupsRes.value?.data) ? lineupsRes.value.data : [],
        events: eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value?.data) ? eventsRes.value.data : [],
      });
    } finally {
      setLoadingDetail(false);
    }
  }

  const statusBadge = (m: any) => {
    const s = m.fixture.status?.short;
    if (LIVE_STATUS.has(s)) return "bg-success/20 text-success";
    if (FINISHED_STATUS.has(s)) return "bg-surface-hover text-muted";
    return "bg-surface-hover text-muted";
  };

  return (
    <div className="space-y-6">
      <div className="glass p-4 rounded-2xl">
        <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent" />
      </div>

      {!selected ? (
        <div className="glass p-5 rounded-2xl">
          <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Select a match</h2>
          {loadingMatches ? <Skeleton rows={6} /> : matches.length === 0 ? <EmptyState text="No matches found for this date" /> : (
            <div className="space-y-2">
              {matches.map((m: any) => (
                <button key={m.fixture.id} onClick={() => loadDetail(m)}
                  className="w-full flex items-center gap-3 p-3 bg-surface/60 border border-border/30 rounded-xl hover:bg-surface hover:border-accent/30 transition-all text-left">
                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.teams.home.logo && <img src={m.teams.home.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                      <span className="font-bold text-[12px] text-foreground truncate">{m.teams.home.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-muted shrink-0 text-center">
                      {m.goals.home != null ? `${m.goals.home} – ${m.goals.away}` : "vs"}
                    </span>
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <span className="font-bold text-[12px] text-foreground truncate text-right">{m.teams.away.name}</span>
                      {m.teams.away.logo && <img src={m.teams.away.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md shrink-0 ${statusBadge(m)}`}>{m.fixture.status?.short}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <button onClick={() => { setSelected(null); setDetail(null); }}
            className="flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold transition-colors">
            ← Back to matches
          </button>

          {/* Match header */}
          <div className="glass p-5 rounded-2xl">
            <p className="text-[11px] text-muted font-bold text-center mb-3">{selected.league?.name}</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col items-center gap-2 flex-1">
                {selected.teams.home.logo && <img src={selected.teams.home.logo} className="w-14 h-14 object-contain" alt="" />}
                <p className="font-black text-foreground text-sm text-center leading-tight">{selected.teams.home.name}</p>
              </div>
              <div className="text-center shrink-0">
                {selected.goals.home != null ? (
                  <p className="text-4xl font-black text-foreground">{selected.goals.home} – {selected.goals.away}</p>
                ) : (
                  <p className="text-xl font-black text-muted">vs</p>
                )}
                <p className="text-[10px] text-muted mt-1">{new Date(selected.fixture.date).toLocaleDateString([], { dateStyle: "medium" })}</p>
                <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-md ${statusBadge(selected)}`}>{selected.fixture.status?.short}</span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                {selected.teams.away.logo && <img src={selected.teams.away.logo} className="w-14 h-14 object-contain" alt="" />}
                <p className="font-black text-foreground text-sm text-center leading-tight">{selected.teams.away.name}</p>
              </div>
            </div>
          </div>

          {loadingDetail ? (
            <div className="glass p-8 rounded-2xl"><Skeleton rows={6} /></div>
          ) : detail ? (
            <>
              {detail.prediction && <PredictionCard prediction={detail.prediction} home={selected.teams.home.name} away={selected.teams.away.name} />}
              {detail.matchStats.length > 0 && <MatchStatsCard stats={detail.matchStats} home={selected.teams.home} away={selected.teams.away} />}
              {detail.lineups.length > 0 && <LineupsCard lineups={detail.lineups} />}
              {detail.events.length > 0 && <EventsTimeline events={detail.events} home={selected.teams.home} away={selected.teams.away} />}
              {detail.injuries.length > 0 && <InjuriesCard injuries={detail.injuries} />}
              {!detail.prediction && detail.matchStats.length === 0 && detail.lineups.length === 0 && detail.injuries.length === 0 && (
                <div className="glass p-8 rounded-2xl"><EmptyState text="No data available for this match yet" /></div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MatchStatsCard({ stats, home, away }: any) {
  const homeStats: Record<string, any> = {};
  const awayStats: Record<string, any> = {};
  (stats[0]?.statistics ?? []).forEach((s: any) => { homeStats[s.type] = s.value; });
  (stats[1]?.statistics ?? []).forEach((s: any) => { awayStats[s.type] = s.value; });

  const ROWS = [
    { key: "Ball Possession", label: "Possession", pct: true },
    { key: "Total Shots", label: "Shots" },
    { key: "Shots on Goal", label: "On Target" },
    { key: "Shots off Goal", label: "Off Target" },
    { key: "Blocked Shots", label: "Blocked" },
    { key: "Corner Kicks", label: "Corners" },
    { key: "Fouls", label: "Fouls" },
    { key: "Yellow Cards", label: "Yellow Cards" },
    { key: "Red Cards", label: "Red Cards" },
    { key: "Offsides", label: "Offsides" },
    { key: "Goalkeeper Saves", label: "Saves" },
    { key: "Total passes", label: "Passes" },
    { key: "Passes accurate", label: "Accurate Passes" },
  ].filter(r => homeStats[r.key] != null || awayStats[r.key] != null);

  return (
    <div className="glass p-5 rounded-2xl">
      <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-5">Match Statistics</h2>
      <div className="space-y-3">
        {ROWS.map(({ key, label, pct }) => {
          const hRaw = homeStats[key] ?? "0";
          const aRaw = awayStats[key] ?? "0";
          const hNum = parseFloat(String(hRaw).replace("%", "")) || 0;
          const aNum = parseFloat(String(aRaw).replace("%", "")) || 0;
          const total = hNum + aNum || 1;
          const hPct = (hNum / total) * 100;
          return (
            <div key={key}>
              <div className="flex justify-between text-[11px] font-black mb-1">
                <span className={hNum > aNum ? "text-accent" : "text-foreground"}>{hRaw}{pct && !String(hRaw).includes("%") ? "%" : ""}</span>
                <span className="text-muted">{label}</span>
                <span className={aNum > hNum ? "text-accent" : "text-foreground"}>{aRaw}{pct && !String(aRaw).includes("%") ? "%" : ""}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-surface border border-border/20">
                <div className="bg-success/70 rounded-l-full transition-all" style={{ width: `${hPct}%` }} />
                <div className="bg-danger/70 rounded-r-full transition-all" style={{ width: `${100 - hPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-3 px-0.5 text-[10px] font-black">
        <span className="text-success">{home.name}</span>
        <span className="text-danger">{away.name}</span>
      </div>
    </div>
  );
}

function LineupsCard({ lineups }: any) {
  const [side, setSide] = useState(0);
  const lineup = lineups[side];
  if (!lineup) return null;
  const starters = lineup.startXI?.map((p: any) => p.player) ?? [];
  const subs = lineup.substitutes?.map((p: any) => p.player) ?? [];

  return (
    <div className="glass p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[12px] font-black text-muted uppercase tracking-widest">Lineups</h2>
        <div className="flex gap-1.5">
          {lineups.map((_: any, i: number) => (
            <button key={i} onClick={() => setSide(i)}
              className={`px-3 py-1 rounded-lg text-[11px] font-black transition-colors ${side === i ? "bg-accent text-white" : "bg-surface text-muted border border-border/50"}`}>
              {lineups[i]?.team?.name?.split(" ").slice(-1)[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        {lineup.team?.logo && <img src={lineup.team.logo} className="w-8 h-8 object-contain" alt="" />}
        <div>
          <p className="font-black text-foreground">{lineup.team?.name}</p>
          {lineup.formation && <p className="text-[11px] text-muted">Formation: <span className="font-bold text-accent">{lineup.formation}</span></p>}
          {lineup.coach?.name && <p className="text-[11px] text-muted">Coach: {lineup.coach.name}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Starting XI</p>
          <div className="space-y-1.5">
            {starters.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted w-5 text-right">{p.number}</span>
                <span className="text-[12px] font-bold text-foreground">{p.name}</span>
                {p.pos && <span className="text-[9px] font-black px-1 py-0.5 rounded bg-surface text-muted border border-border/30">{p.pos}</span>}
              </div>
            ))}
          </div>
        </div>
        {subs.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Substitutes</p>
            <div className="space-y-1.5">
              {subs.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-muted w-5 text-right">{p.number}</span>
                  <span className="text-[12px] text-muted">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTimeline({ events, home, away }: any) {
  const TYPE_META: Record<string, { icon: string; color: string }> = {
    Goal: { icon: "⚽", color: "text-success" },
    subst: { icon: "🔄", color: "text-accent" },
    Card: { icon: "🟨", color: "text-accent-gold" },
    Var: { icon: "📺", color: "text-muted" },
  };

  const categorised = events.reduce((acc: any, e: any) => {
    const type = e.type === "Card" && e.detail?.toLowerCase().includes("red") ? "RedCard" : e.type;
    (acc[type] = acc[type] || []).push(e);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="glass p-5 rounded-2xl">
      <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-5">Match Timeline</h2>

      {/* Quick summary chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(categorised["Goal"] ?? []).length > 0 && (
          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-success/10 text-success border border-success/20">
            ⚽ {categorised["Goal"].length} Goal{categorised["Goal"].length !== 1 ? "s" : ""}
          </span>
        )}
        {(categorised["Card"] ?? []).length > 0 && (
          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-warning/10 text-accent-gold border border-warning/20">
            🟨 {categorised["Card"].length} Yellow
          </span>
        )}
        {(categorised["RedCard"] ?? []).length > 0 && (
          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-danger/10 text-danger border border-danger/20">
            🟥 {categorised["RedCard"].length} Red
          </span>
        )}
        {(categorised["subst"] ?? []).length > 0 && (
          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-surface text-muted border border-border/30">
            🔄 {categorised["subst"].length} Subs
          </span>
        )}
      </div>

      <div className="space-y-2">
        {events.map((e: any, i: number) => {
          const isHome = e.team?.id === home.id;
          const meta = TYPE_META[e.type] ?? { icon: "•", color: "text-muted" };
          const isGoal = e.type === "Goal";
          const isRed = e.type === "Card" && e.detail?.toLowerCase().includes("red");
          return (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isGoal ? "bg-success/5 border border-success/15" : "bg-surface/40"}`}>
              <span className="text-[11px] font-black text-muted w-8 text-right shrink-0">{e.time?.elapsed ?? "?"}&apos;</span>
              <span className={`text-base shrink-0 ${isRed ? "grayscale-0" : ""}`}>{isRed ? "🟥" : meta.icon}</span>
              <div className={`flex-1 text-[12px] ${isHome ? "" : "text-right"}`}>
                <span className={`font-bold ${isGoal ? "text-success" : "text-foreground"}`}>{e.player?.name}</span>
                {e.assist?.name && <span className="text-muted"> · {e.assist.name}</span>}
                {e.detail && <span className="text-muted text-[10px] block">{e.detail}</span>}
              </div>
              <span className="text-[10px] text-muted shrink-0">{isHome ? home.name?.split(" ").slice(-1) : away.name?.split(" ").slice(-1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PredictionCard({ prediction, home, away }: any) {
  const pred = prediction?.predictions;
  const probabilities = normalizeOutcomePercentages(pred?.percent);
  const homeWin = probabilities.home;
  const draw = probabilities.draw;
  const awayWin = probabilities.away;
  const winner = pred?.winner?.name || inferPredictedWinner(probabilities, home, away);
  const advice = pred?.advice;
  const goals = pred?.goals;
  const homeGoals = formatExpectedGoals(goals?.home);
  const awayGoals = formatExpectedGoals(goals?.away);
  const comparison = prediction?.comparison;

  return (
    <div className="glass p-5 rounded-2xl space-y-5">
      <h2 className="text-[12px] font-black text-muted uppercase tracking-widest">AI Prediction</h2>

      {advice && (
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
          <p className="text-sm font-bold text-accent">{advice}</p>
        </div>
      )}

      {(homeWin || draw || awayWin) ? (
        <div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Win Probability</p>
          <div className="flex h-5 rounded-full overflow-hidden border border-border/30 bg-surface">
            <div className="bg-success transition-all" style={{ width: `${homeWin}%` }} />
            <div className="bg-muted/50 transition-all border-x border-background/20" style={{ width: `${draw}%` }} />
            <div className="bg-danger transition-all" style={{ width: `${awayWin}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] font-black">
            <span className="text-success">{home} {homeWin}%</span>
            <span className="text-muted">Draw {draw}%</span>
            <span className="text-danger">{awayWin}% {away}</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {winner && (
          <StatPill label="Predicted Winner" value={winner} accent />
        )}
        {homeGoals != null && <StatPill label={`${home} Goals`} value={homeGoals} />}
        {awayGoals != null && <StatPill label={`${away} Goals`} value={awayGoals} />}
      </div>

      {comparison && (
        <div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Team Comparison</p>
          <div className="space-y-2">
            {Object.entries(comparison).map(([key, val]: [string, any]) => {
              const homeVal = parseFloat(val.home ?? "0");
              const awayVal = parseFloat(val.away ?? "0");
              const total = homeVal + awayVal || 1;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[10px] font-black mb-0.5">
                    <span className="text-success">{val.home}</span>
                    <span className="text-muted capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-danger">{val.away}</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-surface border border-border/20">
                    <div className="bg-success/70" style={{ width: `${(homeVal / total) * 100}%` }} />
                    <div className="bg-danger/70" style={{ width: `${(awayVal / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InjuriesCard({ injuries }: any) {
  return (
    <div className="glass p-5 rounded-2xl">
      <h2 className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">Injury Report ({injuries.length})</h2>
      <div className="space-y-2">
        {injuries.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-surface/60 border border-border/30 rounded-xl">
            {entry.player?.photo && <img src={entry.player.photo} className="w-8 h-8 rounded-full object-cover" alt="" />}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-foreground">{entry.player?.name}</p>
              <p className="text-[10px] text-muted">{entry.team?.name}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-danger/10 text-danger border border-danger/20">{entry.player?.reason ?? "Injured"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── H2H Tab ───────────────────────────────────────────────────────────────────

function H2HTab() {
  const [sport, setSport] = useState("Football");
  const [teamAQuery, setTeamAQuery] = useState("");
  const [teamBQuery, setTeamBQuery] = useState("");
  const [teamA, setTeamA] = useState<any>(null);
  const [teamB, setTeamB] = useState<any>(null);
  const [suggestionsA, setSuggestionsA] = useState<any[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useTeamSearch(teamAQuery, teamA, sport, setSuggestionsA);
  useTeamSearch(teamBQuery, teamB, sport, setSuggestionsB);

  const h2hData = fixtures ? computeComparison(fixtures, teamA, teamB) : null;
  const statsRows = h2hData ? [
    { label: "H2H Wins", home: `${h2hData.wins}`, away: `${h2hData.losses}` },
    { label: "Draws", home: `${h2hData.draws}` },
    { label: "Goals Scored", home: `${h2hData.teamA.goals}`, away: `${h2hData.teamB.goals}` },
    { label: "Avg Goals/Game", home: `${h2hData.teamA.avgGoals}`, away: `${h2hData.teamB.avgGoals}` },
    { label: "Recent Form", home: h2hData.teamA.form.join(" ") || "N/A", away: h2hData.teamB.form.join(" ") || "N/A" },
  ] : [];

  async function compare() {
    if (!teamA || !teamB) return;
    setLoading(true);
    setError("");
    setFixtures(null);
    try {
      const res = await fetch(`${BASE}/api/h2h?team1=${teamA.id}&team2=${teamB.id}&last=15&sport=${sport.toLowerCase()}`, withAuth());
      if (!res.ok) throw new Error("Could not fetch H2H data.");
      const { data } = await res.json();
      setFixtures(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Could not fetch H2H data.");
    } finally {
      setLoading(false);
    }
  }

  function resetSport(s: string) {
    setSport(s); setTeamA(null); setTeamB(null);
    setTeamAQuery(""); setTeamBQuery("");
    setFixtures(null); setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex p-1.5 bg-surface/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-inner overflow-x-auto no-scrollbar gap-1 mb-2">
        {SPORT_OPTIONS.map(s => (
          <button key={s} onClick={() => resetSport(s)}
            className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[12px] font-bold transition-all relative ${sport === s ? "text-white" : "text-muted hover:text-foreground"}`}>
            {sport === s && <div className="absolute inset-0 bg-accent rounded-xl -z-10" />}
            {s}
          </button>
        ))}
      </div>

      <div className="glass p-6 rounded-3xl space-y-5">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <TeamPicker label="Team A" query={teamAQuery} setQuery={(v: string) => { setTeamAQuery(v); setTeamA(null); setFixtures(null); }}
            selected={teamA} setSelected={(t: any) => { setTeamA(t); setTeamAQuery(t.name); setSuggestionsA([]); setFixtures(null); }} suggestions={suggestionsA} />
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border/60 text-muted font-black text-xs shrink-0 mt-6 md:mt-7">VS</div>
          <TeamPicker label="Team B" query={teamBQuery} setQuery={(v: string) => { setTeamBQuery(v); setTeamB(null); setFixtures(null); }}
            selected={teamB} setSelected={(t: any) => { setTeamB(t); setTeamBQuery(t.name); setSuggestionsB([]); setFixtures(null); }} suggestions={suggestionsB} />
        </div>
        <button disabled={!teamA || !teamB || loading} onClick={compare}
          className="btn-gradient w-full py-4 rounded-2xl disabled:opacity-50 text-[15px] font-black tracking-wide">
          {loading ? "Comparing..." : "Compare →"}
        </button>
      </div>

      {error && <div className="card-premium p-4 text-danger text-sm font-bold">{error}</div>}

      {h2hData ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass p-6 rounded-3xl">
            <h3 className="text-[12px] font-black text-muted uppercase tracking-widest mb-5">{teamA.name} vs {teamB.name} · Last {h2hData.total} Meetings</h3>
            <div className="flex items-center gap-4">
              <SummarySide team={teamA.name} value={h2hData.wins} tone="success" />
              <div className="flex-1 px-2 md:px-6">
                <div className="flex h-5 rounded-full overflow-hidden shadow-inner border border-border/40 bg-surface">
                  <div className="bg-success transition-all duration-1000" style={{ width: `${h2hData.winPct}%` }} />
                  <div className="bg-muted transition-all duration-1000 border-x border-background/20" style={{ width: `${h2hData.drawPct}%` }} />
                  <div className="bg-danger transition-all duration-1000" style={{ width: `${h2hData.lossPct}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-wider text-muted">
                  <span className="text-success">{h2hData.winPct}%</span>
                  <span>{h2hData.draws} draws ({h2hData.drawPct}%)</span>
                  <span className="text-danger">{h2hData.lossPct}%</span>
                </div>
              </div>
              <SummarySide team={teamB.name} value={h2hData.losses} tone="danger" />
            </div>
          </div>

          <div className="glass p-6 rounded-3xl">
            <h3 className="text-[12px] font-black text-muted uppercase tracking-widest mb-5">Key Stats</h3>
            <div className="flex items-center justify-between mb-4 px-4">
              <span className="font-black text-foreground">{teamA.name}</span>
              <span className="font-black text-foreground">{teamB.name}</span>
            </div>
            <div className="bg-surface/50 rounded-2xl overflow-hidden border border-border/50">
              <StatsTable rows={statsRows} />
            </div>
          </div>

          <div className="glass p-6 rounded-3xl">
            <h3 className="text-[12px] font-black text-muted uppercase tracking-widest mb-5">Recent Meetings</h3>
            <div className="space-y-2">
              {h2hData.lastMeetings.map((m: any, i: number) => (
                <div key={`${m.date}-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-surface/80 border border-border/50 rounded-2xl">
                  <span className="text-[11px] font-bold text-muted w-28 shrink-0">{m.date ? new Date(m.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "Recent"}</span>
                  <span className="flex-1 text-center font-black text-foreground text-lg">{m.result}</span>
                  <span className={`text-[11px] font-black px-3 py-1 rounded-lg w-full sm:w-auto text-center border ${
                    m.winner === "teamA" ? "bg-success/10 text-success border-success/20" :
                    m.winner === "teamB" ? "bg-danger/10 text-danger border-danger/20" :
                    "bg-surface-hover text-muted border-border"
                  }`}>
                    {m.winner === "teamA" ? teamA.name : m.winner === "teamB" ? teamB.name : "Draw"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <FormCard team={teamA.name} form={h2hData.teamA.form} avgGoals={h2hData.teamA.avgGoals} />
            <FormCard team={teamB.name} form={h2hData.teamB.form} avgGoals={h2hData.teamB.avgGoals} />
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-bold">Select two teams to compare head-to-head stats</p>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function parsePercent(value: any) {
  if (value == null || value === "") return 0;
  const numeric = Number(String(value).replace("%", "").trim());
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeOutcomePercentages(percent: any = {}) {
  const values = [parsePercent(percent.home), parsePercent(percent.draw), parsePercent(percent.away)];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { home: 0, draw: 0, away: 0 };

  const rounded = values.map(value => Math.round((value / total) * 100));
  const diff = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const largestIndex = rounded.indexOf(Math.max(...rounded));
  rounded[largestIndex] += diff;
  return { home: rounded[0], draw: rounded[1], away: rounded[2] };
}

function inferPredictedWinner(probabilities: { home: number; draw: number; away: number }, home: string, away: string) {
  const { home: homeWin, draw, away: awayWin } = probabilities;
  if (!homeWin && !draw && !awayWin) return null;
  const max = Math.max(homeWin, draw, awayWin);
  if (max === draw) return "Draw";
  return max === homeWin ? home : away;
}

function formatExpectedGoals(value: any) {
  if (value == null || value === "") return null;
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(Math.max(0, numeric) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function StatPill({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="p-3 bg-surface/60 border border-border/30 rounded-xl text-center">
      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-base font-black ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-surface/60 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-muted">
      <p className="text-3xl mb-2">📊</p>
      <p className="font-bold text-sm">{text}</p>
    </div>
  );
}

function ApiError({ message }: { message: string }) {
  const isPlanLimit = message.toLowerCase().includes("free plan") || message.toLowerCase().includes("season");
  return (
    <div className="py-8 text-center space-y-2">
      <p className="text-2xl">{isPlanLimit ? "🔒" : "⚠️"}</p>
      <p className="font-bold text-sm text-danger">{message}</p>
      {isPlanLimit && (
        <p className="text-[11px] text-muted">
          This season isn&apos;t available on the free API plan.{" "}
          <span className="text-accent">Try 2022, 2023 or 2024.</span>
        </p>
      )}
    </div>
  );
}

function TeamPicker({ label, query, setQuery, selected, setSelected, suggestions }: any) {
  return (
    <div className="w-full relative">
      <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5">{label}</label>
      <input
        className="w-full px-4 py-3.5 rounded-2xl bg-surface/80 border border-border/50 text-foreground text-sm font-bold outline-none focus:border-accent focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        placeholder={`Search ${label.toLowerCase()}...`}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1.5 bg-surface/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium overflow-hidden p-1">
          {suggestions.map((t: any) => (
            <button key={t.id} className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 hover:text-accent rounded-xl transition-colors" onClick={() => setSelected(t)}>
              <span className="font-black text-[13px]">{t.name}</span>
              {t.country && <span className="block text-[10px] font-bold text-muted uppercase">{t.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummarySide({ team, value, tone }: any) {
  return (
    <div className={`shrink-0 w-20 ${tone === "success" ? "text-right" : "text-left"}`}>
      <p className={`text-4xl font-black ${tone === "success" ? "text-success" : "text-danger"}`}>{value}</p>
      <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5">Wins</p>
    </div>
  );
}

function FormCard({ team, form, avgGoals }: any) {
  return (
    <div className="glass p-5 rounded-2xl">
      <p className="text-[12px] font-black text-muted uppercase tracking-widest mb-4">{team} Form</p>
      <div className="flex items-center gap-2 mb-4">
        {(form.length ? form : ["D"]).map((r: string, i: number) => (
          <div key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border-2 ${
            r === "W" ? "bg-success/10 text-success border-success/20" :
            r === "L" ? "bg-danger/10 text-danger border-danger/20" :
            "bg-surface text-muted border-border"
          }`}>{r}</div>
        ))}
      </div>
      <div className="flex items-center gap-4 p-3 bg-surface/50 rounded-xl border border-border/50">
        <div>
          <p className="text-xl font-black text-foreground">{avgGoals}</p>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Avg goals</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-xl font-black text-success">{form.filter((r: string) => r === "W").length}</p>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Recent wins</p>
        </div>
      </div>
    </div>
  );
}

function useTeamSearch(query: string, selected: any, sport: string, setSuggestions: (v: any[]) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selected || query.trim().length < 2) { setSuggestions([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/teams/search?name=${encodeURIComponent(query.trim())}&sport=${sport.toLowerCase()}`);
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, selected, sport, setSuggestions]);
}

function computeComparison(fixtures: any[], teamA: any, teamB: any) {
  const played = fixtures
    .filter(f => f.goals?.home != null && f.goals?.away != null)
    .sort((a, b) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime());

  let wins = 0, losses = 0, draws = 0, teamAGoals = 0, teamBGoals = 0;
  const formA: string[] = [], formB: string[] = [];

  const lastMeetings = played.slice(0, 10).map(f => {
    const aIsHome = f.teams?.home?.id === teamA.id;
    const aScore = aIsHome ? f.goals.home : f.goals.away;
    const bScore = aIsHome ? f.goals.away : f.goals.home;
    teamAGoals += aScore; teamBGoals += bScore;
    const winner = aScore > bScore ? "teamA" : bScore > aScore ? "teamB" : "draw";
    if (winner === "teamA") { wins++; formA.push("W"); formB.push("L"); }
    else if (winner === "teamB") { losses++; formA.push("L"); formB.push("W"); }
    else { draws++; formA.push("D"); formB.push("D"); }
    return { date: f.fixture?.date, result: `${aScore}-${bScore}`, winner };
  });

  const total = wins + losses + draws;
  const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
  return {
    wins, losses, draws, total,
    winPct: pct(wins), lossPct: pct(losses), drawPct: pct(draws),
    teamA: { goals: teamAGoals, form: formA.slice(0, 5), avgGoals: total ? (teamAGoals / total).toFixed(1) : "0.0" },
    teamB: { goals: teamBGoals, form: formB.slice(0, 5), avgGoals: total ? (teamBGoals / total).toFixed(1) : "0.0" },
    lastMeetings,
  };
}
