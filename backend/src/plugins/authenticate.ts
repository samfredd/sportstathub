import fp from 'fastify-plugin';
import { isSubscriptionActive } from '../helpers/access-control.helpers.js';

async function authenticatePlugin(fastify) {
  async function loadCurrentUser(id: number) {
    const { rows } = await fastify.db.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.is_verified,
              s.plan AS subscription_plan,
              s.status AS subscription_status,
              s.expires_at AS subscription_expires_at
       FROM users u
       LEFT JOIN LATERAL (
         SELECT plan, status, expires_at
         FROM subscriptions
         WHERE user_id = u.id
         ORDER BY created_at DESC
         LIMIT 1
       ) s ON TRUE
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function verifyAndLoadUser(request, reply) {
    try {
      await request.jwtVerify();
      const currentUser = await loadCurrentUser(Number(request.user?.id));
      if (!currentUser) {
        return reply.status(401).send({ status: 'error', error: 'Unauthorized' });
      }
      if (currentUser.status && currentUser.status !== 'active') {
        return reply.status(403).send({ status: 'error', error: `Account is ${currentUser.status}` });
      }
      request.user = currentUser;
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
      const currentUser = await loadCurrentUser(Number(request.user?.id));
      request.user = (currentUser && (!currentUser.status || currentUser.status === 'active'))
        ? currentUser
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
