import Link from "next/link";
import { notFound } from "next/navigation";
import { fixtureToMatch, computeH2HStats } from "@/lib/transforms";
import { MatchAnalyticsTabs, ActiveStatBadge } from "./_tabs";
import type { FormMatch } from "./_tabs";
import LeftLeagueSidebar from "@/components/LeftLeagueSidebar";
import RightStatsSidebar from "@/components/RightStatsSidebar";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const FINISHED   = new Set(["FT", "AET", "PEN"]);
const NOT_STARTED = new Set(["NS", "TBD"]);
const IMPORTANT_EVENTS = new Set(["Goal", "Card", "subst", "Var"]);

async function fetchJson(url: string, revalidate = 30) {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function playedH2H(fixtures: any[]) {
  return fixtures
    .filter((f) => f.goals?.home !== null && f.goals?.away !== null)
    .sort((a, b) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime());
}

function h2hTrend(fixtures: any[]) {
  const played = playedH2H(fixtures);
  const totalGoals = played.reduce((sum: number, f: any) => sum + f.goals.home + f.goals.away, 0);
  const btts = played.filter((f: any) => f.goals.home > 0 && f.goals.away > 0).length;
  const over25 = played.filter((f: any) => f.goals.home + f.goals.away > 2.5).length;
  return {
    played,
    totalGoals,
    avgGoals: played.length ? (totalGoals / played.length).toFixed(1) : "0.0",
    bttsPct: pct(btts, played.length),
    over25Pct: pct(over25, played.length),
  };
}

function buildMomentum(events: any[], match: any) {
  const buckets = [
    { label: "0-15",  home: 0, away: 0 },
    { label: "16-30", home: 0, away: 0 },
    { label: "31-45", home: 0, away: 0 },
    { label: "46-60", home: 0, away: 0 },
    { label: "61-75", home: 0, away: 0 },
    { label: "76-90", home: 0, away: 0 },
  ];
  events.forEach((event) => {
    if (!IMPORTANT_EVENTS.has(event.type)) return;
    const minute = (event.time?.elapsed ?? 0) + (event.time?.extra ?? 0);
    const index = Math.min(Math.max(Math.ceil(minute / 15) - 1, 0), buckets.length - 1);
    const weight = event.type === "Goal" ? 4 : event.type === "Card" ? 1 : 2;
    if (event.team?.id === match.homeId) buckets[index].home += weight;
    if (event.team?.id === match.awayId) buckets[index].away += weight;
  });
  return buckets;
}

function buildSignals({ match, statsData, h2hStats, trend }: any) {
  const signals: any[] = [];
  const possessionHome = statValue(statsData, 0, "Ball Possession");
  const possessionAway = statValue(statsData, 1, "Ball Possession");
  const shotsHome = statValue(statsData, 0, "Shots on Goal");
  const shotsAway = statValue(statsData, 1, "Shots on Goal");
  const cornersHome = statValue(statsData, 0, "Corner Kicks");
  const cornersAway = statValue(statsData, 1, "Corner Kicks");
  const cardsHome  = statValue(statsData, 0, "Yellow Cards") + statValue(statsData, 0, "Red Cards") * 2;
  const cardsAway  = statValue(statsData, 1, "Yellow Cards") + statValue(statsData, 1, "Red Cards") * 2;

  if (possessionHome || possessionAway) {
    const leader = possessionHome >= possessionAway ? match.homeTeam : match.awayTeam;
    signals.push({ label: "Control", value: `${leader} control more of the ball`, detail: `${statDisplay(statsData, 0, "Ball Possession")} vs ${statDisplay(statsData, 1, "Ball Possession")} possession.` });
  }
  if (shotsHome || shotsAway) {
    const edge = shotsHome - shotsAway;
    signals.push({ label: "Shot Quality", value: Math.abs(edge) >= 2 ? `${edge > 0 ? match.homeTeam : match.awayTeam} are creating the cleaner chances` : "Chance quality is close", detail: `${shotsHome} - ${shotsAway} shots on goal.` });
  }
  if (cornersHome + cornersAway > 0) {
    signals.push({ label: "Set Pieces", value: `${cornersHome + cornersAway} total corners`, detail: cornersHome === cornersAway ? "Set-piece pressure is even." : `${cornersHome > cornersAway ? match.homeTeam : match.awayTeam} have the corner edge.` });
  }
  if (cardsHome + cardsAway > 0) {
    signals.push({ label: "Discipline", value: cardsHome === cardsAway ? "Discipline risk is balanced" : `${cardsHome > cardsAway ? match.homeTeam : match.awayTeam} carry more card risk`, detail: `Weighted card count: ${cardsHome} - ${cardsAway}.` });
  }
  if (trend.played?.length > 0) {
    signals.push({ label: "H2H Goals", value: `${trend.avgGoals} goals per H2H meeting`, detail: `${trend.bttsPct}% BTTS and ${trend.over25Pct}% over 2.5 across ${trend.played.length} recent meetings.` });
  }
  if (!signals.length) {
    signals.push({ label: "Pre-match", value: "Live analytics unlock after match events arrive", detail: `${match.homeTeam} and ${match.awayTeam} have limited live data available right now.` });
  }
  return signals.slice(0, 5);
}

function outcomeModel({ match, statsData, h2hStats }: any) {
  let home = 33, draw = 34, away = 33;
  home  += h2hStats.homeWins * 3;
  away  += h2hStats.awayWins * 3;
  draw  += h2hStats.draws * 2;
  const shotEdge       = statValue(statsData, 0, "Shots on Goal") - statValue(statsData, 1, "Shots on Goal");
  const possessionEdge = statValue(statsData, 0, "Ball Possession") - statValue(statsData, 1, "Ball Possession");
  home += Math.max(shotEdge, 0) * 4 + Math.max(possessionEdge, 0) * 0.25;
  away += Math.max(-shotEdge, 0) * 4 + Math.max(-possessionEdge, 0) * 0.25;
  if (match.score) {
    const [hg, ag] = match.score.split("-").map((s: string) => Number.parseInt(s.trim(), 10));
    if (hg > ag) home += 18;
    if (ag > hg) away += 18;
    if (hg === ag) draw += 10;
  }
  const total = home + draw + away;
  return { home: pct(home, total), draw: pct(draw, total), away: pct(away, total) };
}

function computeTeamForm(fixtures: any[], teamId: number): FormMatch[] {
  return (fixtures ?? [])
    .filter((f: any) => f.goals?.home !== null && f.goals?.away !== null && f.fixture?.status?.short !== "NS")
    .sort((a: any, b: any) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime())
    .slice(0, 20)
    .map((f: any) => {
      const isHome = f.teams?.home?.id === teamId;
      const teamGoals = isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0);
      const oppGoals  = isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0);
      const htTeamGoals = isHome ? (f.score?.halftime?.home ?? null) : (f.score?.halftime?.away ?? null);
      const htOppGoals  = isHome ? (f.score?.halftime?.away ?? null) : (f.score?.halftime?.home ?? null);
      const result: "W" | "D" | "L" = teamGoals > oppGoals ? "W" : teamGoals < oppGoals ? "L" : "D";
      const date = f.fixture?.date
        ? new Date(f.fixture.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
        : "";
      return {
        fixtureId:  f.fixture?.id ?? 0,
        date,
        isHome,
        homeTeam:   f.teams?.home?.name ?? "",
        awayTeam:   f.teams?.away?.name ?? "",
        homeLogo:   f.teams?.home?.logo,
        awayLogo:   f.teams?.away?.logo,
        leagueLogo: f.league?.logo,
        teamGoals,
        oppGoals,
        htTeamGoals,
        htOppGoals,
        result,
        league: f.league?.name ?? "",
      };
    });
}

