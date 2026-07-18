import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { createFootballService } from '../football/football.service.js';
import { createOddsService } from '../odds/odds.service.js';

const SUPPORTED_AI_SPORTS: Record<string, string> = {
  football: 'football',
  soccer: 'football',
  basketball: 'basketball',
  baseball: 'baseball',
  hockey: 'hockey',
  volleyball: 'volleyball',
};

const DEFAULT_ODDS_SPORT_KEYS: Record<string, string> = {
  football: 'soccer_epl',
  basketball: 'basketball_nba',
  baseball: 'baseball_mlb',
  hockey: 'icehockey_nhl',
};

export function normalizeAiSport(sport = 'Football'): string | null {
  return SUPPORTED_AI_SPORTS[String(sport).trim().toLowerCase()] ?? null;
}

export function resolveOddsSportKey(sportId: string): string | null {
  const overrideKey = `AI_ODDS_${sportId.toUpperCase()}_KEY`;
  return process.env[overrideKey] || DEFAULT_ODDS_SPORT_KEYS[sportId] || null;
}

function cleanTeamName(value: string): string {
  return value
    .split(/[,\u2014?]/)[0]
    .replace(/\b(prediction|predict|odds|who wins|who will win|will there be|today|tonight)\b.*$/i, '')
    .replace(/^(please|predict|prediction for|what about|give me)\s+/i, '')
    .trim();
}

export function extractMatchup(prompt: string): { homeName: string; awayName: string } | null {
  const match = String(prompt)
    .replace(/\s+/g, ' ')
    .match(/(.{2,70}?)\s+(?:vs\.?|v\.?|versus|against)\s+(.{2,90})/i);

  if (!match) return null;
  const homeName = cleanTeamName(match[1]);
  const awayName = cleanTeamName(match[2]);
  if (homeName.length < 2 || awayName.length < 2) return null;
  return { homeName, awayName };
}

function normalizeTeamSearchResult(item: any) {
  const team = item?.team ?? item ?? {};
  return {
    id: Number(team.id),
    name: team.name,
    country: team.country?.name ?? team.country ?? item?.country?.name ?? item?.country ?? '',
  };
}

function summarizeFixtures(fixtures: any[], teamId: number, limit = 5): string {
  return fixtures.slice(0, limit).map((f: any) => {
    const isHome = f.teams?.home?.id === teamId;
    const tg = isHome ? f.goals?.home : f.goals?.away;
    const og = isHome ? f.goals?.away : f.goals?.home;
    const opp = isHome ? f.teams?.away?.name : f.teams?.home?.name;
    const result = tg > og ? 'W' : tg < og ? 'L' : 'D';
    return `  ${f.fixture?.date?.slice(0, 10) ?? ''} ${isHome ? 'vs' : '@'} ${opp ?? 'Opponent'} ${tg ?? '?'}-${og ?? '?'} [${result}]`;
  }).join('\n');
}

function findRelevantOddsEvents(events: any[] = [], matchup: { homeName: string; awayName: string }) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const home = normalize(matchup.homeName);
  const away = normalize(matchup.awayName);
  return events.filter((event: any) => {
    const text = normalize(`${event.home_team ?? ''} ${event.away_team ?? ''}`);
    return text.includes(home) || text.includes(away);
  }).slice(0, 3);
}

function summarizeOdds(events: any[] = []) {
  return events.map((event: any) => {
    const markets = (event.bookmakers ?? [])
      .slice(0, 3)
      .flatMap((bookmaker: any) => (bookmaker.markets ?? []).map((market: any) => {
        const outcomes = (market.outcomes ?? [])
          .map((outcome: any) => `${outcome.name} ${outcome.price}`)
          .join(', ');
        return `${bookmaker.title} ${market.key}: ${outcomes}`;
      }));
    return `  ${event.home_team} vs ${event.away_team} (${event.commence_time ?? 'time unavailable'})
${markets.slice(0, 6).map((line: string) => `    ${line}`).join('\n') || '    No bookmaker markets returned.'}`;
  }).join('\n');
}

