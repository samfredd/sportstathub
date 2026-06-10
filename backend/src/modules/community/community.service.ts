import {
  mapComment,
  mapPrediction,
  mapThread,
  mapUserToCreator,
  nestComments,
} from './community.mapper.js';
import { hashPassword, comparePasswords } from '../auth/auth.helpers.js';
import { maskPremiumPrediction, requireContentAccess } from '../../helpers/access-control.helpers.js';

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function forbidden(message) {
  return Object.assign(new Error(message), { statusCode: 403 });
}

function mapPlatformStats(row: any = {}) {
  return {
    tipsToday: Number(row.tips_today ?? 0),
    winRate: Number(row.win_rate ?? 0),
    codeCopies: Number(row.code_copies ?? 0),
    creators: Number(row.creators ?? 0),
    liveMatches: Number(row.live_matches ?? 0),
    forumPosts: Number(row.forum_posts ?? 0),
  };
}

export function createCommunityService(repo, footballService?) {
  async function requiredPlanForFeature(key: string, fallback = 'pro') {
    if (!repo.findFeatureFlag) return null;
    const flag = await repo.findFeatureFlag(key).catch(() => null);
    if (!flag || !flag.is_enabled || flag.required_plan === 'free') return null;
    return flag.required_plan ?? fallback;
  }

  async function listPredictions(filters, user = null) {
    let rows = await repo.listPredictions(filters);
    if (rows.length === 0 && filters?.date) {
      rows = await repo.listPredictions({ ...filters, date: undefined });
    }
    const unlimitedRequiredPlan = await requiredPlanForFeature('picks_unlimited');
    return rows.map(mapPrediction).map((prediction, index) => {
      const isLockedByFeature = Boolean(unlimitedRequiredPlan && index >= 3);
      if (!isLockedByFeature) return maskPremiumPrediction(prediction, user);
      return maskPremiumPrediction({ ...prediction, isPremium: true }, user);
    });
  }

  async function getPrediction(id, user = null) {
    const row = await repo.findPredictionById(id);
    if (!row) throw notFound('Prediction not found');
    const prediction = mapPrediction(row);
    const detailRequiredPlan = await requiredPlanForFeature('predictions_full');
    requireContentAccess(user, {
      isPremium: prediction.isPremium || Boolean(detailRequiredPlan),
      requiredPlan: detailRequiredPlan ?? 'pro',
    });
    return prediction;
  }

  async function createPrediction(user, payload) {
    if (!['creator', 'admin'].includes(user.role)) {
      throw forbidden('Only creators can publish predictions');
    }
    const safePayload = user.role === 'admin' ? payload : {
      ...payload,
      status: 'open',
      isTrending: false,
      isPremium: false,
    };
    const row = await repo.createPrediction(user.id, safePayload);
    return mapPrediction(row);
  }

  async function listCreators() {
    const rows = await repo.listCreators();
    return rows.map(mapUserToCreator);
  }

  async function getCreator(id) {
    const row = await repo.findCreatorById(id);
    if (!row) throw notFound('Creator not found');
    return mapUserToCreator(row);
  }

  async function listThreads(filters) {
    const rows = await repo.listThreads(filters);
    return rows.map(mapThread);
  }

  async function getThread(id) {
    const row = await repo.findThreadById(id);
    if (!row) throw notFound('Thread not found');
    return mapThread(row);
  }

  async function createThread(user, payload) {
    const row = await repo.createThread(user.id, payload);
    return mapThread(row);
  }

  async function listComments(filters, user = null) {
    if (filters?.targetType === 'prediction') {
      const row = await repo.findPredictionById(filters.targetId);
      if (row) {
        const prediction = mapPrediction(row);
        const detailRequiredPlan = await requiredPlanForFeature('predictions_full');
        requireContentAccess(user, {
          isPremium: prediction.isPremium || Boolean(detailRequiredPlan),
          requiredPlan: detailRequiredPlan ?? 'pro',
        });
      }
    }
    const rows = await repo.listComments(filters);
    return nestComments(rows);
  }

  async function createComment(user, payload) {
    if (payload?.targetType === 'prediction') {
      const row = await repo.findPredictionById(payload.targetId);
      if (row) {
        const prediction = mapPrediction(row);
        const detailRequiredPlan = await requiredPlanForFeature('predictions_full');
        requireContentAccess(user, {
          isPremium: prediction.isPremium || Boolean(detailRequiredPlan),
          requiredPlan: detailRequiredPlan ?? 'pro',
        });
      }
    }
    const author = mapUserToCreator(user);
    const row = await repo.createComment(user.id, payload, author);
    return mapComment(row);
  }

  async function track(payload) {
    return repo.createTrackingEvent(payload);
  }

  async function getPlatformStats() {
    const [row, liveMatches] = await Promise.all([
      repo.getPlatformStats().catch(() => ({})),
      footballService
        ? footballService.getLiveMatches().then((d: any) => Array.isArray(d) ? d.length : 0).catch(() => 0)
        : Promise.resolve(0),
    ]);
    const base = mapPlatformStats(row);
    return { ...base, liveMatches };
  }

  async function getLeaderboard() {
    const rows = await repo.getLeaderboard();
    return rows.map(mapUserToCreator);
  }

  async function getCreatorDashboard(user) {
    if (!['creator', 'admin'].includes(user.role)) {
      throw forbidden('Only creators can access creator dashboard');
    }
    const dashboard = await repo.getCreatorDashboard(user.id);
    return {
      ...dashboard,
      creator: dashboard.creator ? mapUserToCreator(dashboard.creator) : mapUserToCreator(user),
      predictions: Array.isArray(dashboard.predictions)
        ? dashboard.predictions.map(mapPrediction)
        : [],
    };
  }

  async function getUserDashboard(user) {
    const dashboard = await repo.getUserDashboard(user.id);
    return {
      subscription: dashboard.subscription ?? { plan: 'free', status: 'active', expires_at: null },
      savedCodes: dashboard.savedCodes ?? [],
    };
  }

  async function likePrediction(id) {
    const row = await repo.incrementPredictionLike(id);
    if (!row) throw notFound('Prediction not found');
    return mapPrediction(row);
  }

  async function likeThread(id) {
    const row = await repo.incrementThreadLike(id);
    if (!row) throw notFound('Thread not found');
    return mapThread(row);
  }

  async function likeComment(id) {
    const row = await repo.incrementCommentLike(id);
    if (!row) throw notFound('Comment not found');
    return mapComment(row);
  }

  async function toggleFollow(followerId: number, creatorId: number) {
    const creator = await repo.findCreatorById(creatorId);
    if (!creator) throw notFound('Creator not found');
    return repo.toggleFollow(followerId, creatorId);
  }

  async function isFollowing(followerId: number, creatorId: number) {
    return repo.isFollowing(followerId, creatorId);
  }

  async function getMe(userId: number) {
    const user = await repo.getMe(userId);
    if (!user) throw notFound('User not found');
    return user;
  }

  async function updateProfile(userId: number, payload: { display_name?: string; bio?: string; avatar_url?: string }) {
    const updated = await repo.updateProfile(userId, payload);
    if (!updated) throw notFound('User not found');
    return updated;
  }

  async function becomeCreator(userId: number) {
    const user = await repo.getMe(userId);
    if (!user) throw notFound('User not found');
    if (user.role === 'creator') throw Object.assign(new Error('Already a creator'), { statusCode: 409 });
    if (user.role === 'admin') throw Object.assign(new Error('Admin accounts cannot become creators'), { statusCode: 403 });
    return repo.setUserRole(userId, 'creator');
  }

  async function changePassword(userId: number, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }) {
    const stored = await repo.getUserPassword(userId);
    if (!stored) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const valid = await comparePasswords(currentPassword, stored);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
    const hashed = await hashPassword(newPassword);
    await repo.updateUserPassword(userId, hashed);
  }

  return {
    listPredictions,
    getPrediction,
    createPrediction,
    listCreators,
    getCreator,
    listThreads,
    getThread,
    createThread,
    listComments,
    createComment,
    track,
    getPlatformStats,
    getLeaderboard,
    getCreatorDashboard,
    getUserDashboard,
    getMe,
    updateProfile,
    becomeCreator,
    changePassword,
    likePrediction,
    likeThread,
    likeComment,
    toggleFollow,
    isFollowing,
  };
}
