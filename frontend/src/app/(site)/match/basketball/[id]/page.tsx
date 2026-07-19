"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import LeftLeagueSidebar from "@/components/LeftLeagueSidebar";
import RightStatsSidebar from "@/components/RightStatsSidebar";
import { withAuth } from "@/lib/authHeaders";
import { SaveMatchButton } from "@/components/SaveMatchButton";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Periods {
  home: { q1: number | null; q2: number | null; q3: number | null; q4: number | null; ot: number | null };
  away: { q1: number | null; q2: number | null; q3: number | null; q4: number | null; ot: number | null };
}

interface GameDetail {
  fixture: { id: number; date: string; status: { long: string; short: string; elapsed: number | null } };
  league: { id: number; name: string; country: string; logo: string; season?: number };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
  periods?: Periods;
}

interface TeamStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fouls: number;
  field_goals_made: number;
  field_goals_attempts: number;
  field_goals_percentage: number;
  three_points_made: number;
  three_points_attempts: number;
  three_points_percentage: number;
  free_throws_made: number;
  free_throws_attempts: number;
  free_throws_percentage: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_of_turnovers: number;
}

interface StatsEntry {
  team: { id: number; name: string; logo: string };
  statistics: TeamStats;
}

interface PlayerStat {
  player: { id: number; name: string };
  statistics: {
    minutes: string | number;
    points: number;
    totReb: number;
    assists: number;
    steals: number;
    blocks: number;
    fgp: string | number;
    tpp: string | number;
    ftp: string | number;
    pFouls: number;
    plusMinus: string | number;
  }[];
}

interface PlayersEntry {
  team: { id: number; name: string; logo: string };
  players: PlayerStat[];
}

interface FormGame {
  fixtureId: number;
  date: string;
  isHome: boolean;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number;
  awayScore: number;
  teamScore: number;
  oppScore: number;
  result: "W" | "D" | "L";
  leagueName?: string;
}

