const BASE_URL = 'https://api.the-odds-api.com/v4';

const DEFAULT_TTL = {
  sports:  3600,
  odds:    300,
  scores:  60,
  events:  300,
};

export function createOddsService({ apiKey, redis }: any) {
  if (!apiKey) {
    return null;
  }

  async function apiFetch(endpoint: string, params: Record<string, string> = {}, ttl?: number) {
    const qs = new URLSearchParams({ ...params, apiKey }).toString();
    const cacheKey = `odds:${endpoint}:${new URLSearchParams(params).toString()}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // non-fatal
    }

    const url = `${BASE_URL}${endpoint}?${qs}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (cause) {
      const err: any = new Error('Odds API request timed out or failed');
      err.statusCode = 503;
      err.cause = cause;
      throw err;
    }

    if (!res.ok) {
      const err: any = new Error(`Odds API responded with ${res.status}`);
      err.statusCode = res.status === 429 ? 429 : 502;
      throw err;
    }

    const data = await res.json();
    const cacheTtl = ttl ?? DEFAULT_TTL.odds;
    try {
      await redis.setex(cacheKey, cacheTtl, JSON.stringify(data));
    } catch {
      // non-fatal
    }

    return data;
  }

  function getSports() {
    return apiFetch('/sports', { all: 'false' }, DEFAULT_TTL.sports);
  }

  function getOdds(sport: string, regions = 'eu', markets = 'h2h', bookmakers?: string) {
    const params: Record<string, string> = { regions, markets };
    if (bookmakers) params.bookmakers = bookmakers;
    return apiFetch(`/sports/${sport}/odds`, params, DEFAULT_TTL.odds);
  }

  function getScores(sport: string, daysFrom = 1) {
    return apiFetch(`/sports/${sport}/scores`, { daysFrom: String(daysFrom) }, DEFAULT_TTL.scores);
  }

  function getEvents(sport: string) {
    return apiFetch(`/sports/${sport}/events`, {}, DEFAULT_TTL.events);
  }

  return { getSports, getOdds, getScores, getEvents };
}
