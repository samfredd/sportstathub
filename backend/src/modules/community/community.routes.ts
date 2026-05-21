import fp from 'fastify-plugin';
import { createCommunityRepository } from './community.repository.js';
import { createCommunityService } from './community.service.js';
import { createCommunityController } from './community.controller.js';
import { createFootballService } from '../football/football.service.js';
import config from '../../config/env.config.js';
import {
  commentsQuerySchema,
  createCommentSchema,
  createPredictionSchema,
  createThreadSchema,
  idParamSchema,
  interactionParamSchema,
  predictionsQuerySchema,
  threadsQuerySchema,
  trackingSchema,
  updateProfileSchema,
} from './community.schemas.js';

async function communityRoutes(fastify) {
  const repo = createCommunityRepository(fastify.db);
  const footballService = createFootballService({ apiKey: config.footballApiKey, sportsApiKey: config.sportsApiKey, redis: fastify.redis });
  const service = createCommunityService(repo, footballService);
  const ctrl = createCommunityController(service);

  fastify.get('/api/platform/stats', ctrl.getPlatformStats);

  fastify.get('/api/dashboard/creator', {
    onRequest: [fastify.authenticate],
  }, ctrl.getCreatorDashboard);

  fastify.get('/api/dashboard/me', {
    onRequest: [fastify.authenticate],
  }, ctrl.getUserDashboard);

  fastify.get('/api/me', {
    onRequest: [fastify.authenticate],
  }, ctrl.getMe);

  fastify.put('/api/me/profile', {
    onRequest: [fastify.authenticate],
    schema: { body: updateProfileSchema },
  }, ctrl.updateProfile);

  fastify.post('/api/me/become-creator', {
    onRequest: [fastify.authenticate],
  }, ctrl.becomeCreator);

  fastify.put('/api/me/password', {
    onRequest: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } } },
  }, ctrl.changePassword);

  fastify.get('/api/predictions', {
    onRequest: [fastify.optionalAuth],
    schema: { querystring: predictionsQuerySchema },
  }, ctrl.listPredictions);

  fastify.get('/api/predictions/:id', {
    onRequest: [fastify.optionalAuth],
    schema: { params: idParamSchema },
  }, ctrl.getPrediction);

  fastify.post('/api/predictions', {
    onRequest: [fastify.authenticate],
    schema: { body: createPredictionSchema },
  }, ctrl.createPrediction);

  fastify.post('/api/predictions/:id/like', {
    schema: { params: interactionParamSchema },
  }, ctrl.likePrediction);

  fastify.get('/api/creators', ctrl.listCreators);
  fastify.get('/api/creators/leaderboard', ctrl.getLeaderboard);

  fastify.get('/api/creators/:id', {
    schema: { params: idParamSchema },
  }, ctrl.getCreator);

  fastify.post('/api/creators/:id/follow', {
    onRequest: [fastify.authenticate],
    schema: { params: idParamSchema },
  }, ctrl.toggleFollow);

  fastify.get('/api/forum/threads', {
    schema: { querystring: threadsQuerySchema },
  }, ctrl.listThreads);

  fastify.get('/api/forum/threads/:id', {
    schema: { params: idParamSchema },
  }, ctrl.getThread);

  fastify.post('/api/forum/threads', {
    onRequest: [fastify.authenticate],
    schema: { body: createThreadSchema },
  }, ctrl.createThread);

  fastify.post('/api/forum/threads/:id/like', {
    schema: { params: interactionParamSchema },
  }, ctrl.likeThread);

  fastify.get('/api/comments', {
    onRequest: [fastify.optionalAuth],
    schema: { querystring: commentsQuerySchema },
  }, ctrl.listComments);

  fastify.post('/api/comments', {
    onRequest: [fastify.authenticate],
    schema: { body: createCommentSchema },
  }, ctrl.createComment);

  fastify.post('/api/comments/:id/like', {
    schema: { params: interactionParamSchema },
  }, ctrl.likeComment);

  fastify.post('/api/tracking/click', {
    schema: { body: trackingSchema },
  }, ctrl.track);
}

export default fp(communityRoutes, {
  name: 'community-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