interface StandingEntry {
  rank?: number;
  position?: number;
  team?: { id: number; name: string; logo?: string };
  all?: { played?: number; win?: number; draw?: number; lose?: number };
  points?: number;
  wins?: number;
  losses?: number;
  played?: number;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "scores",    label: "Scores" },
  { id: "stats",     label: "Stats" },
  { id: "players",   label: "Players" },
  { id: "form",      label: "Form" },
  { id: "h2h",       label: "H2H" },
  { id: "standings", label: "Standings" },
  { id: "analysis",  label: "Analysis" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const LAST_N = [5, 10, 15, 20] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPct(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function fmtMin(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val).split(":")[0] + "m";
}

function fmtNum(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return String(val);
}

function pctOf(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function sortPlayers(players: PlayerStat[]): PlayerStat[] {
  return [...players].sort((a, b) => {
    const minA = parseFloat(String(a.statistics[0]?.minutes ?? "0")) || 0;
    const minB = parseFloat(String(b.statistics[0]?.minutes ?? "0")) || 0;
    const ptsA = a.statistics[0]?.points ?? 0;
    const ptsB = b.statistics[0]?.points ?? 0;
    if (minA === 0 && minB !== 0) return 1;
    if (minB === 0 && minA !== 0) return -1;
    return ptsB - ptsA;
  });
}

function computeFormGames(fixtures: unknown[], teamId: number): FormGame[] {
  const arr = Array.isArray(fixtures) ? fixtures : [];
  return arr
    .filter((f: any) => f.goals?.home !== null && f.goals?.away !== null && f.fixture?.status?.short !== "NS")
    .sort((a: any, b: any) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime())
    .slice(0, 20)
    .map((f: any) => {
      const isHome = f.teams?.home?.id === teamId;
      const teamScore = isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0);
      const oppScore  = isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0);
      const result: "W" | "D" | "L" = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
      const date = f.fixture?.date
        ? new Date(f.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
        : "";
      return {
        fixtureId: f.fixture?.id ?? 0,
        date,
        isHome,
        homeTeam: f.teams?.home?.name ?? "",
        awayTeam: f.teams?.away?.name ?? "",
        homeLogo: f.teams?.home?.logo,
        awayLogo: f.teams?.away?.logo,
        homeScore: f.goals?.home ?? 0,
        awayScore: f.goals?.away ?? 0,
        teamScore,
        oppScore,
        result,
        leagueName: f.league?.name ?? "",
      };
    });
}

function wdl(form: FormGame[]) {
  return {
    w: form.filter(f => f.result === "W").length,
    d: form.filter(f => f.result === "D").length,
    l: form.filter(f => f.result === "L").length,
  };
}

function avg(arr: number[]): string {
  if (!arr.length) return "0.0";
  return (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);
}

function extractStandings(raw: unknown): StandingEntry[] {
  if (!raw) return [];
  // Football-style: [{ league: { standings: [[...]] } }]
  const arr = Array.isArray(raw) ? raw : [];
  if (!arr.length) return [];
  // Check if it's grouped football-style
  const first = arr[0];
  if (first && typeof first === "object" && "league" in first) {
    const league = (first as any).league;
    const groups = league?.standings;
    if (Array.isArray(groups) && groups.length > 0 && Array.isArray(groups[0])) {
      // Flatten all groups into one list
      return (groups as StandingEntry[][]).flat();
    }
  }
  // Maybe it's already an array of group arrays
  if (Array.isArray(arr[0])) {
    return (arr as StandingEntry[][]).flat();
  }
  // Flat list
  return arr as StandingEntry[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TeamLogo({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-background border border-border/50 flex items-center justify-center overflow-hidden shadow-sm">
      {logo ? (
        <img src={logo} alt={name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
      ) : (
        <span className="text-lg font-black text-muted">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function StatusBadge({ statusLong, statusShort }: { statusLong: string; statusShort: string }) {
  const isLive = ["Q1", "Q2", "Q3", "Q4", "OT", "HT", "BT"].includes(statusShort.toUpperCase().replace(/\s/g, ""));
  const isFinal = statusShort === "FT" || statusShort === "AOT";
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/10 border border-live/20 text-live text-[10px] font-black uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
        {statusShort}
      </span>
    );
  }
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
      isFinal ? "bg-surface border-border text-muted" : "bg-accent/10 border-accent/20 text-accent"
    }`}>
      {isFinal ? "Final" : statusLong}
    </span>
  );
}

function StatBar({ label, homeVal, awayVal, homeDisplay, awayDisplay }: {
  label: string;
  homeVal: number;
  awayVal: number;
  homeDisplay?: string;
  awayDisplay?: string;
}) {
  const total = homeVal + awayVal;
  const homePct = total > 0 ? pctOf(homeVal, total) : 50;
  const awayPct = 100 - homePct;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-accent tabular-nums">{homeDisplay ?? homeVal}</span>
        <span className="text-muted/80 uppercase tracking-wider text-[10px]">{label}</span>
        <span className="text-danger tabular-nums">{awayDisplay ?? awayVal}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
        <div className="bg-accent rounded-full transition-all duration-500" style={{ width: `${homePct}%` }} />
        <div className="bg-danger rounded-full transition-all duration-500" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`bg-surface-hover animate-pulse rounded-xl ${className}`} />;
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

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "py-4" : "py-8"}`}>
      <div className="text-sm font-black text-foreground">{title}</div>
      <p className="text-xs text-muted mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Quarters Grid ───────────────────────────────────────────────────────────

function QuartersGrid({ game }: { game: GameDetail }) {
  const p = game.periods;
  if (!p) return null;

  const hasOT = p.home.ot !== null || p.away.ot !== null;
  const homeQ = [p.home.q1, p.home.q2, p.home.q3, p.home.q4];
  const awayQ = [p.away.q1, p.away.q2, p.away.q3, p.away.q4];

  const homeH1 = (homeQ[0] ?? 0) + (homeQ[1] ?? 0);
  const homeH2 = (homeQ[2] ?? 0) + (homeQ[3] ?? 0);
  const awayH1 = (awayQ[0] ?? 0) + (awayQ[1] ?? 0);
  const awayH2 = (awayQ[2] ?? 0) + (awayQ[3] ?? 0);

  const homeFinal = game.goals.home ?? 0;
  const awayFinal = game.goals.away ?? 0;

  const cols = ["Q1", "Q2", "Q3", "Q4", ...(hasOT ? ["OT"] : []), "FIN"];
  const homeRow = [...homeQ, ...(hasOT ? [p.home.ot] : []), homeFinal];
  const awayRow = [...awayQ, ...(hasOT ? [p.away.ot] : []), awayFinal];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30">
          <h2 className="text-[11px] font-black text-muted uppercase tracking-widest">Quarter Scores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-2 text-muted font-bold text-[10px] uppercase tracking-wider w-24">Team</th>
                {cols.map((c, i) => (
                  <th key={c} className={`px-3 py-2 text-center font-bold text-[10px] uppercase tracking-wider ${i === cols.length - 1 ? "text-foreground font-black" : "text-muted"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/20 hover:bg-surface-hover/40 transition-colors">
                <td className="px-4 py-3 font-bold text-foreground truncate max-w-[90px]">{game.teams.home.name}</td>
                {homeRow.map((v, i) => (
                  <td key={i} className={`px-3 py-3 text-center ${i === homeRow.length - 1 ? "font-black text-foreground text-[14px]" : "text-foreground/80"}`}>
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-surface-hover/40 transition-colors">
                <td className="px-4 py-3 font-bold text-foreground truncate max-w-[90px]">{game.teams.away.name}</td>
                {awayRow.map((v, i) => (
                  <td key={i} className={`px-3 py-3 text-center ${i === awayRow.length - 1 ? "font-black text-foreground text-[14px]" : "text-foreground/80"}`}>
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Halves */}
        <div className="border-t border-border/20 px-5 py-3 flex gap-6">
          <div className="text-[11px] text-muted font-bold uppercase tracking-wider">Halves</div>
          <div className="flex gap-4 text-[11px]">
            <span className="text-muted/60">H1</span>
            <span className="font-black text-foreground">{homeH1} – {awayH1}</span>
            <span className="text-border/60">·</span>
            <span className="text-muted/60">H2</span>
            <span className="font-black text-foreground">{homeH2} – {awayH2}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team Stats Section ───────────────────────────────────────────────────────

function TeamStatsSection({ stats, homeName, awayName }: { stats: StatsEntry[]; homeName: string; awayName: string }) {
  const h = stats[0]?.statistics;
  const a = stats[1]?.statistics;
  if (!h || !a) return null;

  const rows: { label: string; hVal: number; aVal: number; hDisplay?: string; aDisplay?: string }[] = [
    { label: "Points",        hVal: h.points,              aVal: a.points },
    { label: "Off Rebounds",  hVal: h.offensive_rebounds,  aVal: a.offensive_rebounds },
    { label: "Def Rebounds",  hVal: h.defensive_rebounds,  aVal: a.defensive_rebounds },
    { label: "Rebounds",      hVal: h.rebounds,            aVal: a.rebounds },
    { label: "Assists",       hVal: h.assists,              aVal: a.assists },
    { label: "Steals",        hVal: h.steals,               aVal: a.steals },
    { label: "Blocks",        hVal: h.blocks,               aVal: a.blocks },
    {
      label: "FG",
      hVal: h.field_goals_percentage ?? 0,
      aVal: a.field_goals_percentage ?? 0,
      hDisplay: `${h.field_goals_made}-${h.field_goals_attempts} (${fmtPct(h.field_goals_percentage)})`,
      aDisplay: `${a.field_goals_made}-${a.field_goals_attempts} (${fmtPct(a.field_goals_percentage)})`,
    },
    {
      label: "3-Point",
      hVal: h.three_points_percentage ?? 0,
      aVal: a.three_points_percentage ?? 0,
      hDisplay: `${h.three_points_made}-${h.three_points_attempts} (${fmtPct(h.three_points_percentage)})`,
      aDisplay: `${a.three_points_made}-${a.three_points_attempts} (${fmtPct(a.three_points_percentage)})`,
    },
    {
      label: "Free Throws",
      hVal: h.free_throws_percentage ?? 0,
      aVal: a.free_throws_percentage ?? 0,
      hDisplay: `${h.free_throws_made}-${h.free_throws_attempts} (${fmtPct(h.free_throws_percentage)})`,
      aDisplay: `${a.free_throws_made}-${a.free_throws_attempts} (${fmtPct(a.free_throws_percentage)})`,
    },
    { label: "Turnovers",     hVal: h.total_of_turnovers,  aVal: a.total_of_turnovers },
    { label: "Fouls",         hVal: h.fouls,                aVal: a.fouls },
  ];

  return (
    <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
        <h2 className="text-[11px] font-black text-muted uppercase tracking-widest">Team Statistics</h2>
        <div className="flex gap-4 text-[11px] font-bold">
          <span className="text-accent">{homeName}</span>
          <span className="text-danger">{awayName}</span>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        {rows.map(r => (
          <StatBar
            key={r.label}
            label={r.label}
            homeVal={r.hVal}
            awayVal={r.aVal}
            homeDisplay={r.hDisplay}
            awayDisplay={r.aDisplay}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Player Stats Section ─────────────────────────────────────────────────────

function PlayerTable({ players }: { players: PlayerStat[] }) {
  const sorted = sortPlayers(players);
  if (!sorted.length) {
    return <p className="text-center text-muted text-sm py-8">No player data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border/40 text-left">
            {["#", "Player", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "FLS", "+/-"].map(h => (
              <th key={h} className="px-2 py-2 text-muted font-bold text-[10px] uppercase tracking-wider whitespace-nowrap first:pl-4 last:pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {sorted.map((entry, i) => {
            const s = entry.statistics[0];
            const minVal = parseFloat(String(s?.minutes ?? "0")) || 0;
            const isDNP = minVal === 0;
            return (
              <tr key={entry.player.id} className={`hover:bg-surface-hover/40 transition-colors ${isDNP ? "opacity-40" : ""}`}>
                <td className="pl-4 pr-2 py-2.5 text-muted/60 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2.5 font-bold text-foreground whitespace-nowrap max-w-[120px] truncate">
                  {entry.player.name}
                </td>
                <td className="px-2 py-2.5 text-muted tabular-nums">{fmtMin(s?.minutes)}</td>
                <td className="px-2 py-2.5 font-black text-foreground tabular-nums">{fmtNum(s?.points)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtNum(s?.totReb)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtNum(s?.assists)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtNum(s?.steals)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtNum(s?.blocks)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtPct(s?.fgp)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtPct(s?.tpp)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtPct(s?.ftp)}</td>
                <td className="px-2 py-2.5 text-foreground/80 tabular-nums">{fmtNum(s?.pFouls)}</td>
                <td className="pr-4 pl-2 py-2.5 tabular-nums font-bold">
                  <span className={
                    s?.plusMinus !== undefined && s.plusMinus !== null
                      ? Number(s.plusMinus) > 0 ? "text-accent" : Number(s.plusMinus) < 0 ? "text-danger" : "text-muted"
                      : "text-muted"
                  }>
                    {s?.plusMinus !== undefined && s?.plusMinus !== null
                      ? (Number(s.plusMinus) > 0 ? "+" : "") + String(s.plusMinus)
                      : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsSection({ playersData, homeName, awayName, homeId }: {
  playersData: PlayersEntry[];
  homeName: string;
  awayName: string;
  homeId: number;
}) {
  const [tab, setTab] = useState<"home" | "away">("home");
  const homeEntry = playersData.find(e => e.team.id === homeId) ?? playersData[0];
  const awayEntry = playersData.find(e => e.team.id !== homeId) ?? playersData[1];
  const current = tab === "home" ? homeEntry : awayEntry;

  return (
    <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[11px] font-black text-muted uppercase tracking-widest">Player Stats</h2>
        <div className="flex gap-1">
          {(["home", "away"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                tab === t
                  ? "bg-accent text-white"
                  : "bg-surface-hover text-muted hover:text-foreground"
              }`}
            >
              {t === "home" ? homeName : awayName}
            </button>
          ))}
        </div>
      </div>
      {current ? (
        <PlayerTable players={current.players ?? []} />
      ) : (
        <p className="text-center text-muted text-sm py-8">No player data available.</p>
      )}
    </div>
  );
}

// ─── Form Tab ─────────────────────────────────────────────────────────────────

function FormTab({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homeId,
  awayId,
  homeFormRaw,
  awayFormRaw,
  formLoading,
  lastN,
}: {
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeId: number;
  awayId: number;
  homeFormRaw: unknown[];
  awayFormRaw: unknown[];
  formLoading: boolean;
  lastN: number;
}) {
  const homeForm = computeFormGames(homeFormRaw, homeId).slice(0, lastN);
  const awayForm = computeFormGames(awayFormRaw, awayId).slice(0, lastN);

  if (formLoading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-48" />
        <SkeletonBlock className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <TeamFormPanel
        teamName={homeName}
        logo={homeLogo}
        form={homeForm}
        color="accent"
      />
      <TeamFormPanel
        teamName={awayName}
        logo={awayLogo}
        form={awayForm}
        color="danger"
      />
    </div>
  );
}

function TeamFormPanel({
  teamName,
  logo,
  form,
  color,
}: {
  teamName: string;
  logo?: string;
  form: FormGame[];
  color: "accent" | "danger";
}) {
  const { w, d, l } = wdl(form);
  const winRate = form.length ? `${Math.round((w / form.length) * 100)}%` : "—";
  const avgScored = avg(form.map(f => f.teamScore));
  const avgConceded = avg(form.map(f => f.oppScore));

  return (
    <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
        {logo && <img src={logo} alt={teamName} className="w-7 h-7 object-contain" />}
        <span className="font-black text-foreground tracking-tight uppercase text-sm">{teamName}</span>
        <span className="text-[10px] text-muted/70 font-medium">{form.length} games</span>
        <div className="ml-auto flex items-center gap-1">
          {w > 0 && <ResultPill label={`${w}W`} type="W" />}
          {d > 0 && <ResultPill label={`${d}D`} type="D" />}
          {l > 0 && <ResultPill label={`${l}L`} type="L" />}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 border-b border-border/30">
        <div className={`py-4 px-2 text-center flex flex-col items-center gap-1 ${color === "accent" ? "bg-accent/8" : "bg-danger/8"}`}>
          <div className="text-[9px] text-muted font-black uppercase tracking-widest">Win Rate</div>
          <div className={`text-2xl font-black tabular-nums ${color === "accent" ? "text-accent" : "text-danger"}`}>{winRate}</div>
          <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">OF GAMES</div>
        </div>
        <div className="py-4 px-2 text-center flex flex-col items-center gap-1 bg-background/40">
          <div className="text-[9px] text-muted font-black uppercase tracking-widest">Avg Scored</div>
          <div className="text-2xl font-black tabular-nums text-foreground">{avgScored}</div>
          <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">PTS / GAME</div>
        </div>
        <div className="py-4 px-2 text-center flex flex-col items-center gap-1 bg-background/40">
          <div className="text-[9px] text-muted font-black uppercase tracking-widest">Avg Conceded</div>
          <div className="text-2xl font-black tabular-nums text-muted">{avgConceded}</div>
          <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">PTS / GAME</div>
        </div>
      </div>

      {/* Match rows */}
      {form.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[300px]">
            <div className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr_40px] gap-1 items-center bg-background/40 border-b border-border/20">
              {["DATE", "HOME", "SCORE", "AWAY", "RES"].map((h, i) => (
                <span key={i} className="text-[9px] font-black text-muted uppercase tracking-widest text-center first:text-left">
                  {h}
                </span>
              ))}
            </div>
            <div className="divide-y divide-border/15">
              {form.map((f, i) => {
                const scoreCls =
                  f.result === "W"
                    ? "bg-emerald-600 text-white"
                    : f.result === "L"
                    ? "bg-red-700 text-white"
                    : "bg-muted/30 text-foreground";
                return (
                  <div key={i} className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr_40px] gap-1 items-center hover:bg-background/30 transition-colors">
                    <span className="text-[10px] text-muted truncate">{f.date}</span>
                    <div className="flex items-center gap-1 min-w-0 justify-end">
                      {f.homeLogo && <img src={f.homeLogo} alt={f.homeTeam} className="w-3.5 h-3.5 object-contain shrink-0" />}
                      <span className="text-[11px] font-bold text-foreground truncate text-right">{f.homeTeam}</span>
                    </div>
                    <div className="flex justify-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black tabular-nums ${scoreCls}`}>
                        {f.homeScore}-{f.awayScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      {f.awayLogo && <img src={f.awayLogo} alt={f.awayTeam} className="w-3.5 h-3.5 object-contain shrink-0" />}
                      <span className="text-[11px] font-bold text-foreground truncate">{f.awayTeam}</span>
                    </div>
                    <div className="flex justify-center">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${scoreCls}`}>
                        {f.result}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted">No game history available</div>
      )}
    </div>
  );
}

// ─── H2H Tab ──────────────────────────────────────────────────────────────────

function H2HTab({
  homeName,
  awayName,
  homeId,
  h2hData,
  h2hLoading,
  lastN,
}: {
  homeName: string;
  awayName: string;
  homeId: number;
  h2hData: unknown[];
  h2hLoading: boolean;
  lastN: number;
}) {
  if (h2hLoading) {
    return <SkeletonBlock className="h-64" />;
  }

  const played = Array.isArray(h2hData)
    ? h2hData
        .filter((f: any) => f.goals?.home !== null && f.goals?.away !== null)
        .sort((a: any, b: any) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime())
        .slice(0, lastN)
    : [];

  const homeWins = played.filter((f: any) => {
    const trackedIsHome = f.teams?.home?.id === homeId;
    const hg = f.goals?.home ?? 0;
    const ag = f.goals?.away ?? 0;
    return trackedIsHome ? hg > ag : ag > hg;
  }).length;
  const awayWins = played.filter((f: any) => {
    const trackedIsHome = f.teams?.home?.id === homeId;
    const hg = f.goals?.home ?? 0;
    const ag = f.goals?.away ?? 0;
    return trackedIsHome ? ag > hg : hg > ag;
  }).length;
  const draws = played.length - homeWins - awayWins;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {played.length > 0 && (
        <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <span className="text-sm font-black text-foreground uppercase tracking-tight">
              {homeName} vs {awayName}
            </span>
            <span className="ml-auto text-[10px] text-muted font-bold">{played.length} meetings</span>
          </div>
          <div className="grid grid-cols-3">
            <div className="bg-danger/8 py-4 px-2 text-center flex flex-col items-center gap-1">
              <div className="text-[9px] text-muted font-black uppercase tracking-widest">{homeName.split(" ")[0]}</div>
              <div className="text-2xl font-black tabular-nums text-danger">{homeWins}</div>
              <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">WINS</div>
            </div>
            <div className="bg-background/40 py-4 px-2 text-center flex flex-col items-center gap-1">
              <div className="text-[9px] text-muted font-black uppercase tracking-widest">Draws</div>
              <div className="text-2xl font-black tabular-nums text-foreground">{draws}</div>
              <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">DRAWS</div>
            </div>
            <div className="bg-accent/8 py-4 px-2 text-center flex flex-col items-center gap-1">
              <div className="text-[9px] text-muted font-black uppercase tracking-widest">{awayName.split(" ")[0]}</div>
              <div className="text-2xl font-black tabular-nums text-accent">{awayWins}</div>
              <div className="text-[8px] text-muted/60 font-bold uppercase tracking-widest">WINS</div>
            </div>
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="rounded-2xl bg-surface border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <span className="text-sm font-black text-foreground uppercase tracking-tight">Recent Meetings</span>
          <span className="ml-auto text-[10px] text-muted font-bold">Last {played.length}</span>
        </div>

        {played.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <div className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr] gap-1 items-center bg-background/40 border-b border-border/20">
                {["DATE", "HOME", "SCORE", "AWAY"].map((h) => (
                  <span key={h} className="text-[9px] font-black text-muted uppercase tracking-widest text-center first:text-left">
                    {h}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-border/15">
                {played.map((fixture: any, i: number) => {
                  const hg = fixture.goals?.home ?? 0;
                  const ag = fixture.goals?.away ?? 0;
                  const trackedIsHome = fixture.teams?.home?.id === homeId;
                  const trackedGoals  = trackedIsHome ? hg : ag;
                  const oppGoals2     = trackedIsHome ? ag : hg;
                  const result: "W" | "D" | "L" = trackedGoals > oppGoals2 ? "W" : trackedGoals < oppGoals2 ? "L" : "D";
                  const scoreCls =
                    result === "W"
                      ? "bg-emerald-600 text-white"
                      : result === "L"
                      ? "bg-red-700 text-white"
                      : "bg-muted/30 text-foreground";
                  const date = fixture.fixture?.date
                    ? new Date(fixture.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                    : "—";
                  return (
                    <div key={i} className="px-3 py-2 grid grid-cols-[60px_1fr_52px_1fr] gap-1 items-center hover:bg-background/30 transition-colors min-w-[300px]">
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
                          {hg}-{ag}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        {fixture.teams?.away?.logo && (
                          <img src={fixture.teams.away.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                        )}
                        <span className="text-[11px] font-bold text-foreground truncate">{fixture.teams?.away?.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No previous meetings found" body="No head-to-head history is available for these two teams." compact />
        )}
      </div>
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

function StandingsTab({
  standingsData,
  standingsLoading,
  homeId,
  awayId,
}: {
  standingsData: unknown;
  standingsLoading: boolean;
  homeId: number;
  awayId: number;
}) {
  if (standingsLoading) {
    return <SkeletonBlock className="h-64" />;
  }

  const entries = extractStandings(standingsData);

  if (!entries.length) {
    return (
      <div className="rounded-2xl bg-surface border border-border/50 p-8 text-center">
        <EmptyState title="Standings unavailable" body="League table is not available for this fixture." />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-foreground tracking-tight uppercase">League Standings</h2>
        <span className="text-[10px] text-muted font-black uppercase tracking-widest">Current Season</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[340px]">
          <div className="px-3 py-2 grid grid-cols-[24px_1fr_30px_30px_30px_36px] gap-1 border-b border-border/30">
            {["#", "Team", "W", "L", "P", "Pts"].map((h) => (
              <span key={h} className="text-[9px] text-muted font-black uppercase tracking-widest text-center first:text-left">
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-border/20">
            {entries.map((entry: StandingEntry, idx: number) => {
              const teamId = entry.team?.id;
              const isHighlighted = teamId === homeId || teamId === awayId;
              const rank = entry.rank ?? entry.position ?? (idx + 1);
              // Support both football-style (entry.all.*) and basketball-style (entry.wins/losses)
              const wins   = entry.all?.win   ?? entry.wins   ?? 0;
              const losses = entry.all?.lose  ?? entry.losses ?? 0;
              const played = entry.all?.played ?? entry.played ?? (wins + losses);
              const pts    = entry.points ?? 0;
              return (
                <div
                  key={teamId ?? idx}
                  className={`px-3 py-2.5 grid grid-cols-[24px_1fr_30px_30px_30px_36px] gap-1 items-center transition-colors ${
                    isHighlighted ? "bg-accent/8 border-l-2 border-accent" : "hover:bg-background/40"
                  }`}
                >
                  <span className={`text-sm font-black tabular-nums ${isHighlighted ? "text-accent" : "text-muted"}`}>
                    {rank}
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {entry.team?.logo && (
                      <img src={entry.team.logo} alt={entry.team.name} className="w-4 h-4 object-contain shrink-0" />
                    )}
                    <span className={`text-[12px] font-bold truncate ${isHighlighted ? "text-accent" : "text-foreground"}`}>
                      {entry.team?.name ?? "—"}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted tabular-nums text-center">{wins}</span>
                  <span className="text-[12px] text-muted tabular-nums text-center">{losses}</span>
                  <span className="text-[12px] text-muted tabular-nums text-center">{played}</span>
                  <span className={`text-[13px] font-black tabular-nums text-center ${isHighlighted ? "text-accent" : "text-foreground"}`}>
                    {pts}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────

const ANALYSE_TABS = [
  { id: "ai",       label: "AI" },
  { id: "signals",  label: "Signals" },
  { id: "winprob",  label: "Win Prob" },
] as const;
type AnalyseTabId = (typeof ANALYSE_TABS)[number]["id"];

function AnalysisTab({
  homeName,
  awayName,
  homeId,
  awayId,
  homeFormRaw,
  awayFormRaw,
  h2hData,
  stats,
  formLoading,
  h2hLoading,
  matchId,
  isUpcoming,
}: {
  homeName: string;
  awayName: string;
  homeId: number;
  awayId: number;
  homeFormRaw: unknown[];
  awayFormRaw: unknown[];
  h2hData: unknown[];
  stats: StatsEntry[] | null;
  formLoading: boolean;
  h2hLoading: boolean;
  matchId: string;
  isUpcoming: boolean;
}) {
  const [analyseTab, setAnalyseTab] = useState<AnalyseTabId>("ai");

  const homeForm = computeFormGames(homeFormRaw, homeId);
  const awayForm = computeFormGames(awayFormRaw, awayId);

  // Basketball win probability — W/L only, no draws
  function formWinRate(form: FormGame[]): number {
    const last10 = form.slice(0, 10);
    if (!last10.length) return 0;
    return last10.filter(f => f.result === "W").length / last10.length;
  }

  const h2hPlayed = Array.isArray(h2hData)
    ? h2hData
        .filter((f: any) => f.goals?.home !== null && f.goals?.away !== null)
        .sort((a: any, b: any) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime())
        .slice(0, 10)
    : [];

  const h2hHomeWins = h2hPlayed.filter((f: any) => {
    const isHome = f.teams?.home?.id === homeId;
    const hg = f.goals?.home ?? 0;
    const ag = f.goals?.away ?? 0;
    return isHome ? hg > ag : ag > hg;
  }).length;
  const h2hAwayWins = h2hPlayed.filter((f: any) => {
    const isHome = f.teams?.home?.id === homeId;
    const hg = f.goals?.home ?? 0;
    const ag = f.goals?.away ?? 0;
    return isHome ? ag > hg : hg > ag;
  }).length;

  // Win probability: form win rate (60%) + H2H record (20%) + home court (20%)
  const homeFormRate  = formWinRate(homeForm);
  const awayFormRate  = formWinRate(awayForm);
  const h2hTotal      = h2hHomeWins + h2hAwayWins;
  const h2hHomeRate   = h2hTotal > 0 ? h2hHomeWins / h2hTotal : 0.5;
  const HOME_COURT    = 0.05; // ~5% home court advantage

  const rawHome = (homeFormRate * 0.6) + (h2hHomeRate * 0.2) + ((1 - awayFormRate) * 0.1) + HOME_COURT;
  const rawAway = (awayFormRate * 0.6) + ((1 - h2hHomeRate) * 0.2) + ((1 - homeFormRate) * 0.1);

  // Normalise to sum = 1
  const probSum  = rawHome + rawAway || 1;
  const homeWinPct = Math.round((rawHome / probSum) * 100);
  const awayWinPct = 100 - homeWinPct;

  // Signals
  const signals: { label: string; value: string; detail: string }[] = [];

  const { w: hw, l: hl } = wdl(homeForm.slice(0, 5));
  const { w: aw, l: al } = wdl(awayForm.slice(0, 5));
  if (homeForm.length > 0) {
    const streak = homeForm.slice(0, 3).every(f => f.result === "W") ? "🔥 3-game win streak" : homeForm.slice(0, 3).every(f => f.result === "L") ? "❄️ 3-game skid" : null;
    signals.push({
      label: `${homeName} Form`,
      value: `${hw}W–${hl}L in last 5 games`,
      detail: streak ? `${streak}. ${Math.round(homeFormRate * 100)}% win rate over last 10.` : `${Math.round(homeFormRate * 100)}% win rate over last 10 games.`,
    });
  }
  if (awayForm.length > 0) {
    const streak = awayForm.slice(0, 3).every(f => f.result === "W") ? "🔥 3-game win streak" : awayForm.slice(0, 3).every(f => f.result === "L") ? "❄️ 3-game skid" : null;
    signals.push({
      label: `${awayName} Form`,
      value: `${aw}W–${al}L in last 5 games`,
      detail: streak ? `${streak}. ${Math.round(awayFormRate * 100)}% win rate over last 10.` : `${Math.round(awayFormRate * 100)}% win rate over last 10 games.`,
    });
  }

  const homeAvgScored   = avg(homeForm.slice(0, 10).map(f => f.teamScore));
  const homeAvgConceded = avg(homeForm.slice(0, 10).map(f => f.oppScore));
  const awayAvgScored   = avg(awayForm.slice(0, 10).map(f => f.teamScore));
  const awayAvgConceded = avg(awayForm.slice(0, 10).map(f => f.oppScore));
  if (homeForm.length > 0 && awayForm.length > 0) {
    const higherScorer = Number(homeAvgScored) >= Number(awayAvgScored) ? homeName : awayName;
    signals.push({
      label: "Scoring",
      value: `${homeName} avg ${homeAvgScored} pts | ${awayName} avg ${awayAvgScored} pts`,
      detail: `${higherScorer} is the higher-scoring team recently. Defense: ${homeName} concedes ${homeAvgConceded}/g, ${awayName} concedes ${awayAvgConceded}/g.`,
    });
  }

  if (h2hPlayed.length > 0) {
    const leader = h2hHomeWins > h2hAwayWins ? homeName : h2hAwayWins > h2hHomeWins ? awayName : "Even";
    signals.push({
      label: "Head-to-Head",
      value: `${leader === "Even" ? "Series tied" : leader + " leads"} ${h2hHomeWins}–${h2hAwayWins}`,
      detail: `Based on ${h2hPlayed.length} recent meetings between these two teams.`,
    });
  }

  if (stats && stats.length >= 2) {
    const h = stats[0]?.statistics;
    const a = stats[1]?.statistics;
    if (h && a) {
      const hReb = h.rebounds ?? 0;
      const aReb = a.rebounds ?? 0;
      const hFg  = h.field_goals_percentage ?? 0;
      const aFg  = a.field_goals_percentage ?? 0;
      if (Math.abs(hReb - aReb) >= 1) {
        const rebLeader = hReb > aReb ? homeName : awayName;
        signals.push({ label: "Rebounds", value: `${rebLeader} outrebounded ${Math.abs(hReb - aReb)} board lead`, detail: `${homeName} ${hReb} REB vs ${awayName} ${aReb} REB this game.` });
      }
      if (Math.abs(hFg - aFg) >= 3) {
        const fgLeader = hFg > aFg ? homeName : awayName;
        signals.push({ label: "Shooting", value: `${fgLeader} shooting more efficiently`, detail: `FG%: ${homeName} ${Math.round(hFg)}% vs ${awayName} ${Math.round(aFg)}%.` });
      }
    }
  }

  if (!signals.length) {
    signals.push({ label: "Pre-game", value: "Live analytics unlock when the game starts", detail: `${homeName} vs ${awayName} — signals will populate as data arrives.` });
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {ANALYSE_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setAnalyseTab(t.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
              analyseTab === t.id
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground bg-surface border border-border/60 hover:bg-surface-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI sub-tab */}
      {analyseTab === "ai" && (
        <BbAiPredictionCard matchId={matchId} homeName={homeName} awayName={awayName} isUpcoming={isUpcoming} />
      )}

      {/* Signals sub-tab */}
      {analyseTab === "signals" && (
        <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-foreground tracking-tight uppercase">Data Signals</h2>
            <span className="text-[10px] text-muted font-black uppercase tracking-widest">Derived</span>
          </div>
          <div className="p-4 space-y-3">
            {signals.map((signal, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-background/70 border border-border/50">
                <div className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">{signal.label}</div>
                <div className="text-sm font-black text-foreground">{signal.value}</div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win Probability sub-tab */}
      {analyseTab === "winprob" && (
        <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-foreground tracking-tight uppercase">Win Probability</h2>
            <span className="text-[10px] text-muted font-black uppercase tracking-widest">Signal Model</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-accent/8 border border-accent/25 p-4 text-center">
                <div className="text-3xl font-black tabular-nums text-accent">{homeWinPct}%</div>
                <div className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 truncate">{homeName}</div>
              </div>
              <div className="rounded-xl bg-danger/8 border border-danger/25 p-4 text-center">
                <div className="text-3xl font-black tabular-nums text-danger">{awayWinPct}%</div>
                <div className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 truncate">{awayName}</div>
              </div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-accent rounded-l-full transition-all duration-500" style={{ width: `${homeWinPct}%` }} />
              <div className="bg-danger rounded-r-full transition-all duration-500" style={{ width: `${awayWinPct}%` }} />
            </div>
            <p className="mt-3 text-[10px] text-muted leading-relaxed">
              Uses form win rate (60%), H2H record (20%), opponent defense (10%), home court advantage (10%). Not bookmaker odds.
            </p>

            {/* Quick stats grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {homeForm.length > 0 && (
                <div className="rounded-xl bg-background/60 border border-border/40 p-3 text-center">
                  <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">{homeName.split(" ")[0]} Win Rate</div>
                  <div className="text-lg font-black text-accent tabular-nums">{Math.round(homeFormRate * 100)}%</div>
                  <div className="text-[9px] text-muted/70 font-bold">last 10 games</div>
                </div>
              )}
              {awayForm.length > 0 && (
                <div className="rounded-xl bg-background/60 border border-border/40 p-3 text-center">
                  <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">{awayName.split(" ")[0]} Win Rate</div>
                  <div className="text-lg font-black text-danger tabular-nums">{Math.round(awayFormRate * 100)}%</div>
                  <div className="text-[9px] text-muted/70 font-bold">last 10 games</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Prediction (basketball) ───────────────────────────────────────────────

interface BbAiSection { heading: string; content: string; index: number }
type BbAiStatus = "loading" | "streaming" | "done" | "error";

function bbParseSections(raw: string): BbAiSection[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/^###\s+/m)
    .filter(p => p.trim())
    .map((chunk, index) => {
      const lines = chunk.split("\n");
      const heading = lines[0].trim().replace(/^\d+\.\s*/, "").replace(/:$/, "").trim();
      const content = lines.slice(1).join("\n").trim();
      return { heading, content, index };
    });
}

function BbRichText({ text }: { text: string }) {
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

function BbSectionBody({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n").filter(l => l.trim());
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isBullet  = /^[\s]*[-*•]\s+/.test(line);
        const isNumered = /^\s*\d+[.)]\s+/.test(line);
        const body      = line.replace(/^[\s]*[-*•\d.)+]\s*/, "").trim();
        if (isBullet || isNumered) {
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="text-sm text-foreground/90 leading-relaxed"><BbRichText text={body} /></span>
            </div>
          );
        }
        return <p key={i} className="text-sm text-foreground/90 leading-relaxed"><BbRichText text={line.trim()} /></p>;
      })}
    </div>
  );
}

function BbAiSkeleton() {
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

function BbPredictView({ sections, homeName, awayName }: { sections: BbAiSection[]; homeName: string; awayName: string }) {
  const byKw = (kw: RegExp) => sections.find(s => kw.test(s.heading));
  const s1 = sections[0] ?? byKw(/winner/i);
  const s2 = sections[1] ?? byKw(/score/i);
  const s3 = sections[2] ?? byKw(/matchup|key match/i);
  const s4 = sections[3] ?? byKw(/factor/i);
  const s5 = sections[4] ?? byKw(/confidence/i);

  const verdictText = s1?.content ?? "";
  const homeWords   = homeName.split(" ").filter(w => w.length > 3);
  const awayWords   = awayName.split(" ").filter(w => w.length > 3);
  const mentionsHome = homeWords.some(w => verdictText.toLowerCase().includes(w.toLowerCase()));
  const mentionsAway = awayWords.some(w => verdictText.toLowerCase().includes(w.toLowerCase()));
  const tone = mentionsHome && !mentionsAway ? "home" : mentionsAway && !mentionsHome ? "away" : "neutral";
  const verdictBg   = tone === "home" ? "bg-accent/8 border-accent/25" : tone === "away" ? "bg-danger/8 border-danger/25" : "bg-muted/10 border-border/40";
  const verdictClr  = tone === "home" ? "text-accent" : tone === "away" ? "text-danger" : "text-foreground";

  const scoreMatch = s2?.content.match(/\*?\*?(\d+[–-]\d+)\*?\*?/);
  const score = scoreMatch?.[1] ?? s2?.content.split("\n")[0].replace(/\*\*/g, "").trim().slice(0, 15) ?? "—";

  const confMatch = s5?.content.match(/\*?\*?(High|Medium|Low)\*?\*?/i);
  const confLevel = confMatch?.[1] ?? null;
  const confBg    = confLevel === "High" ? "bg-emerald-500/10 border-emerald-500/20" : confLevel === "Medium" ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/10 border-border/40";
  const confClr   = confLevel === "High" ? "text-emerald-400" : confLevel === "Medium" ? "text-amber-400" : "text-muted";

  return (
    <div className="space-y-3">
      {s1 && (
        <div className={`rounded-xl border p-4 ${verdictBg}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">{s1.heading}</div>
          <div className={`text-sm leading-relaxed ${verdictClr}`}><BbSectionBody text={s1.content} /></div>
        </div>
      )}
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
            <div className={`text-xl font-black ${confClr}`}>{confLevel}</div>
          </div>
        )}
      </div>
      {s3 && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">{s3.heading}</div>
          <BbSectionBody text={s3.content} />
        </div>
      )}
      {s4 && (
        <div className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-3">{s4.heading}</div>
          <BbSectionBody text={s4.content} />
        </div>
      )}
    </div>
  );
}

function BbAnalyseView({ sections }: { sections: BbAiSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i} className="rounded-xl bg-background/70 border border-border/50 p-4">
          <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-3">{section.heading}</div>
          <BbSectionBody text={section.content} />
        </div>
      ))}
    </div>
  );
}

