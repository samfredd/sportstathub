// Status codes that mean a match is currently being played
const LIVE_STATUS = new Set(['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE']);

// ─── Raw API-Football shapes (minimal) ────────────────────────────────────────

interface RawFixtureStatus {
  short?: string;
  elapsed?: number | null;
}

interface RawFixture {
  id: number;
  date: string;
  referee?: string | null;
  venue?: { name?: string } | null;
  status?: RawFixtureStatus;
}

interface RawTeam {
  id: number;
  name: string;
  logo: string;
}

interface RawScoreObject {
  total?: number | string | null;
}

type RawScoreValue = number | string | RawScoreObject | null;

interface RawGoals {
  home: RawScoreValue;
  away: RawScoreValue;
}

interface RawLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
}

interface RawFixtureResponse {
  fixture: RawFixture;
  league: RawLeague;
  teams: { home: RawTeam; away: RawTeam };
  goals?: RawGoals;
}

// ─── UI shapes ────────────────────────────────────────────────────────────────

export interface MatchShape {
  id: number;
  league: string;
  country: string;
  leagueLogo: string;
  leagueId: number;
  time: string;
  homeTeam: string;
  homeLogo: string;
  homeId: number;
  awayTeam: string;
  awayLogo: string;
  awayId: number;
  score: string | null;
  status: 'Live' | 'Upcoming';
  elapsed: number | null;
  statusShort: string;
  date: string;
  referee: string | null;
  venue: string | null;
  prediction: null;
  odds: null;
  locked: boolean;
}

export interface RankShape {
  rank: number;
  team: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: string;
  change: -1 | 0 | 1;
}

export interface StatRow {
  label: string;
  homeValue: string;
  awayValue: string;
  homePct: number;
  awayPct: number;
}

export interface TeamMeta {
  id?: number;
  name?: string;
  logo?: string;
}

export interface ParsedMatchStats {
  home: TeamMeta;
  away: TeamMeta;
  rows: StatRow[];
}

export interface H2HStats {
  homeWins: number;
  draws: number;
  awayWins: number;
  total: number;
  homeWinPct: string;
  drawPct: string;
  awayWinPct: string;
}

// ─── Transforms ───────────────────────────────────────────────────────────────

/**
 * Maps a raw API-Football fixture object to the shape the UI components expect.
 */
