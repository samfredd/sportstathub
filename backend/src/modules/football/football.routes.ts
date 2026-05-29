import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
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

  // Sports
  fastify.get('/api/sports', {}, ctrl.getSports);

  // Matches
  fastify.get('/api/matches/live', {}, ctrl.getLiveMatches);
  fastify.get('/api/matches', { schema: { querystring: matchesQuerySchema } }, ctrl.getMatches);
  fastify.get('/api/matches/:id', { schema: { params: matchParamSchema } }, ctrl.getMatchById);
  fastify.get('/api/matches/:id/stats', { schema: { params: matchParamSchema } }, ctrl.getMatchStats);
  fastify.get('/api/matches/:id/lineups', { schema: { params: matchParamSchema } }, ctrl.getMatchLineups);
  fastify.get('/api/matches/:id/events', { schema: { params: matchParamSchema } }, ctrl.getMatchEvents);
  fastify.get('/api/matches/:id/players', { schema: { params: matchParamSchema } }, ctrl.getMatchPlayerStats);

  // Match analytics
  fastify.get('/api/matches/:id/predictions', { schema: { params: matchParamSchema } }, ctrl.getMatchPredictions);
  fastify.get('/api/matches/:id/injuries', { schema: { params: matchParamSchema } }, ctrl.getMatchInjuries);

  // Leagues & standings
  fastify.get('/api/leagues', { schema: { querystring: leaguesQuerySchema } }, ctrl.getLeagues);
  fastify.get('/api/leagues/:id/standings', { schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getStandings);
  fastify.get('/api/leagues/:id/scorers', { onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopScorers);
  fastify.get('/api/leagues/:id/assists', { onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopAssists);
  fastify.get('/api/leagues/:id/yellow-cards', { onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopYellowCards);
  fastify.get('/api/leagues/:id/red-cards', { onRequest: [requireAdvancedStats], schema: { params: leagueParamSchema, querystring: standingsQuerySchema } }, ctrl.getTopRedCards);

  // Teams
  fastify.get('/api/teams/:id/statistics', { onRequest: [requireAdvancedStats], schema: { params: teamParamSchema, querystring: teamStatsQuerySchema } }, ctrl.getTeamStatistics);
  fastify.get('/api/teams/:id/fixtures', { schema: { params: teamParamSchema, querystring: teamFixturesQuerySchema } }, ctrl.getTeamFixtures);

  // Head-to-head
  fastify.get('/api/h2h', { schema: { querystring: h2hQuerySchema } }, ctrl.getH2H);

  // Teams search (for H2H autocomplete)
  fastify.get('/api/teams/search', { schema: { querystring: teamsSearchSchema } }, ctrl.searchTeams);
}

export default fp(footballRoutes, { name: 'football-routes', fastify: '5.x' });