function BbAiPredictionCard({ matchId, homeName, awayName, isUpcoming }: {
  matchId: string; homeName: string; awayName: string; isUpcoming: boolean;
}) {
  const [status,     setStatus]     = useState<BbAiStatus>("loading");
  const [streamText, setStreamText] = useState("");
  const [sections,   setSections]   = useState<BbAiSection[]>([]);
  const [mode,       setMode]       = useState<"predict" | "analyse">("predict");
  const [error,      setError]      = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    setStatus("loading"); setError(""); setStreamText(""); setSections([]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `${BASE}/api/matches/${matchId}/ai-prediction?sport=basketball`,
        withAuth({ signal: abortRef.current.signal }),
      );
      const ct = res.headers.get("content-type") ?? "";

      if (ct.includes("application/json")) {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Analysis unavailable");
        const m: "predict" | "analyse" = json.data?.mode === "analyse" ? "analyse" : "predict";
        setMode(m);
        setSections(bbParseSections(json.data?.analysis ?? ""));
        setStatus("done");
        return;
      }

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
            if (ev.token) { full += ev.token; setStreamText(full); }
            if (ev.done) {
              const m: "predict" | "analyse" = ev.mode === "analyse" ? "analyse" : "predict";
              setMode(m);
              setSections(bbParseSections(ev.analysis ?? full));
              setStatus("done");
            }
            if (ev.error) { setError(ev.error); setStatus("error"); }
          } catch { /* skip malformed */ }
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
  const eyebrow = status === "loading" ? "ai" : status === "streaming" ? "generating…" : mode === "predict" ? "pre-game" : "game analysis";

  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] text-accent font-black uppercase tracking-widest">{eyebrow}</div>
          <h2 className="text-sm font-black text-foreground tracking-tight uppercase mt-0.5">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {status === "done" && (
            <button onClick={load} className="text-[10px] font-black text-muted hover:text-foreground uppercase tracking-wider transition-colors cursor-pointer">
              Refresh
            </button>
          )}
          {status === "error" && (
            <button
              onClick={load}
              className="px-3 py-1.5 bg-accent text-white text-[11px] font-black rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {status === "loading" && <BbAiSkeleton />}

        {status === "streaming" && (
          <div className="rounded-xl bg-background/70 border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
              <span className="text-[10px] text-muted font-black uppercase tracking-widest">Analysing</span>
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
          </div>
        )}

        {status === "done" && sections.length > 0 && (
          mode === "predict"
            ? <BbPredictView sections={sections} homeName={homeName} awayName={awayName} />
            : <BbAnalyseView sections={sections} />
        )}

        {status === "done" && sections.length === 0 && (
          <div className="flex items-center gap-4 py-3">
            <p className="text-sm font-black text-foreground">Empty response — try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BasketballMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [tab, setTab] = useState<TabId>("scores");
  const [lastN, setLastN] = useState<number>(10);

  const [game,     setGame]     = useState<GameDetail | null>(null);
  const [stats,    setStats]    = useState<StatsEntry[] | null>(null);
  const [players,  setPlayers]  = useState<PlayersEntry[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Secondary data — fetched after game loads
  const [homeFormRaw,  setHomeFormRaw]  = useState<unknown[]>([]);
  const [awayFormRaw,  setAwayFormRaw]  = useState<unknown[]>([]);
  const [h2hData,      setH2HData]      = useState<unknown[]>([]);
  const [standingsData,setStandingsData]= useState<unknown>(null);
  const [formLoading,  setFormLoading]  = useState(false);
  const [h2hLoading,   setH2HLoading]   = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Load primary data
  const fetchPrimary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gameRes, statsRes, playersRes] = await Promise.all([
        fetch(`${BASE}/api/matches/${id}?sport=basketball`),
        fetch(`${BASE}/api/matches/${id}/stats?sport=basketball`),
        fetch(`${BASE}/api/matches/${id}/players?sport=basketball`),
      ]);

      if (!gameRes.ok) throw new Error(`Game fetch failed: ${gameRes.status}`);
      const gameJson = await gameRes.json();
      const g = gameJson?.data ?? null;
      setGame(g);

      if (statsRes.ok) {
        const sj = await statsRes.json();
        setStats(sj?.data ?? null);
      }
      if (playersRes.ok) {
        const pj = await playersRes.json();
        setPlayers(pj?.data ?? null);
      }

      return g;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load match data.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load secondary data after game is available
  const fetchSecondary = useCallback(async (g: GameDetail) => {
    const homeId   = g.teams.home.id;
    const awayId   = g.teams.away.id;
    const leagueId = g.league?.id;
    const season   = g.league?.season;

    setFormLoading(true);
    Promise.all([
      fetch(`${BASE}/api/teams/${homeId}/fixtures?last=20&sport=basketball`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/teams/${awayId}/fixtures?last=20&sport=basketball`).then(r => r.ok ? r.json() : null),
    ]).then(([hj, aj]) => {
      setHomeFormRaw(hj?.data ?? []);
      setAwayFormRaw(aj?.data ?? []);
    }).catch(() => {}).finally(() => setFormLoading(false));

    setH2HLoading(true);
    fetch(`${BASE}/api/h2h?team1=${homeId}&team2=${awayId}&last=10&sport=basketball`)
      .then(r => r.ok ? r.json() : null)
      .then(j => setH2HData(j?.data ?? []))
      .catch(() => {})
      .finally(() => setH2HLoading(false));

    if (leagueId && season) {
      setStandingsLoading(true);
      fetch(`${BASE}/api/leagues/${leagueId}/standings?season=${season}&sport=basketball`)
        .then(r => r.ok ? r.json() : null)
        .then(j => setStandingsData(j?.data ?? null))
        .catch(() => {})
        .finally(() => setStandingsLoading(false));
    }
  }, []);

  useEffect(() => {
    fetchPrimary().then(g => { if (g) fetchSecondary(g); });
  }, [fetchPrimary, fetchSecondary]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex gap-5 px-3 sm:px-4 lg:px-6 py-6 max-w-[1600px] mx-auto pb-28 lg:pb-12">
        <LeftLeagueSidebar currentLeagueId={null} />
        <div className="flex-1 min-w-0 space-y-4">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-72" />
        </div>
        <RightStatsSidebar />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !game) {
    return (
      <div className="flex gap-5 px-3 sm:px-4 lg:px-6 py-6 max-w-[1600px] mx-auto">
        <LeftLeagueSidebar currentLeagueId={null} />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-12 h-12 bg-background rounded-xl border border-border flex items-center justify-center mb-2">
            <span className="text-2xl">🏀</span>
          </div>
          <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Match Not Found</h2>
          <p className="text-xs text-muted text-center max-w-[200px]">
            {error ?? "This match could not be loaded."}
          </p>
          <Link href="/" className="mt-2 px-4 py-2 bg-accent text-white text-[11px] font-black rounded-lg hover:bg-accent-hover transition-colors">
            Back to Matches
          </Link>
        </div>
        <RightStatsSidebar />
      </div>
    );
  }

  const statusShort = game.fixture.status.short;
  const isUpcoming  = statusShort === "NS" || game.goals.home === null;
  const matchId     = id;
  const displayDate = game.fixture.date
    ? new Date(game.fixture.date).toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : "";

  const homeName = game.teams.home.name;
  const awayName = game.teams.away.name;
  const homeId   = game.teams.home.id;
  const awayId   = game.teams.away.id;

  return (
    <div className="flex gap-5 px-3 sm:px-4 lg:px-6 py-6 font-sans pb-28 lg:pb-12 max-w-[1600px] mx-auto">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <LeftLeagueSidebar currentLeagueId={game.league?.id ?? null} />

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-1">
          <Link href="/" className="text-[10px] font-black text-muted hover:text-accent uppercase tracking-widest transition-colors">
            Matches
          </Link>
          <span className="text-muted/30">/</span>
          <span className="text-[10px] font-black text-muted hover:text-accent uppercase tracking-widest transition-colors">
            Basketball
          </span>
          <span className="text-muted/30">/</span>
          <span className="text-[10px] font-black text-foreground uppercase tracking-widest truncate">
            {homeName} vs {awayName}
          </span>
        </div>

        {/* ── Score Header ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-surface">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-accent" />

          <div className="flex items-center gap-2 px-5 sm:px-7 pt-4 pb-0 flex-wrap">
            {game.league?.logo && (
              <img src={game.league.logo} alt={game.league.name} className="w-4 h-4 object-contain" />
            )}
            <span className="text-[11px] font-bold text-muted">{game.league?.name}</span>
            {game.league?.country && (
              <>
                <span className="text-muted/30">·</span>
                <span className="text-[11px] text-muted/70">{game.league.country}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isUpcoming&&<SaveMatchButton fixtureId={matchId} sport="basketball" startsAt={game.fixture.date}
                homeTeam={homeName} awayTeam={awayName} league={game.league?.name}/>}
              <StatusBadge statusLong={game.fixture.status.long} statusShort={statusShort} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 px-4 sm:px-7 py-6 sm:py-8">
            <div className="flex flex-col items-center gap-2">
              <TeamLogo name={homeName} logo={game.teams.home.logo} />
              <h1 className="text-[11px] sm:text-sm font-black text-foreground text-center tracking-tight uppercase leading-tight px-1 max-w-[90px] sm:max-w-[140px]">
                {homeName}
              </h1>
            </div>

            <div className="text-center min-w-[96px] sm:min-w-[150px]">
              <div className="text-[10px] text-muted/70 mb-2 font-medium">{displayDate}</div>
              {game.goals.home !== null && game.goals.away !== null ? (
                <>
                  <div className="text-4xl sm:text-6xl font-black text-foreground tracking-tight tabular-nums leading-none">
                    {game.goals.home} – {game.goals.away}
                  </div>
                  {game.fixture.status.elapsed && (
                    <div className="mt-2 inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
                      <span className="text-[11px] text-live font-black">{game.fixture.status.elapsed}&apos;</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-2xl sm:text-4xl font-black text-foreground tracking-tight tabular-nums">
                  TBD
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <TeamLogo name={awayName} logo={game.teams.away.logo} />
              <h1 className="text-[11px] sm:text-sm font-black text-foreground text-center tracking-tight uppercase leading-tight px-1 max-w-[90px] sm:max-w-[140px]">
                {awayName}
              </h1>
            </div>
          </div>

          <div className="border-t border-border/30 px-5 sm:px-7 py-2.5 flex items-center gap-2">
            <span className="text-[10px] text-muted flex items-center gap-1.5">
              🏀 Basketball
            </span>
            <span className="text-[10px] text-muted/50 ml-auto">#{id}</span>
          </div>
        </section>

        {/* ── Tab Navigation ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
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
              </button>
            ))}
          </div>

          {/* Last N filter — shown for form and h2h */}
          {(tab === "form" || tab === "h2h") && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted font-bold shrink-0">Last:</span>
              {LAST_N.map(n => (
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

        {/* ── Tab Content ──────────────────────────────────────────────────── */}

        {tab === "scores" && (
          game.periods ? (
            <QuartersGrid game={game} />
          ) : (
            <div className="rounded-2xl bg-surface border border-border/40 p-12 flex flex-col items-center gap-3">
              <span className="text-4xl">🏀</span>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">No Score Data Yet</h3>
              <p className="text-xs text-muted text-center max-w-[220px]">
                Quarter scores will appear once the game is underway or completed.
              </p>
            </div>
          )
        )}

        {tab === "stats" && (
          stats && stats.length >= 2 ? (
            <TeamStatsSection stats={stats} homeName={homeName} awayName={awayName} />
          ) : (
            <div className="rounded-2xl bg-surface border border-border/40 p-12 flex flex-col items-center gap-3">
              <span className="text-4xl">📊</span>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">No Stats Yet</h3>
              <p className="text-xs text-muted text-center max-w-[220px]">
                Team statistics will appear once the game is underway or completed.
              </p>
            </div>
          )
        )}

        {tab === "players" && (
          players && players.length > 0 ? (
            <PlayerStatsSection
              playersData={players}
              homeName={homeName}
              awayName={awayName}
              homeId={homeId}
            />
          ) : (
            <div className="rounded-2xl bg-surface border border-border/40 p-12 flex flex-col items-center gap-3">
              <span className="text-4xl">👤</span>
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">No Player Data Yet</h3>
              <p className="text-xs text-muted text-center max-w-[220px]">
                Player statistics will appear once the game is underway or completed.
              </p>
            </div>
          )
        )}

        {tab === "form" && (
          <FormTab
            homeName={homeName}
            awayName={awayName}
            homeLogo={game.teams.home.logo}
            awayLogo={game.teams.away.logo}
            homeId={homeId}
            awayId={awayId}
            homeFormRaw={homeFormRaw}
            awayFormRaw={awayFormRaw}
            formLoading={formLoading}
            lastN={lastN}
          />
        )}

        {tab === "h2h" && (
          <H2HTab
            homeName={homeName}
            awayName={awayName}
            homeId={homeId}
            h2hData={h2hData}
            h2hLoading={h2hLoading}
            lastN={lastN}
          />
        )}

        {tab === "standings" && (
          <StandingsTab
            standingsData={standingsData}
            standingsLoading={standingsLoading}
            homeId={homeId}
            awayId={awayId}
          />
        )}

        {tab === "analysis" && (
          <AnalysisTab
            homeName={homeName}
            awayName={awayName}
            homeId={homeId}
            awayId={awayId}
            homeFormRaw={homeFormRaw}
            awayFormRaw={awayFormRaw}
            h2hData={h2hData}
            stats={stats}
            formLoading={formLoading}
            h2hLoading={h2hLoading}
            matchId={matchId}
            isUpcoming={isUpcoming}
          />
        )}

      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <RightStatsSidebar />
    </div>
  );
}
