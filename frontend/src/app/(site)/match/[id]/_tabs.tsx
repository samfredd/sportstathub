"use client";

import { useState, useRef, useEffect } from "react";
import type { MatchShape, ParsedMatchStats, H2HStats } from "@/lib/transforms";
import { withAuth } from "@/lib/authHeaders";
import PremiumGate from "@/components/PremiumGate";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormMatch {
  fixtureId: number;
  date: string;
  isHome: boolean;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  teamGoals: number;
  oppGoals: number;
  htTeamGoals: number | null;
  htOppGoals: number | null;
  result: "W" | "D" | "L";
  league: string;
}

export interface MatchTabsProps {
  match: MatchShape;
  matchId: string | number;
  matchStats: ParsedMatchStats | null;
  statsData: any;
  events: any[];
  momentum: any[];
  lineups: any[];
  homeLineup: any;
  awayLineup: any;
  signals: any[];
  model: { home: number; draw: number; away: number };
  h2hStats: H2HStats;
  trend: any;
  homeForm: FormMatch[];
  awayForm: FormMatch[];
  standings: any[];
  predictions: any;
  injuries: any[];
  hasStarted: boolean;
  isFinished: boolean;
  homePos?: number | null;
  awayPos?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "form",      label: "Last Matches" },
  { id: "h2h",       label: "H2H" },
  { id: "standings", label: "Standings" },
  { id: "analyse",   label: "Smart Analyse" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STAT_TYPES = [
  { id: "goals",      label: "Goals" },
  { id: "corners",    label: "Corners" },
  { id: "cards",      label: "Cards" },
  { id: "fouls",      label: "Fouls" },
  { id: "offsides",   label: "Offsides" },
  { id: "possession", label: "Possession" },
  { id: "xg",         label: "xG" },
  { id: "shots",      label: "Shots" },
  { id: "sot",        label: "Shots on Target" },
  { id: "saves",      label: "Saves" },
  { id: "tackles",    label: "Tackles" },
];

// Maps our stat type IDs to API-Football statistic type strings.
// "fouls" tries "Fouls" first; some leagues use "Total Fouls" — rawStatVal handles the fallback.
const STAT_API_KEY: Partial<Record<StatTypeId, string>> = {
  corners:    "Corner Kicks",
  fouls:      "Fouls",
  offsides:   "Offsides",
  possession: "Ball Possession",
  xg:         "Expected Goals",
  shots:      "Total Shots",
  sot:        "Shots on Goal",
  saves:      "Goalkeeper Saves",
  tackles:    "Tackles",
  // "cards"      → handled specially below (Yellow Cards + Red Cards)
  // "goals"      → from FormMatch.teamGoals / oppGoals (no stats fetch needed)
  // "possession" → percentage value ("55%"); special-cased in helpers
};

// Type for the raw stats array returned by /api/matches/:id/stats
type MatchStatsArr = Array<{ team?: { id?: number }; statistics: Array<{ type: string; value: string | number | null }> }>;

// Per-fixture stat cache: fixtureId → raw stats array
type StatsCache = Record<number, MatchStatsArr | null>;

type StatTypeId = (typeof STAT_TYPES)[number]["id"];

const LAST_N = [5, 10, 15, 20] as const;
type VenueFilter = "all" | "home" | "away";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function statValue(statsData: any, teamIndex: number, label: string) {
  const raw = statsData?.[teamIndex]?.statistics?.find((item: any) => item.type === label)?.value;
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  return Number.parseFloat(String(raw).replace("%", "")) || 0;
}

function statDisplay(statsData: any, teamIndex: number, label: string) {
  const raw = statsData?.[teamIndex]?.statistics?.find((item: any) => item.type === label)?.value;
  if (raw === null || raw === undefined) return "0";
  return String(raw);
}

function eventMinute(event: any) {
  return (event.time?.elapsed ?? 0) + (event.time?.extra ?? 0);
}

function eventIcon(type: string, detail?: string) {
  if (type === "Goal") return "G";
  if (type === "Card") return detail?.includes("Red") ? "R" : "Y";
  if (type === "subst") return "S";
  if (type === "Var") return "V";
  return "E";
}

function formation(lineup: any) {
  return lineup?.formation || "N/A";
}

function filterForm(form: FormMatch[], venue: VenueFilter, n: number) {
  let f = form;
  if (venue === "home") f = form.filter((m) => m.isHome);
  if (venue === "away") f = form.filter((m) => !m.isHome);
  return f.slice(0, n);
}

function formAvg(form: FormMatch[], key: "teamGoals" | "oppGoals"): string {
  if (!form.length) return "0.0";
  return (form.reduce((s, f) => s + f[key], 0) / form.length).toFixed(1);
}

function totalAvg(form: FormMatch[]): string {
  if (!form.length) return "0.0";
  return (form.reduce((s, f) => s + f.teamGoals + f.oppGoals, 0) / form.length).toFixed(1);
}

function wdl(form: FormMatch[]) {
  return {
    w: form.filter((f) => f.result === "W").length,
    d: form.filter((f) => f.result === "D").length,
    l: form.filter((f) => f.result === "L").length,
  };
}

// ─── Stat extraction helpers ──────────────────────────────────────────────────

function rawStatVal(statsArr: MatchStatsArr, idx: number, label: string, fallbackLabel?: string): number {
  let raw = statsArr[idx]?.statistics?.find(s => s.type === label)?.value;
  // Some leagues use a different key (e.g. "Total Fouls" vs "Fouls")
  if ((raw === null || raw === undefined) && fallbackLabel) {
    raw = statsArr[idx]?.statistics?.find(s => s.type === fallbackLabel)?.value;
  }
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  return parseFloat(String(raw).replace("%", "")) || 0;
}

/** Extract team & opponent values for the given stat type from a cached fixture stats array. */
function extractStat(
  statsArr: MatchStatsArr | null,
  isHome: boolean,
  statType: StatTypeId
): { team: number; opp: number } {
  if (!statsArr || statsArr.length < 2) return { team: 0, opp: 0 };
  const ti = isHome ? 0 : 1; // team index
  const oi = isHome ? 1 : 0; // opponent index

  if (statType === "goals") return { team: 0, opp: 0 }; // handled via FormMatch directly
  if (statType === "cards") {
    const teamCards = rawStatVal(statsArr, ti, "Yellow Cards") + rawStatVal(statsArr, ti, "Red Cards");
    const oppCards  = rawStatVal(statsArr, oi, "Yellow Cards") + rawStatVal(statsArr, oi, "Red Cards");
    return { team: teamCards, opp: oppCards };
  }
  if (statType === "fouls") {
    // API-Football uses "Fouls" in most leagues, "Total Fouls" in some
    return {
      team: rawStatVal(statsArr, ti, "Fouls", "Total Fouls"),
      opp:  rawStatVal(statsArr, oi, "Fouls", "Total Fouls"),
    };
  }
  if (statType === "possession") {
    // "Ball Possession" values are percentages like "55%" — strip % in rawStatVal
    return {
      team: rawStatVal(statsArr, ti, "Ball Possession"),
      opp:  rawStatVal(statsArr, oi, "Ball Possession"),
    };
  }
  const label = STAT_API_KEY[statType];
  if (!label) return { team: 0, opp: 0 };
  return { team: rawStatVal(statsArr, ti, label), opp: rawStatVal(statsArr, oi, label) };
}

/** Compute average {team, opp, total} stat for a set of form matches using the cache. */
function computeStatAvgs(
  form: FormMatch[],
  statType: StatTypeId,
  cache: StatsCache
): { team: string; total: string; opp: string } {
  if (statType === "goals") {
    return {
      team:  formAvg(form, "teamGoals"),
      total: totalAvg(form),
      opp:   formAvg(form, "oppGoals"),
    };
  }
  const withData = form.filter(f => cache[f.fixtureId] !== undefined && cache[f.fixtureId] !== null);
  if (!withData.length) return { team: "—", total: "—", opp: "—" };

  let teamSum = 0, oppSum = 0;
  withData.forEach(f => {
    const s = extractStat(cache[f.fixtureId]!, f.isHome, statType);
    teamSum += s.team;
    oppSum  += s.opp;
  });
  const n = withData.length;

  // Possession is a % — total (team%+opp%) always ≈ 100, which is meaningless
  if (statType === "possession") {
    return {
      team:  (teamSum / n).toFixed(1) + "%",
      total: "—",
      opp:   (oppSum  / n).toFixed(1) + "%",
    };
  }

  return {
    team:  (teamSum / n).toFixed(1),
    total: ((teamSum + oppSum) / n).toFixed(1),
    opp:   (oppSum  / n).toFixed(1),
  };
}

/** Get per-match stat total (team + opp) for the table row. */
function getRowStatTotal(f: FormMatch, statType: StatTypeId, cache: StatsCache): string {
  if (statType === "goals") return String(f.teamGoals + f.oppGoals);
  // Possession total is always ~100% — meaningless to display
  if (statType === "possession") return "—";
  const stats = cache[f.fixtureId];
  if (!stats) return "—";
  const { team, opp } = extractStat(stats, f.isHome, statType);
  return String(team + opp);
}

/** Get per-match stat pill string (always home-away orientation regardless of isHome). */
function getRowStatScore(f: FormMatch, statType: StatTypeId, cache: StatsCache): string {
  if (statType === "goals") {
    const homeScore = f.isHome ? f.teamGoals : f.oppGoals;
    const awayScore = f.isHome ? f.oppGoals : f.teamGoals;
    return `${homeScore}-${awayScore}`;
  }
  const stats = cache[f.fixtureId];
  if (!stats) return "—";

  let homeVal: number, awayVal: number;

  if (statType === "cards") {
    homeVal = rawStatVal(stats, 0, "Yellow Cards") + rawStatVal(stats, 0, "Red Cards");
    awayVal = rawStatVal(stats, 1, "Yellow Cards") + rawStatVal(stats, 1, "Red Cards");
    return `${homeVal}-${awayVal}`;
  }
  if (statType === "fouls") {
    homeVal = rawStatVal(stats, 0, "Fouls", "Total Fouls");
    awayVal = rawStatVal(stats, 1, "Fouls", "Total Fouls");
    return `${homeVal}-${awayVal}`;
  }
  if (statType === "possession") {
    homeVal = rawStatVal(stats, 0, "Ball Possession");
    awayVal = rawStatVal(stats, 1, "Ball Possession");
    return `${homeVal}%-${awayVal}%`;
  }

  const label = STAT_API_KEY[statType];
  if (!label) return "—";
  homeVal = rawStatVal(stats, 0, label);
  awayVal = rawStatVal(stats, 1, label);
  return `${homeVal}-${awayVal}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MatchAnalyticsTabs(props: MatchTabsProps) {
  const [tab, setTab] = useState<TabId>("form");
  const [statType, setStatType] = useState<StatTypeId>("goals");
  const [lastN, setLastN] = useState<number>(5);
  const [homeVenue, setHomeVenue] = useState<VenueFilter>("all");
  const [awayVenue, setAwayVenue] = useState<VenueFilter>("all");

  // Broadcast the active stat to sibling components (e.g. venue strip indicator)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("stat-type-change", { detail: statType }));
  }, [statType]);

  return (
    <div>
      {/* ── Stat filter bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mb-3 pb-0.5">
        {STAT_TYPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatType(s.id as StatTypeId)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
              statType === s.id
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statType === s.id ? "bg-white" : "bg-muted/60"}`} />
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Tab navigation + Last N ─────────────────────────────── */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 ${
                tab === t.id
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground bg-surface border border-border/60 hover:bg-surface-hover"
              }`}
            >
              {t.label}
              {t.id === "analyse" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent-gold/15 border border-accent-gold/30 text-accent-gold">
                  PRO
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Last N filter — shown for form and h2h */}
        {(tab === "form" || tab === "h2h") && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted font-bold shrink-0">Last:</span>
            {LAST_N.map((n) => (
              <button
                key={n}
                onClick={() => setLastN(n)}
                className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all ${
                  lastN === n
                    ? "bg-accent text-white"
                    : "bg-surface border border-border/60 text-muted hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      {tab === "form"      && (
        <LastMatchesTab
          {...props}
          statType={statType}
          lastN={lastN}
          homeVenue={homeVenue}
          awayVenue={awayVenue}
          setHomeVenue={setHomeVenue}
          setAwayVenue={setAwayVenue}
        />
      )}
      {tab === "h2h"       && <H2HTab {...props} lastN={lastN} statType={statType} />}
      {tab === "standings" && <StandingsTab {...props} />}
      {tab === "analyse" && (
        <PremiumGate feature="Smart Analysis" mode="replace" flagKey="live_ai">
          <SmartAnalyseTab {...props} />
        </PremiumGate>
      )}
    </div>
  );
}

// ─── LAST MATCHES TAB ─────────────────────────────────────────────────────────

interface LastMatchesTabProps extends MatchTabsProps {
  statType: StatTypeId;
  lastN: number;
  homeVenue: VenueFilter;
  awayVenue: VenueFilter;
  setHomeVenue: (v: VenueFilter) => void;
  setAwayVenue: (v: VenueFilter) => void;
}

function LastMatchesTab(props: LastMatchesTabProps) {
  const { match, homeForm, awayForm, statType, lastN, homeVenue, awayVenue, setHomeVenue, setAwayVenue } = props;

  const filteredHome = filterForm(homeForm, homeVenue, lastN);
  const filteredAway = filterForm(awayForm, awayVenue, lastN);

  // ── Stats cache ──────────────────────────────────────────────────────────
  const [statsCache, setStatsCache] = useState<StatsCache>({});
  const fetchingRef = useRef(new Set<number>());

  useEffect(() => {
    if (statType === "goals") return; // goals come from FormMatch directly

    const allMatches = [...filteredHome, ...filteredAway];
    const toFetch = allMatches
      .map(f => f.fixtureId)
      .filter(id => id && !(id in statsCache) && !fetchingRef.current.has(id));

    if (!toFetch.length) return;
    toFetch.forEach(id => fetchingRef.current.add(id));

    Promise.all(
      toFetch.map(id =>
        fetch(`${BASE}/api/matches/${id}/stats`, withAuth())
          .then(r => r.ok ? r.json() : null)
          .then(json => [id, json?.data ?? null] as [number, MatchStatsArr | null])
          .catch(() => [id, null] as [number, null])
      )
    ).then(results => {
      const patch: StatsCache = {};
      results.forEach(([id, data]) => { patch[id] = data; fetchingRef.current.delete(id); });
      setStatsCache(prev => ({ ...prev, ...patch }));
    });
  }, [statType, filteredHome, filteredAway]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadingStats = statType !== "goals" &&
    [...filteredHome, ...filteredAway].some(f => f.fixtureId && !(f.fixtureId in statsCache));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <TeamFormPanel
        teamName={match.homeTeam}
        logo={match.homeLogo}
        form={filteredHome}
        statType={statType}
        venue={homeVenue}
        setVenue={setHomeVenue}
        statsCache={statsCache}
        loadingStats={loadingStats}
      />
      <TeamFormPanel
        teamName={match.awayTeam}
        logo={match.awayLogo}
        form={filteredAway}
        statType={statType}
        venue={awayVenue}
        setVenue={setAwayVenue}
        statsCache={statsCache}
        loadingStats={loadingStats}
      />
    </div>
  );
}

function TeamFormPanel({
  teamName,
  logo,
  form,
  statType,
  venue,
  setVenue,
  statsCache,
  loadingStats,
}: {
  teamName: string;
  logo: string;
  form: FormMatch[];
  statType: StatTypeId;
  venue: VenueFilter;
  setVenue: (v: VenueFilter) => void;
  statsCache: StatsCache;
  loadingStats: boolean;
}) {
  const { w, d, l } = wdl(form);
  const avgs = computeStatAvgs(form, statType, statsCache);
  const statLabel = STAT_TYPES.find(s => s.id === statType)?.label ?? "Stat";

  return (
    <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
      {/* Team header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
        {logo && <img src={logo} alt={teamName} className="w-7 h-7 object-contain" />}
        <span className="font-black text-foreground tracking-tight uppercase text-sm">{teamName}</span>
        <span className="text-[10px] text-muted/70 font-medium">{form.length} matches</span>
        <div className="ml-auto flex items-center gap-1">
          {w > 0 && <ResultPill label={`${w}W`} type="W" />}
          {d > 0 && <ResultPill label={`${d}D`} type="D" />}
          {l > 0 && <ResultPill label={`${l}L`} type="L" />}
        </div>
      </div>

      {/* Venue filter */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/20 bg-background/30">
        <span className="text-[10px] text-muted font-black uppercase tracking-widest mr-1">Venue</span>
        {(["all", "home", "away"] as VenueFilter[]).map((v) => (
          <button
            key={v}
            onClick={() => setVenue(v)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
              venue === v
                ? "bg-accent text-white"
                : "bg-surface border border-border/50 text-muted hover:text-foreground"
            }`}
          >
            {v === "all" ? "All" : v === "home" ? "Home" : "Away"}
          </button>
        ))}
        {loadingStats && (
          <div className="ml-auto w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Three stat boxes */}
      <div className="grid grid-cols-3 border-b border-border/30">
        <StatBox label={teamName.split(" ")[0].toUpperCase()} value={avgs.team} variant="team" />
        <StatBox label={statLabel.toUpperCase()} value={avgs.total} variant="total" />
        <StatBox label="OPPONENT" value={avgs.opp} variant="opp" />
      </div>

      {/* Match table */}
      {form.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            <div className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr_28px_44px] gap-1 items-center bg-background/40 border-b border-border/20">
              {["DATE", "HOME", statType === "goals" ? "SCORE" : statLabel.toUpperCase().slice(0, 5), "AWAY", "TOT", "HT"].map((h, i) => (
                <span key={i} className="text-[9px] font-black text-muted uppercase tracking-widest text-center first:text-left">
                  {h}
                </span>
              ))}
            </div>
            <div className="divide-y divide-border/15">
              {form.map((f, i) => (
                <MatchTableRow key={i} f={f} statType={statType} statsCache={statsCache} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted">No matches available</div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "team" | "total" | "opp";
}) {
  const bg =
    variant === "team"
      ? "bg-danger/10"
      : variant === "opp"
      ? "bg-accent/10"
      : "bg-background/40";
  const numCls =
    variant === "team"
      ? "text-danger"
      : variant === "opp"
      ? "text-accent"
      : "text-foreground";
  return (
    <div className={`${bg} py-4 px-2 text-center flex flex-col items-center gap-1`}>
      <div className="text-[9px] text-muted font-black uppercase tracking-widest truncate w-full text-center">
        {label}
      </div>
      <div className={`text-2xl font-black tabular-nums leading-none ${numCls}`}>{value}</div>
      <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">AVG / MATCH</div>
    </div>
  );
}

function ResultPill({ label, type }: { label: string; type: "W" | "D" | "L" }) {
  const cls =
    type === "W"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
      : type === "L"
      ? "bg-danger/15 text-danger border-danger/20"
      : "bg-muted/15 text-muted border-border";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${cls}`}>
      {label}
    </span>
  );
}

function MatchTableRow({ f, statType, statsCache }: { f: FormMatch; statType: StatTypeId; statsCache: StatsCache }) {
  const scoreDisplay = getRowStatScore(f, statType, statsCache);
  const total        = getRowStatTotal(f, statType, statsCache);
  const htHome       = f.isHome ? f.htTeamGoals : f.htOppGoals;
  const htAway       = f.isHome ? f.htOppGoals  : f.htTeamGoals;
  // HT score only makes sense for goals
  const htDisplay    = statType === "goals" && htHome !== null && htAway !== null
    ? `${htHome}-${htAway}`
    : "—";

  // Score pill colour is always based on goals result (W/D/L)
  const scoreCls =
    f.result === "W"
      ? "bg-emerald-600 text-white"
      : f.result === "L"
      ? "bg-red-700 text-white"
      : "bg-muted/30 text-foreground";

  return (
    <div className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr_28px_44px] gap-1 items-center hover:bg-background/30 transition-colors">
      {/* Date + league icon */}
      <div className="flex items-center gap-1 min-w-0">
        {f.leagueLogo && (
          <img src={f.leagueLogo} alt={f.league} className="w-3.5 h-3.5 object-contain shrink-0" />
        )}
        <span className="text-[10px] text-muted truncate">{f.date}</span>
      </div>

      {/* Home team */}
      <div className="flex items-center gap-1 min-w-0 justify-end">
        <span className="text-[11px] font-bold text-foreground truncate text-right">{f.homeTeam}</span>
        {f.homeLogo && <img src={f.homeLogo} alt={f.homeTeam} className="w-3.5 h-3.5 object-contain shrink-0" />}
      </div>

      {/* Score / stat pill */}
      <div className="flex justify-center">
        <span className={`px-2 py-0.5 rounded text-[11px] font-black tabular-nums ${scoreCls}`}>
          {scoreDisplay}
        </span>
      </div>

      {/* Away team */}
      <div className="flex items-center gap-1 min-w-0">
        {f.awayLogo && <img src={f.awayLogo} alt={f.awayTeam} className="w-3.5 h-3.5 object-contain shrink-0" />}
        <span className="text-[11px] font-bold text-foreground truncate">{f.awayTeam}</span>
      </div>

      {/* Total */}
      <span className="text-[11px] text-muted tabular-nums text-center">{total}</span>

      {/* HT */}
      <span className="text-[10px] text-muted tabular-nums text-center">{htDisplay}</span>
    </div>
  );
}

// ─── H2H TAB ─────────────────────────────────────────────────────────────────

function H2HTab({ match, h2hStats, trend, lastN, statType }: MatchTabsProps & { lastN: number; statType: StatTypeId }) {
  const played = (trend.played ?? []).slice(0, lastN);

  // ── Stats cache (same pattern as LastMatchesTab) ─────────────────────────
  const [statsCache, setStatsCache] = useState<StatsCache>({});
  const fetchingRef = useRef(new Set<number>());

  useEffect(() => {
    if (statType === "goals") return;

    const toFetch = played
      .map((f: any) => f.fixture?.id as number)
      .filter((id: number) => id && !(id in statsCache) && !fetchingRef.current.has(id));

    if (!toFetch.length) return;
    toFetch.forEach((id: number) => fetchingRef.current.add(id));

    Promise.all(
      toFetch.map((id: number) =>
        fetch(`${BASE}/api/matches/${id}/stats`, withAuth())
          .then(r => r.ok ? r.json() : null)
          .then(json => [id, json?.data ?? null] as [number, MatchStatsArr | null])
          .catch(() => [id, null] as [number, null])
      )
    ).then(results => {
      const patch: StatsCache = {};
      results.forEach(([id, data]) => { patch[id] = data; fetchingRef.current.delete(id); });
      setStatsCache(prev => ({ ...prev, ...patch }));
    });
  }, [statType, played]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadingStats = statType !== "goals" &&
    played.some((f: any) => f.fixture?.id && !(f.fixture.id in statsCache));

  const statLabel = STAT_TYPES.find(s => s.id === statType)?.label ?? "Stat";
  const scoreHeader = statType === "goals" ? "SCORE" : statLabel.toUpperCase().slice(0, 5);

  return (
    <div className="space-y-4">
      {/* H2H summary boxes — always goals-based (wins/draws/losses don't change) */}
      {h2hStats.total > 0 && (
        <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <span className="text-sm font-black text-foreground uppercase tracking-tight">
              {match.homeTeam} vs {match.awayTeam}
            </span>
            <span className="ml-auto text-[10px] text-muted font-bold">{h2hStats.total} meetings</span>
          </div>
          <div className="grid grid-cols-3">
            <StatBox label={match.homeTeam.split(" ")[0].toUpperCase()} value={String(h2hStats.homeWins)} variant="team" />
            <StatBox label="DRAWS" value={String(h2hStats.draws)} variant="total" />
            <StatBox label={match.awayTeam.split(" ")[0].toUpperCase()} value={String(h2hStats.awayWins)} variant="opp" />
          </div>
        </div>
      )}

      {/* H2H match table */}
      <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <span className="text-sm font-black text-foreground uppercase tracking-tight">Recent Meetings</span>
          <span className="ml-auto text-[10px] text-muted font-bold">Last {played.length}</span>
          {loadingStats && (
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin ml-1" />
          )}
        </div>

        {played.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="px-3 py-2 grid grid-cols-[64px_1fr_52px_1fr_28px_36px] gap-1 items-center bg-background/40 border-b border-border/20">
                {["DATE", "HOME", scoreHeader, "AWAY", "TOT", "GLS"].map((h) => (
                  <span key={h} className="text-[9px] font-black text-muted uppercase tracking-widest text-center first:text-left">
                    {h}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-border/15">
                {played.map((fixture: any, i: number) => (
                  <H2HRow key={i} fixture={fixture} homeTeamId={match.homeId} statType={statType} statsCache={statsCache} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No H2H meetings found" body="No recent head-to-head matches available for these teams." compact />
        )}
      </div>
    </div>
  );
}

function H2HRow({
  fixture,
  homeTeamId,
  statType,
  statsCache,
}: {
  fixture: any;
  homeTeamId: number;
  statType: StatTypeId;
  statsCache: StatsCache;
}) {
  const homeGoals = fixture.goals?.home ?? 0;
  const awayGoals = fixture.goals?.away ?? 0;
  const date      = fixture.fixture?.date
    ? new Date(fixture.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    : "—";

  // W/D/L is always goals-based
  const trackedIsHome = fixture.teams?.home?.id === homeTeamId;
  const trackedGoals  = trackedIsHome ? homeGoals : awayGoals;
  const oppGoals2     = trackedIsHome ? awayGoals : homeGoals;
  const result: "W" | "D" | "L" = trackedGoals > oppGoals2 ? "W" : trackedGoals < oppGoals2 ? "L" : "D";

  const scoreCls =
    result === "W"
      ? "bg-emerald-600 text-white"
      : result === "L"
      ? "bg-red-700 text-white"
      : "bg-muted/30 text-foreground";

  // Stat-aware score pill + total
  let scoreDisplay: string;
  let statTotal: string;

  if (statType === "goals") {
    scoreDisplay = `${homeGoals}-${awayGoals}`;
    statTotal    = String(homeGoals + awayGoals);
  } else {
    const fixtureId = fixture.fixture?.id as number | undefined;
    const stats     = fixtureId != null ? statsCache[fixtureId] : undefined;
    if (!stats) {
      scoreDisplay = "—";
      statTotal    = "—";
    } else {
      let hv: number, av: number;
      if (statType === "cards") {
        hv = rawStatVal(stats, 0, "Yellow Cards") + rawStatVal(stats, 0, "Red Cards");
        av = rawStatVal(stats, 1, "Yellow Cards") + rawStatVal(stats, 1, "Red Cards");
      } else {
        const label = STAT_API_KEY[statType];
        hv = label ? rawStatVal(stats, 0, label) : 0;
        av = label ? rawStatVal(stats, 1, label) : 0;
      }
      scoreDisplay = `${hv}-${av}`;
      statTotal    = String(hv + av);
    }
  }

  return (
    <div className="px-3 py-2 grid grid-cols-[64px_1fr_52px_1fr_28px_36px] gap-1 items-center hover:bg-background/30 transition-colors min-w-[320px]">
      <div className="flex items-center gap-1 min-w-0">
        {fixture.league?.logo && (
          <img src={fixture.league.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
        )}
        <span className="text-[10px] text-muted truncate">{date}</span>
      </div>

      <div className="flex items-center gap-1 min-w-0 justify-end">
        {fixture.teams?.home?.logo && (
          <img src={fixture.teams.home.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
        )}
        <span className="text-[11px] font-bold text-foreground truncate text-right">{fixture.teams?.home?.name}</span>
      </div>

      <div className="flex justify-center">
        <span className={`px-2 py-0.5 rounded text-[11px] font-black tabular-nums ${scoreCls}`}>
          {scoreDisplay}
        </span>
      </div>

      <div className="flex items-center gap-1 min-w-0">
        {fixture.teams?.away?.logo && (
          <img src={fixture.teams.away.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
        )}
        <span className="text-[11px] font-bold text-foreground truncate">{fixture.teams?.away?.name}</span>
      </div>

      {/* Stat total for selected type */}
      <span className="text-[11px] text-muted tabular-nums text-center">{statTotal}</span>

      {/* Goals score always shown in the last column when a non-goals stat is active */}
      <span className="text-[10px] text-muted tabular-nums text-center">
        {statType === "goals" ? "—" : `${homeGoals}-${awayGoals}`}
      </span>
    </div>
  );
}

// ─── STANDINGS TAB ────────────────────────────────────────────────────────────

function StandingsTab({ match, standings }: MatchTabsProps) {
  const groups: any[] = Array.isArray(standings) ? standings : [];

  if (!groups.length) {
    return (
      <div className="rounded-2xl bg-surface border border-border/50 p-8 text-center">
        <EmptyState title="Standings unavailable" body="League table is not available for this fixture." />
      </div>
    );
  }

  const leagueGroups = groups[0]?.league?.standings ?? groups;

  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-foreground tracking-tight uppercase">League Standings</h2>
        <span className="text-[10px] text-muted font-black uppercase tracking-widest">current season</span>
      </div>

      <div className="overflow-x-auto">
        {leagueGroups.map((group: any[], gi: number) => (
          <div key={gi} className="min-w-[360px]">
            {leagueGroups.length > 1 && (
              <div className="px-5 py-2 bg-background/50 border-b border-border/30">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Group {gi + 1}</span>
              </div>
            )}
            <div className="px-3 py-2 grid grid-cols-[24px_1fr_30px_30px_30px_30px_36px_36px] gap-1 border-b border-border/30">
              {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h) => (
                <span key={h} className="text-[9px] text-muted font-black uppercase tracking-widest text-center first:text-left">
                  {h}
                </span>
              ))}
            </div>
            <div className="divide-y divide-border/20">
              {group.map((entry: any) => {
                const isHighlighted = entry.team?.id === match.homeId || entry.team?.id === match.awayId;
                return (
                  <div
                    key={entry.team?.id}
                    className={`px-3 py-2.5 grid grid-cols-[24px_1fr_30px_30px_30px_30px_36px_36px] gap-1 items-center transition-colors ${
                      isHighlighted ? "bg-accent/8 border-l-2 border-accent" : "hover:bg-background/40"
                    }`}
                  >
                    <span className={`text-sm font-black tabular-nums ${isHighlighted ? "text-accent" : "text-muted"}`}>
                      {entry.rank}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {entry.team?.logo && (
                        <img src={entry.team.logo} alt={entry.team?.name} className="w-4 h-4 object-contain shrink-0" />
                      )}
                      <span className={`text-[12px] font-bold truncate ${isHighlighted ? "text-accent" : "text-foreground"}`}>
                        {entry.team?.name}
                      </span>
                    </div>
                    {[entry.all?.played, entry.all?.win, entry.all?.draw, entry.all?.lose].map((v, i) => (
                      <span key={i} className="text-[12px] text-muted tabular-nums text-center">{v ?? 0}</span>
                    ))}
                    <span className={`text-[12px] tabular-nums text-center font-bold ${
                      (entry.goalsDiff ?? 0) > 0 ? "text-accent" : (entry.goalsDiff ?? 0) < 0 ? "text-danger" : "text-muted"
                    }`}>
                      {(entry.goalsDiff ?? 0) > 0 ? "+" : ""}{entry.goalsDiff ?? 0}
                    </span>
                    <span className={`text-[13px] font-black tabular-nums text-center ${isHighlighted ? "text-accent" : "text-foreground"}`}>
                      {entry.points ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SMART ANALYSE TAB ────────────────────────────────────────────────────────

const ANALYSE_TABS = [
  { id: "ai",          label: "AI" },
  { id: "stats",       label: "Stats" },
  { id: "timeline",    label: "Timeline" },
  { id: "squads",      label: "Squads" },
  { id: "predictions", label: "Predictions" },
  { id: "news",        label: "News" },
] as const;

type AnalyseTabId = (typeof ANALYSE_TABS)[number]["id"];

function SmartAnalyseTab(props: MatchTabsProps) {
  const [analyseTab, setAnalyseTab] = useState<AnalyseTabId>("ai");
  const { match, matchStats, statsData, events, momentum, lineups, homeLineup, awayLineup, signals, model, trend, predictions, injuries, hasStarted, isFinished } = props;

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {ANALYSE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAnalyseTab(t.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
              analyseTab === t.id
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground bg-surface border border-border/60 hover:bg-surface-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI */}
      {analyseTab === "ai" && (
        <AiPredictionCard matchId={props.matchId} homeTeam={match.homeTeam} awayTeam={match.awayTeam} isUpcoming={!hasStarted} />
      )}

      {/* Stats */}
      {analyseTab === "stats" && (
        <div className="space-y-4">
          <AnalyticsPanel title={matchStats ? "Match Statistics" : "Statistics"} eyebrow={matchStats ? "live" : "pre-match"}>
            {matchStats ? (
              <div className="space-y-5">
                <div className="grid sm:grid-cols-3 gap-3">
                  <PressureCard label="Possession"    home={statDisplay(statsData, 0, "Ball Possession")} away={statDisplay(statsData, 1, "Ball Possession")} />
                  <PressureCard label="Shots on Goal" home={statValue(statsData, 0, "Shots on Goal")}    away={statValue(statsData, 1, "Shots on Goal")} />
                  <PressureCard label="Corners"       home={statValue(statsData, 0, "Corner Kicks")}     away={statValue(statsData, 1, "Corner Kicks")} />
                </div>
                <div className="space-y-4">
                  {matchStats.rows.map((row) => <StatRow key={row.label} row={row} />)}
                </div>
              </div>
            ) : (
              <EmptyState title="No live statistics yet" body="Statistics will appear after kickoff." />
            )}
          </AnalyticsPanel>

          <AnalyticsPanel title="Data Signals" eyebrow="derived">
            <div className="space-y-3">
              {signals.map((signal: any) => (
                <div key={signal.label} className="p-3.5 rounded-xl bg-background/70 border border-border/50">
                  <div className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">{signal.label}</div>
                  <div className="text-sm font-black text-foreground">{signal.value}</div>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">{signal.detail}</p>
                </div>
              ))}
            </div>
          </AnalyticsPanel>
        </div>
      )}

      {/* Timeline */}
      {analyseTab === "timeline" && (
        <div className="space-y-4">
          <AnalyticsPanel title="Event Timeline" eyebrow={events.length ? `${events.length} events` : "no events"}>
            {events.length ? (
              <div className="space-y-2">
                {events.map((event, i) => (
                  <TimelineEvent key={`${event.time?.elapsed}-${event.type}-${i}`} event={event} match={match} />
                ))}
              </div>
            ) : (
              <EmptyState title="Timeline not started" body="Goals, cards, substitutions, and VAR will appear here." />
            )}
          </AnalyticsPanel>

          <AnalyticsPanel title="Momentum Map" eyebrow="15-min buckets">
            {events.length ? (
              <div className="space-y-4">
                {momentum.map((bucket: any) => <MomentumRow key={bucket.label} bucket={bucket} match={match} />)}
              </div>
            ) : (
              <EmptyState title="Momentum needs events" body="Pressure timeline builds once the match starts." />
            )}
          </AnalyticsPanel>
        </div>
      )}

      {/* Squads */}
      {analyseTab === "squads" && (
        <div className="space-y-4">
          <AnalyticsPanel title="Lineups & Shape" eyebrow={lineups.length ? "confirmed" : "not available"}>
            {lineups.length ? (
              <div className="grid md:grid-cols-2 gap-4">
                <LineupCard lineup={homeLineup} fallbackName={match.homeTeam} />
                <LineupCard lineup={awayLineup} fallbackName={match.awayTeam} />
              </div>
            ) : (
              <EmptyState title="Lineups unavailable" body="Formations will show here when published." />
            )}
          </AnalyticsPanel>

          <div className="grid md:grid-cols-2 gap-4">
            <InjuryCard title={`${match.homeTeam} Injuries`} logo={match.homeLogo} injuries={injuries.filter((p: any) => p.team?.id === match.homeId)} />
            <InjuryCard title={`${match.awayTeam} Injuries`} logo={match.awayLogo} injuries={injuries.filter((p: any) => p.team?.id === match.awayId)} />
          </div>
        </div>
      )}

      {/* News */}
      {analyseTab === "news" && (
        <MatchNewsTab homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      )}

      {/* Predictions */}
      {analyseTab === "predictions" && (
        <div className="space-y-4">
          <AnalyticsPanel title="Win Probability" eyebrow="signal model">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <ProbCard label={match.homeTeam} value={`${model.home}%`} accent />
              <ProbCard label="Draw"           value={`${model.draw}%`} />
              <ProbCard label={match.awayTeam} value={`${model.away}%`} danger />
            </div>
            <p className="text-[10px] text-muted leading-relaxed">
              Model is a lightweight signal score from H2H record, current score, shots, and possession. Not bookmaker odds.
            </p>
          </AnalyticsPanel>

          <ApiPredictionCard match={match} predictions={predictions} isFinished={isFinished} />

          <AnalyticsPanel title="Market Watch" eyebrow={hasStarted ? "live" : "pre-match"}>
            <div className="space-y-2.5">
              <MarketRow label="Goals Profile"   value={`${trend.avgGoals} H2H avg`} tone={Number(trend.avgGoals) >= 2.5 ? "hot" : "cool"} />
              <MarketRow label="BTTS Signal"     value={`${trend.bttsPct}%`}         tone={trend.bttsPct >= 55 ? "hot" : "cool"} />
              <MarketRow label="Over 2.5 Signal" value={`${trend.over25Pct}%`}       tone={trend.over25Pct >= 55 ? "hot" : "cool"} />
              <MarketRow label="Match Phase"     value={isFinished ? "Closed" : hasStarted ? "Live" : "Pre-match"} tone={hasStarted && !isFinished ? "hot" : "neutral"} />
            </div>
          </AnalyticsPanel>
        </div>
      )}
    </div>
  );
}

// ─── MATCH NEWS TAB ───────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_COLOR: Record<string, string> = {
  "BBC Sport":  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Sky Sports": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Guardian":   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "ESPN":       "bg-red-500/10 text-red-400 border-red-500/20",
};

function NewsCard({ item }: { item: NewsItem }) {
  const sourceCls = SOURCE_COLOR[item.source] ?? "bg-muted/10 text-muted border-border";
  return (
    <a
      href={`/news/${item.id}`}
      className="flex gap-3 p-3.5 rounded-xl bg-background/70 border border-border/50 hover:border-accent/30 hover:bg-background/90 transition-all group"
    >
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover shrink-0 bg-surface"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${sourceCls}`}>
            {item.source}
          </span>
          <span className="text-[10px] text-muted">{timeAgo(item.publishedAt)}</span>
        </div>
        <p className="text-[13px] font-bold text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {item.title}
        </p>
        {item.description && (
          <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{item.description}</p>
        )}
      </div>
    </a>
  );
}

function MatchNewsTab({ homeTeam, awayTeam }: { homeTeam: string; awayTeam: string }) {
  const [items, setItems]   = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "empty">("loading");

  useEffect(() => {
    const params = new URLSearchParams({ team1: homeTeam, team2: awayTeam, limit: "12" });
    fetch(`${BASE}/api/news/team?${params}`)
      .then(r => r.json())
      .then(json => {
        const fetched: NewsItem[] = json?.data?.items ?? [];
        setItems(fetched);
        setStatus(fetched.length ? "done" : "empty");
      })
      .catch(() => setStatus("empty"));
  }, [homeTeam, awayTeam]);

  return (
    <AnalyticsPanel title="Latest News" eyebrow={status === "done" ? `${items.length} articles` : "rss"}>
      {status === "loading" && (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-border/20" />
          ))}
        </div>
      )}
      {status === "empty" && (
        <EmptyState title="No news found" body={`No recent articles found for ${homeTeam} or ${awayTeam}.`} />
      )}
      {status === "done" && (
        <div className="space-y-2.5">
          {items.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
      )}
    </AnalyticsPanel>
  );
}

