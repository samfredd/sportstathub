"use client";

import { useEffect, useMemo, useState } from "react";
import { standingToRank } from "@/lib/transforms";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LEAGUES = [
  { id: 39,  name: "Premier League",   country: "England",  flag: "ENG" },
  { id: 140, name: "La Liga",          country: "Spain",    flag: "ESP" },
  { id: 135, name: "Serie A",          country: "Italy",    flag: "ITA" },
  { id: 78,  name: "Bundesliga",       country: "Germany",  flag: "GER" },
  { id: 61,  name: "Ligue 1",          country: "France",   flag: "FRA" },
  { id: 2,   name: "Champions League", country: "Europe",   flag: "UCL" },
];

const STAT_METRIC_GROUPS = [
  {
    title: "Scoring",
    metrics: [
      { id: "goals", label: "Goals", forTotalKey: "goalsFor", againstTotalKey: "goalsAgainst" },
      { id: "goalDiff", label: "Goal Difference", totalKey: "goalDiff", signed: true },
    ],
  },
  {
    title: "Table Form",
    metrics: [
      { id: "points", label: "Points", totalKey: "points" },
      { id: "wins", label: "Wins", totalKey: "wins" },
      { id: "draws", label: "Draws", totalKey: "draws" },
      { id: "losses", label: "Losses", totalKey: "losses" },
    ],
  },
  {
    title: "Defending",
    metrics: [
      { id: "cleanSheets", label: "Clean Sheets", totalKey: "cleanSheets" },
      { id: "failedToScore", label: "Failed To Score", totalKey: "failedToScore" },
    ],
  },
  {
    title: "Discipline",
    metrics: [
      { id: "yellowCards", label: "Yellow Cards", totalKey: "yellowCards", denominatorKey: "seasonPlayed" },
      { id: "redCards", label: "Red Cards", totalKey: "redCards", denominatorKey: "seasonPlayed" },
    ],
  },
];

const LAST_GAME_OPTIONS = [
  { id: "5", label: "5" },
  { id: "10", label: "10" },
  { id: "20", label: "20" },
  { id: "season", label: "Season" },
];

const STAT_METRICS = (STAT_METRIC_GROUPS as any[]).flatMap((group: any) => group.metrics) as any[];

function currentSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function extractStandings(data) {
  const groups = data?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return [];
  return groups.flat().map(standingToRank);
}

function extractRawStandings(data) {
  const groups = data?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return [];
  return groups.flat();
}

function providerSeason() {
  return String(currentSeason());
}

function statSeasonOptions() {
  const latest = Number(providerSeason());
  return [latest, latest - 1, latest - 2].map(String);
}

function fetchApiData(path, signal) {
  return fetch(`${BASE}${path}`, { signal }).then((response) => {
    if (!response.ok) throw new Error("Football data unavailable");
    return response.json();
  }).then((payload) => payload.data);
}

