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
  leagues:      3600,
  referees:     3600,
  predictions:  300,
  injuries:     300,
  teamStats:    3600,
  playerRanks:  1800,
};

export function normalizeGameScore(value: any): number | null {
  const score = typeof value === 'object' && value !== null ? value.total : value;
  if (score === null || score === undefined || score === '') return null;

  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore : null;
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
    const cacheKey = `${sport}:${actualEndpoint}:${qs}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis miss is non-fatal
    }

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
      const err = new Error('API request timed out or failed');
      err.statusCode = 503;
      err.cause = cause;
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`API responded with ${res.status}`);
      err.statusCode = res.status === 429 ? 429 : 502;
      throw err;
    }

    const json = await res.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
      const msg = Object.values(json.errors).join(', ');
      const err = new Error(`API Error: ${msg}`);
      err.statusCode = 400;
      throw err;
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
    try {
      await redis.setex(cacheKey, cacheTtl, JSON.stringify(responseData));
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

  function getMatchPlayerStats(gameId, sport = 'basketball') {
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

  function getPredictions(fixtureId: number) {
    return apiFetch('/predictions', { fixture: fixtureId }, DEFAULT_TTL.predictions);
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
    return [
      { id: 'football', label: 'Football' },
      { id: 'basketball', label: 'Basketball' },
      { id: 'baseball', label: 'Baseball' },
      { id: 'hockey', label: 'Hockey' },
      { id: 'volleyball', label: 'Volleyball' },
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
