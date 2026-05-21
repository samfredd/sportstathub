const PLAN_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

type AccessUser = {
  role?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  plan?: string | null;
  status?: string | null;
  expires_at?: string | null;
};

type AccessContent = {
  isPremium?: boolean | null;
  is_premium?: boolean | null;
  requiredPlan?: string | null;
  required_plan?: string | null;
};

function statusCodeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function planRank(plan?: string | null) {
  return PLAN_RANK[String(plan ?? 'free').toLowerCase()] ?? 0;
}

export function isSubscriptionActive(subscription?: AccessUser | null, requiredPlan = 'pro') {
  if (!subscription) return false;

  const plan = subscription.subscription_plan ?? subscription.plan ?? 'free';
  const status = subscription.subscription_status ?? subscription.status ?? null;
  const expiresAt = subscription.subscription_expires_at ?? subscription.expires_at ?? null;

  if (String(status ?? '').toLowerCase() !== 'active') return false;
  if (planRank(plan) < planRank(requiredPlan)) return false;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;

  return true;
}

export function canAccessContent(user?: AccessUser | null, content: AccessContent = {}) {
  const isPremium = Boolean(content.isPremium ?? content.is_premium);
  const requiredPlan = content.requiredPlan ?? content.required_plan ?? 'pro';

  if (!isPremium || requiredPlan === 'free') return true;
  if (user?.role === 'admin') return true;

  return isSubscriptionActive(user, requiredPlan);
}

export function requireContentAccess(user?: AccessUser | null, content: AccessContent = {}) {
  if (canAccessContent(user, content)) return;

  const isPremium = Boolean(content.isPremium ?? content.is_premium);
  if (!isPremium) return;

  if (!user) throw statusCodeError('Authentication required', 401);
  throw statusCodeError('Pro subscription required', 403);
}

export function maskPremiumPrediction<T extends Record<string, any>>(prediction: T, user?: AccessUser | null): T {
  if (canAccessContent(user, prediction)) return prediction;

  return {
    ...prediction,
    prediction: {
      ...(prediction.prediction ?? {}),
      odds: null,
      confidence: null,
      analysis: 'Upgrade to Pro to unlock the full prediction, odds, confidence, analysis, and booking code.',
    },
    bookingCode: null,
    booking_code: null,
    access: {
      locked: true,
      requiredPlan: 'pro',
      reason: user ? 'upgrade_required' : 'login_required',
    },
  };
}
