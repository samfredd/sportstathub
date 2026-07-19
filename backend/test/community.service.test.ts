import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommunityService } from '../src/modules/community/community.service.js';

function makeRepo() {
  const calls = [];
  const premiumRow = {
    id: 99,
    sport: 'Football',
    league: { name: 'Premier League', country: 'England' },
    match_data: {
      homeTeam: { name: 'Home FC', shortName: 'HOM' },
      awayTeam: { name: 'Away FC', shortName: 'AWY' },
      date: '2026-05-16T15:00:00.000Z',
    },
    prediction: {
      type: 'Home Win',
      odds: 2.1,
      confidence: 78,
      analysis: 'Full premium analysis',
    },
    booking_code: {
      bookmaker: 'Bet9ja',
      code: 'FULLCODE',
      affiliateUrl: 'https://example.com/slip',
      trackingId: 'track_99',
      clicks: 12,
      successRate: 66,
    },
    status: 'open',
    stats: { likes: 0, comments: 0, views: 0, shares: 0 },
    is_trending: false,
    is_premium: true,
    cursor_epoch: '1778846400.000000',
    tags: [],
    created_at: '2026-05-15T12:00:00.000Z',
    user_id: 7,
    username: 'sharp',
    role: 'creator',
  };
  return {
    calls,
    premiumRow,
    async listPredictions(filters) {
      calls.push({ method: 'listPredictions', filters });
      return [premiumRow];
    },
    async findPredictionById(id) {
      calls.push({ method: 'findPredictionById', id });
      return premiumRow;
    },
    async getPlatformStats() {
      calls.push({ method: 'getPlatformStats' });
      return {
        tips_today: 3,
        win_rate: 61.5,
        code_copies: 12,
        creators: 2,
        live_matches: 0,
        forum_posts: 5,
      };
    },
    async getLeaderboard() {
      calls.push({ method: 'getLeaderboard' });
      return [{ user_id: 7, username: 'sharp', role: 'creator', total_predictions: 10, win_rate: 70 }];
    },
    async getCreatorDashboard(userId) {
      calls.push({ method: 'getCreatorDashboard', userId });
      return {
        overview: { totalClicks: 12 },
        chartData: [],
        topCodes: [],
        predictions: [],
      };
    },
  };
}

test('getPlatformStats exposes aggregate community metrics', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  const stats = await service.getPlatformStats();

  assert.deepEqual(repo.calls[0], { method: 'getPlatformStats' });
  assert.equal(stats.tipsToday, 3);
  assert.equal(stats.winRate, 61.5);
  assert.equal(stats.codeCopies, 12);
  assert.equal(stats.creators, 2);
  assert.equal(stats.liveMatches, 0);
  assert.equal(stats.forumPosts, 5);
});

test('getLeaderboard maps creator rows to public creator models', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  const leaderboard = await service.getLeaderboard();

  assert.deepEqual(repo.calls[0], { method: 'getLeaderboard' });
  assert.equal(leaderboard[0].id, '7');
  assert.equal(leaderboard[0].name, 'sharp');
  assert.equal(leaderboard[0].stats.totalPredictions, 10);
  assert.equal(leaderboard[0].stats.winRate, 70);
});

test('getCreatorDashboard requires a creator or admin user', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  await assert.rejects(
    () => service.getCreatorDashboard({ id: 2, role: 'user' }),
    /Only creators can access creator dashboard/
  );
});

test('getCreatorDashboard returns the current creator dashboard', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  const dashboard = await service.getCreatorDashboard({ id: 7, role: 'creator' });

  assert.deepEqual(repo.calls[0], { method: 'getCreatorDashboard', userId: 7 });
  assert.equal(dashboard.overview.totalClicks, 12);
});

test('listPredictions masks premium rows for guests', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  const predictions = await service.listPredictions({}, null);

  assert.equal(predictions[0].isPremium, true);
  assert.equal(predictions[0].access.locked, true);
  assert.equal(predictions[0].bookingCode, null);
  assert.equal(predictions[0].prediction.odds, null);
});