function ordinal(n: number): string {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function findTeamPos(standings: any[], teamId: number): number | null {
  for (const group of standings) {
    if (!Array.isArray(group)) continue;
    const entry = group.find((e: any) => e.team?.id === teamId);
    if (entry) return entry.rank ?? null;
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const matchJson = await fetchJson(`${BASE}/api/matches/${id}`);
  if (!matchJson?.data) notFound();

  const match = fixtureToMatch(matchJson.data);
  if (!match) notFound();

  const hasStarted = !NOT_STARTED.has(match.statusShort);
  const isFinished  = FINISHED.has(match.statusShort);
  const season: string | undefined = matchJson.data?.league?.season?.toString();

  const [h2hJson, eventsJson, homeFixJson, awayFixJson, standingsJson] = await Promise.all([
    fetchJson(`${BASE}/api/h2h?team1=${match.homeId}&team2=${match.awayId}&last=10`, 3600),
    hasStarted ? fetchJson(`${BASE}/api/matches/${id}/events`, 60)  : Promise.resolve(null),
    fetchJson(`${BASE}/api/teams/${match.homeId}/fixtures?last=20`, 300),
    fetchJson(`${BASE}/api/teams/${match.awayId}/fixtures?last=20`, 300),
    season ? fetchJson(`${BASE}/api/leagues/${match.leagueId}/standings?season=${season}`, 3600) : Promise.resolve(null),
  ]);

  const h2hFixtures = h2hJson?.data ?? [];
  const h2hStats    = computeH2HStats(h2hFixtures, match.homeId);
  const trend       = h2hTrend(h2hFixtures);
  const events      = eventsJson?.data ?? [];
  const statsData   = null;
  const matchStats  = null;
  const lineups: any[] = [];
  const homeLineup  = undefined;
  const awayLineup  = undefined;
  const momentum    = buildMomentum(events, match);
  const signals     = buildSignals({ match, statsData: null, h2hStats, trend });
  const model       = outcomeModel({ match, statsData: null, h2hStats });
  const predictions = null;
  const injuries: any[] = [];
  const homeForm    = computeTeamForm(homeFixJson?.data ?? [], match.homeId);
  const awayForm    = computeTeamForm(awayFixJson?.data ?? [], match.awayId);

  let standings: any[] = [];
  if (standingsJson?.data) {
    const raw = standingsJson.data;
    const groups = Array.isArray(raw) ? raw : [];
    standings = groups[0]?.league?.standings ?? groups;
  }

  const homePos = standings.length ? findTeamPos(standings, match.homeId) : null;
  const awayPos = standings.length ? findTeamPos(standings, match.awayId) : null;

  // Format display date from match.date ("YYYY-MM-DD")
  const [y, m, d] = match.date.split("-").map(Number);
  const displayDate = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const refereeDisplay = match.referee?.split(",")[0]?.trim() ?? null;

  return (
    <div className="flex gap-5 px-3 sm:px-4 lg:px-6 py-6 font-sans pb-28 lg:pb-12 max-w-[1600px] mx-auto">

      {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
      <LeftLeagueSidebar currentLeagueId={match.leagueId} />

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <Link href="/" className="text-[10px] font-black text-muted hover:text-accent uppercase tracking-widest transition-colors">
          Matches
        </Link>
        <span className="text-muted/30">/</span>
        <span className="text-[10px] font-black text-foreground uppercase tracking-widest truncate">
          {match.homeTeam} vs {match.awayTeam}
        </span>
      </div>

      {/* ── Match Header ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-surface mb-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-accent" />

        {/* League + status row */}
        <div className="flex items-center gap-2 px-5 sm:px-7 pt-4 pb-0 flex-wrap">
          {match.leagueLogo && (
            <img src={match.leagueLogo} alt={match.league} className="w-4 h-4 object-contain" />
          )}
          <span className="text-[11px] font-bold text-muted">{match.league}</span>
          <span className="text-muted/30">·</span>
          <span className="text-[11px] text-muted/70">{match.country}</span>
          <div className="ml-auto">
            <StatusPill match={match} isFinished={isFinished} />
          </div>
        </div>

        {/* Teams + Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 px-4 sm:px-7 py-6 sm:py-8">
          {/* Home */}
          <TeamHero name={match.homeTeam} logo={match.homeLogo} pos={homePos} align="right" />

          {/* Center: time / score */}
          <div className="text-center min-w-[96px] sm:min-w-[150px]">
            <div className="text-[10px] text-muted/70 mb-2 font-medium">{displayDate}</div>
            {match.score ? (
              <>
                <div className="text-4xl sm:text-6xl font-black text-foreground tracking-tight tabular-nums leading-none">
                  {match.score}
                </div>
                {match.elapsed && (
                  <div className="mt-2 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
                    <span className="text-[11px] text-live font-black">{match.elapsed}&apos;</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-3xl sm:text-5xl font-black text-foreground tracking-tight tabular-nums">
                {match.time}
              </div>
            )}
            {refereeDisplay && (
              <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background border border-border/40">
                <span className="text-[10px] text-muted">⚑ {refereeDisplay}</span>
              </div>
            )}
          </div>

          {/* Away */}
          <TeamHero name={match.awayTeam} logo={match.awayLogo} pos={awayPos} />
        </div>

        {/* Venue strip */}
        {match.venue && (
          <div className="border-t border-border/30 px-5 sm:px-7 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-muted flex items-center gap-1.5">
              <span>📍</span>
              {match.venue}
            </span>
            <ActiveStatBadge />
            <span className="text-[10px] text-muted/50 ml-auto">#{match.id}</span>
          </div>
        )}
      </section>

      {/* Analytics tabs */}
      <MatchAnalyticsTabs
        matchId={id}
        match={match}
        matchStats={matchStats}
        statsData={statsData}
        events={events}
        momentum={momentum}
        lineups={lineups}
        homeLineup={homeLineup}
        awayLineup={awayLineup}
        signals={signals}
        model={model}
        h2hStats={h2hStats}
        trend={trend}
        homeForm={homeForm}
        awayForm={awayForm}
        standings={standings}
        predictions={predictions}
        injuries={injuries}
        hasStarted={hasStarted}
        isFinished={isFinished}
        homePos={homePos}
        awayPos={awayPos}
      />

      </div>{/* /main content */}

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <RightStatsSidebar />

    </div>
  );
}

// ─── Server-only display components ───────────────────────────────────────────

function TeamHero({
  name,
  logo,
  pos,
  align = "left",
}: {
  name: string;
  logo: string;
  pos?: number | null;
  align?: "left" | "right";
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-background border border-border/50 flex items-center justify-center overflow-hidden shadow-sm">
        {logo ? (
          <img src={logo} alt={name} className="w-10 h-10 sm:w-16 sm:h-16 object-contain" />
        ) : (
          <span className="text-lg font-black text-muted">{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <h1 className="text-[11px] sm:text-base font-black text-foreground text-center tracking-tight uppercase leading-tight px-1 max-w-[90px] sm:max-w-none">
        {name}
      </h1>
      {pos != null && (
        <span className="px-2 py-0.5 rounded-md bg-background border border-border/50 text-[10px] text-muted font-bold tabular-nums">
          {ordinal(pos)}
        </span>
      )}
    </div>
  );
}

function StatusPill({ match, isFinished }: { match: any; isFinished: boolean }) {
  if (match.status === "Live") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live-soft border border-live/20 text-live text-[10px] font-black uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
        Live
      </span>
    );
  }
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
      isFinished
        ? "bg-surface border-border text-muted"
        : "bg-accent-soft border-accent/20 text-accent"
    }`}>
      {isFinished ? "FT" : "Upcoming"}
    </span>
  );
}
