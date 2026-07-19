import fp from 'fastify-plugin';
import { createCommunityRepository } from './community.repository.js';
import { createCommunityService } from './community.service.js';
import { createCommunityController } from './community.controller.js';
import { createFootballService } from '../football/football.service.js';
import config from '../../config/env.config.js';
import { createNewsService } from '../news/news.service.js';
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
  const service = createCommunityService(repo,footballService,createNewsService({redis:fastify.redis}));
  const ctrl = createCommunityController(service);

  fastify.get('/api/platform/stats', ctrl.getPlatformStats);
  fastify.get('/api/search',{config:{rateLimit:{max:30,timeWindow:'1 minute'}},schema:{querystring:{type:'object',required:['q'],properties:{q:{type:'string',minLength:2,maxLength:120}},additionalProperties:false}}},ctrl.globalSearch);

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
    schema: { body: { type: 'object', required: ['termsAccepted','termsVersion'], properties: {
      termsAccepted: { const: true }, termsVersion: { const: '2026-01' },
      statement: { type: 'string', minLength: 20, maxLength: 2000 },
    }, additionalProperties: false } },
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
    onRequest: [fastify.authenticate],
    schema: { params: interactionParamSchema },
  }, ctrl.likePrediction);

  fastify.get('/api/creators',{schema:{querystring:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100,default:50},pagination:{type:'string',enum:['legacy','cursor'],default:'legacy'},cursor:{type:'string',maxLength:500}},additionalProperties:false}}},ctrl.listCreators);
  fastify.get('/api/creators/leaderboard', ctrl.getLeaderboard);

  fastify.get('/api/creators/:id', {
    schema: { params: idParamSchema },
  }, ctrl.getCreator);
  fastify.get('/api/creators/:id/performance', { schema: { params: idParamSchema } }, ctrl.getCreatorPerformance);

  fastify.post('/api/creators/:id/follow', {
    onRequest: [fastify.authenticate],
    schema: { params: idParamSchema },
  }, ctrl.toggleFollow);

  fastify.get('/api/forum/threads', {
    onRequest: [fastify.optionalAuth],
    schema: { querystring: threadsQuerySchema },
  }, ctrl.listThreads);

  fastify.get('/api/forum/threads/:id', {
    onRequest: [fastify.optionalAuth],
    schema: { params: idParamSchema },
  }, ctrl.getThread);

  fastify.post('/api/forum/threads', {
    onRequest: [fastify.authenticate],
    schema: { body: createThreadSchema },
  }, ctrl.createThread);

  fastify.post('/api/forum/threads/:id/like', {
    onRequest: [fastify.authenticate],
    schema: { params: interactionParamSchema },
  }, ctrl.likeThread);

  const editThreadSchema = { type:'object',required:['content'],properties:{
    title:{type:'string',minLength:5,maxLength:160},content:{type:'string',minLength:10,maxLength:5000},
  },additionalProperties:false };
  const editCommentSchema = { type:'object',required:['content'],properties:{content:{type:'string',minLength:1,maxLength:500}},additionalProperties:false };
  fastify.put('/api/forum/threads/:id',{onRequest:[fastify.authenticate],schema:{params:idParamSchema,body:editThreadSchema}},ctrl.updateThread);
  fastify.delete('/api/forum/threads/:id',{onRequest:[fastify.authenticate],schema:{params:idParamSchema}},ctrl.deleteThread);

  fastify.get('/api/comments', {
    onRequest: [fastify.optionalAuth],
    schema: { querystring: commentsQuerySchema },
  }, ctrl.listComments);

  fastify.post('/api/comments', {
    onRequest: [fastify.authenticate],
    schema: { body: createCommentSchema },
  }, ctrl.createComment);

  fastify.post('/api/comments/:id/like', {
    onRequest: [fastify.authenticate],
    schema: { params: interactionParamSchema },
  }, ctrl.likeComment);
  fastify.put('/api/comments/:id',{onRequest:[fastify.authenticate],schema:{params:idParamSchema,body:editCommentSchema}},ctrl.updateComment);
  fastify.delete('/api/comments/:id',{onRequest:[fastify.authenticate],schema:{params:idParamSchema}},ctrl.deleteComment);

  fastify.post('/api/moderation/reports',{onRequest:[fastify.authenticate],schema:{body:{type:'object',required:['contentType','contentId','reason'],properties:{
    contentType:{type:'string',enum:['thread','comment']},contentId:{type:'integer',minimum:1},
    reason:{type:'string',enum:['spam','harassment','hate','misinformation','privacy','other']},details:{type:'string',maxLength:2000},
  },additionalProperties:false}}},ctrl.reportContent);
  fastify.put('/api/me/relationships/:id',{onRequest:[fastify.authenticate],schema:{params:idParamSchema,body:{type:'object',required:['type','enabled'],properties:{
    type:{type:'string',enum:['block','mute']},enabled:{type:'boolean'},
  },additionalProperties:false}}},ctrl.setRelationship);
  fastify.get('/api/admin/moderation/reports',{onRequest:[fastify.requireAdmin],schema:{querystring:{type:'object',properties:{
    status:{type:'string',enum:['open','reviewing','resolved','dismissed','all'],default:'open'},limit:{type:'integer',minimum:1,maximum:100,default:50},
  },additionalProperties:false}}},ctrl.moderationQueue);
  fastify.post('/api/admin/moderation/actions',{onRequest:[fastify.requireAdmin],schema:{body:{type:'object',required:['reportId','action','reason'],properties:{
    reportId:{type:'integer',minimum:1},action:{type:'string',enum:['hide','remove','restore','dismiss','warn']},reason:{type:'string',minLength:5,maxLength:2000},
  },additionalProperties:false}}},ctrl.moderateContent);
  fastify.post('/api/moderation/appeals',{onRequest:[fastify.authenticate],schema:{body:{type:'object',required:['actionId','contentType','statement'],properties:{
    actionId:{type:'integer',minimum:1},contentType:{type:'string',enum:['thread','comment']},statement:{type:'string',minLength:20,maxLength:3000},
  },additionalProperties:false}}},ctrl.appealModeration);
  fastify.post('/api/admin/moderation/appeals/resolve',{onRequest:[fastify.requireAdmin],schema:{body:{type:'object',required:['appealId','decision','reason'],properties:{
    appealId:{type:'integer',minimum:1},decision:{type:'string',enum:['upheld','overturned']},reason:{type:'string',minLength:5,maxLength:2000},
  },additionalProperties:false}}},ctrl.resolveAppeal);

  const preferenceProperties = {
    replies:{type:'boolean'},mentions:{type:'boolean'},follows:{type:'boolean'},prediction_results:{type:'boolean'},saved_match_starts:{type:'boolean'},billing:{type:'boolean'},moderation:{type:'boolean'},
  };
  fastify.get('/api/notifications',{onRequest:[fastify.authenticate],schema:{querystring:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100,default:50}},additionalProperties:false}}},ctrl.listNotifications);
  fastify.post('/api/notifications/read',{onRequest:[fastify.authenticate],schema:{body:{type:'object',properties:{ids:{type:'array',items:{type:'integer',minimum:1},maxItems:100}},additionalProperties:false}}},ctrl.markNotificationsRead);
  fastify.get('/api/notifications/preferences',{onRequest:[fastify.authenticate]},ctrl.getNotificationPreferences);
  fastify.put('/api/notifications/preferences',{onRequest:[fastify.authenticate],schema:{body:{type:'object',properties:preferenceProperties,additionalProperties:false,minProperties:1}}},ctrl.updateNotificationPreferences);
  const savedMatchParams={type:'object',required:['fixtureId'],properties:{fixtureId:{type:'string',minLength:1,maxLength:80}},additionalProperties:false};
  fastify.get('/api/saved-matches',{onRequest:[fastify.authenticate]},ctrl.listSavedMatches);
  fastify.put('/api/saved-matches/:fixtureId',{onRequest:[fastify.authenticate],schema:{params:savedMatchParams,body:{type:'object',required:['sport','startsAt','homeTeam','awayTeam'],properties:{sport:{type:'string',minLength:2,maxLength:40},startsAt:{type:'string',format:'date-time'},homeTeam:{type:'string',minLength:1,maxLength:140},awayTeam:{type:'string',minLength:1,maxLength:140},league:{type:'string',maxLength:140}},additionalProperties:false}}},ctrl.saveMatch);
  fastify.delete('/api/saved-matches/:fixtureId',{onRequest:[fastify.authenticate],schema:{params:savedMatchParams,querystring:{type:'object',required:['sport'],properties:{sport:{type:'string',minLength:2,maxLength:40}},additionalProperties:false}}},ctrl.deleteSavedMatch);

  fastify.post('/api/tracking/click', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { body: trackingSchema },
  }, ctrl.track);
}

export default fp(communityRoutes, {
  name: 'community-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
