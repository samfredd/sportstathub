import fp from 'fastify-plugin';
import { isSubscriptionActive } from '../helpers/access-control.helpers.js';
import { createStepUpChallenge } from '../modules/auth/step-up.service.js';

async function authenticatePlugin(fastify) {
  async function loadCurrentUser(id: number, sessionId: string, sessionVersion: number) {
    if (!sessionId || !Number.isInteger(sessionVersion)) return null;
    const { rows } = await fastify.db.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.is_verified,
              u.session_version, u.mfa_required, u.mfa_enrolled_at,
              s.plan AS subscription_plan,
              s.status AS subscription_status,
              CASE WHEN s.status='grace' THEN s.grace_ends_at ELSE s.expires_at END AS subscription_expires_at
       FROM users u
       JOIN auth_sessions auths ON auths.id = $2 AND auths.user_id = u.id
         AND auths.revoked_at IS NULL AND auths.expires_at > NOW()
       LEFT JOIN LATERAL (
         SELECT plan, status, expires_at, grace_ends_at
         FROM subscriptions
         WHERE user_id = u.id
         ORDER BY CASE WHEN status IN ('active','grace') THEN 0 ELSE 1 END, created_at DESC
         LIMIT 1
       ) s ON TRUE
       WHERE u.id = $1 AND u.session_version = $3 AND auths.session_version = $3`,
      [id, sessionId, sessionVersion]
    );
    return rows[0] ?? null;
  }

  async function verifyAndLoadUser(request, reply) {
    try {
      await request.jwtVerify();
      const tokenUser = request.user;
      const currentUser = await loadCurrentUser(
        Number(request.user?.id), String(request.user?.sid || ''), Number(request.user?.sv));
      if (!currentUser) {
        return reply.status(401).send({ status: 'error', error: 'Unauthorized' });
      }
      if (currentUser.status && currentUser.status !== 'active') {
        return reply.status(403).send({ status: 'error', error: `Account is ${currentUser.status}` });
      }
      if (currentUser.role === 'admin' && (!currentUser.mfa_required || !currentUser.mfa_enrolled_at)) {
        return reply.status(403).send({ status: 'error', error: 'Administrator MFA is required' });
      }
      request.user = { ...currentUser, session_id: String(tokenUser?.sid), auth_time: tokenUser?.auth_time };
    } catch {
      return reply.status(401).send({ status: 'error', error: 'Unauthorized' });
    }
  }

  fastify.decorate('authenticate', verifyAndLoadUser);
  fastify.decorate('requireAuth', verifyAndLoadUser);

  // Optional auth: attach the user when a credential is present (httpOnly
  // cookie or Authorization header) but NEVER reject the request — public
  // routes must keep working for anonymous visitors and stale/expired tokens.
  fastify.decorate('optionalAuth', async function (request, _reply) {
    const hasCredential = request.headers?.authorization || request.cookies?.token;
    if (!hasCredential) return;
    try {
      await request.jwtVerify();
      const currentUser = await loadCurrentUser(
        Number(request.user?.id), String(request.user?.sid || ''), Number(request.user?.sv));
      request.user = (currentUser && (!currentUser.status || currentUser.status === 'active'))
        ? { ...currentUser, session_id: String(request.user?.sid) }
        : null;
    } catch {
      request.user = null;
    }
  });

  fastify.decorate('requireAdmin', async function (request, reply) {
    await verifyAndLoadUser(request, reply);
    if (reply.sent) return;
    if (request.user?.role !== 'admin') {
      return reply.status(403).send({ status: 'error', error: 'Forbidden: admin access required' });
    }
  });

  fastify.decorate('requireRecentAdminAuth', async function (request, reply) {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;
    const authTime = Number(request.user?.auth_time || 0);
    if (!authTime || Date.now() / 1000 - authTime > 10 * 60) {
      // Machine-readable so the admin frontend can show a step-up modal and
      // retry the original request, instead of treating this the same as an
      // expired session and forcing a full logout.
      const challengeId = await createStepUpChallenge(fastify.redis, request.user.id);
      return reply.status(401).send({ status: 'error', code: 'ADMIN_STEP_UP_REQUIRED', challengeId });
    }
  });

  fastify.decorate('requireProAccess', async function (request, reply, requiredPlan = 'pro') {
    await verifyAndLoadUser(request, reply);
    if (reply.sent) return;
    if (request.user?.role === 'admin') return;
    if (!isSubscriptionActive(request.user, requiredPlan)) {
      return reply.status(403).send({ status: 'error', error: 'Pro subscription required' });
    }
  });

  fastify.decorate('canAccessContent', function (user, content: any = {}) {
    if (!content?.isPremium && !content?.is_premium) return true;
    if (user?.role === 'admin') return true;
    return isSubscriptionActive(user, content.requiredPlan ?? content.required_plan ?? 'pro');
  });

  fastify.decorate('requireFeatureAccess', function (featureKey, fallbackPlan = 'pro') {
    return async function (request, reply) {
      let requiredPlan = fallbackPlan;
      try {
        const { rows } = await fastify.db.query(
          `SELECT required_plan, is_enabled FROM feature_flags WHERE key = $1`,
          [featureKey]
        );
        const flag = rows[0];
        // A disabled flag must reject the request, not skip auth entirely —
        // "disabled" bypassing the gate would make a paused/broken feature
        // MORE accessible (fully public, unauthenticated) than a working one.
        if (flag && !flag.is_enabled) {
          return reply.status(403).send({ status: 'error', error: 'This feature is currently unavailable' });
        }
        requiredPlan = flag?.required_plan ?? fallbackPlan;
      } catch {
        requiredPlan = fallbackPlan;
      }

      // A "free" required_plan means no paid plan is needed, not that login
      // itself is optional — still authenticate, just skip the plan check.
      if (requiredPlan === 'free') {
        return verifyAndLoadUser(request, reply);
      }

      return fastify.requireProAccess(request, reply, requiredPlan);
    };
  });
}

export default fp(authenticatePlugin, { name: 'authenticate', fastify: '5.x' });
