const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  revalidate?: number;
}

type Params = Record<string, string | number | boolean | undefined | null>;

async function get(path: string, params: Params = {}, fetchOpts: FetchOptions = {}): Promise<any> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const { revalidate, cache, ...rest } = fetchOpts;
  const nextOpt = revalidate !== undefined ? { revalidate } : {};

  const res = await fetch(url.toString(), {
    next: nextOpt,
    ...(cache ? { cache } : {}),
    credentials: "include", // send the httpOnly auth cookie
    ...rest,
    headers: {
      ...(rest.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

const api = {
  // Matches
  getLiveMatches: (params?: Params, opts?: FetchOptions) =>
    get('/api/matches/live', params, { revalidate: 30, ...opts }),
  getMatches: (date?: string, league?: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get('/api/matches', { date, league, season, sport }, { revalidate: 60, ...opts }),
  getMatchById: (id: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/matches/${id}`, { sport }, { revalidate: 30, ...opts }),
  getMatchStats: (id: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/matches/${id}/stats`, { sport }, { revalidate: 60, ...opts }),
  getMatchLineups: (id: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/matches/${id}/lineups`, { sport }, { revalidate: 600, ...opts }),
  getMatchEvents: (id: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/matches/${id}/events`, { sport }, { revalidate: 60, ...opts }),

  // Leagues & standings
  getLeagues: (params?: Params, opts?: FetchOptions) =>
    get('/api/leagues', params, { revalidate: 3600, ...opts }),
  getStandings: (id: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/leagues/${id}/standings`, { season, sport }, { revalidate: 3600, ...opts }),
  getTopScorers: (id: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/leagues/${id}/scorers`, { season, sport }, { revalidate: 1800, ...opts }),
  getTopAssists: (id: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/leagues/${id}/assists`, { season, sport }, { revalidate: 1800, ...opts }),
  getTopYellowCards: (id: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/leagues/${id}/yellow-cards`, { season, sport }, { revalidate: 1800, ...opts }),
  getTopRedCards: (id: string | number, season?: string | number, sport?: string, opts?: FetchOptions) =>
    get(`/api/leagues/${id}/red-cards`, { season, sport }, { revalidate: 1800, ...opts }),

  // Match analytics
  getMatchPredictions: (id: string | number, opts?: FetchOptions) =>
    get(`/api/matches/${id}/predictions`, {}, { revalidate: 300, ...opts }),
  getMatchInjuries: (id: string | number, opts?: FetchOptions) =>
    get(`/api/matches/${id}/injuries`, {}, { revalidate: 300, ...opts }),

  // Teams
  searchTeams: (name?: string, sport?: string, opts?: FetchOptions) =>
    get('/api/teams/search', { name, sport }, { revalidate: 3600, ...opts }),
  globalSearch: (q:string,opts?:FetchOptions)=>get('/api/search',{q},{cache:'no-store',...opts}),
  getTeamStatistics: (id: string | number, league: string | number, season: string | number, opts?: FetchOptions) =>
    get(`/api/teams/${id}/statistics`, { league, season }, { revalidate: 3600, ...opts }),

  // H2H
  getH2H: (team1?: string | number, team2?: string | number, last?: number, sport?: string, opts?: FetchOptions) =>
    get('/api/h2h', { team1, team2, last, sport }, { revalidate: 3600, ...opts }),

  // Odds
  getOddsSports: (opts?: FetchOptions) =>
    get('/api/odds/sports', {}, { revalidate: 3600, ...opts }),
  getOdds: (sport: string, regions?: string, markets?: string, opts?: FetchOptions) =>
    get(`/api/odds/${sport}`, { regions, markets }, { revalidate: 300, ...opts }),

  // Referees
  getRefereeStats: (name?: string, league?: string | number, season?: string | number, opts?: FetchOptions) =>
    get('/api/referees', { name, league, season }, { revalidate: 3600, ...opts }),

  // Booking codes
  getCodes: (params?: Params, opts?: FetchOptions) =>
    get('/api/codes', params, { revalidate: 60, ...opts }),
};

export default api;
