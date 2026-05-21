import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAccessContent,
  isSubscriptionActive,
  maskPremiumPrediction,
  requireContentAccess,
} from '../src/helpers/access-control.helpers.js';

const premiumPrediction = {
  id: '42',
  sport: 'Football',
  league: { name: 'Premier League', country: 'England' },
  match: {
    homeTeam: { name: 'Home FC', shortName: 'HOM' },
    awayTeam: { name: 'Away FC', shortName: 'AWY' },
    date: '2026-05-16T15:00:00.000Z',
  },
  prediction: {
    type: 'Home Win',
    odds: 2.1,
    confidence: 78,
    analysis: 'Full premium rationale with tactical details.',
  },
  bookingCode: {
    bookmaker: 'Bet9ja',
    code: 'FULLCODE',
    affiliateUrl: 'https://example.com/slip',
    trackingId: 'track_42',
    clicks: 12,
    successRate: 66,
  },
  status: 'open',
  stats: { likes: 3, comments: 1, views: 20, shares: 0 },
  isTrending: false,
  isPremium: true,
  tags: ['value'],
  timestamp: '2026-05-15T12:00:00.000Z',
};

test('isSubscriptionActive only accepts paid active plans that have not expired', () => {
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'active', expires_at: null }), true);
  assert.equal(isSubscriptionActive({ plan: 'enterprise', status: 'active', expires_at: '2999-01-01T00:00:00.000Z' }), true);
  assert.equal(isSubscriptionActive({ plan: 'free', status: 'active', expires_at: null }), false);
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'expired', expires_at: null }), false);
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'cancelled', expires_at: null }), false);
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'pending', expires_at: null }), false);
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'failed', expires_at: null }), false);
  assert.equal(isSubscriptionActive({ plan: 'pro', status: 'active', expires_at: '2000-01-01T00:00:00.000Z' }), false);
});

test('canAccessContent denies premium content to guests, free users, and expired pro users', () => {
  assert.equal(canAccessContent(null, { isPremium: true }), false);
  assert.equal(canAccessContent({ role: 'user', subscription_plan: 'free', subscription_status: 'active' }, { isPremium: true }), false);
  assert.equal(canAccessContent({ role: 'user', subscription_plan: 'pro', subscription_status: 'expired' }, { isPremium: true }), false);
  assert.equal(canAccessContent({ role: 'user', subscription_plan: 'pro', subscription_status: 'active' }, { isPremium: true }), true);
  assert.equal(canAccessContent({ role: 'admin', subscription_plan: 'free', subscription_status: 'expired' }, { isPremium: true }), true);
});

test('requireContentAccess returns 401 for guests and 403 for non-paying authenticated users', () => {
  assert.throws(
    () => requireContentAccess(null, { isPremium: true }),
    (error: any) => error.statusCode === 401 && /Authentication required/.test(error.message)
  );
  assert.throws(
    () => requireContentAccess({ role: 'user', subscription_plan: 'free', subscription_status: 'active' }, { isPremium: true }),
    (error: any) => error.statusCode === 403 && /Pro subscription required/.test(error.message)
  );
});

test('maskPremiumPrediction strips full premium content while keeping a teaser', () => {
  const masked: any = maskPremiumPrediction(premiumPrediction, null);

  assert.equal(masked.isPremium, true);
  assert.equal(masked.access.locked, true);
  assert.equal(masked.prediction.type, 'Home Win');
  assert.equal(masked.prediction.odds, null);
  assert.equal(masked.prediction.confidence, null);
  assert.match(masked.prediction.analysis, /Upgrade/);
  assert.equal(masked.bookingCode, null);
});

test('maskPremiumPrediction leaves premium content intact for active pro and admin users', () => {
  const pro = { role: 'user', subscription_plan: 'pro', subscription_status: 'active' };
  const admin = { role: 'admin', subscription_plan: 'free', subscription_status: 'expired' };

  assert.equal(maskPremiumPrediction(premiumPrediction, pro).bookingCode.code, 'FULLCODE');
  assert.equal(maskPremiumPrediction(premiumPrediction, admin).bookingCode.code, 'FULLCODE');
});