function numeric(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sumCardBuckets(buckets) {
  if (!buckets || typeof buckets !== "object") return 0;
  return Object.values(buckets as Record<string, any>).reduce((sum: number, bucket: any) => sum + numeric(bucket?.total), 0);
}

function getMetricConfig(metricId) {
  return STAT_METRICS.find((metric) => metric.id === metricId) ?? STAT_METRICS[0];
}

function getMetricLabel(metricId) {
  return getMetricConfig(metricId).label ?? metricId;
}

function isSeasonOnlyMetric(metricId) {
  return metricId === "yellowCards" || metricId === "redCards";
}

function formatAverage(value) {
  return numeric(value).toFixed(Math.abs(numeric(value)) >= 10 ? 1 : 2);
}

function formatTotal(value, signed = false) {
  const rounded = Math.round(numeric(value));
  return signed && rounded > 0 ? `+${rounded}` : rounded;
}

function buildSeasonStatRow(standing, leagueCountry, teamStats) {
  const all = standing?.all ?? {};
  const played = numeric(all.played);
  const wins = numeric(all.win);
  const draws = numeric(all.draw);
  const losses = numeric(all.lose);
  const goalsFor = numeric(all.goals?.for);
  const goalsAgainst = numeric(all.goals?.against);

  return {
    teamId: standing?.team?.id,
    team: standing?.team?.name ?? "Unknown team",
    logo: standing?.team?.logo ?? "",
    country: leagueCountry,
    played,
    seasonPlayed: played,
    wins,
    draws,
    losses,
    points: numeric(standing?.points),
    goalDiff: numeric(standing?.goalsDiff, goalsFor - goalsAgainst),
    goalsFor,
    goalsAgainst,
    cleanSheets: numeric(teamStats?.clean_sheet?.total),
    failedToScore: numeric(teamStats?.failed_to_score?.total),
    yellowCards: sumCardBuckets(teamStats?.cards?.yellow),
    redCards: sumCardBuckets(teamStats?.cards?.red),
  };
}

function buildFixtureTotals(baseRow, fixtures) {
  const totals = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    failedToScore: 0,
  };

  for (const fixture of fixtures ?? []) {
    const homeId = numeric(fixture?.teams?.home?.id, null);
    const awayId = numeric(fixture?.teams?.away?.id, null);
    const homeGoals = numeric(fixture?.goals?.home, null);
    const awayGoals = numeric(fixture?.goals?.away, null);
    if (homeGoals === null || awayGoals === null) continue;

    const isHome = homeId === baseRow.teamId;
    const isAway = awayId === baseRow.teamId;
    if (!isHome && !isAway) continue;

    const goalsFor = isHome ? homeGoals : awayGoals;
    const goalsAgainst = isHome ? awayGoals : homeGoals;
    totals.played += 1;
    totals.goalsFor += goalsFor;
    totals.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) totals.wins += 1;
    if (goalsFor === goalsAgainst) totals.draws += 1;
    if (goalsFor < goalsAgainst) totals.losses += 1;
    if (goalsAgainst === 0) totals.cleanSheets += 1;
    if (goalsFor === 0) totals.failedToScore += 1;
  }

  return {
    ...baseRow,
    ...totals,
    points: totals.wins * 3 + totals.draws,
    goalDiff: totals.goalsFor - totals.goalsAgainst,
  };
}

function metricTotalKey(metric, direction) {
  if (direction === "against" && metric.againstTotalKey) return metric.againstTotalKey;
  return metric.forTotalKey ?? metric.totalKey;
}

function statValueForRow(row, metric, direction) {
  const key = metricTotalKey(metric, direction);
  const total = numeric(row?.[key]);
  const played = Math.max(1, numeric(row?.[metric.denominatorKey] ?? row?.played, 1));
  return {
    value: total / played,
    total,
  };
}

