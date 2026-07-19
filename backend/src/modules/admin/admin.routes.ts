import fp from 'fastify-plugin';
import { createAdminRepository } from './admin.repository.js';
import { createAdminService }    from './admin.service.js';
import { createAdminController } from './admin.controller.js';
import {
  usersQuerySchema, userParamSchema, updateUserSchema,
  adminCodesQuerySchema, adminCreateCodeSchema, adminUpdateCodeSchema,
  subscriptionsQuerySchema, subscriptionParamSchema,
  createSubscriptionSchema, updateSubscriptionSchema,
  createPlanSchema, updatePlanSchema,
  changePasswordSchema, bulkUserSchema,
} from './admin.schemas.js';
import { createPredictionSchema } from '../community/community.schemas.js';

async function adminRoutes(fastify) {
  const repo  = createAdminRepository(fastify.db);
  const svc   = createAdminService(repo);
  const ctrl  = createAdminController(svc);

  const guard = { onRequest: [fastify.requireAdmin] };
  const sensitiveGuard = { onRequest: [fastify.requireRecentAdminAuth] };
  const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } };

  // ─── Stats ────────────────────────────────────────────────
  fastify.get('/api/admin/stats', guard, ctrl.getStats);

  // ─── Users ────────────────────────────────────────────────
  const adminUsersQuerySchema = {
    ...usersQuerySchema,
    properties: {
      ...usersQuerySchema.properties,
      status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
    },
  };

  fastify.get('/api/admin/users', {
    ...guard,
    schema: { querystring: adminUsersQuerySchema },
  }, ctrl.getUsers);

  fastify.get('/api/admin/users/:id', {
    ...guard,
    schema: { params: idParam },
  }, ctrl.getUserById);

  fastify.put('/api/admin/users/:id', {
    ...sensitiveGuard,
    schema: { params: idParam, body: updateUserSchema },
  }, ctrl.updateUser);

  fastify.delete('/api/admin/users/:id', {
    ...sensitiveGuard,
    schema: { params: idParam },
  }, ctrl.deleteUser);

  // ─── Booking Codes ────────────────────────────────────────
  fastify.get('/api/admin/codes', {
    ...guard,
    schema: { querystring: adminCodesQuerySchema },
  }, ctrl.getCodes);

  fastify.post('/api/admin/codes', {
    ...guard,
    schema: { body: adminCreateCodeSchema },
  }, ctrl.createCode);

  fastify.put('/api/admin/codes/:id', {
    ...guard,
    schema: { params: idParam, body: adminUpdateCodeSchema },
  }, ctrl.updateCode);

  fastify.delete('/api/admin/codes/:id', {
    ...guard,
    schema: { params: idParam },
  }, ctrl.deleteCode);

  // ─── Subscriptions ────────────────────────────────────────
  fastify.get('/api/admin/subscriptions', {
    ...guard,
    schema: { querystring: subscriptionsQuerySchema },
  }, ctrl.getSubscriptions);

  fastify.post('/api/admin/subscriptions', {
    ...sensitiveGuard,
    schema: { body: createSubscriptionSchema },
  }, ctrl.createSubscription);

  fastify.put('/api/admin/subscriptions/:id', {
    ...sensitiveGuard,
    schema: { params: idParam, body: updateSubscriptionSchema },
  }, ctrl.updateSubscription);

  fastify.delete('/api/admin/subscriptions/:id', {
    ...sensitiveGuard,
    schema: { params: idParam },
  }, ctrl.deleteSubscription);

  // ─── Admin Profile ────────────────────────────────────────────
  fastify.get('/api/admin/me', guard, ctrl.getProfile);
  fastify.put('/api/admin/me', {
    ...guard,
    schema: { body: { type: 'object', properties: { username: { type: 'string', minLength: 2, maxLength: 32 }, email: { type: 'string', format: 'email' } } } },
  }, ctrl.updateProfile);
  fastify.put('/api/admin/me/password', {
    ...sensitiveGuard,
    schema: { body: changePasswordSchema },
  }, ctrl.changePassword);
  const activityQuery = { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20, maximum: 50 } } };
  fastify.get('/api/admin/me/activity', { ...guard, schema: { querystring: activityQuery } }, ctrl.getMyActivity);

  // ─── Subscription Plans ───────────────────────────────────
  fastify.get('/api/admin/subscription-plans', guard, ctrl.getPlans);
  fastify.post('/api/admin/subscription-plans', { ...sensitiveGuard, schema: { body: createPlanSchema } }, ctrl.createPlan);
  fastify.get('/api/admin/subscription-plans/:id', { ...guard, schema: { params: idParam } }, ctrl.getPlan);
  fastify.put('/api/admin/subscription-plans/:id', { ...sensitiveGuard, schema: { params: idParam, body: updatePlanSchema } }, ctrl.updatePlan);
  fastify.delete('/api/admin/subscription-plans/:id', { ...sensitiveGuard, schema: { params: idParam } }, ctrl.deletePlan);

  // ─── Predictions ──────────────────────────────────────────
  const predictionsQuery = { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 }, search: { type: 'string', default: '' }, status: { type: 'string', default: '' } } };
  fastify.get('/api/admin/predictions', { ...guard, schema: { querystring: predictionsQuery } }, ctrl.getPredictions);
  fastify.put('/api/admin/predictions/:id', {
    ...sensitiveGuard,
    schema: {
      params: idParam,
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'won', 'lost', 'void'] },
          isPremium: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, ctrl.updatePredictionStatus);
  fastify.post('/api/admin/predictions', {
    ...guard,
    schema: {
      body: {
        type: 'object',
        required: ['sport', 'league', 'matchData', 'prediction'],
        properties: {
          sport:       createPredictionSchema.properties.sport,
          schemaVersion: createPredictionSchema.properties.schemaVersion,
          league:      createPredictionSchema.properties.league,
          matchData:   createPredictionSchema.properties.match,
          prediction:  createPredictionSchema.properties.prediction,
          bookingCode: createPredictionSchema.properties.bookingCode,
          isPremium:   { type: 'boolean', default: false },
          isTrending:  { type: 'boolean', default: false },
          tags:        createPredictionSchema.properties.tags,
          fixtureId:   { type: 'integer', nullable: true },
        },
        additionalProperties: false,
      },
    },
  }, ctrl.createAdminPrediction);
  fastify.delete('/api/admin/predictions/:id', { ...sensitiveGuard, schema: { params: idParam } }, ctrl.deletePrediction);

  // Manually trigger the settlement sweep (grades open predictions tied to a
  // finished fixture). The scheduler also runs this hourly.
  fastify.post('/api/admin/predictions/settle', guard, async (_request, reply) => {
    const result = await (fastify as any).runSettlement();
    return reply.status(200).send({ status: 'success', data: result });
  });

  // ─── Forum ────────────────────────────────────────────────
  const threadsQuery = { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 }, search: { type: 'string', default: '' } } };
  fastify.get('/api/admin/forum/threads', { ...guard, schema: { querystring: threadsQuery } }, ctrl.getThreads);
  fastify.get('/api/admin/forum/threads/:id', { ...guard, schema: { params: idParam } }, ctrl.getThreadDetail);
  fastify.delete('/api/admin/forum/threads/:id', { ...guard, schema: { params: idParam } }, ctrl.deleteThread);
  fastify.put('/api/admin/forum/threads/:id/pin', { ...guard, schema: { params: idParam } }, ctrl.togglePinThread);
  fastify.delete('/api/admin/forum/comments/:id', { ...guard, schema: { params: idParam } }, ctrl.deleteComment);

  // ─── Feature Flags ────────────────────────────────────────
  const flagKeyParam = { type: 'object', required: ['key'], properties: { key: { type: 'string', minLength: 1 } } };
  const updateFlagSchema = {
    type: 'object',
    properties: {
      required_plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
      is_enabled:    { type: 'boolean' },
    },
  };
  fastify.get('/api/admin/feature-flags', guard, ctrl.getFeatureFlags);
  fastify.patch('/api/admin/feature-flags/:key', {
    ...sensitiveGuard,
    schema: { params: flagKeyParam, body: updateFlagSchema },
  }, async (request: any, reply) => {
    const updated = await svc.updateFeatureFlag(request.user.id, request.params.key, request.body);
    // Bust the public cache so clients see the change
    try { await (fastify as any).redis.del('feature_flags:all'); } catch {}
    return reply.status(200).send({ status: 'success', data: updated });
  });

  // ─── Public Feature Flags (no auth, Redis-cached 5 min) ──
  fastify.get('/api/feature-flags', async (_request, reply) => {
    const CACHE_KEY = 'feature_flags:all';
    try {
      const cached = await (fastify as any).redis.get(CACHE_KEY);
      if (cached) return reply.send({ status: 'success', data: JSON.parse(cached) });
    } catch {}
    const flags = await repo.findAllFeatureFlags();
    try { await (fastify as any).redis.setex(CACHE_KEY, 300, JSON.stringify(flags)); } catch {}
    return reply.send({ status: 'success', data: flags });
  });

  // ─── Audit Log ────────────────────────────────────────────
  fastify.get('/api/admin/audit-logs', {
    ...guard,
    schema: { querystring: { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 50, maximum: 100 } } } },
  }, ctrl.getAuditLogs);

  // ─── Daily Stats (chart) ──────────────────────────────────
  fastify.get('/api/admin/stats/daily', guard, ctrl.getDailyStats);

  // ─── Creator Leaderboard ──────────────────────────────────
  fastify.get('/api/admin/creators', guard, ctrl.getCreatorLeaderboard);
  fastify.get('/api/admin/creator-applications', {
    ...guard,
    schema: { querystring: { type: 'object', properties: {
      status: { type: 'string', enum: ['pending','approved','rejected','withdrawn'], default: 'pending' },
    }, additionalProperties: false } },
  }, ctrl.getCreatorApplications);
  fastify.post('/api/admin/creator-applications/:id/review', {
    ...sensitiveGuard,
    schema: { params: idParam, body: { type: 'object', required: ['decision'], properties: {
      decision: { type: 'string', enum: ['approve','reject'] },
      notes: { type: 'string', maxLength: 2000 },
    }, additionalProperties: false } },
  }, ctrl.reviewCreatorApplication);

  // ─── Filtered Audit Logs ──────────────────────────────────
  const filteredAuditQuery = {
    type: 'object',
    properties: {
      page:    { type: 'integer', default: 1 },
      limit:   { type: 'integer', default: 50, maximum: 100 },
      action:  { type: 'string' },
      adminId: { type: 'integer' },
      dateFrom:{ type: 'string' },
      dateTo:  { type: 'string' },
    },
  };
  fastify.get('/api/admin/audit-logs/filtered', {
    ...guard,
    schema: { querystring: filteredAuditQuery },
  }, ctrl.getFilteredAuditLogs);

  // ─── Bulk User Actions ────────────────────────────────────
  fastify.post('/api/admin/users/bulk', {
    ...sensitiveGuard,
    schema: { body: bulkUserSchema },
  }, ctrl.bulkUserAction);

  // ─── Subscription Funnel ──────────────────────────────────
  fastify.get('/api/admin/subscriptions/funnel', guard, ctrl.getSubscriptionFunnel);

  // ─── Update User Status ───────────────────────────────────
  const userStatusSchema = {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
      reason: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  };
  fastify.patch('/api/admin/users/:id/status', {
    ...sensitiveGuard,
    schema: { params: idParam, body: userStatusSchema },
  }, ctrl.updateUserStatus);

  // ─── Enums ────────────────────────────────────────────────
  fastify.get('/api/admin/enums', guard, async (_request, reply) => {
    return reply.send({
      status: 'success',
      data: {
        bookmakers:  ['Bet9ja', '1xBet', 'SportyBet', 'Betway', 'BetKing', 'NairaBet', 'MerryBet', 'Other'],
        categories:  ['Football', 'Basketball', 'Tennis', 'Multi', 'Other'],
        stakeTypes:  ['Single', 'Accumulator', 'System', 'Lucky'],
      },
    });
  });
}

export default fp(adminRoutes, {
  name: 'admin-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