async function buildOddsContext(oddsService: any, matchup: { homeName: string; awayName: string } | null, sportId: string, generatedAt: string) {
  if (!oddsService) {
    return {
      text: 'Live bookmaker odds source: unavailable because ODDS_API_KEY is not configured.',
      sources: [{ label: 'The Odds API', status: 'not_configured', generatedAt }],
    };
  }
  const oddsSportKey = resolveOddsSportKey(sportId);
  if (!oddsSportKey) {
    return {
      text: `Live bookmaker odds source: not mapped for ${sportId}.`,
      sources: [{ label: 'The Odds API', status: 'not_mapped', generatedAt }],
    };
  }
  if (!matchup) {
    return {
      text: 'Live bookmaker odds source: skipped because no team-vs-team matchup was parsed.',
      sources: [{ label: 'The Odds API', status: 'skipped_no_matchup', generatedAt }],
    };
  }

  try {
    const odds = await oddsService.getOdds(oddsSportKey, 'us,uk,eu', 'h2h,totals,spreads');
    const relevant = findRelevantOddsEvents(Array.isArray(odds) ? odds : [], matchup);
    if (!relevant.length) {
      return {
        text: `Live bookmaker odds source: checked ${oddsSportKey}, but no matching events were found for ${matchup.homeName} vs ${matchup.awayName}.`,
        sources: [{ label: `The Odds API ${oddsSportKey}`, status: 'no_match', generatedAt }],
      };
    }
    return {
      text: `Live bookmaker odds source: The Odds API ${oddsSportKey}. Last checked: ${generatedAt}.
${summarizeOdds(relevant)}`,
      sources: [{ label: `The Odds API ${oddsSportKey}`, status: 'available', generatedAt }],
    };
  } catch (error: any) {
    return {
      text: `Live bookmaker odds source: unavailable (${error?.message ?? 'unknown error'}). Do not invent bookmaker prices.`,
      sources: [{ label: `The Odds API ${oddsSportKey}`, status: 'unavailable', generatedAt }],
    };
  }
}

