import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { createFootballService } from '../football/football.service.js';

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

// ─── Routes ───────────────────────────────────────────────────────────────────

async function aiRoutes(fastify: any) {
  const footballService = createFootballService({
    apiKey:      config.footballApiKey,
    sportsApiKey: config.sportsApiKey,
    redis:       fastify.redis,
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
      const ollamaRes = await fetch(`${config.ollamaUrl}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:  config.ollamaModel,
          prompt,
          stream: true,
          options: { num_ctx: 1536, temperature: 0.3, num_predict: 350, num_thread: 1 },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!ollamaRes.ok) {
        send({ error: `Ollama returned ${ollamaRes.status}. Ensure model "${config.ollamaModel}" is installed.` });
        raw.end();
        return;
      }

      const reader  = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.response) {
              analysis += chunk.response;
              send({ token: chunk.response });
            }
          } catch { /* malformed JSON line — skip */ }
        }
      }

      send({ done: true, mode, analysis, model: config.ollamaModel });

      try {
        await fastify.redis.setex(cacheKey, 3600, JSON.stringify({
          analysis, mode, model: config.ollamaModel,
          generated_at: new Date().toISOString(),
        }));
      } catch { /* non-fatal */ }

    } catch (e: any) {
      send({ error: e.message ?? 'Could not reach Ollama.' });
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

    const systemPrompt = `You are an expert sports analyst. The user will describe a match or ask about a prediction.
Give a concise, structured prediction with these sections:
### Prediction
Your main tip (e.g. "Home Win", "Over 2.5 Goals", "BTTS Yes").

### Reasoning
2–3 bullet points explaining why.

### Odds Estimate
Estimated fair odds range (e.g. 1.70–1.90).

### Confidence
Low / Medium / High — and the key uncertainty.

RULES:
- Be honest about uncertainty — never guarantee outcomes.
- Keep total response under 200 words.
- Use hedged language ("likely", "suggests", "tends to").`;

    const fullPrompt = `${systemPrompt}\n\nUser request: ${userPrompt}\nSport: ${sport}`;

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
      const ollamaRes = await fetch(`${config.ollamaUrl}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:  config.ollamaModel,
          prompt: fullPrompt,
          stream: true,
          options: { num_ctx: 1024, temperature: 0.4, num_predict: 300, num_thread: 1 },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!ollamaRes.ok) {
        send({ error: `AI service unavailable (HTTP ${ollamaRes.status}). Please try again later.` });
        raw.end();
        return;
      }

      const reader  = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let analysis = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.response) {
              analysis += chunk.response;
              send({ token: chunk.response });
            }
          } catch { /* skip */ }
        }
      }

      send({ done: true, analysis });
    } catch (e: any) {
      send({ error: e.message ?? 'AI service is currently unavailable.' });
    }

    raw.end();
  });

  // ── Connectivity test ──────────────────────────────────────────────────────
  fastify.get('/api/ai/test', async (_request: any, reply: any) => {
    try {
      const res = await fetch(`${config.ollamaUrl}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:  config.ollamaModel,
          prompt: 'Reply with exactly: "Ollama is working."',
          stream: false,
          options: { num_ctx: 512, num_predict: 20, temperature: 0.0, num_thread: 1 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        return reply.status(502).send({ status: 'error', error: `Ollama returned HTTP ${res.status}.`, hint: `docker exec ollama ollama pull ${config.ollamaModel}` });
      }
      const json: any = await res.json();
      return reply.send({ status: 'ok', model: config.ollamaModel, url: config.ollamaUrl, response: (json.response ?? '').trim() });
    } catch (e: any) {
      return reply.status(503).send({ status: 'error', error: `Cannot reach Ollama: ${e.message}`, hint: 'docker compose up -d ollama' });
    }
  });
}

export default fp(aiRoutes, { name: 'ai-routes', fastify: '5.x', dependencies: ['infrastructure', 'authenticate'] });
