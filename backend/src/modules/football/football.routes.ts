import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { cache, registerCacheHeaders } from '../../helpers/http-cache.helpers.js';
import { createFootballService } from './football.service.js';
import { createFootballController } from './football.controller.js';
import {
  matchesQuerySchema,
  matchParamSchema,
  leagueParamSchema,
  h2hQuerySchema,
  leaguesQuerySchema,
  standingsQuerySchema,
  teamsSearchSchema,
  teamParamSchema,
  teamStatsQuerySchema,
  teamFixturesQuerySchema,
} from './football.schemas.js';

async function footballRoutes(fastify) {
  const footballService = createFootballService({
    apiKey: config.footballApiKey,
    sportsApiKey: config.sportsApiKey,
    redis: fastify.redis,
  });
  const ctrl = createFootballController(footballService);
  const requireAdvancedStats = fastify.requireFeatureAccess('advanced_stats', 'pro');

  // Apply per-route Cache-Control to successful GET responses. Public endpoints
  // serve identical data to everyone (CDN-cacheable); gated endpoints use
  // `private` so a shared cache can't serve pro data to others.
  registerCacheHeaders(fastify);

  // Sports
  fastify.get('/api/sports', { ...cache(3600) }, ctrl.getSports);

  // Matches
  fastify.get('/api/matches/live', { ...cache(30) }, ctrl.getLiveMatches);

  // Server-Sent Events — pushes live fixture updates every 30 s without polling.
  // Rate limiting is disabled: this is one long-lived connection, not repeated requests.
  // X-Accel-Buffering: no disables Nginx/Traefik response buffering so chunks flush immediately.
  fastify.get('/api/matches/live/stream', { config: { rateLimit: false } as any }, async (request, reply) => {
    const { sport } = request.query as { sport?: string };

    reply.hijack();
    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Allow CORS for SSE (same origin set applies as the rest of the API)
    const origin = (request.headers.origin as string) || '';
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.writeHead(200);

    let closed = false;

    const push = async () => {
      if (closed || res.destroyed) return;
      try {
        const data = await footballService.getLiveMatches(sport);
        res.write(`data: ${JSON.stringify({ data })}\n\n`);
      } catch { /* non-fatal — client keeps last state */ }
    };

    await push(); // send immediately on connect
    const interval = setInterval(push, 30_000);

    request.raw.on('close', () => {
      closed = true;
      clearInterval(interval);
      if (!res.destroyed) res.end();
    });
  });
  fastify.get('/api/matches', { ...cache(60), schema: { querystring: matchesQuerySchema } }, ctrl.getMatches);
  fastify.get('/api/matches/:id', { ...cache(30), schema: { params: matchParamSchema } }, ctrl.getMatchById);
  fastify.get('/api/matches/:id/stats', { ...cache(60), schema: { params: matchParamSchema } }, ctrl.getMatchStats);
  fastify.get('/api/matches/:id/lineups', { ...cache(600), schema: { params: matchParamSchema } }, ctrl.getMatchLineups);
  fastify.get('/api/matches/:id/events', { ...cache(60), schema: { params: matchParamSchema } }, ctrl.getMatchEvents);
  fastify.get('/api/matches/:id/players', { ...cache(120), schema: { params: matchParamSchema } }, ctrl.getMatchPlayerStats);

  // Match analytics
  fastify.get('/api/matches/:id/predictions', { ...cache(300), schema: { params: matchParamSchema } }, ctrl.getMatchPredictions);
  fastify.get('/api/matches/:id/injuries', { ...cache(300), schema: { params: matchParamSchema } }, ctrl.getMatchInjuries);

  // Leagues & standings
  fastify.get('/api/leagues', { ...cache(21600), schema: { querystring: leaguesQuerySchema } }, ctrl.getLeagues);
  fastify.get('/api/leagues/:id/standings', { ...cache(3600), schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getStandings);
  fastify.get('/api/leagues/:id/scorers', { ...cache(1800, 'private'), onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopScorers);
  fastify.get('/api/leagues/:id/assists', { ...cache(1800, 'private'), onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopAssists);
  fastify.get('/api/leagues/:id/yellow-cards', { ...cache(1800, 'private'), onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopYellowCards);
  fastify.get('/api/leagues/:id/red-cards', { ...cache(1800, 'private'), onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopRedCards);

  // Teams
  fastify.get('/api/teams/:id/statistics', { ...cache(3600, 'private'), onRequest: [requireAdvancedStats], schema: { params: teamParamSchema, querystring: teamStatsQuerySchema } }, ctrl.getTeamStatistics);
  fastify.get('/api/teams/:id/fixtures', { ...cache(300), schema: { params: teamParamSchema, querystring: teamFixturesQuerySchema } }, ctrl.getTeamFixtures);

  // Head-to-head
  fastify.get('/api/h2h', { ...cache(3600), schema: { querystring: h2hQuerySchema } }, ctrl.getH2H);

  // Teams search (for H2H autocomplete)
  fastify.get('/api/teams/search', { ...cache(3600), schema: { querystring: teamsSearchSchema } }, ctrl.searchTeams);
}

export default fp(footballRoutes, { name: 'football-routes', fastify: '5.x' });
