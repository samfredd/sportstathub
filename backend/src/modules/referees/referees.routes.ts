import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { createFootballService } from '../football/football.service.js';
import { createRefereesService } from './referees.service.js';
import { createRefereesController } from './referees.controller.js';
import { refereesQuerySchema } from './referees.schemas.js';

async function refereesRoutes(fastify) {
  const footballService = createFootballService({
    apiKey: config.footballApiKey,
    sportsApiKey: config.sportsApiKey,
    redis: fastify.redis,
  });
  const refereesService = createRefereesService({ footballService });
  const ctrl = createRefereesController(refereesService);
  const requireRefereeAccess = fastify.requireFeatureAccess('referee_search', 'free');

  fastify.get('/api/referees', {
    onRequest: [requireRefereeAccess],
    schema: { querystring: refereesQuerySchema },
  }, ctrl.getRefereeStats);
}

export default fp(refereesRoutes, { name: 'referees-routes', fastify: '5.x' });