export default function RankingsPage() {
  const [activeLeagueId, setActiveLeagueId] = useState(LEAGUES[0].id);
  const [season, setSeason] = useState(currentSeason);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("standings");
  const [statMetric, setStatMetric] = useState("goals");
  const [statDirection, setStatDirection] = useState("for");
  const [lastGames, setLastGames] = useState("season");
  const [statCountry, setStatCountry] = useState("All Countries");
  const [statLeagueId, setStatLeagueId] = useState(String(LEAGUES[0].id));
  const [statSeason, setStatSeason] = useState(providerSeason);
  const [statRows, setStatRows] = useState<any[]>([]);
  const [statLoading, setStatLoading] = useState(false);
  const [statError, setStatError] = useState("");

  const league = LEAGUES.find((l) => l.id === activeLeagueId) ?? LEAGUES[0];

  useEffect(() => {
    if (mode !== "standings") return;

    const ctrl = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError("");
    });

    fetch(`${BASE}/api/leagues/${activeLeagueId}/standings?season=${season}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Standings unavailable");
        return r.json();
      })
      .then(({ data }) => {
        if (!ctrl.signal.aborted) setRows(extractStandings(data));
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setRows([]);
          setError("Standings are unavailable for this league and season.");
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [activeLeagueId, season, mode]);

  useEffect(() => {
    if (mode !== "stats") return;

    const ctrl = new AbortController();
    const leagueId = Number(statLeagueId) || activeLeagueId;
    const selectedLeague = LEAGUES.find((item) => item.id === leagueId) ?? LEAGUES[0];
    const selectedSeason = Number(statSeason) || Number(providerSeason());

    async function loadStatRows() {
      setStatLoading(true);
      setStatError("");

      try {
        const standingsData = await fetchApiData(`/api/leagues/${leagueId}/standings?season=${selectedSeason}`, ctrl.signal);
        const rawStandings = extractRawStandings(standingsData);

        if (rawStandings.length === 0) {
          setStatRows([]);
          setStatError("No real ranking data is available for this league and season.");
          return;
        }

        const teams = rawStandings.filter((standing) => standing?.team?.id);
        const needsTeamStats =
          statMetric === "yellowCards" ||
          statMetric === "redCards" ||
          (lastGames === "season" && (statMetric === "cleanSheets" || statMetric === "failedToScore"));
        const statResults = needsTeamStats
          ? await Promise.allSettled(
              teams.map((standing) =>
                fetchApiData(`/api/teams/${standing.team.id}/statistics?league=${leagueId}&season=${selectedSeason}`, ctrl.signal)
              )
            )
          : [];

        if (needsTeamStats && statResults.every((result) => result.status === "rejected")) {
          setStatRows([]);
          setStatError("Team statistics are unavailable from the provider right now.");
          return;
        }

        let nextRows = teams.map((standing, index) => {
          const stats = statResults[index]?.status === "fulfilled" ? statResults[index].value : null;
          return buildSeasonStatRow(standing, selectedLeague.country, stats);
        });

        if (lastGames !== "season" && !isSeasonOnlyMetric(statMetric)) {
          const fixtureResults = await Promise.allSettled(
            nextRows.map((row) =>
              fetchApiData(`/api/teams/${row.teamId}/fixtures?last=${lastGames}&league=${leagueId}&season=${selectedSeason}`, ctrl.signal)
            )
          );
          const hasFixtureData = fixtureResults.some((result) => result.status === "fulfilled" && Array.isArray(result.value) && result.value.length > 0);

          if (!hasFixtureData) {
            setStatRows([]);
            setStatError("Recent fixture rankings are unavailable from the provider right now. Season rankings may still be available.");
            return;
          }

          nextRows = nextRows.map((row, index) => {
            const fixtures = fixtureResults[index]?.status === "fulfilled" ? fixtureResults[index].value : [];
            return buildFixtureTotals(row, fixtures);
          });
        }

        if (!ctrl.signal.aborted) setStatRows(nextRows);
      } catch (err) {
        if (err.name !== "AbortError") {
          setStatRows([]);
          setStatError("Live ranking data is unavailable right now.");
        }
      } finally {
        if (!ctrl.signal.aborted) setStatLoading(false);
      }
    }

    loadStatRows();
    return () => ctrl.abort();
  }, [activeLeagueId, lastGames, mode, statLeagueId, statMetric, statSeason]);

  return (
    <div className="px-4 lg:px-6 py-10">
        <div className="flex gap-6">
          <aside className="hidden lg:flex flex-col w-56 shrink-0 gap-3">
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] px-2 mb-1">Competitions</p>
            {LEAGUES.map((lg) => (
              <LeagueButton
                key={lg.id}
                league={lg}
                active={lg.id === activeLeagueId}
                onClick={() => {
                  setActiveLeagueId(lg.id);
                  if (mode === "stats") {
                    setStatLeagueId(String(lg.id));
                    setStatCountry("All Countries");
                  }
                }}
              />
            ))}
          </aside>

          <main className="flex-1 min-w-0 flex flex-col gap-6">
            <div className="flex p-1.5 bg-surface/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-inner overflow-x-auto no-scrollbar gap-1">
              <ModeButton active={mode === "standings"} onClick={() => setMode("standings")}>
                Standings
              </ModeButton>
              <ModeButton active={mode === "stats"} onClick={() => setMode("stats")}>
                Stat Categories
              </ModeButton>
            </div>

            {mode === "standings" ? (
              <>
                <div className="relative rounded-3xl overflow-hidden h-36 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-800">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,135,90,0.25),transparent_65%)]" />
                  <div className="relative h-full flex items-center justify-between px-6 sm:px-8 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-black text-white/80 border border-white/30 rounded-lg px-2 py-1">{league.flag}</span>
                        <div className="min-w-0">
                          <h1 className="text-2xl font-black text-white tracking-tight leading-none truncate">{league.name}</h1>
                          <p className="text-white/65 text-sm font-medium mt-1">{league.country} standings</p>
                        </div>
                      </div>
                    </div>
                    <label className="shrink-0">
                      <span className="block text-[10px] text-white/70 font-black uppercase tracking-widest mb-1">Season</span>
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={season}
                        onChange={(e) => setSeason(Number(e.target.value))}
                        className="w-24 bg-white/10 border border-white/25 text-white rounded-xl px-3 py-4 text-sm font-black outline-none focus:border-white/60"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar pb-1">
                  {LEAGUES.map((lg) => (
                    <button
                      key={lg.id}
                      type="button"
                      onClick={() => setActiveLeagueId(lg.id)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                        activeLeagueId === lg.id
                          ? "bg-accent text-white border-accent"
                          : "glass text-muted border-border/40"
                      }`}
                    >
                      {lg.name}
                    </button>
                  ))}
                </div>

                <StandingsTable rows={rows} loading={loading} error={error} leagueName={league.name} />
              </>
            ) : (
              <StatCategoriesPanel
                activeLeagueId={activeLeagueId}
                setActiveLeagueId={setActiveLeagueId}
                statMetric={statMetric}
                setStatMetric={setStatMetric}
                statDirection={statDirection}
                setStatDirection={setStatDirection}
                lastGames={lastGames}
                setLastGames={setLastGames}
                statCountry={statCountry}
                setStatCountry={setStatCountry}
                statLeagueId={statLeagueId}
                setStatLeagueId={setStatLeagueId}
                statSeason={statSeason}
                setStatSeason={setStatSeason}
                statRows={statRows}
                statLoading={statLoading}
                statError={statError}
              />
            )}
          </main>
        </div>
      </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-[140px] py-3 rounded-xl text-[13px] font-black transition-all duration-200 ${
        active ? "bg-accent text-white shadow-premium" : "text-muted hover:text-foreground hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}

function StatCategoriesPanel({
  activeLeagueId,
  setActiveLeagueId,
  statMetric,
  setStatMetric,
  statDirection,
  setStatDirection,
  lastGames,
  setLastGames,
  statCountry,
  setStatCountry,
  statLeagueId,
  setStatLeagueId,
  statSeason,
  setStatSeason,
  statRows,
  statLoading,
  statError,
}) {
  const countries = ["All Countries", ...Array.from(new Set(statRows.map((team) => team.country))).sort()] as string[];
  const seasonOptions = statSeasonOptions();
  const filteredTeams = useMemo(() => {
    return statRows.filter((team) => {
      const countryMatch = statCountry === "All Countries" || team.country === statCountry;
      return countryMatch;
    });
  }, [statCountry, statRows]);

  const rankingRows = useMemo(() => {
    const metric = getMetricConfig(statMetric);
    return filteredTeams
      .map((team) => {
        const values = statValueForRow(team, metric, statDirection);
        return { ...team, ...values };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredTeams, statDirection, statMetric]);

  return (
    <section className="flex flex-col gap-5">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-surface via-accent/10 to-accent/20 border border-border/40 p-6 sm:p-8">
        <div className="relative">
          <h1 className="text-3xl font-black text-foreground tracking-tight leading-none">Rankings</h1>
          <p className="text-muted text-sm font-medium mt-3 max-w-2xl">Compare live team leaders using standings, team statistics, and recent fixtures from the football data provider.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-2xl border border-border/40 glass p-1">
        <button
          type="button"
          onClick={() => setStatDirection("for")}
          className={`rounded-xl py-3 text-sm font-black transition-all ${statDirection === "for" ? "bg-accent text-white shadow-premium" : "text-muted hover:text-foreground"}`}
        >
          Most (For)
        </button>
        <button
          type="button"
          onClick={() => setStatDirection("against")}
          className={`rounded-xl py-3 text-sm font-black transition-all ${statDirection === "against" ? "bg-accent text-white shadow-premium" : "text-muted hover:text-foreground"}`}
        >
          Most Conceded (Against)
        </button>
      </div>

      <div className="glass rounded-3xl border border-border/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Last Games:</span>
          <div className="flex rounded-2xl bg-surface/70 border border-border/40 p-1 overflow-x-auto no-scrollbar">
            {LAST_GAME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLastGames(option.id)}
                className={`min-w-14 rounded-xl px-3 py-2 text-sm font-black transition-all ${lastGames === option.id ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 mt-4 md:grid-cols-3">
          <FilterSelect label="Country" value={statCountry} onChange={setStatCountry}>
            {countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </FilterSelect>
          <FilterSelect
            label="League"
            value={statLeagueId}
            onChange={(value) => {
              setStatLeagueId(value);
              setActiveLeagueId(Number(value));
              setStatCountry("All Countries");
            }}
          >
            {LEAGUES.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Season" value={statSeason} onChange={setStatSeason}>
            {seasonOptions.map((seasonOption) => (
              <option key={seasonOption} value={seasonOption}>{seasonOption}</option>
            ))}
          </FilterSelect>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <MetricSidebar activeMetric={statMetric} onChange={setStatMetric} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-accent">{statDirection === "for" ? "Most (For)" : "Most Conceded"}</p>
            <p className="text-sm font-black text-foreground">{getMetricLabel(statMetric)}</p>
            <p className="text-sm font-semibold text-muted">- {lastGames === "season" || isSeasonOnlyMetric(statMetric) ? "Season totals" : `${LAST_GAME_OPTIONS.find((option) => option.id === lastGames)?.label} last games`}</p>
          </div>
          <StatRankTable rows={rankingRows} metric={statMetric} loading={statLoading} error={statError} />
        </div>
      </div>

      <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar pb-1">
        {LEAGUES.map((lg) => (
          <button
            key={lg.id}
            type="button"
            onClick={() => {
              setActiveLeagueId(lg.id);
              setStatLeagueId(String(lg.id));
              setStatCountry("All Countries");
            }}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all border ${
              activeLeagueId === lg.id
                ? "bg-accent text-white border-accent"
                : "glass text-muted border-border/40"
            }`}
          >
            {lg.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function MetricSidebar({ activeMetric, onChange }) {
  return (
    <aside className="glass rounded-3xl border border-border/30 p-4">
      <div className="max-h-[620px] overflow-y-auto no-scrollbar pr-1 space-y-5">
        {STAT_METRIC_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] px-2 mb-2">{group.title}</p>
            <div className="space-y-1">
              {group.metrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => onChange(metric.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-black transition-all ${
                    activeMetric === metric.id
                      ? "bg-accent text-white shadow-premium"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function StatRankTable({ rows, metric, loading, error }) {
  const metricConfig = getMetricConfig(metric);

  if (loading) {
    return (
      <div className="glass rounded-3xl border border-border/30 flex flex-col items-center justify-center py-20 px-4 text-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-muted text-sm font-bold">Fetching live rankings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-3xl border border-border/30 flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="text-foreground font-black text-base">No live rankings</p>
        <p className="text-muted text-sm mt-1 max-w-sm">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass rounded-3xl border border-border/30 flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="text-foreground font-black text-base">No teams match these filters</p>
        <p className="text-muted text-sm mt-1 max-w-sm">Try another league, season, or country filter.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl border border-border/30 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[54px_minmax(230px,1fr)_120px_90px] gap-3 px-4 py-4 bg-surface text-[10px] text-muted font-black uppercase tracking-widest">
            <span>#</span>
            <span>Team</span>
            <span className="text-right">Avg/Game</span>
            <span className="text-right">Total</span>
          </div>
          {rows.map((row, index) => (
            <div key={`${row.team}-${metric}`} className="grid grid-cols-[54px_minmax(230px,1fr)_120px_90px] gap-3 items-center px-4 py-4 border-t border-border/30 hover:bg-surface-hover/50 transition-colors">
              <span className={`text-sm font-black tabular-nums ${index === 0 ? "text-accent-gold" : "text-muted"}`}>{index + 1}</span>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-surface border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
                  {row.logo
                    ? <img src={row.logo} alt="" className="w-7 h-7 object-contain" />
                    : <span className="text-[10px] font-black text-muted">{row.team.slice(0, 2).toUpperCase()}</span>}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">{row.team}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{row.country}</p>
                </div>
              </div>
              <span className="text-right text-base font-black text-foreground tabular-nums">{formatAverage(row.value)}</span>
              <span className="text-right text-sm font-black text-muted tabular-nums">{formatTotal(row.total, metricConfig.signed)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border/50 bg-surface px-3 py-4 text-sm font-black text-foreground outline-none transition-all focus:border-accent"
      >
        {children}
      </select>
    </label>
  );
}

function LeagueButton({ league, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 border overflow-hidden ${
        active
          ? "border-accent/30 bg-accent/10 shadow-lg shadow-accent/5"
          : "border-border/30 hover:border-border/60 glass hover:bg-surface-hover"
      }`}
    >
      {active && <div className="absolute left-0 top-0 h-full w-0.5 bg-accent rounded-r-full" />}
      <span className="text-[10px] font-black text-muted border border-border/50 rounded-md px-1.5 py-1 shrink-0">{league.flag}</span>
      <div className="min-w-0">
        <div className={`text-sm font-black truncate leading-tight ${active ? "text-accent" : "text-foreground"}`}>
          {league.name}
        </div>
        <div className="text-[10px] text-muted font-bold uppercase tracking-wide">{league.country}</div>
      </div>
    </button>
  );
}

function StandingsTable({ rows, loading, error, leagueName }) {
  if (loading) {
    return (
      <div className="glass rounded-3xl border border-border/30 flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-muted text-sm font-bold">Fetching standings...</p>
      </div>
    );
  }

  if (error || rows.length === 0) {
    return (
      <div className="glass rounded-3xl border border-border/30 flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center text-xl font-black border border-border/40">
          table
        </div>
        <div className="text-center">
          <p className="text-foreground font-black text-base">No standings</p>
          <p className="text-muted text-sm mt-1">{error || `No ${leagueName} table for this season.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl border border-border/30 overflow-hidden">
      <div className="grid grid-cols-[44px_minmax(170px,1fr)_repeat(5,54px)_70px] gap-2 px-4 py-3 bg-surface text-[10px] text-muted font-black uppercase tracking-widest overflow-x-auto min-w-[760px]">
        <span>#</span>
        <span>Club</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-right">Pts</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {rows.map((row) => (
            <div key={`${row.rank}-${row.team}`} className="grid grid-cols-[44px_minmax(170px,1fr)_repeat(5,54px)_70px] gap-2 items-center px-4 py-3 border-t border-border/30 hover:bg-surface-hover/50 transition-colors">
              <span className="text-sm font-black text-muted tabular-nums">{row.rank}</span>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-surface border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                  {row.logo
                    ? <img src={row.logo} alt="" className="w-6 h-6 object-contain" />
                    : <span className="text-[10px] font-black text-muted">{row.team.slice(0, 2).toUpperCase()}</span>}
                </div>
                <span className="text-sm font-black text-foreground truncate">{row.team}</span>
              </div>
              <Cell>{row.played}</Cell>
              <Cell>{row.won}</Cell>
              <Cell>{row.drawn}</Cell>
              <Cell>{row.lost}</Cell>
              <Cell value={row.goalDiff} signed />
              <span className="text-right text-base font-black text-accent tabular-nums">{row.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({ children = null, value = children, signed = false }) {
  const display = signed && Number(value) > 0 ? `+${value}` : value ?? children;
  return <span className="text-center text-sm font-bold text-foreground/80 tabular-nums">{display}</span>;
}
