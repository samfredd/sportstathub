import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { createOddsService } from './odds.service.js';
import { createOddsController } from './odds.controller.js';

async function oddsRoutes(fastify: any) {
  const oddsService = createOddsService({
    apiKey: config.oddsApiKey,
    redis: fastify.redis,
  });

  if (!oddsService) {
    fastify.log.warn('ODDS_API_KEY not set — odds routes disabled');
    return;
  }

  const ctrl = createOddsController(oddsService);
  const requireAdvancedStats = fastify.requireFeatureAccess('advanced_stats', 'pro');

  fastify.get('/api/odds/sports', {}, ctrl.getSports);
  fastify.get('/api/odds/:sport', { onRequest: [requireAdvancedStats] }, ctrl.getOdds);
  fastify.get('/api/odds/:sport/scores', { onRequest: [requireAdvancedStats] }, ctrl.getScores);
  fastify.get('/api/odds/:sport/events', { onRequest: [requireAdvancedStats] }, ctrl.getEvents);
}

export default fp(oddsRoutes, { name: 'odds-routes', fastify: '5.x', dependencies: ['authenticate'] });
