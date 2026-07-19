import { hashPassword, comparePasswords } from '../auth/auth.helpers.js';

export function createAdminService(repo) {

  // ─── STATS ────────────────────────────────────────────────
  async function getDashboardStats() {
    return repo.getDashboardStats();
  }

  // ─── USERS ────────────────────────────────────────────────
  async function listUsers({ page = 1, limit = 20, search = '', status = '' } = {}) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      repo.findAllUsers({ limit, offset, search, status }),
      repo.countUsers(search, status),
    ]);
    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function getUserById(id) {
    const user = await repo.findUserById(id);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
  }

  async function updateUser(adminId, id, payload) {
      const allowed: any = {};
    if (payload.role !== undefined) {
      const VALID_ROLES = ['user', 'creator_pending', 'creator', 'creator_suspended', 'creator_rejected', 'moderator', 'admin'];
      if (!VALID_ROLES.includes(payload.role)) {
        throw Object.assign(new Error('Invalid role'), { statusCode: 400 });
      }
      allowed.role = payload.role;
    }
    if (payload.is_verified !== undefined) allowed.is_verified = Boolean(payload.is_verified);
    if (payload.status !== undefined) {
      const VALID_STATUSES = ['active', 'suspended', 'banned'];
      if (!VALID_STATUSES.includes(payload.status)) {
        throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
      }
      allowed.status = payload.status;
    }

    const updated = await repo.updateUser(id, allowed);
    if (!updated) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    await repo.createAuditLog({
      adminId,
      action: 'user.updated',
      targetType: 'user',
      targetId: id,
      metadata: allowed,
    });

    return updated;
  }

  async function deleteUser(adminId, id) {
    const deleted = await repo.deleteUser(id);
    if (!deleted) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    await repo.createAuditLog({
      adminId,
      action: 'user.deleted',
      targetType: 'user',
      targetId: id,
    });

    return deleted;
  }

  // ─── BOOKING CODES ────────────────────────────────────────
  async function listCodes({ page = 1, limit = 20, search = '', includeInactive = true } = {}) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      repo.findAllCodes({ limit, offset, search, includeInactive }),
      repo.countCodes(search, includeInactive),
    ]);
    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function createCode(adminId, payload) {
    const code = await repo.adminCreateCode(payload);
    await repo.createAuditLog({
      adminId,
      action: 'code.created',
      targetType: 'booking_code',
      targetId: code.id,
      metadata: { bookmaker: code.bookmaker },
    });
    return code;
  }

  async function updateCode(adminId, id, payload) {
    const updated = await repo.adminUpdateCode(id, payload);
    if (!updated) throw Object.assign(new Error('Code not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'code.updated',
      targetType: 'booking_code',
      targetId: id,
      metadata: payload,
    });
    return updated;
  }

  async function deleteCode(adminId, id) {
    const deleted = await repo.adminDeleteCode(id);
    if (!deleted) throw Object.assign(new Error('Code not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'code.deleted',
      targetType: 'booking_code',
      targetId: id,
    });
    return deleted;
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────────
  async function listSubscriptions({ page = 1, limit = 20, search = '' } = {}) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      repo.findAllSubscriptions({ limit, offset, search }),
      repo.countSubscriptions(search),
    ]);
    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function createSubscription(adminId, payload) {
    const VALID_PLANS   = ['free', 'pro', 'enterprise'];
    const VALID_STATUS  = ['active', 'grace', 'cancelled', 'expired', 'pending', 'failed'];
    if (!VALID_PLANS.includes(payload.plan)) {
      throw Object.assign(new Error('Invalid plan'), { statusCode: 400 });
    }
    if (payload.status && !VALID_STATUS.includes(payload.status)) {
      throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
    }
    const sub = await repo.createSubscription(payload);
    await repo.createAuditLog({
      adminId,
      action: 'subscription.created',
      targetType: 'subscription',
      targetId: sub.id,
      metadata: { userId: payload.userId, plan: payload.plan },
    });
    return sub;
  }

  async function updateSubscription(adminId, id, payload) {
    const updated = await repo.updateSubscription(id, payload);
    if (!updated) throw Object.assign(new Error('Subscription not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'subscription.updated',
      targetType: 'subscription',
      targetId: id,
      metadata: payload,
    });
    return updated;
  }

  async function deleteSubscription(adminId, id) {
    const deleted = await repo.deleteSubscription(id);
    if (!deleted) throw Object.assign(new Error('Subscription not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'subscription.deleted',
      targetType: 'subscription',
      targetId: id,
    });
    return deleted;
  }

  // ─── SUBSCRIPTION PLANS ───────────────────────────────────────
  async function listPlans() {
    return repo.findAllPlans();
  }

  async function getPlan(id) {
    const plan = await repo.findPlanById(id);
    if (!plan) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    return plan;
  }

  async function createPlan(adminId, payload) {
    const existing = await repo.findPlanBySlug(payload.slug);
    if (existing) throw Object.assign(new Error('A plan with this slug already exists'), { statusCode: 409 });
    const plan = await repo.createPlan(payload);
    await repo.createAuditLog({ adminId, action: 'plan.created', targetType: 'subscription_plan', targetId: plan.id, metadata: { slug: plan.slug } });
    return plan;
  }

  async function updatePlan(adminId, id, payload) {
    const updated = await repo.updatePlan(id, payload);
    if (!updated) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'plan.updated', targetType: 'subscription_plan', targetId: id, metadata: payload });
    return updated;
  }

  async function deletePlan(adminId, id) {
    const deleted = await repo.deletePlan(id);
    if (!deleted) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'plan.deleted', targetType: 'subscription_plan', targetId: id });
    return deleted;
  }

  // ─── PREDICTIONS ──────────────────────────────────────────
  async function listPredictions({ page = 1, limit = 20, search = '', status = '' } = {}) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      repo.findAllPredictions({ limit, offset, search, status }),
      repo.countPredictions(search, status),
    ]);
    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function setPredictionStatus(adminId, id, status) {
    const VALID = ['open', 'won', 'lost', 'void'];
    if (!VALID.includes(status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
    const updated = await repo.updatePredictionStatus(id, status);
    if (!updated) throw Object.assign(new Error('Prediction not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'prediction.updated', targetType: 'prediction', targetId: id, metadata: { status } });
    return updated;
  }

  async function updatePrediction(adminId, id, payload) {
    const allowed: any = {};
    if (payload.status !== undefined) {
      const VALID = ['open', 'won', 'lost', 'void'];
      if (!VALID.includes(payload.status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
      allowed.status = payload.status;
    }
    if (payload.isPremium !== undefined) allowed.isPremium = Boolean(payload.isPremium);
    if (!Object.keys(allowed).length) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });

    const updated = await repo.updatePrediction(id, allowed);
    if (!updated) throw Object.assign(new Error('Prediction not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'prediction.updated', targetType: 'prediction', targetId: id, metadata: allowed });
    return updated;
  }

  async function deletePrediction(adminId, id) {
    const deleted = await repo.adminDeletePrediction(id);
    if (!deleted) throw Object.assign(new Error('Prediction not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'prediction.deleted', targetType: 'prediction', targetId: id });
    return deleted;
  }

  async function createAdminPrediction(adminId, body) {
    const { sport, schemaVersion, league, matchData, prediction, bookingCode, isPremium, tags, isTrending, fixtureId } = body;
    const created = await repo.createAdminPrediction({
      userId: adminId,
      sport,
      league,
      matchData,
      prediction,
      bookingCode,
      schemaVersion,
      isPremium: isPremium ?? false,
      tags: tags ?? [],
      isTrending: isTrending ?? false,
      fixtureId: fixtureId ?? null,
    });
    await repo.createAuditLog({
      adminId,
      action: 'prediction.created',
      targetType: 'prediction',
      targetId: created.id,
      metadata: { sport, isPremium },
    });
    return created;
  }

  // ─── FORUM ────────────────────────────────────────────────
  async function listThreads({ page = 1, limit = 20, search = '' } = {}) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      repo.findAllThreads({ limit, offset, search }),
      repo.countThreads(search),
    ]);
    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function deleteThread(adminId, id) {
    const deleted = await repo.adminDeleteThread(id);
    if (!deleted) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'forum.thread.deleted', targetType: 'forum_thread', targetId: id });
    return deleted;
  }

  async function getThreadDetail(id) {
    const thread = await repo.findThreadForAdmin(id);
    if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
    const comments = await repo.findThreadComments(id);
    return { ...thread, comments };
  }

  async function deleteComment(adminId, id) {
    const deleted = await repo.adminDeleteComment(id);
    if (!deleted) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
    await repo.createAuditLog({ adminId, action: 'forum.comment.deleted', targetType: 'comment', targetId: id });
    return deleted;
  }

  async function togglePinThread(adminId, id) {
    const updated = await repo.adminTogglePinThread(id);
    if (!updated) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: updated.is_pinned ? 'forum.thread.pinned' : 'forum.thread.unpinned',
      targetType: 'forum_thread',
      targetId: id,
    });
    return updated;
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────
  async function getAuditLogs({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    return repo.getAuditLogs({ limit, offset });
  }

  async function getDailyStats() {
    return repo.getDailyStats();
  }

  // ─── ADMIN PROFILE ────────────────────────────────────────
  async function changeAdminPassword(adminId, { currentPassword, newPassword }) {
    const stored = await repo.getAdminPassword(adminId);
    if (!stored) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    const valid = await comparePasswords(currentPassword, stored);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
    const hashed = await hashPassword(newPassword);
    await repo.updateAdminPassword(adminId, hashed);
  }

  async function getAdminProfile(adminId) {
    const admin = await repo.findAdminById(adminId);
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    return admin;
  }

  async function updateAdminProfile(adminId, { username, email }: { username?: string; email?: string }) {
    if (!username && !email) throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
    let updated;
    try {
      updated = await repo.updateAdminProfile(adminId, { username, email });
    } catch (err: any) {
      if (err.code === '23505') {
        const msg = err.constraint?.includes('email') ? 'Email is already in use' : 'Username is already taken';
        throw Object.assign(new Error(msg), { statusCode: 409 });
      }
      throw err;
    }
    if (!updated) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'admin.profile.updated',
      targetType: 'user',
      targetId: adminId,
      metadata: { username, email },
    });
    return updated;
  }

  // ─── FEATURE FLAGS ───────────────────────────────────────────
  async function listFeatureFlags() {
    return repo.findAllFeatureFlags();
  }

  async function updateFeatureFlag(adminId, key: string, payload: { required_plan?: string; is_enabled?: boolean }) {
    const VALID_PLANS = ['free', 'pro', 'enterprise'];
    if (payload.required_plan !== undefined && !VALID_PLANS.includes(payload.required_plan)) {
      throw Object.assign(new Error('Invalid plan — must be free, pro, or enterprise'), { statusCode: 400 });
    }
    const updated = await repo.updateFeatureFlag(key, payload);
    if (!updated) throw Object.assign(new Error('Feature flag not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: 'feature_flag.updated',
      targetType: 'feature_flag',
      targetId: updated.id,
      metadata: { key, ...payload },
    });
    return updated;
  }

  async function getMyActivity(adminId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    return repo.getAuditLogsByAdmin(adminId, { limit, offset });
  }

  // ─── CREATOR LEADERBOARD ──────────────────────────────────
  async function getCreatorLeaderboard() {
    return repo.getCreatorLeaderboard();
  }

  // ─── FILTERED AUDIT LOGS ──────────────────────────────────
  async function getFilteredAuditLogs({ page = 1, limit = 50, action = undefined, adminId = undefined, dateFrom = undefined, dateTo = undefined }: { page?: number; limit?: number; action?: string; adminId?: number; dateFrom?: string; dateTo?: string } = {}) {
    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      repo.getFilteredAuditLogs({ limit, offset, action, adminId, dateFrom, dateTo }),
      repo.countFilteredAuditLogs({ action, adminId, dateFrom, dateTo }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── BULK USER ACTION ─────────────────────────────────────
  async function bulkUserAction(adminId, { ids, action, payload = {} }: { ids: number[]; action: string; payload?: any }) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      throw Object.assign(new Error('ids must be an array of 1–100 integers'), { statusCode: 400 });
    }
    const VALID_ACTIONS = ['delete', 'suspend', 'unsuspend', 'change_role'];
    if (!VALID_ACTIONS.includes(action)) {
      throw Object.assign(new Error(`action must be one of: ${VALID_ACTIONS.join(', ')}`), { statusCode: 400 });
    }

    let affected = 0;
    if (action === 'delete') {
      const rows = await repo.bulkDeleteUsers(ids);
      affected = rows.length;
    } else if (action === 'suspend') {
      const rows = await repo.bulkUpdateUsers(ids, { status: 'suspended' });
      affected = rows.length;
    } else if (action === 'unsuspend') {
      const rows = await repo.bulkUpdateUsers(ids, { status: 'active' });
      affected = rows.length;
    } else if (action === 'change_role') {
      if (!payload?.role) throw Object.assign(new Error('payload.role is required for change_role'), { statusCode: 400 });
      const rows = await repo.bulkUpdateUsers(ids, { role: payload.role });
      affected = rows.length;
    }

    await repo.createAuditLog({
      adminId,
      action: 'users.bulk_action',
      targetType: 'user',
      targetId: null,
      metadata: { action, count: ids.length },
    });

    return { affected };
  }

  // ─── SUBSCRIPTION FUNNEL ──────────────────────────────────
  async function getSubscriptionFunnel() {
    return repo.getSubscriptionFunnel();
  }

  async function listCreatorApplications(status = 'pending') {
    return repo.listCreatorApplications(status);
  }

  async function reviewCreatorApplication(adminId: number, id: number, payload: any) {
    if (!['approve', 'reject'].includes(payload.decision)) {
      throw Object.assign(new Error('Invalid review decision'), { statusCode: 400 });
    }
    const result = await repo.reviewCreatorApplication(adminId, id, payload.decision, payload.notes);
    if (!result) throw Object.assign(new Error('Pending creator application not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId, action: `creator.application_${payload.decision}d`, targetType: 'creator_application',
      targetId: id, metadata: { userId: result.user_id, notes: payload.notes ?? null },
    });
    return result;
  }

  // ─── SUSPEND / BAN USER ───────────────────────────────────
  async function suspendUser(adminId, userId, status: 'active' | 'suspended' | 'banned') {
    const updated = await repo.updateUser(userId, { status });
    if (!updated) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    await repo.createAuditLog({
      adminId,
      action: `user.${status}`,
      targetType: 'user',
      targetId: userId,
      metadata: { status },
    });
    return updated;
  }

  return {
    getDashboardStats, getDailyStats,
    listUsers, getUserById, updateUser, deleteUser,
    listCodes, createCode, updateCode, deleteCode,
    listSubscriptions, createSubscription, updateSubscription, deleteSubscription,
    listPlans, getPlan, createPlan, updatePlan, deletePlan,
    listPredictions, setPredictionStatus, updatePrediction, deletePrediction, createAdminPrediction,
    listThreads, deleteThread, getThreadDetail, deleteComment, togglePinThread,
    getAuditLogs, changeAdminPassword,
    getAdminProfile, updateAdminProfile, getMyActivity,
    listFeatureFlags, updateFeatureFlag,
    getCreatorLeaderboard,
    getFilteredAuditLogs,
    bulkUserAction,
    getSubscriptionFunnel, listCreatorApplications, reviewCreatorApplication,
    suspendUser,
  };
}
