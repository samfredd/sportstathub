const BASE_URL = 'https://v3.football.api-sports.io';

// IDs of the most-watched leagues, used by the ?popular=true filter
const POPULAR_LEAGUE_IDS = new Set([2, 3, 39, 61, 78, 88, 135, 140, 848]);

const DEFAULT_TTL = {
  live:         60,
  fixtures:     300,
  stats:        120,
  events:       120,
  lineups:      3600,
  standings:    3600,
  h2h:          3600,
  scorers:      1800,
  leagues:      21600,   // 6h — league lists barely change; reduce daily-quota burn
  referees:     3600,
  predictions:  300,
  injuries:     300,
  teamStats:    3600,
  playerRanks:  1800,
};

// How long to keep a "stale" copy that can be served when the upstream API is
// down or rate-limited. Far longer than the fresh TTL — a slightly old payload
// beats a 502/429 in the user's face.
const STALE_TTL = 86400; // 24h

// When the upstream returns 429, remember it briefly so we stop hammering an
// already-exhausted quota (free tier is 100 req/day).
const RATE_LIMIT_COOLDOWN = 120; // 2 min

export function normalizeGameScore(value: any): number | null {
  const score = typeof value === 'object' && value !== null ? value.total : value;
  if (score === null || score === undefined || score === '') return null;

  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore : null;
}

function parsePercent(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace('%', '').trim());
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
}

function formatPercent(value: number): string {
  return `${Math.max(0, Math.round(value))}%`;
}

export function normalizePredictionPercentages(percent: any = {}) {
  const home = parsePercent(percent.home);
  const draw = parsePercent(percent.draw);
  const away = parsePercent(percent.away);
  const values = [home ?? 0, draw ?? 0, away ?? 0];
  const total = values.reduce((sum, value) => sum + value, 0);
  const normalized = total > 0
    ? values.map(value => (value / total) * 100)
    : [34, 33, 33];
  const rounded = normalized.map(value => Math.round(value));
  const diff = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const largestIndex = rounded.indexOf(Math.max(...rounded));
  rounded[largestIndex] += diff;

  return {
    ...percent,
    home: formatPercent(rounded[0]),
    draw: formatPercent(rounded[1]),
    away: formatPercent(rounded[2]),
  };
}