async function buildFreeTextDataContext(footballService: any, oddsService: any, userPrompt: string, sportId: string) {
  const matchup = extractMatchup(userPrompt);
  const generatedAt = new Date().toISOString();
  const oddsContext = await buildOddsContext(oddsService, matchup, sportId, generatedAt);
  if (!matchup) {
    return {
      generatedAt,
      contextText: `## Data Context\nNo team-vs-team matchup was confidently parsed from the prompt. Treat this as a low-data estimate and do not cite team form, injuries, odds, or bookmaker prices.\n${oddsContext.text}`,
      sources: [{ label: 'User prompt only', status: 'limited', generatedAt }, ...oddsContext.sources],
    };
  }

  try {
    const [homeResults, awayResults] = await Promise.all([
      footballService.searchTeams(matchup.homeName, sportId),
      footballService.searchTeams(matchup.awayName, sportId),
    ]);
    const home = normalizeTeamSearchResult(homeResults?.[0]);
    const away = normalizeTeamSearchResult(awayResults?.[0]);
    if (!home.id || !away.id) {
      return {
        generatedAt,
        contextText: `## Data Context\nCould not match one or both teams in API-Sports. Parsed matchup: ${matchup.homeName} vs ${matchup.awayName}. Do not invent form or historical stats.\n${oddsContext.text}`,
        sources: [{ label: 'API-Sports team search', status: 'no_match', generatedAt }, ...oddsContext.sources],
      };
    }

    const [h2h, homeForm, awayForm] = await Promise.all([
      footballService.getH2H(home.id, away.id, 8, sportId).catch(() => []),
      footballService.getTeamLastFixtures(home.id, 5, undefined, undefined, sportId).catch(() => []),
      footballService.getTeamLastFixtures(away.id, 5, undefined, undefined, sportId).catch(() => []),
    ]);
    const played = Array.isArray(h2h) ? h2h.filter((f: any) => f.goals?.home !== null && f.goals?.away !== null) : [];
    const totalGoals = played.reduce((sum: number, f: any) => sum + Number(f.goals?.home ?? 0) + Number(f.goals?.away ?? 0), 0);
    const avgGoals = played.length ? (totalGoals / played.length).toFixed(1) : 'n/a';

    return {
      generatedAt,
      contextText: `## Data Context
Source: API-Sports ${sportId} endpoints. Last updated: ${generatedAt}.
Update cadence: API-Sports form and H2H responses may be cached for up to 1 hour. Odds are checked at request time when The Odds API is configured.
Injury context: not available from this endpoint unless the user provides it. Do not invent injuries.
Parsed matchup: ${home.name} vs ${away.name}

Head-to-head meetings found: ${played.length}
Average combined score/goals in H2H: ${avgGoals}
${played.slice(0, 5).map((f: any) => `  ${f.fixture?.date?.slice(0, 10) ?? ''} ${f.teams?.home?.name} ${f.goals?.home}-${f.goals?.away} ${f.teams?.away?.name}`).join('\n')}

${home.name} recent form:
${summarizeFixtures(homeForm, home.id) || '  No recent fixtures returned.'}

${away.name} recent form:
${summarizeFixtures(awayForm, away.id) || '  No recent fixtures returned.'}

${oddsContext.text}`,
      sources: [
        { label: 'API-Sports team search', status: 'matched', generatedAt },
        { label: 'API-Sports head-to-head', status: played.length ? 'available' : 'empty', generatedAt },
        { label: 'API-Sports recent fixtures', status: 'available', generatedAt },
        ...oddsContext.sources,
      ],
    };
  } catch (error: any) {
    return {
      generatedAt,
      contextText: `## Data Context\nAPI-Sports context could not be loaded: ${error?.message ?? 'unknown error'}. Treat this as a low-data estimate and do not cite unavailable stats.\n${oddsContext.text}`,
      sources: [{ label: 'API-Sports', status: 'unavailable', generatedAt }, ...oddsContext.sources],
    };
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(mode: 'predict' | 'analyse'): string {
  const constraints = `STRICT RULES:
- Base every claim on the statistical data provided below.
- Do NOT invent statistics, scorelines, player names, or facts not in the data.
- Do NOT express certainty — use hedged language ("likely", "suggests", "may indicate").
- Output only the requested sections using ### headings. No preamble, no closing remarks.`;

  if (mode === 'predict') {
    return `You are a football analyst. Produce a structured pre-match prediction using only the data provided.
${constraints}

Write exactly these five sections:
### Predicted Result
Home Win / Draw / Away Win — one sentence.

### Score Prediction
Most likely scoreline.

### Goals Market
Over or Under 2.5? BTTS Yes or No? One-line reason.

### Key Factors
2–3 bullet points using only the data given.

### Confidence
Low / Medium / High — and the single biggest uncertainty.`;
  }

  return `You are a football analyst. Produce a structured match analysis using only the data provided.
${constraints}

Write exactly these four sections:
### Match Summary
Key narrative based on the data provided.

### Tactical Analysis
2–3 bullet points on decisive factors from the data.

### Standout Performers
Notable players supported by the statistics given.

### Takeaways
What this result suggests for both teams going forward.`;
}

function formLine(fixtures: any[], teamId: number): string {
  return fixtures.map(f => {
    const isHome = f.teams?.home?.id === teamId;
    const tg = isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0);
    const og = isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0);
    const opp = isHome ? f.teams?.away?.name : f.teams?.home?.name;
    const r = tg > og ? 'W' : tg < og ? 'L' : 'D';
    return `  ${f.fixture?.date?.slice(0, 10) ?? ''}  ${isHome ? 'vs' : '@'} ${opp}  ${tg}-${og}  [${r}]`;
  }).join('\n');
}

