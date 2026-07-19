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

function validateAvatarUrl(value?: string) {
  if(!value)return value;
  try{
    const url=new URL(value);
    const allowed=(process.env.AVATAR_ALLOWED_HOSTS??'lh3.googleusercontent.com').split(',').map(host=>host.trim().toLowerCase()).filter(Boolean);
    const hostname=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.hash||!allowed.some(host=>hostname===host||hostname.endsWith(`.${host}`)))throw new Error();
    return url.toString();
  }catch{throw Object.assign(new Error('Avatar URL must use HTTPS and an approved image host'),{statusCode:400});}
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

export function createCommunityService(repo, footballService?, newsService?) {
  function decodeCursor(cursor?: string, requiredFields: string[] = []) {
    if(!cursor)return null;
    try { const parsed=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
      if(!parsed || !Number.isInteger(Number(parsed.id)) || requiredFields.some(field=>parsed[field]===undefined))throw new Error(); return parsed;
    } catch { throw Object.assign(new Error('Invalid pagination cursor'),{statusCode:400}); }
  }
  const encodeCursor=(value: any)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const mentionUsernames=(textValue: unknown)=>[...new Set([...String(textValue??'').matchAll(/(?:^|\s)@([a-zA-Z0-9_]{3,30})\b/g)].map(match=>match[1].toLowerCase()))].slice(0,20);
  async function requiredPlanForFeature(key: string, fallback = 'pro') {
    if (!repo.findFeatureFlag) return null;
    const flag = await repo.findFeatureFlag(key).catch(() => null);
    if (!flag || !flag.is_enabled || flag.required_plan === 'free') return null;
    return flag.required_plan ?? fallback;
  }

  async function listPredictions(filters, user = null) {
    const cursorData=filters?.pagination==='cursor'?decodeCursor(filters.cursor,filters.cursor?['createdEpoch']:[]):null;
    const rows = await repo.listPredictions(cursorData ? {...filters,cursorData} : filters);
    const unlimitedRequiredPlan = await requiredPlanForFeature('picks_unlimited');
    const pageRows=filters?.pagination==='cursor'?rows.slice(0,filters.limit):rows;
    const items=pageRows.map(mapPrediction).map((prediction, index) => {
      const isLockedByFeature = Boolean(unlimitedRequiredPlan && index >= 3);
      if (!isLockedByFeature) return maskPremiumPrediction(prediction, user);
      return maskPremiumPrediction({ ...prediction, isPremium: true }, user);
    });
    if(filters?.pagination!=='cursor')return items;
    const last=pageRows.at(-1); return {items,nextCursor:rows.length>filters.limit&&last
      ?encodeCursor({createdEpoch:last.cursor_epoch,id:last.id}):null};
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

  async function listCreators(filters: any = {}) {
    const cursorData=filters.pagination==='cursor'?decodeCursor(filters.cursor,filters.cursor?['totalPredictions','createdEpoch']:[]):null;
    const rows = await repo.listCreators({...filters,...(cursorData?{cursorData}:{})});
    const pageRows=filters.pagination==='cursor'?rows.slice(0,filters.limit):rows;
    const items=pageRows.map(mapUserToCreator);
    if(filters.pagination!=='cursor')return items;
    const last=pageRows.at(-1);return {items,nextCursor:rows.length>filters.limit&&last
      ?encodeCursor({totalPredictions:last.total_predictions,createdEpoch:last.cursor_epoch,id:last.user_id}):null};
  }

  async function getCreator(id) {
    const row = await repo.findCreatorById(id);
    if (!row) throw notFound('Creator not found');
    return mapUserToCreator(row);
  }

  async function listThreads(filters, user = null) {
    if(filters?.pagination==='cursor' && filters.sort!=='latest') throw Object.assign(new Error('Cursor pagination supports latest thread sort'),{statusCode:400});
    const threadCursor=filters?.pagination==='cursor'?decodeCursor(filters.cursor,filters.cursor?['pinned','lastReplyEpoch']:[]):null;
    const rows = await repo.listThreads({ ...filters, viewerId: user?.id,...(threadCursor?{cursorData:threadCursor}:{}) });
    const pageRows=filters?.pagination==='cursor'?rows.slice(0,filters.limit):rows;
    const items=pageRows.map(mapThread); if(filters?.pagination!=='cursor')return items;
    const last=pageRows.at(-1);return {items,nextCursor:rows.length>filters.limit&&last
      ?encodeCursor({pinned:last.is_pinned,lastReplyEpoch:last.cursor_reply_epoch,id:last.id}):null};
  }

  async function getThread(id) {
    const row = await repo.findThreadById(id);
    if (!row) throw notFound('Thread not found');
    return mapThread(row);
  }

  async function createThread(user, payload) {
    const row = await repo.createThread(user.id, {...payload,mentionUsernames:mentionUsernames(`${payload.title} ${payload.content}`)});
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
    const commentCursor=filters?.pagination==='cursor'?decodeCursor(filters.cursor,filters.cursor?['createdEpoch']:[]):null;
    const rows = await repo.listComments({ ...filters, viewerId: user?.id,...(commentCursor?{cursorData:commentCursor}:{}) });
    const pageRows=filters?.pagination==='cursor'?rows.slice(0,filters.limit):rows;
    const items=nestComments(pageRows);if(filters?.pagination!=='cursor')return items;
    const last=pageRows.at(-1);return {items,nextCursor:rows.length>filters.limit&&last?encodeCursor({createdEpoch:last.cursor_epoch,id:last.id}):null};
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
    const row = await repo.createComment(user.id, {...payload,mentionUsernames:mentionUsernames(payload.content)}, author);
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

  async function globalSearch(query: string) {
    const normalized=query.trim();if(normalized.length<2)return {teams:[],creators:[],predictions:[],threads:[],news:[]};
    const [community,teamResponse,newsItems]=await Promise.all([
      repo.searchCommunity(normalized,6),
      footballService?.searchTeams(normalized,'football').catch(()=>[])??Promise.resolve([]),
      newsService?.getAllNews().catch(()=>[])??Promise.resolve([]),
    ]);
    const teams=(Array.isArray(teamResponse)?teamResponse:teamResponse?.response??[]).slice(0,8).map((item:any)=>item.team??item);
    const news=(Array.isArray(newsItems)?newsItems:[]).filter((item:any)=>`${item.title} ${item.description}`.toLowerCase().includes(normalized.toLowerCase())).slice(0,6);
    return {...community,teams,news};
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

  async function getCreatorPerformance(id: number) {
    const creator = await repo.findCreatorById(id);
    if (!creator) throw notFound('Creator not found');
    return repo.getCreatorPerformance(id);
  }

  async function getUserDashboard(user) {
    const dashboard = await repo.getUserDashboard(user.id);
    return {
      subscription: dashboard.subscription ?? { plan: 'free', status: 'active', expires_at: null },
      savedCodes: dashboard.savedCodes ?? [],
    };
  }

  async function likePrediction(id, userId: number) {
    const result = await repo.togglePredictionLike(userId, id);
    if (!result) throw notFound('Prediction not found');
    return { ...mapPrediction(result.row), liked: result.liked };
  }

  async function likeThread(id, userId: number) {
    const result = await repo.toggleThreadLike(userId, id);
    if (!result) throw notFound('Thread not found');
    return { ...mapThread(result.row), liked: result.liked };
  }

  async function likeComment(id, userId: number) {
    const result = await repo.toggleCommentLike(userId, id);
    if (!result) throw notFound('Comment not found');
    return { ...mapComment(result.row), liked: result.liked };
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
    const updated = await repo.updateProfile(userId, {...payload,...(payload.avatar_url!==undefined?{avatar_url:validateAvatarUrl(payload.avatar_url)}:{})});
    if (!updated) throw notFound('User not found');
    return updated;
  }

  async function becomeCreator(userId: number, payload: any) {
    const user = await repo.getMe(userId);
    if (!user) throw notFound('User not found');
    if (user.role === 'creator') throw Object.assign(new Error('Already a creator'), { statusCode: 409 });
    if (user.role === 'creator_pending') throw Object.assign(new Error('Creator application is already pending'), { statusCode: 409 });
    if (user.role === 'admin') throw Object.assign(new Error('Admin accounts cannot become creators'), { statusCode: 403 });
    if (!payload?.termsAccepted || payload?.termsVersion !== '2026-01') {
      throw Object.assign(new Error('Creator terms must be accepted'), { statusCode: 400 });
    }
    return repo.createCreatorApplication(userId, payload);
  }

  async function changePassword(userId: number, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }) {
    const stored = await repo.getUserPassword(userId);
    if (!stored) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const valid = await comparePasswords(currentPassword, stored);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
    const hashed = await hashPassword(newPassword);
    await repo.updateUserPassword(userId, hashed);
  }

  async function updateContent(user: any, contentType: 'thread'|'comment', id: number, payload: any) {
    const row = await repo.updateContent(user, contentType, id, payload);
    if (!row) throw notFound('Content not found');
    return contentType === 'thread' ? mapThread(row) : mapComment(row);
  }

  async function deleteContent(user: any, contentType: 'thread'|'comment', id: number) {
    const row = await repo.softDeleteContent(user, contentType, id);
    if (!row) throw notFound('Content not found or not owned by you');
    return { deleted: true };
  }

  async function reportContent(user: any, input: any) {
    const report = await repo.reportContent(user.id, input);
    if (!report) throw notFound('Content not found');
    return report;
  }

  async function setRelationship(user: any, targetUserId: number, input: any) {
    if (Number(user.id) === targetUserId) throw Object.assign(new Error('You cannot block or mute yourself'), { statusCode: 400 });
    return repo.setRelationship(user.id,targetUserId,input.type,input.enabled);
  }

  async function moderateContent(user: any, input: any) {
    const action = await repo.moderateContent(user.id,input);
    if (!action) throw notFound('Report not found');
    return action;
  }

  async function appealModeration(user: any, input: any) {
    const appeal = await repo.appealModeration(user.id,input);
    if (!appeal) throw Object.assign(new Error('Action not appealable or already appealed'), { statusCode: 409 });
    return appeal;
  }
  async function resolveAppeal(user: any,input: any){const appeal=await repo.resolveAppeal(user.id,input);if(!appeal)throw notFound('Open appeal not found');return appeal;}

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
    globalSearch,
    getLeaderboard,
    getCreatorDashboard,
    getCreatorPerformance,
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
    updateContent,
    deleteContent,
    reportContent,
    setRelationship,
    listModerationQueue: repo.listModerationQueue,
    moderateContent,
    appealModeration,
    resolveAppeal,
    listNotifications: (user: any, limit: number) => repo.listNotifications(user.id,limit),
    markNotificationsRead: (user: any, ids?: number[]) => repo.markNotificationsRead(user.id,ids),
    getNotificationPreferences: (user: any) => repo.getNotificationPreferences(user.id),
    updateNotificationPreferences: (user: any, input: any) => repo.updateNotificationPreferences(user.id,input),
    saveMatch: (user: any,input: any) => repo.saveMatch(user.id,input),
    listSavedMatches: (user: any) => repo.listSavedMatches(user.id),
    deleteSavedMatch: (user: any,fixtureId: string,sport: string) => repo.deleteSavedMatch(user.id,fixtureId,sport),
  };
}
