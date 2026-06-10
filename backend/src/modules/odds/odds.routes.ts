import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { cache, registerCacheHeaders } from '../../helpers/http-cache.helpers.js';
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

  registerCacheHeaders(fastify);

  // TTLs mirror the odds service: sports list 1h, odds/events 5m, scores 1m.
  // The data endpoints are pro-gated, so they cache `private` (browser only).
  fastify.get('/api/odds/sports', { ...cache(3600) }, ctrl.getSports);
  fastify.get('/api/odds/:sport', { ...cache(300, 'private'), onRequest: [requireAdvancedStats] }, ctrl.getOdds);
  fastify.get('/api/odds/:sport/scores', { ...cache(60, 'private'), onRequest: [requireAdvancedStats] }, ctrl.getScores);
  fastify.get('/api/odds/:sport/events', { ...cache(300, 'private'), onRequest: [requireAdvancedStats] }, ctrl.getEvents);
}

export default fp(oddsRoutes, { name: 'odds-routes', fastify: '5.x', dependencies: ['authenticate'] });