function buildUserPrompt(match: any, h2h: any[], homeForm: any[], awayForm: any[], mode: 'predict' | 'analyse'): string {
  const home  = match.teams?.home;
  const away  = match.teams?.away;
  const league = match.league;

  const played    = h2h.filter((f: any) => f.goals?.home !== null && f.goals?.away !== null);
  const hw        = played.filter((f: any) => (f.teams?.home?.id === home?.id ? f.goals?.home > f.goals?.away : f.goals?.away > f.goals?.home)).length;
  const aw        = played.filter((f: any) => (f.teams?.home?.id === away?.id ? f.goals?.home > f.goals?.away : f.goals?.away > f.goals?.home)).length;
  const dr        = played.length - hw - aw;
  const totalGoals = played.reduce((s: number, f: any) => s + (f.goals?.home ?? 0) + (f.goals?.away ?? 0), 0);
  const avgGoals  = played.length ? (totalGoals / played.length).toFixed(1) : '0.0';
  const btts      = played.filter((f: any) => f.goals?.home > 0 && f.goals?.away > 0).length;
  const over25    = played.filter((f: any) => (f.goals?.home ?? 0) + (f.goals?.away ?? 0) > 2.5).length;
  const pct       = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  const goalsAvg  = (fixtures: any[], teamId: number, conceded: boolean) => {
    if (!fixtures.length) return '0.0';
    const total = fixtures.reduce((s: number, f: any) => {
      const isHome = f.teams?.home?.id === teamId;
      return s + (conceded ? (isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0)) : (isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0)));
    }, 0);
    return (total / fixtures.length).toFixed(1);
  };

  return `## Match
${home?.name} (Home) vs ${away?.name} (Away)
Competition: ${league?.name}, ${league?.country}
Date: ${match.fixture?.date?.slice(0, 10) ?? 'Unknown'} | Venue: ${match.fixture?.venue?.name ?? 'Unknown'}

## Head-to-Head (last ${played.length} meetings)
${home?.name} wins: ${hw} | Draws: ${dr} | ${away?.name} wins: ${aw}
Avg goals/game: ${avgGoals} | BTTS: ${pct(btts, played.length)}% | Over 2.5: ${pct(over25, played.length)}%
${played.slice(0, 5).map((f: any) => `  ${f.fixture?.date?.slice(0, 10) ?? ''}  ${f.teams?.home?.name} ${f.goals?.home}-${f.goals?.away} ${f.teams?.away?.name}`).join('\n')}

## ${home?.name} Recent Form (last ${homeForm.length})
Scored avg: ${goalsAvg(homeForm, home?.id, false)}/game | Conceded avg: ${goalsAvg(homeForm, home?.id, true)}/game
${formLine(homeForm, home?.id)}

## ${away?.name} Recent Form (last ${awayForm.length})
Scored avg: ${goalsAvg(awayForm, away?.id, false)}/game | Conceded avg: ${goalsAvg(awayForm, away?.id, true)}/game
${formLine(awayForm, away?.id)}`;
}

// ─── Basketball prompt builders ───────────────────────────────────────────────

function buildBasketballSystemPrompt(mode: 'predict' | 'analyse'): string {
  const constraints = `STRICT RULES:
- Base every claim on the statistical data provided below.
- Do NOT invent statistics, player names, or facts not in the data.
- Do NOT express certainty — use hedged language ("likely", "suggests", "may indicate").
- Output only the requested sections using ### headings. No preamble, no closing remarks.`;

  if (mode === 'predict') {
    return `You are a basketball analyst. Produce a structured pre-game prediction using only the data provided.
${constraints}

Write exactly these five sections:
### Predicted Winner
Home Win / Away Win — one sentence.

### Score Prediction
Most likely final score range (e.g. 108–102).

### Key Matchup
The decisive factor (pace, shooting efficiency, defense). One sentence.

### Key Factors
2–3 bullet points using only the data given.

### Confidence
Low / Medium / High — and the single biggest uncertainty.`;
  }

  return `You are a basketball analyst. Produce a structured game analysis using only the data provided.
${constraints}

Write exactly these four sections:
### Game Summary
Key narrative based on the data provided.

### Tactical Analysis
2–3 bullet points on decisive factors from the data.

### Standout Performances
Notable team performances supported by the statistics given.

### Takeaways
What this result suggests for both teams going forward.`;
}