export function normalizeExpectedGoalValue(value: any) {
  if (value === null || value === undefined || value === '') return value;
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(Math.max(0, numeric) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function sanitizePredictionItem(item: any) {
  if (!item?.predictions || typeof item.predictions !== 'object') return item;
  const predictions = { ...item.predictions };

  if (predictions.goals && typeof predictions.goals === 'object') {
    predictions.goals = {
      ...predictions.goals,
      home: normalizeExpectedGoalValue(predictions.goals.home),
      away: normalizeExpectedGoalValue(predictions.goals.away),
    };
  }

  if (predictions.percent && typeof predictions.percent === 'object') {
    predictions.percent = normalizePredictionPercentages(predictions.percent);
  }

  return { ...item, predictions };
}

export function sanitizePredictionResponse(data: any) {
  if (Array.isArray(data)) return data.map(sanitizePredictionItem);
  return sanitizePredictionItem(data);
}

export function createFootballService({ apiKey, sportsApiKey, redis }: any) {
  async function apiFetch(endpoint: string, params: any = {}, ttl?: number) {
    const sport = params.sport || 'football';
    delete params.sport;

    let baseUrl = 'https://v3.football.api-sports.io';
    let actualEndpoint = endpoint;
    let apiKeyToUse = apiKey;

    if (sport !== 'football') {
      const subdomains = {
        basketball: 'v1.basketball',
        baseball: 'v1.baseball',
        hockey: 'v1.hockey',
        volleyball: 'v1.volleyball',
      };

      if (!subdomains[sport]) {
        const err = new Error(`Unsupported sport: ${sport}`);
        err.statusCode = 400;
        throw err;
      }

      baseUrl = `https://${subdomains[sport]}.api-sports.io`;
      if (actualEndpoint.startsWith('/fixtures')) {
        actualEndpoint = actualEndpoint.replace('/fixtures', '/games');
      }
      apiKeyToUse = sportsApiKey || apiKey;
    }

    if (!apiKeyToUse) {
      const err = new Error('API Key is not set. Add it to .env and restart.');
      err.statusCode = 503;
      throw err;
    }

    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string])
    ).toString();
    const cacheKey  = `${sport}:${actualEndpoint}:${qs}`;
    const staleKey  = `${cacheKey}:stale`;
    const cooldownKey = `${cacheKey}:cooldown`;

    const readJson = async (key: string) => {
      try {
        const raw = await redis.get(key);
        if (raw) return JSON.parse(raw);
      } catch {
        // Redis unavailable or corrupted entry — treat as a miss
      }
      return undefined;
    };

    // Fresh cache hit → serve immediately
    const fresh = await readJson(cacheKey);
    if (fresh !== undefined) return fresh;

    // Recent 429 → don't re-hit the exhausted quota; serve the last good copy
    // if we have one, otherwise surface the rate limit.
    try {
      if (await redis.get(cooldownKey)) {
        const stale = await readJson(staleKey);
        if (stale !== undefined) return stale;
        const err: any = new Error('API rate limit reached. Try again shortly.');
        err.statusCode = 429;
        throw err;
      }
    } catch (e: any) {
      if (e?.statusCode) throw e; // re-throw our own 429
      // Redis read failed — fall through to a live fetch
    }

    // On any upstream failure, fall back to the stale copy when available.
    const serveStaleOrThrow = async (err: any) => {
      const stale = await readJson(staleKey);
      if (stale !== undefined) return stale;
      throw err;
    };

    const url = new URL(`${baseUrl}${actualEndpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });

    let res;
    try {
      res = await fetch(url.toString(), {
        headers: { 'x-apisports-key': apiKeyToUse },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      const err: any = new Error('API request timed out or failed');
      err.statusCode = 503;
      err.cause = cause;
      return serveStaleOrThrow(err);
    }

    if (!res.ok) {
      if (res.status === 429) {
        try { await redis.setex(cooldownKey, RATE_LIMIT_COOLDOWN, '1'); } catch { /* non-fatal */ }
      }
      const err: any = new Error(`API responded with ${res.status}`);
      err.statusCode = res.status === 429 ? 429 : 502;
      return serveStaleOrThrow(err);
    }

    const json = await res.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
      const msg = Object.values(json.errors).join(', ');
      // API-Sports reports quota exhaustion inside errors with a 200 status.
      const rateLimited = /limit|requests/i.test(msg);
      if (rateLimited) {
        try { await redis.setex(cooldownKey, RATE_LIMIT_COOLDOWN, '1'); } catch { /* non-fatal */ }
      }
      const err: any = new Error(`API Error: ${msg}`);
      err.statusCode = rateLimited ? 429 : 400;
      return serveStaleOrThrow(err);
    }

    let responseData = json.response;

    // Normalize other sports to football fixture format
    if (sport !== 'football' && actualEndpoint === '/games') {
      responseData = responseData.map(game => ({
        fixture: {
          id: game.id,
          date: game.date,
          status: game.status,
        },
        league: {
          id: game.league?.id,
          name: game.league?.name,
          country: game.country?.name || game.league?.country,
          logo: game.league?.logo,
        },
        teams: game.teams,
        goals: {
          home: normalizeGameScore(game.scores?.home),
          away: normalizeGameScore(game.scores?.away),
        },
        periods: {
          home: {
            q1: game.scores?.home?.quarter_1 ?? null,
            q2: game.scores?.home?.quarter_2 ?? null,
            q3: game.scores?.home?.quarter_3 ?? null,
            q4: game.scores?.home?.quarter_4 ?? null,
            ot: game.scores?.home?.over_time ?? null,
          },
          away: {
            q1: game.scores?.away?.quarter_1 ?? null,
            q2: game.scores?.away?.quarter_2 ?? null,
            q3: game.scores?.away?.quarter_3 ?? null,
            q4: game.scores?.away?.quarter_4 ?? null,
            ot: game.scores?.away?.over_time ?? null,
          },
        },
      }));
    } else if (sport !== 'football' && actualEndpoint === '/leagues') {
      responseData = responseData.map(l => ({
        league: {
          id: l.id || l.league?.id,
          name: l.name || l.league?.name,
          country: l.country?.name || l.country || l.league?.country,
          logo: l.logo || l.league?.logo
        }
      }));
    }

    const cacheTtl = ttl ?? resolveTtl(actualEndpoint, params);
    const serialized = JSON.stringify(responseData);
    try {
      await redis.setex(cacheKey, cacheTtl, serialized);
      // Keep a long-lived stale copy for serve-on-error fallback.
      await redis.setex(staleKey, STALE_TTL, serialized);
    } catch {
      // Cache write failure is non-fatal
    }

    return responseData;
  }

  function resolveTtl(endpoint: string, params: any) {
    if (params.live)                         return DEFAULT_TTL.live;
    if (endpoint === '/standings')           return DEFAULT_TTL.standings;
    if (endpoint === '/fixtures/headtohead') return DEFAULT_TTL.h2h;
    if (endpoint === '/players/topscorers')  return DEFAULT_TTL.scorers;
    if (endpoint === '/leagues')             return DEFAULT_TTL.leagues;
    if (endpoint === '/fixtures/statistics') return DEFAULT_TTL.stats;
    if (endpoint === '/fixtures/events')     return DEFAULT_TTL.events;
    if (endpoint === '/fixtures/lineups')    return DEFAULT_TTL.lineups;
    return DEFAULT_TTL.fixtures;
  }

  // ── Public methods ────────────────────────────────────────────────────────

  function getLiveMatches(sport = 'football') {
    return apiFetch('/fixtures', { live: 'all', sport });
  }

  function getMatchesByDate(date, leagueId, season, sport = 'football') {
    return apiFetch('/fixtures', { date, league: leagueId, season, sport });
  }

  async function getMatchById(fixtureId, sport = 'football') {
    const results = await apiFetch('/fixtures', { id: fixtureId, sport });
    return results[0] ?? null;
  }

  function getMatchStats(fixtureId, sport = 'football') {
    const idParam = sport === 'football' ? { fixture: fixtureId } : { id: fixtureId };
    return apiFetch('/fixtures/statistics', { ...idParam, sport });
  }

  function getMatchPlayerStats(gameId, sport = 'football') {
    const idParam = sport === 'football' ? { fixture: gameId } : { id: gameId };
    return apiFetch('/fixtures/players', { ...idParam, sport });
  }

  function getMatchLineups(fixtureId, sport = 'football') {
    return apiFetch('/fixtures/lineups', { fixture: fixtureId, sport });
  }

  function getMatchEvents(fixtureId, sport = 'football') {
    return apiFetch('/fixtures/events', { fixture: fixtureId, sport });
  }

  async function getLeagues({ season, country, current, popular, sport = 'football' }: any = {}) {
    const leagues = await apiFetch('/leagues', {
      season,
      country,
      current: sport === 'football' ? current : undefined,
      sport,
    });
    if (sport === 'football' && (popular === 'true' || popular === true)) {
      return leagues.filter(l => POPULAR_LEAGUE_IDS.has(l.league.id));
    }
    // API-sports other sports don't have the same popular leagues, just return top 10 if popular
    if (sport !== 'football' && (popular === 'true' || popular === true)) {
      return leagues.slice(0, 10);
    }
    return leagues;
  }

  function getStandings(leagueId, season, sport = 'football') {
    return apiFetch('/standings', { league: leagueId, season, sport });
  }

  function getH2H(team1Id, team2Id, last = 10, sport = 'football') {
    return apiFetch('/fixtures/headtohead', { h2h: `${team1Id}-${team2Id}`, last, sport });
  }

  function getTopScorers(leagueId, season, sport = 'football') {
    return apiFetch('/players/topscorers', { league: leagueId, season, sport });
  }

  function getTopAssists(leagueId, season, sport = 'football') {
    return apiFetch('/players/topassists', { league: leagueId, season, sport }, DEFAULT_TTL.playerRanks);
  }

  function getTopYellowCards(leagueId, season, sport = 'football') {
    return apiFetch('/players/topyellowcards', { league: leagueId, season, sport }, DEFAULT_TTL.playerRanks);
  }

  function getTopRedCards(leagueId, season, sport = 'football') {
    return apiFetch('/players/topredcards', { league: leagueId, season, sport }, DEFAULT_TTL.playerRanks);
  }

  async function getPredictions(fixtureId: number) {
    const predictions = await apiFetch('/predictions', { fixture: fixtureId }, DEFAULT_TTL.predictions);
    return sanitizePredictionResponse(predictions);
  }

  function getInjuries(fixtureId: number) {
    return apiFetch('/injuries', { fixture: fixtureId }, DEFAULT_TTL.injuries);
  }

  function getTeamStatistics(teamId: number, leagueId: number, season: number) {
    return apiFetch('/teams/statistics', { team: teamId, league: leagueId, season }, DEFAULT_TTL.teamStats);
  }

  async function getTeamLastFixtures(teamId: number, last = 6, leagueId?: number, season?: number, sport = 'football') {
    const normalizePlayed = (fixtures: any[] = []) => fixtures
      .filter((f: any) => f.goals?.home !== null && f.goals?.away !== null && f.fixture?.status?.short !== 'NS')
      .sort((a: any, b: any) => new Date(b.fixture?.date ?? 0).getTime() - new Date(a.fixture?.date ?? 0).getTime())
      .slice(0, last);

    if (season) {
      const fixtures = await apiFetch('/fixtures', { team: teamId, league: leagueId, season, sport }, DEFAULT_TTL.fixtures);
      return normalizePlayed(fixtures);
    }

    const currentYear = new Date().getFullYear();
    const seasons = [...new Set([currentYear, currentYear - 1, currentYear - 2, 2024, 2023, 2022])];

    for (const season of seasons) {
      try {
        const fixtures = await apiFetch('/fixtures', { team: teamId, season, sport }, DEFAULT_TTL.fixtures);
        const played = normalizePlayed(fixtures);
        if (played.length > 0) return played.slice(0, last);
      } catch {
        continue;
      }
    }
    return [];
  }

  function getRefereeFixtures(refereeName, leagueId, season) {
    return apiFetch('/fixtures', { referee: refereeName, league: leagueId, season });
  }

  function searchTeams(name, sport = 'football') {
    return apiFetch('/teams', { search: name, sport }, DEFAULT_TTL.leagues);
  }

  async function getSports() {
    // Only football is wired end-to-end. Other sports are listed so the UI can
    // show them as "coming soon", but they are not active and trigger no API
    // calls — keeps the daily API-Football quota focused on football.
    return [
      { id: 'football',   label: 'Football',   active: true },
      { id: 'basketball', label: 'Basketball', active: false, comingSoon: true },
      { id: 'baseball',   label: 'Baseball',   active: false, comingSoon: true },
      { id: 'hockey',     label: 'Hockey',     active: false, comingSoon: true },
      { id: 'volleyball', label: 'Volleyball', active: false, comingSoon: true },
    ];
  }

  return {
    getSports,
    getLiveMatches,
    getMatchesByDate,
    getMatchById,
    getMatchStats,
    getMatchPlayerStats,
    getMatchLineups,
    getMatchEvents,
    getLeagues,
    getStandings,
    getH2H,
    getTopScorers,
    getTopAssists,
    getTopYellowCards,
    getTopRedCards,
    getPredictions,
    getInjuries,
    getTeamStatistics,
    getTeamLastFixtures,
    getRefereeFixtures,
    searchTeams,
  };
}