export function fixtureToMatch(f: RawFixtureResponse | null | undefined): MatchShape | null {
  if (!f?.fixture) return null;
  const { fixture, league, teams, goals } = f;

  const isLive = LIVE_STATUS.has(fixture.status?.short ?? '');
  const goalsHome = scoreValue(goals?.home);
  const goalsAway = scoreValue(goals?.away);

  return {
    id: fixture.id,
    league: league.name,
    country: league.country,
    leagueLogo: league.logo,
    leagueId: league.id,
    // Format as HH:mm in UTC so all users see the same time
    time: new Date(fixture.date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
    homeTeam: teams.home.name,
    homeLogo: teams.home.logo,
    homeId: teams.home.id,
    awayTeam: teams.away.name,
    awayLogo: teams.away.logo,
    awayId: teams.away.id,
    score: goalsHome !== null && goalsAway !== null ? `${goalsHome} - ${goalsAway}` : null,
    status: isLive ? 'Live' : 'Upcoming',
    elapsed: fixture.status?.elapsed ?? null,
    statusShort: fixture.status?.short ?? 'NS',
    date: fixture.date.slice(0, 10), // YYYY-MM-DD
    referee: fixture.referee ?? null,
    venue: fixture.venue?.name ?? null,
    // Prediction / odds not provided by the free API
    prediction: null,
    odds: null,
    locked: false,
  };
}

function scoreValue(value: RawScoreValue | undefined): number | null {
  const score = typeof value === 'object' && value !== null ? value.total : value;
  if (score === null || score === undefined || score === '') return null;

  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore : null;
}

interface RawStandingEntry {
  rank: number;
  form?: string | null;
  team: { name: string; logo: string };
  all?: {
    played?: number;
    win?: number;
    draw?: number;
    lose?: number;
    goals?: { for?: number; against?: number };
  };
  goalsDiff?: number;
  points?: number;
}

/**
 * Maps a single standings entry (from /standings response) to a rank row.
 * Derives "form trend" from the last character of the form string:
 *   W → +1 (recent win),  L → -1 (recent loss), D/other → 0
 */
export function standingToRank(entry: RawStandingEntry): RankShape {
  const form = entry.form ?? '';
  const last = form.slice(-1);
  const change: -1 | 0 | 1 = last === 'W' ? 1 : last === 'L' ? -1 : 0;

  return {
    rank: entry.rank,
    team: entry.team.name,
    logo: entry.team.logo,
    played: entry.all?.played ?? 0,
    won: entry.all?.win ?? 0,
    drawn: entry.all?.draw ?? 0,
    lost: entry.all?.lose ?? 0,
    goalsFor: entry.all?.goals?.for ?? 0,
    goalsAgainst: entry.all?.goals?.against ?? 0,
    goalDiff: entry.goalsDiff ?? 0,
    points: entry.points ?? 0,
    form,
    change,
  };
}

const STAT_KEYS: string[] = [
  'Ball Possession',
  'Shots on Goal',
  'Total Shots',
  'Corner Kicks',
  'Fouls',
  'Yellow Cards',
  'Red Cards',
  'Offsides',
  'Goalkeeper Saves',
  'Passes %',
];

interface RawStatEntry {
  type: string;
  value: string | number | null;
}

interface RawTeamStats {
  team?: TeamMeta;
  statistics: RawStatEntry[];
}

/**
 * Parses the raw API-Football statistics response into a UI-ready shape.
 * statsData is an array of two objects: [homeTeamStats, awayTeamStats].
 * Returns null if data is missing or invalid.
 */
export function parseMatchStats(statsData: RawTeamStats[]): ParsedMatchStats | null {
  if (!Array.isArray(statsData) || statsData.length < 2) return null;

  const [homeData, awayData] = statsData;

  const toMap = (arr: RawStatEntry[]): Record<string, string | number | null> => {
    const m: Record<string, string | number | null> = {};
    (arr || []).forEach((s) => { m[s.type] = s.value; });
    return m;
  };

  const homeMap = toMap(homeData.statistics);
  const awayMap = toMap(awayData.statistics);

  const parseNum = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    return parseFloat(v) || 0;
  };

  const rows = STAT_KEYS.map((label) => {
    const hRaw = homeMap[label] ?? null;
    const aRaw = awayMap[label] ?? null;
    const hNum = parseNum(hRaw);
    const aNum = parseNum(aRaw);

    const isPct = typeof hRaw === 'string' && hRaw.includes('%');
    let homePct: number, awayPct: number;
    if (isPct) {
      homePct = hNum;
      awayPct = aNum;
    } else {
      const total = hNum + aNum || 1;
      homePct = Math.round((hNum / total) * 100);
      awayPct = 100 - homePct;
    }

    return {
      label,
      homeValue: hRaw !== null ? String(hRaw) : '0',
      awayValue: aRaw !== null ? String(aRaw) : '0',
      homePct,
      awayPct,
    };
  }).filter((row) => row.homeValue !== '0' || row.awayValue !== '0');

  if (!rows.length) return null;

  return {
    home: { id: homeData.team?.id, name: homeData.team?.name, logo: homeData.team?.logo },
    away: { id: awayData.team?.id, name: awayData.team?.name, logo: awayData.team?.logo },
    rows,
  };
}

interface RawH2HFixture {
  goals?: { home: number | null; away: number | null };
  teams?: { home?: { id?: number }; away?: { id?: number } };
}

/**
 * Computes H2H win/draw stats from an array of fixture objects,
 * from the perspective of the given homeTeamId (first team in the matchup).
 */
export function computeH2HStats(fixtures: RawH2HFixture[], homeTeamId: number): H2HStats {
  let homeWins = 0, draws = 0, awayWins = 0;

  fixtures.forEach(f => {
    const gh = f.goals?.home;
    const ga = f.goals?.away;
    if (gh === null || gh === undefined) return; // not played

    const isHomeTeamPlayingHome = f.teams?.home?.id === homeTeamId;
    const homeScore = isHomeTeamPlayingHome ? gh : (ga ?? 0);
    const awayScore = isHomeTeamPlayingHome ? (ga ?? 0) : gh;

    if (homeScore > awayScore) homeWins++;
    else if (homeScore < awayScore) awayWins++;
    else draws++;
  });

  const total = homeWins + draws + awayWins || 1; // avoid div/0
  return {
    homeWins,
    draws,
    awayWins,
    total: homeWins + draws + awayWins,
    homeWinPct: Math.round((homeWins / total) * 100) + '%',
    drawPct: Math.round((draws / total) * 100) + '%',
    awayWinPct: Math.round((awayWins / total) * 100) + '%',
  };
}