function buildBasketballUserPrompt(
  match: any,
  h2h: any[],
  homeForm: any[],
  awayForm: any[],
  mode: 'predict' | 'analyse',
): string {
  const home  = match.teams?.home;
  const away  = match.teams?.away;
  const league = match.league;

  const played = h2h.filter((f: any) => f.goals?.home !== null && f.goals?.away !== null);
  const hw = played.filter((f: any) => {
    const isHomeTeamHome = f.teams?.home?.id === home?.id;
    return isHomeTeamHome ? f.goals?.home > f.goals?.away : f.goals?.away > f.goals?.home;
  }).length;
  const aw = played.length - hw;

  const ptsAvg = (fixtures: any[], teamId: number, conceded: boolean): string => {
    if (!fixtures.length) return '0.0';
    const total = fixtures.reduce((s: number, f: any) => {
      const isHome = f.teams?.home?.id === teamId;
      return s + (conceded
        ? (isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0))
        : (isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0)));
    }, 0);
    return (total / fixtures.length).toFixed(1);
  };

  const formLine = (fixtures: any[], teamId: number): string =>
    fixtures.map((f: any) => {
      const isHome = f.teams?.home?.id === teamId;
      const tg = isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0);
      const og = isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0);
      const opp = isHome ? f.teams?.away?.name : f.teams?.home?.name;
      const r = tg > og ? 'W' : tg < og ? 'L' : 'OT';
      return `  ${f.fixture?.date?.slice(0, 10) ?? ''}  ${isHome ? 'vs' : '@'} ${opp}  ${tg}–${og}  [${r}]`;
    }).join('\n');

  const scoreSection = match.goals?.home !== null && match.goals?.away !== null
    ? `Final Score: ${home?.name} ${match.goals?.home} – ${match.goals?.away} ${away?.name}` : '';

  return `## Game
${home?.name} (Home) vs ${away?.name} (Away)
Competition: ${league?.name ?? 'Unknown'}, ${league?.country ?? ''}
Date: ${match.fixture?.date?.slice(0, 10) ?? 'Unknown'}
${scoreSection}

## Head-to-Head (last ${played.length} meetings)
${home?.name} wins: ${hw} | ${away?.name} wins: ${aw}
${played.slice(0, 5).map((f: any) => `  ${f.fixture?.date?.slice(0, 10) ?? ''}  ${f.teams?.home?.name} ${f.goals?.home}–${f.goals?.away} ${f.teams?.away?.name}`).join('\n')}

## ${home?.name} Recent Form (last ${homeForm.length} games)
Avg scored: ${ptsAvg(homeForm, home?.id, false)} pts/game | Avg conceded: ${ptsAvg(homeForm, home?.id, true)} pts/game
${formLine(homeForm, home?.id)}

## ${away?.name} Recent Form (last ${awayForm.length} games)
Avg scored: ${ptsAvg(awayForm, away?.id, false)} pts/game | Avg conceded: ${ptsAvg(awayForm, away?.id, true)} pts/game
${formLine(awayForm, away?.id)}`;
}

// ─── NVIDIA AI client ─────────────────────────────────────────────────────────

// Nemotron models run in reasoning mode by default and emit a chain-of-thought
// wall of text before (or instead of) the actual answer. "/no_think" as the
// first (system) message turns that off so `content` only ever holds the
// final structured response we ask for.
function toNvidiaMessages(prompt: string) {
  return [
    { role: 'system', content: '/no_think' },
    { role: 'user', content: prompt },
  ];
}

async function callNvidia(body: object, timeoutMs: number): Promise<Response> {
  return fetch(`${config.nvidiaBaseUrl}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.nvidiaApiKey}`,
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Defensive net in case a model still wraps reasoning in <think>...</think>
// inline despite "/no_think" — strips it across chunk boundaries so it never
// reaches the client, even if reasoning tags split across separate tokens.
// `flush()` must be called once the stream ends to release the small tail
// held back for split-tag detection — without it the last few characters of
// every response would be silently dropped.
function createThinkTagFilter() {
  const OPEN  = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let carry   = '';

  function process(text: string, isFinal: boolean): string {
    carry += text;
    let out = '';
    for (;;) {
      if (!inThink) {
        const idx = carry.indexOf(OPEN);
        if (idx === -1) {
          const holdBack = isFinal ? 0 : OPEN.length - 1;
          const safeLen = Math.max(0, carry.length - holdBack);
          out += carry.slice(0, safeLen);
          carry = carry.slice(safeLen);
          break;
        }
        out += carry.slice(0, idx);
        carry = carry.slice(idx + OPEN.length);
        inThink = true;
      } else {
        const idx = carry.indexOf(CLOSE);
        if (idx === -1) {
          const holdBack = isFinal ? 0 : CLOSE.length - 1;
          carry = carry.slice(Math.max(0, carry.length - holdBack));
          break;
        }
        carry = carry.slice(idx + CLOSE.length);
        inThink = false;
      }
    }
    return out;
  }

  return {
    push:  (text: string) => process(text, false),
    flush: () => process('', true),
  };
}

async function* streamNvidiaTokens(response: Response): AsyncGenerator<string> {
  const reader      = response.body!.getReader();
  const decoder     = new TextDecoder();
  const filterThink = createThinkTagFilter();
  let buf = '';

  streamLoop: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') break streamLoop;
      try {
        const chunk = JSON.parse(payload);
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          const visible = filterThink.push(token);
          if (visible) yield visible;
        }
      } catch { /* malformed SSE line — skip */ }
    }
  }

  const tail = filterThink.flush();
  if (tail) yield tail;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