test('getPrediction denies direct premium detail access to guests, free users, and expired pro users', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  await assert.rejects(
    () => service.getPrediction(99, null),
    (error: any) => error.statusCode === 401
  );
  await assert.rejects(
    () => service.getPrediction(99, { role: 'user', subscription_plan: 'free', subscription_status: 'active' }),
    (error: any) => error.statusCode === 403
  );
  await assert.rejects(
    () => service.getPrediction(99, { role: 'user', subscription_plan: 'pro', subscription_status: 'expired' }),
    (error: any) => error.statusCode === 403
  );
});

test('getPrediction allows direct premium detail access to active pro users and admins', async () => {
  const repo = makeRepo();
  const service = createCommunityService(repo);

  const proPrediction = await service.getPrediction(99, {
    role: 'user',
    subscription_plan: 'pro',
    subscription_status: 'active',
  });
  const adminPrediction = await service.getPrediction(99, {
    role: 'admin',
    subscription_plan: 'free',
    subscription_status: 'expired',
  });

  assert.equal(proPrediction.bookingCode.code, 'FULLCODE');
  assert.equal(adminPrediction.bookingCode.code, 'FULLCODE');
});

test('listPredictions preserves an explicit empty date instead of falling back to latest', async () => {
  const calls: any[] = [];
  const repo = {
    async listPredictions(filters) { calls.push(filters); return []; },
    async findFeatureFlag() { return null; },
  };
  const service = createCommunityService(repo);
  const result = await service.listPredictions({ date: '2099-01-01' });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [{ date: '2099-01-01' }]);
});

test('cursor pagination returns a stable opaque continuation token', async () => {
  const repo=makeRepo();
  repo.listPredictions=async (filters:any)=>{
    repo.calls.push({method:'listPredictions',filters});
    return [repo.premiumRow,{...repo.premiumRow,id:98,created_at:'2026-05-14T12:00:00.000Z'}];
  };
  const service=createCommunityService(repo);
  const page=await service.listPredictions({pagination:'cursor',limit:1},null);
  assert.equal(page.items.length,1);assert.equal(typeof page.nextCursor,'string');
  const decoded=JSON.parse(Buffer.from(page.nextCursor,'base64url').toString('utf8'));
  assert.deepEqual(decoded,{createdEpoch:'1778846400.000000',id:99});
});

test('users cannot block themselves', async()=>{
  const service=createCommunityService(makeRepo());
  await assert.rejects(()=>service.setRelationship({id:7},7,{type:'block',enabled:true}),(error:any)=>error.statusCode===400);
});

test('creator cursor pagination uses prediction count, timestamp, and id',async()=>{
  const repo:any=makeRepo();repo.listCreators=async()=>[
    {user_id:7,username:'sharp',role:'creator',total_predictions:10,win_rate:70,cursor_epoch:'1778846400.000000'},
    {user_id:6,username:'steady',role:'creator',total_predictions:8,win_rate:60,cursor_epoch:'1778846300.000000'},
  ];
  const page=await createCommunityService(repo).listCreators({pagination:'cursor',limit:1});
  assert.equal(page.items.length,1);assert.deepEqual(JSON.parse(Buffer.from(page.nextCursor,'base64url').toString()),{totalPredictions:10,createdEpoch:'1778846400.000000',id:7});
});

test('profile avatar URLs require HTTPS on an approved host',async()=>{
  const repo:any=makeRepo();repo.updateProfile=async(_id:number,payload:any)=>payload;
  const service=createCommunityService(repo);
  await assert.rejects(()=>service.updateProfile(7,{avatar_url:'javascript:alert(1)'}),(error:any)=>error.statusCode===400);
  await assert.rejects(()=>service.updateProfile(7,{avatar_url:'https://127.0.0.1/avatar.png'}),(error:any)=>error.statusCode===400);
  const updated=await service.updateProfile(7,{avatar_url:'https://lh3.googleusercontent.com/avatar.png'});
  assert.equal(updated.avatar_url,'https://lh3.googleusercontent.com/avatar.png');
});
