export function createAdminController(service) {

  function ok(reply, data) {
    return reply.status(200).send({ status: 'success', data });
  }

  // ─── STATS ────────────────────────────────────────────────
  async function getStats(request, reply) {
    const stats = await service.getDashboardStats();
    return ok(reply, stats);
  }

  // ─── USERS ────────────────────────────────────────────────
  async function getUsers(request, reply) {
    const { page, limit, search, status } = request.query;
    const result = await service.listUsers({ page, limit, search, status });
    return ok(reply, result);
  }

  async function getUserById(request, reply) {
    const user = await service.getUserById(parseInt(request.params.id));
    return ok(reply, user);
  }

  async function updateUser(request, reply) {
    const updated = await service.updateUser(
      request.user.id,
      parseInt(request.params.id),
      request.body,
      request.id
    );
    return ok(reply, updated);
  }

  async function deleteUser(request, reply) {
    await service.deleteUser(request.user.id, parseInt(request.params.id), request.id);
    return reply.status(204).send();
  }

  // ─── BOOKING CODES ────────────────────────────────────────
  async function getCodes(request, reply) {
    const { page, limit, search, includeInactive } = request.query;
    const result = await service.listCodes({ page, limit, search, includeInactive });
    return ok(reply, result);
  }

  async function createCode(request, reply) {
    const code = await service.createCode(request.user.id, request.body);
    return reply.status(201).send({ status: 'success', data: code });
  }

  async function updateCode(request, reply) {
    const updated = await service.updateCode(
      request.user.id,
      parseInt(request.params.id),
      request.body
    );
    return ok(reply, updated);
  }

  async function deleteCode(request, reply) {
    await service.deleteCode(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────────
  async function getSubscriptions(request, reply) {
    const { page, limit, search } = request.query;
    const result = await service.listSubscriptions({ page, limit, search });
    return ok(reply, result);
  }

  async function createSubscription(request, reply) {
    const sub = await service.createSubscription(request.user.id, request.body);
    return reply.status(201).send({ status: 'success', data: sub });
  }

  async function updateSubscription(request, reply) {
    const updated = await service.updateSubscription(
      request.user.id,
      parseInt(request.params.id),
      request.body
    );
    return ok(reply, updated);
  }

  async function deleteSubscription(request, reply) {
    await service.deleteSubscription(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  // ─── PREDICTIONS ──────────────────────────────────────────
  async function getPredictions(request, reply) {
    const { page, limit, search, status } = request.query;
    return ok(reply, await service.listPredictions({ page, limit, search, status }));
  }

  async function updatePredictionStatus(request, reply) {
    const updated = await service.updatePrediction(request.user.id, parseInt(request.params.id), request.body);
    return ok(reply, updated);
  }

  async function deletePrediction(request, reply) {
    await service.deletePrediction(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  async function createAdminPrediction(request, reply) {
    const created = await service.createAdminPrediction(request.user.id, request.body);
    return reply.code(201).send({ status: 'success', data: created });
  }

  // ─── SUBSCRIPTION PLANS ───────────────────────────────────────
  async function getPlans(_request, reply) {
    return ok(reply, await service.listPlans());
  }

  async function getPlan(request, reply) {
    return ok(reply, await service.getPlan(parseInt(request.params.id)));
  }

  async function createPlan(request, reply) {
    const plan = await service.createPlan(request.user.id, request.body);
    return reply.status(201).send({ status: 'success', data: plan });
  }

  async function updatePlan(request, reply) {
    const updated = await service.updatePlan(request.user.id, parseInt(request.params.id), request.body);
    return ok(reply, updated);
  }

  async function deletePlan(request, reply) {
    await service.deletePlan(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  // ─── FORUM ────────────────────────────────────────────────
  async function getThreads(request, reply) {
    const { page, limit, search } = request.query;
    return ok(reply, await service.listThreads({ page, limit, search }));
  }

  async function deleteThread(request, reply) {
    await service.deleteThread(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  async function getThreadDetail(request, reply) {
    return ok(reply, await service.getThreadDetail(parseInt(request.params.id)));
  }

  async function deleteComment(request, reply) {
    await service.deleteComment(request.user.id, parseInt(request.params.id));
    return reply.status(204).send();
  }

  async function togglePinThread(request, reply) {
    return ok(reply, await service.togglePinThread(request.user.id, parseInt(request.params.id)));
  }

  // ─── ADMIN PROFILE ────────────────────────────────────────
  async function changePassword(request, reply) {
    await service.changeAdminPassword(request.user.id, request.body);
    return ok(reply, { message: 'Password updated successfully' });
  }

  async function getProfile(request, reply) {
    return ok(reply, await service.getAdminProfile(request.user.id));
  }

  async function updateProfile(request, reply) {
    return ok(reply, await service.updateAdminProfile(request.user.id, request.body));
  }

  async function getMyActivity(request, reply) {
    const { page, limit } = request.query as any;
    return ok(reply, await service.getMyActivity(request.user.id, { page, limit }));
  }

  // ─── FEATURE FLAGS ────────────────────────────────────────
  async function getFeatureFlags(_request, reply) {
    return ok(reply, await service.listFeatureFlags());
  }

  async function updateFeatureFlag(request, reply) {
    const updated = await service.updateFeatureFlag(
      request.user.id,
      request.params.key,
      request.body
    );
    return ok(reply, updated);
  }

  // ─── AUDIT LOG ────────────────────────────────────────────
  async function getAuditLogs(request, reply) {
    const { page, limit } = request.query;
    const logs = await service.getAuditLogs({ page, limit });
    return ok(reply, logs);
  }

  async function getDailyStats(_request, reply) {
    return ok(reply, await service.getDailyStats());
  }

  // ─── CREATOR LEADERBOARD ──────────────────────────────────
  async function getCreatorLeaderboard(_request, reply) {
    return ok(reply, await service.getCreatorLeaderboard());
  }

  // ─── FILTERED AUDIT LOGS ──────────────────────────────────
  async function getFilteredAuditLogs(request, reply) {
    const { page, limit, action, adminId, dateFrom, dateTo } = request.query as any;
    return ok(reply, await service.getFilteredAuditLogs({ page, limit, action, adminId, dateFrom, dateTo }));
  }

  // ─── BULK USER ACTION ─────────────────────────────────────
  async function bulkUserAction(request, reply) {
    const { ids, action, payload, reason } = request.body as any;
    return ok(reply, await service.bulkUserAction(request.user.id, { ids, action, payload, reason }, request.id));
  }

  // ─── SUBSCRIPTION FUNNEL ──────────────────────────────────
  async function getSubscriptionFunnel(_request, reply) {
    return ok(reply, await service.getSubscriptionFunnel());
  }

  async function getCreatorApplications(request, reply) {
    return ok(reply, await service.listCreatorApplications(request.query.status || 'pending'));
  }

  async function reviewCreatorApplication(request, reply) {
    return ok(reply, await service.reviewCreatorApplication(
      request.user.id, parseInt(request.params.id), request.body));
  }

  // ─── UPDATE USER STATUS ───────────────────────────────────
  async function updateUserStatus(request, reply) {
    const { status, reason } = request.body as any;
    return ok(reply, await service.suspendUser(request.user.id, parseInt(request.params.id), status, reason, request.id));
  }

  return {
    getStats, getDailyStats,
    getUsers, getUserById, updateUser, deleteUser,
    getCodes, createCode, updateCode, deleteCode,
    getSubscriptions, createSubscription, updateSubscription, deleteSubscription,
    getPlans, getPlan, createPlan, updatePlan, deletePlan,
    getPredictions, updatePredictionStatus, deletePrediction, createAdminPrediction,
    getThreads, deleteThread, getThreadDetail, deleteComment, togglePinThread,
    getAuditLogs, changePassword,
    getProfile, updateProfile, getMyActivity,
    getFeatureFlags, updateFeatureFlag,
    getCreatorLeaderboard,
    getFilteredAuditLogs,
    bulkUserAction,
    getSubscriptionFunnel,
    getCreatorApplications, reviewCreatorApplication,
    updateUserStatus,
  };
}