async function aiRoutes(fastify: any) {
  const footballService = createFootballService({
    apiKey:      config.footballApiKey,
    sportsApiKey: config.sportsApiKey,
    redis:       fastify.redis,
  });
  const oddsService = createOddsService({
    apiKey: config.oddsApiKey,
    redis: fastify.redis,
  });
  const requireLiveAiAccess = fastify.requireFeatureAccess('live_ai', 'enterprise');

  fastify.get('/api/matches/:id/ai-prediction', {
    onRequest: [requireLiveAiAccess],
  }, async (request: any, reply: any) => {
    const { id }    = request.params;
    const { sport = 'football' } = request.query as { sport?: string };
    const isBasketball = sport === 'basketball';
    const cacheKey = `ai:prediction:v5:${id}:${sport}`;

    // Cache hit → instant JSON
    try {
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return reply.send({ status: 'success', data: { ...JSON.parse(cached), cached: true } });
      }
    } catch { /* non-fatal */ }

    // Fetch match data
    let match: any;
    try {
      match = await footballService.getMatchById(Number(id), sport);
    } catch (cause: any) {
      if (cause?.statusCode === 429) {
        return reply.status(429).send({ status: 'error', error: 'API rate limit reached. Try again tomorrow.' });
      }
      throw cause;
    }
    if (!match) return reply.status(404).send({ status: 'error', error: 'Match not found' });

    const statusShort = match.fixture?.status?.short ?? '';
    const mode: 'predict' | 'analyse' = new Set(['NS', 'TBD']).has(statusShort) ? 'predict' : 'analyse';

    const [h2h, homeForm, awayForm] = await Promise.all([
      footballService.getH2H(match.teams?.home?.id, match.teams?.away?.id, 10, sport).catch(() => []),
      footballService.getTeamLastFixtures(match.teams?.home?.id, 6, undefined, undefined, sport).catch(() => []),
      footballService.getTeamLastFixtures(match.teams?.away?.id, 6, undefined, undefined, sport).catch(() => []),
    ]);

    const prompt = isBasketball
      ? buildBasketballSystemPrompt(mode) + '\n\n' + buildBasketballUserPrompt(match, h2h, homeForm, awayForm, mode)
      : buildSystemPrompt(mode) + '\n\n' + buildUserPrompt(match, h2h, homeForm, awayForm, mode);

    // Stream SSE response
    reply.hijack();
    const raw = reply.raw;
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache, no-transform');
    raw.setHeader('X-Accel-Buffering', 'no');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
    raw.flushHeaders();

    const send = (data: object) => raw.write(`data: ${JSON.stringify(data)}\n\n`);

    let analysis = '';
    try {
      const nvidiaRes = await callNvidia({
        model:       config.nvidiaModel,
        messages:    toNvidiaMessages(prompt),
        stream:      true,
        temperature: 0.3,
        max_tokens:  350,
      }, 120_000);

      if (!nvidiaRes.ok) {
        send({ error: `NVIDIA AI returned ${nvidiaRes.status}. Check NVIDIA_API_KEY and model "${config.nvidiaModel}".` });
        raw.end();
        return;
      }

      for await (const token of streamNvidiaTokens(nvidiaRes)) {
        analysis += token;
        send({ token });
      }

      send({ done: true, mode, analysis, model: config.nvidiaModel });

      try {
        await fastify.redis.setex(cacheKey, 3600, JSON.stringify({
          analysis, mode, model: config.nvidiaModel,
          generated_at: new Date().toISOString(),
        }));
      } catch { /* non-fatal */ }

    } catch (e: any) {
      send({ error: e.message ?? 'Could not reach NVIDIA AI.' });
    }

    raw.end();
  });

  // ── Free-text prediction ───────────────────────────────────────────────────
  fastify.post('/api/ai/predict', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt:   { type: 'string', minLength: 5, maxLength: 1000 },
          sport:    { type: 'string', maxLength: 50 },
        },
        additionalProperties: false,
      },
    },
  }, async (request: any, reply: any) => {
    const { prompt: userPrompt, sport = 'Football' } = request.body as { prompt: string; sport?: string };
    const sportId = normalizeAiSport(sport);
    if (!sportId) {
      return reply.status(400).send({
        status: 'error',
        error: 'AI Predict currently supports Football, Basketball, Baseball, Hockey, and Volleyball.',
      });
    }
    const dataContext = await buildFreeTextDataContext(footballService, oddsService, userPrompt, sportId);

    const systemPrompt = `You are an expert sports analyst. The user will describe a match or ask about a prediction.
Give a concise, structured prediction with exactly these sections:
### Prediction
Winner: Home / Draw / Away / Not applicable — then your main tip (for example "Home Win", "Over 2.5 Goals", "BTTS Yes"). Always include this line even for totals or player markets.

### Probability Range
For 1X2 questions, use exactly: Home xx%, Draw yy%, Away zz%, where xx + yy + zz = 100. For two-outcome markets, use two percentages that sum to 100. Do not mix percentages with scorelines on this line.

### Key Factors
2–3 bullet points explaining the strongest factors. Include H2H and recent form when available. Mention injuries only when the Data Context or user supplied injury information; otherwise state injury data was not available.

### Odds Estimate
Estimated decimal fair odds range (e.g. 1.70–1.90). Keep football 1X2 estimates in realistic bookmaker-style ranges; never output odds below 1.10, avoid exact single odds, and say "not enough data" if the prompt lacks context.

### Data Sources
List the sources used and update frequency/freshness in one short sentence.

### Confidence
Low / Medium / High — and the key uncertainty.

RULES:
- Be honest about uncertainty — never guarantee outcomes.
- Keep total response under 240 words.
- Use hedged language ("likely", "suggests", "tends to").
- Base claims on the Data Context when it is available.
- Use live bookmaker odds only when The Odds API source is marked available in the Data Context.
- Do not invent live odds, bookmaker prices, team form, injuries, or goal spreads when the user has not provided data.
- Never output negative goals, negative xG, or negative spreads.
- Probability ranges are estimates, not bookmaker odds. They must be plausible percentages, sum to 100 for the stated market, and must not imply certainty.`;

    const fullPrompt = `${systemPrompt}\n\nUser request: ${userPrompt}\nSport: ${sportId}\n\n${dataContext.contextText}`;

    reply.hijack();
    const raw = reply.raw;
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache, no-transform');
    raw.setHeader('X-Accel-Buffering', 'no');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('Access-Control-Allow-Origin', config.corsOrigin || '*');
    raw.flushHeaders();

    const send = (data: object) => raw.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      const nvidiaRes = await callNvidia({
        model:       config.nvidiaModel,
        messages:    toNvidiaMessages(fullPrompt),
        stream:      true,
        temperature: 0.25,
        max_tokens:  300,
      }, 60_000);

      if (!nvidiaRes.ok) {
        send({ error: `AI service unavailable (HTTP ${nvidiaRes.status}). Please try again later.` });
        raw.end();
        return;
      }

      let analysis = '';
      for await (const token of streamNvidiaTokens(nvidiaRes)) {
        analysis += token;
        send({ token });
      }

      send({ done: true, analysis, sources: dataContext.sources, generatedAt: dataContext.generatedAt });
    } catch (e: any) {
      send({ error: e.message ?? 'AI service is currently unavailable.' });
    }

    raw.end();
  });

  // ── Connectivity test ──────────────────────────────────────────────────────
  fastify.get('/api/ai/test', async (_request: any, reply: any) => {
    try {
      const res = await callNvidia({
        model:       config.nvidiaModel,
        messages:    toNvidiaMessages('Reply with exactly: "NVIDIA AI is working."'),
        stream:      false,
        temperature: 0.0,
        max_tokens:  20,
      }, 60_000);
      if (!res.ok) {
        return reply.status(502).send({ status: 'error', error: `NVIDIA AI returned HTTP ${res.status}.`, hint: `Check that NVIDIA_API_KEY is valid and model "${config.nvidiaModel}" is available on build.nvidia.com` });
      }
      const json: any = await res.json();
      const text = (json.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
      return reply.send({ status: 'ok', model: config.nvidiaModel, url: config.nvidiaBaseUrl, response: text.trim() });
    } catch (e: any) {
      return reply.status(503).send({ status: 'error', error: `Cannot reach NVIDIA AI: ${e.message}`, hint: 'Verify NVIDIA_API_KEY is set and the network can reach integrate.api.nvidia.com' });
    }
  });
}

export default fp(aiRoutes, { name: 'ai-routes', fastify: '5.x', dependencies: ['infrastructure', 'authenticate'] });
