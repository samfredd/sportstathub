import fp from 'fastify-plugin';
import { beginAdminMfaEnrollment, forgotPassword, login, logout, recoverAdminMfa, refresh, register, resetPassword, verifyAdminMfa, verifyAdminStepUp, verifyOTP } from '../../features/auth/controllers/auth.controller.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyOTPSchema } from './auth.schemas.js';
import { clearSessionCookies } from './session.service.js';

const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
const strictRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

async function authRoutes(fastify) {
  fastify.post('/auth/register',      { schema: registerSchema,       ...authRateLimit   }, register);
  fastify.post('/auth/verify-otp',    { schema: verifyOTPSchema,      ...authRateLimit   }, verifyOTP);
  fastify.post('/auth/login',         { schema: loginSchema,          ...authRateLimit   }, login);
  fastify.post('/auth/forgot-password', { schema: forgotPasswordSchema, ...strictRateLimit }, forgotPassword);
  fastify.post('/auth/reset-password',  { schema: resetPasswordSchema,  ...authRateLimit   }, resetPassword);
  const mfaSchema = { body: { type: 'object', required: ['mfaToken'], properties: {
    mfaToken: { type: 'string', minLength: 20 }, code: { type: 'string', pattern: '^\\d{6}$' },
  }, additionalProperties: false } };
  fastify.post('/auth/admin/mfa/enroll', { schema: mfaSchema, ...strictRateLimit }, beginAdminMfaEnrollment);
  fastify.post('/auth/admin/mfa/verify', {
    schema: { body: { ...mfaSchema.body, required: ['mfaToken', 'code'] } }, ...strictRateLimit,
  }, verifyAdminMfa);
  fastify.post('/auth/admin/mfa/recover', {
    schema: { body: { type: 'object', required: ['mfaToken','recoveryCode'], properties: {
      mfaToken: { type: 'string', minLength: 20 },
      recoveryCode: { type: 'string', pattern: '^[A-Fa-f0-9]{12}$' },
    }, additionalProperties: false } }, ...strictRateLimit,
  }, recoverAdminMfa);
  fastify.post('/auth/admin/step-up/verify', {
    schema: { body: { type: 'object', required: ['challengeId'], properties: {
      challengeId: { type: 'string', format: 'uuid' },
      code: { type: 'string', pattern: '^\\d{6}$' },
      recoveryCode: { type: 'string', pattern: '^[A-Fa-f0-9]{12}$' },
    }, additionalProperties: false } }, ...strictRateLimit,
  }, verifyAdminStepUp);
  fastify.post('/auth/refresh',         { ...authRateLimit }, refresh);
  fastify.post('/auth/logout', logout);
  fastify.get('/auth/sessions', { onRequest: [fastify.authenticate] }, async (request: any, reply) => {
    const { rows } = await fastify.db.query(
      `SELECT id,user_agent,host(ip_address) AS ip_address,created_at,last_used_at,expires_at,
              (id=$2) AS current
       FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW()
       ORDER BY last_used_at DESC`, [request.user.id, request.user.session_id]);
    return reply.send({ status: 'success', data: rows });
  });
  fastify.delete('/auth/sessions/:id', {
    onRequest: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (request: any, reply) => {
    const { rowCount } = await fastify.db.query(
      `UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoke_reason='user_revoked'
       WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [request.params.id, request.user.id]);
    if (!rowCount) return reply.status(404).send({ error: 'Session not found' });
    if (request.params.id === request.user.session_id) clearSessionCookies(reply);
    return reply.status(204).send();
  });
  fastify.delete('/auth/sessions', { onRequest: [fastify.authenticate] }, async (request: any, reply) => {
    await fastify.db.query(
      `UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoke_reason='logout_other_devices'
       WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL`, [request.user.id, request.user.session_id]);
    return reply.status(204).send();
  });
}

export default fp(authRoutes, { name: 'auth-routes', fastify: '5.x' });