// ─── AI Prediction card — parser + renderer ───────────────────────────────────

interface AiSection {
  heading: string;
  content: string;
  index: number;
}

// Split on "### " headings (what qwen2.5:1.5b actually outputs)
function parseSections(raw: string): AiSection[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/^###\s+/m)
    .filter((p) => p.trim())
    .map((chunk, index) => {
      const lines = chunk.split("\n");
      const heading = lines[0].trim().replace(/^\d+\.\s*/, "").replace(/:$/, "").trim();
      const content = lines.slice(1).join("\n").trim();
      return { heading, content, index };
    });
}

// Inline bold: **text** → <strong>
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} className="font-black text-foreground">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// Renders a section body: paragraphs, bullet lists, numbered lists
function SectionBody({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isIndented  = /^\s{2,}/.test(line);
        const isBullet    = /^[\s]*[-*•]\s+/.test(line);
        const isNumbered  = /^\s*\d+[.)]\s+/.test(line);
        const body        = line.replace(/^[\s]*[-*•\d.)+]\s*/, "").trim();

        if (isBullet || isNumbered) {
          return (
            <div key={i} className={`flex items-start gap-2.5 ${isIndented ? "ml-4" : ""}`}>
              <span className={`mt-1.5 rounded-full shrink-0 ${isIndented ? "w-1 h-1 bg-muted/50" : "w-1.5 h-1.5 bg-accent"}`} />
              <span className={`leading-relaxed ${isIndented ? "text-xs text-muted" : "text-sm text-foreground/90"}`}>
                <RichText text={body} />
              </span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-foreground/90 leading-relaxed">
            <RichText text={line.trim()} />
          </p>
        );
      })}
    </div>
  );
}

function AiSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-xl bg-border/20" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 rounded-xl bg-border/20" />
        <div className="h-14 rounded-xl bg-border/20" />
      </div>
      <div className="h-28 rounded-xl bg-border/20" />
      <div className="h-20 rounded-xl bg-border/20" />
    </div>
  );
}

// ── Predict view ──────────────────────────────────────────────────────────────

function PredictView({ sections, homeTeam, awayTeam }: { sections: AiSection[]; homeTeam: string; awayTeam: string }) {
  const byNum  = (n: number) => sections.find((s) => s.index === n - 1);
  const byKw   = (kw: RegExp) => sections.find((s) => kw.test(s.heading));

  const s1 = byNum(1) ?? byKw(/predicted result/i);
  const s2 = byNum(2) ?? byKw(/score/i);
  const s3 = byNum(3) ?? byKw(/goals market/i);
  const s4 = byNum(4) ?? byKw(/key factor/i);
  const s5 = byNum(5) ?? byKw(/confidence/i);

  // Colour verdict card based on whether home/away team name appears in the text
  const verdictText = s1?.content ?? "";
  const homeWords   = homeTeam.split(" ").filter((w) => w.length > 3);
  const awayWords   = awayTeam.split(" ").filter((w) => w.length > 3);
  const mentionsHome = homeWords.some((w) => verdictText.toLowerCase().includes(w.toLowerCase()));
  const mentionsAway = awayWords.some((w) => verdictText.toLowerCase().includes(w.toLowerCase()));
  const isDraw = /draw/i.test(verdictText);
  const tone = isDraw ? "draw" : mentionsHome && !mentionsAway ? "home" : mentionsAway && !mentionsHome ? "away" : "neutral";

  const verdictBg   = tone === "home" ? "bg-accent/8 border-accent/25" : tone === "away" ? "bg-danger/8 border-danger/25" : "bg-muted/10 border-border/40";
  const verdictText2 = tone === "home" ? "text-accent" : tone === "away" ? "text-danger" : "text-foreground";

  // Extract score from section 2 (e.g. "**2-1**" or "2-1")
  const scoreMatch = s2?.content.match(/\*?\*?(\d+[-–]\d+)\*?\*?/);
  const score = scoreMatch?.[1] ?? s2?.content.split("\n")[0].replace(/\*\*/g, "").trim().slice(0, 15) ?? "—";

  // Extract confidence level
  const confMatch  = s5?.content.match(/\*?\*?(High|Medium|Low)\*?\*?/i);
  const confLevel  = confMatch?.[1] ?? null;
  const confBg     = confLevel === "High" ? "bg-emerald-500/10 border-emerald-500/20" : confLevel === "Medium" ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/10 border-border/40";
  const confColor  = confLevel === "High" ? "text-emerald-400" : confLevel === "Medium" ? "text-amber-400" : "text-muted";
  const confDetail = s5?.content.replace(/^\*?\*?(High|Medium|Low)\*?\*?\s*/i, "").trim();

  return (
    <div className="space-y-3">
      {/* Verdict */}
      {s1 && (
        <div className={`rounded-xl border p-4 ${verdictBg}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">{s1.heading}</div>
          <div className={`text-sm leading-relaxed ${verdictText2}`}>
            <SectionBody text={s1.content} />
          </div>
        </div>
      )}

      {/* Score + Confidence */}
      <div className="grid grid-cols-2 gap-3">
        {s2 && (
          <div className="rounded-xl bg-background/70 border border-border/50 p-3.5 text-center">
            <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5">Score</div>
            <div className="text-xl font-black tabular-nums text-foreground">{score}</div>
          </div>
        )}
        {confLevel && (
          <div className={`rounded-xl border p-3.5 text-center ${confBg}`}>
            <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5">Confidence</div>
            <div className={`text-xl font-black ${confColor}`}>{confLevel}</div>
          </div>
        )}
      </div>

      {/* Goals Market */}
      {s3 && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">{s3.heading}</div>
          <SectionBody text={s3.content} />
        </div>
      )}

      {/* Key Factors */}
      {s4 && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-3">{s4.heading}</div>
          <SectionBody text={s4.content} />
        </div>
      )}

      {/* Confidence detail */}
      {confDetail && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">Risk Factor</div>
          <SectionBody text={confDetail} />
        </div>
      )}
    </div>
  );
}

// ── Analyse view ──────────────────────────────────────────────────────────────

function AnalyseView({ sections }: { sections: AiSection[] }) {
  const summary    = sections.find((s) => /summary/i.test(s.heading));
  const tactical   = sections.find((s) => /tactical/i.test(s.heading));
  const performers = sections.find((s) => /performer/i.test(s.heading));
  const takeaways  = sections.find((s) => /takeaway/i.test(s.heading));

  // If keyword matching misses sections, render all in order
  const matched = [summary, tactical, performers, takeaways].filter(Boolean);
  const toRender: AiSection[] = matched.length >= 2 ? (matched as AiSection[]) : sections;

  return (
    <div className="space-y-3">
      {toRender.map((section, i) => (
        <div key={i} className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-3">{section.heading}</div>
          <SectionBody text={section.content} />
        </div>
      ))}
    </div>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────

type AiStatus = "loading" | "streaming" | "done" | "error";

function AiPredictionCard({ matchId, homeTeam, awayTeam, isUpcoming }: {
  matchId: string | number; homeTeam: string; awayTeam: string; isUpcoming: boolean;
}) {
  const [status,     setStatus]     = useState<AiStatus>("loading");
  const [streamText, setStreamText] = useState("");
  const [sections,   setSections]   = useState<AiSection[]>([]);
  const [mode,       setMode]       = useState<"predict" | "analyse">("predict");
  const [error,      setError]      = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    setStatus("loading"); setError(""); setStreamText(""); setSections([]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(`${BASE}/api/matches/${matchId}/ai-prediction`, withAuth({ signal: abortRef.current.signal }));
      const ct  = res.headers.get("content-type") ?? "";

      // Cached result → plain JSON
      if (ct.includes("application/json")) {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Analysis unavailable");
        const m: "predict" | "analyse" = json.data?.mode === "analyse" ? "analyse" : "predict";
        setMode(m);
        setSections(parseSections(json.data?.analysis ?? ""));
        setStatus("done");
        return;
      }

      // Live stream → SSE
      if (!res.body) throw new Error("No response body");
      setStatus("streaming");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.token) {
              full += ev.token;
              setStreamText(full);
            }
            if (ev.done) {
              const m: "predict" | "analyse" = ev.mode === "analyse" ? "analyse" : "predict";
              setMode(m);
              setSections(parseSections(ev.analysis ?? full));
              setStatus("done");
            }
            if (ev.error) { setError(ev.error); setStatus("error"); }
          } catch { /* skip malformed event */ }
        }
      }

    } catch (e: any) {
      if (e.name === "AbortError") return;
      setError(e.message || "Something went wrong");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const title   = isUpcoming ? "AI Prediction" : "AI Analysis";
  const eyebrow = status === "streaming" ? "generating…" : mode === "predict" ? "pre-match" : "match analysis";

  return (
    <AnalyticsPanel title={title} eyebrow={status === "loading" ? "ai" : eyebrow}>
      {status === "loading" && <AiSkeleton />}

      {status === "streaming" && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span className="text-[10px] text-muted font-black uppercase tracking-widest">Generating</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {streamText}
            <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-middle" />
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">Analysis unavailable</p>
            <p className="text-xs text-muted mt-0.5">{error}</p>
          </div>
          <button onClick={load} className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-surface-hover transition-colors">Retry</button>
        </div>
      )}

      {status === "done" && sections.length === 0 && (
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-black text-foreground">No output</p>
            <p className="text-xs text-muted mt-0.5">The model returned an empty response.</p>
          </div>
          <button onClick={load} className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-surface-hover transition-colors">Retry</button>
        </div>
      )}

      {status === "done" && sections.length > 0 && mode === "predict" && (
        <PredictView sections={sections} homeTeam={homeTeam} awayTeam={awayTeam} />
      )}

      {status === "done" && sections.length > 0 && mode === "analyse" && (
        <AnalyseView sections={sections} />
      )}
    </AnalyticsPanel>
  );
}

function MarketPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 text-center ${accent ? "bg-accent/8 border-accent/25" : "bg-background/70 border-border/50"}`}>
      <div className={`text-lg font-black tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted font-black uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function ApiPredictionCard({ match, predictions, isFinished }: { match: MatchShape; predictions: any; isFinished: boolean }) {
  const pred = Array.isArray(predictions) ? predictions[0] : predictions;
  if (!pred) return null;
  return (
    <AnalyticsPanel title="Match Forecast" eyebrow="statistical model">
      <div className="space-y-4">
        {!isFinished && pred.predictions?.winner && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-accent/8 border border-accent/20">
            <div>
              <div className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Predicted Winner</div>
              <div className="text-lg font-black text-foreground">{pred.predictions.winner.name || "Draw"}</div>
              {pred.predictions.winner.comment && <div className="text-xs text-muted mt-0.5">{pred.predictions.winner.comment}</div>}
            </div>
            <div className="text-3xl">🏆</div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pred.predictions?.goals?.home !== undefined && (
            <MarketPill label={`${match.homeTeam} Goals`} value={pred.predictions.goals.home} />
          )}
          {pred.predictions?.goals?.away !== undefined && (
            <MarketPill label={`${match.awayTeam} Goals`} value={pred.predictions.goals.away} />
          )}
          {pred.predictions?.under_over && (
            <MarketPill label="Over/Under" value={pred.predictions.under_over} accent />
          )}
        </div>
        {pred.predictions?.percent && (
          <WinBar home={pred.predictions.percent.home} draw={pred.predictions.percent.draw} away={pred.predictions.percent.away} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
        )}
      </div>
    </AnalyticsPanel>
  );
}

function WinBar({ home, draw, away, homeTeam, awayTeam }: { home: string; draw: string; away: string; homeTeam: string; awayTeam: string }) {
  const h = parseInt(home) || 0, d = parseInt(draw) || 0, a = parseInt(away) || 0;
  return (
    <div className="space-y-2">
      <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5">
        {h > 0 && <div className="bg-accent rounded-l-full" style={{ width: `${h}%` }} />}
        {d > 0 && <div className="bg-muted/40" style={{ width: `${d}%` }} />}
        {a > 0 && <div className="bg-danger rounded-r-full" style={{ width: `${a}%` }} />}
      </div>
      <div className="flex justify-between text-[10px] font-black">
        <span className="text-accent">{homeTeam} {home}</span>
        <span className="text-muted">Draw {draw}</span>
        <span className="text-danger">{awayTeam} {away}</span>
      </div>
    </div>
  );
}

function InjuryCard({ title, logo, injuries }: { title: string; logo: string; injuries: any[] }) {
  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        {logo && <img src={logo} alt={title} className="w-4 h-4 object-contain" />}
        <h3 className="font-black text-foreground text-sm uppercase tracking-tight">{title}</h3>
        {injuries.length > 0 && <span className="ml-auto text-[10px] bg-danger/10 text-danger font-black px-2 py-0.5 rounded-full">{injuries.length}</span>}
      </div>
      {injuries.length > 0 ? (
        <div className="divide-y divide-border/20">
          {injuries.map((p: any, i: number) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center">
                <span className="text-[10px] font-black text-danger">{p.player?.pos || "?"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{p.player?.name}</div>
                <div className="text-[11px] text-muted">{p.player?.reason || "Injury"}</div>
              </div>
              {p.player?.type && <span className="text-[10px] font-black text-danger bg-danger/8 px-2 py-0.5 rounded-full shrink-0">{p.player.type}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-5 text-center text-sm text-muted">No injury reports</div>
      )}
    </div>
  );
}

// ─── Shared display components ────────────────────────────────────────────────

function AnalyticsPanel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-foreground tracking-tight uppercase">{title}</h2>
        <span className="text-[10px] text-muted font-black uppercase tracking-widest">{eyebrow}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "py-4" : "py-8"}`}>
      <div className="text-sm font-black text-foreground">{title}</div>
      <p className="text-xs text-muted mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}

function ProbCard({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  const col = accent ? "text-accent" : danger ? "text-danger" : "text-muted";
  return (
    <div className="rounded-xl bg-background/60 border border-border/50 p-3 text-center">
      <div className={`text-2xl font-black tabular-nums ${col}`}>{value}</div>
      <div className="text-[9px] text-muted font-black uppercase tracking-widest mt-0.5 truncate">{label}</div>
    </div>
  );
}

function PressureCard({ label, home, away }: { label: string; home: any; away: any }) {
  return (
    <div className="rounded-xl bg-background/70 border border-border/50 p-3.5">
      <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-black text-accent tabular-nums">{home}</span>
        <span className="text-[10px] text-muted font-black">vs</span>
        <span className="text-xl font-black text-danger tabular-nums">{away}</span>
      </div>
    </div>
  );
}

function StatRow({ row }: { row: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-black text-accent tabular-nums w-16">{row.homeValue}</span>
        <span className="text-[10px] font-black text-muted uppercase tracking-widest text-center flex-1 px-2">{row.label}</span>
        <span className="text-sm font-black text-danger tabular-nums w-16 text-right">{row.awayValue}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 h-1.5">
        <div className="bg-border/20 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: `${row.homePct}%` }} />
        </div>
        <div className="bg-border/20 rounded-full overflow-hidden flex justify-end">
          <div className="h-full bg-danger rounded-full" style={{ width: `${row.awayPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({ event, match }: { event: any; match: MatchShape }) {
  const side = event.team?.id === match.homeId ? "home" : event.team?.id === match.awayId ? "away" : "neutral";
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 p-2.5 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
        event.type === "Goal" ? "bg-accent text-white" : event.detail?.includes("Red") ? "bg-danger text-white" : "bg-surface border border-border text-foreground"
      }`}>
        {eventIcon(event.type, event.detail)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted font-black uppercase tracking-widest">{eventMinute(event)}&apos; · {event.type}</div>
        <div className="text-sm font-black text-foreground truncate">{event.player?.name || event.team?.name || "Match event"}</div>
        <div className="text-xs text-muted truncate">{event.detail || event.team?.name}</div>
      </div>
    </div>
  );
}

function MomentumRow({ bucket, match }: { bucket: any; match: MatchShape }) {
  const max = Math.max(bucket.home, bucket.away, 1);
  return (
    <div className="grid grid-cols-[48px_1fr_1fr] gap-3 items-center">
      <span className="text-[10px] text-muted font-black uppercase tracking-widest">{bucket.label}</span>
      <div className="h-2.5 bg-border/20 rounded-full overflow-hidden flex justify-end" title={match.homeTeam}>
        <div className="h-full bg-accent rounded-full" style={{ width: `${pct(bucket.home, max)}%` }} />
      </div>
      <div className="h-2.5 bg-border/20 rounded-full overflow-hidden" title={match.awayTeam}>
        <div className="h-full bg-danger rounded-full" style={{ width: `${pct(bucket.away, max)}%` }} />
      </div>
    </div>
  );
}

function LineupCard({ lineup, fallbackName }: { lineup: any; fallbackName: string }) {
  const starters    = lineup?.startXI ?? [];
  const substitutes = lineup?.substitutes ?? [];
  return (
    <div className="rounded-xl bg-background/70 border border-border/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-black text-foreground text-sm">{lineup?.team?.name || fallbackName}</div>
        <span className="text-[10px] text-accent font-black uppercase tracking-widest">{formation(lineup)}</span>
      </div>
      <div className="space-y-1.5">
        {starters.slice(0, 11).map(({ player }: any) => (
          <PlayerRow key={player.id || `${player.number}-${player.name}`} player={player} />
        ))}
      </div>
      {substitutes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-muted font-black uppercase tracking-widest">Substitutes ({substitutes.length})</summary>
          <div className="mt-2 space-y-1.5">
            {substitutes.slice(0, 9).map(({ player }: any) => (
              <PlayerRow key={player.id || `${player.number}-${player.name}`} player={player} muted />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PlayerRow({ player, muted = false }: { player: any; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="w-6 h-6 rounded-md bg-surface border border-border/50 flex items-center justify-center text-[10px] font-black text-muted tabular-nums shrink-0">
        {player.number || "-"}
      </span>
      <span className={`font-bold truncate ${muted ? "text-muted" : "text-foreground"}`}>{player.name}</span>
      <span className="ml-auto text-[10px] text-muted font-black">{player.pos || ""}</span>
    </div>
  );
}

function MarketRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneClass = tone === "hot" ? "text-accent bg-accent/10" : tone === "cool" ? "text-muted bg-surface" : "text-foreground bg-background";
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background/70 border border-border/50 w-full">
      <span className="text-xs text-muted font-black uppercase tracking-widest">{label}</span>
      <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${toneClass}`}>{value}</span>
    </div>
  );
}

// ─── Active stat indicator (used in the match header venue strip) ─────────────

/**
 * Listens for "stat-type-change" custom events fired by MatchAnalyticsTabs
 * and renders a small badge showing the currently selected stat.
 * Exported so page.tsx (server component) can place it in the venue strip.
 */
export function ActiveStatBadge() {
  const [label, setLabel] = useState("Goals");

  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<StatTypeId>).detail;
      setLabel(STAT_TYPES.find(s => s.id === id)?.label ?? "Goals");
    }
    window.addEventListener("stat-type-change", handler);
    return () => window.removeEventListener("stat-type-change", handler);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
      {label}
    </span>
  );
}
