import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import { hashPassword } from '../auth/auth.helpers.js';
import { hashToken } from '../auth/session.service.js';

const createSchema = {
  body: { type: 'object', properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    expiresInHours: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
  }, additionalProperties: false },
};
const acceptSchema = {
  body: { type: 'object', required: ['token', 'username', 'email', 'password'], properties: {
    token: { type: 'string', minLength: 32, maxLength: 256 },
    username: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$' },
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 12, maxLength: 128 },
  }, additionalProperties: false },
};

async function adminInvitationRoutes(fastify: any) {
  fastify.post('/api/admin/invitations', {
    onRequest: [fastify.requireRecentAdminAuth], schema: createSchema,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request: any, reply: any) => {
    const token = crypto.randomBytes(32).toString('base64url');
    const id = crypto.randomUUID();
    const email = request.body.email?.trim().toLowerCase() || null;
    const hours = request.body.expiresInHours ?? 24;
    await fastify.db.query(
      `INSERT INTO admin_invitations (id,token_hash,intended_email,created_by,expires_at)
       VALUES ($1,$2,$3,$4,NOW() + ($5 * INTERVAL '1 hour'))`,
      [id, hashToken(token), email, request.user.id, hours]);
    await fastify.db.query(
      `INSERT INTO admin_logs (admin_id,action,target_type,metadata)
       VALUES ($1,'admin.invitation_created','admin_invitation',$2)`,
      [request.user.id, JSON.stringify({ invitationId: id, intendedEmail: email, expiresInHours: hours })]);
    // The raw token is returned exactly once. It is never logged or stored.
    return reply.status(201).send({ status: 'success', data: { id, token, intendedEmail: email, expiresInHours: hours } });
  });

  fastify.post('/auth/admin/invitations/accept', {
    schema: acceptSchema, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request: any, reply: any) => {
    const client = await fastify.db.connect();
    const email = request.body.email.trim().toLowerCase();
    const username = request.body.username.trim().toLowerCase();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT * FROM admin_invitations WHERE token_hash = $1 FOR UPDATE`,
        [hashToken(request.body.token)]);
      const invitation = rows[0];
      const invalid = !invitation || invitation.used_at || invitation.revoked_at ||
        new Date(invitation.expires_at) <= new Date() ||
        (invitation.intended_email && invitation.intended_email !== email);
      if (invalid) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Unable to accept administrator invitation' });
      }
      const passwordHash = await hashPassword(request.body.password);
      const inserted = await client.query(
        `INSERT INTO users (username,email,password,role,is_verified,mfa_required)
         VALUES ($1,$2,$3,'admin',TRUE,TRUE)
         ON CONFLICT DO NOTHING RETURNING id,username,email,role`,
        [username, email, passwordHash]);
      const user = inserted.rows[0];
      if (!user) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Unable to accept administrator invitation' });
      }
      const consumed = await client.query(
        `UPDATE admin_invitations SET used_at = NOW(), used_by = $2
         WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
        [invitation.id, user.id]);
      if (!consumed.rowCount) throw new Error('Invitation consumption race');
      await client.query(
        `INSERT INTO admin_logs (admin_id,action,target_type,target_id,metadata)
         VALUES ($1,'admin.created','user',$2,$3)`,
        [invitation.created_by, user.id, JSON.stringify({ invitationId: invitation.id })]);
      await client.query('COMMIT');
      return reply.status(201).send({ status: 'success', message: 'Administrator account created. Sign in to enroll MFA.' });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      request.log.error({ err: error }, 'Administrator invitation acceptance failed');
      return reply.status(400).send({ error: 'Unable to accept administrator invitation' });
    } finally { client.release(); }
  });
}

export default fp(adminInvitationRoutes, { name: 'admin-invitation-routes', fastify: '5.x' });
