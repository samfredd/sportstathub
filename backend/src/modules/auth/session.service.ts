import crypto from 'node:crypto';
import config from '../../config/env.config.js';

export const ACCESS_COOKIE_NAME = 'token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
const IS_PROD = process.env.NODE_ENV === 'production';
const REFRESH_GRACE_SECONDS = 10;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requestMetadata(request: any) {
  const rawIp = request.ip || request.socket?.remoteAddress || null;
  return {
    userAgent: String(request.headers?.['user-agent'] || '').slice(0, 512) || null,
    ip: rawIp && /^[0-9a-fA-F:.]+$/.test(rawIp) ? rawIp : null,
  };
}

export function setAccessCookie(reply: any, token: string) {
  reply.setCookie(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: config.jwtExpiration,
  });
}

export function setRefreshCookie(reply: any, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/auth',
    maxAge: config.refreshTokenExpiration,
  });
}

export function clearSessionCookies(reply: any) {
  reply.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
}

export async function createSession(request: any, reply: any, user: any): Promise<string> {
  if (user.role === 'admin' && (!user.mfa_required || !user.mfa_enrolled_at)) {
    throw Object.assign(new Error('Administrator MFA verification is required'), { statusCode: 403 });
  }
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('base64url');
  const refreshToken = `${sessionId}.${secret}`;
  const version = Number(user.session_version ?? 1);
  const metadata = requestMetadata(request);

  await request.server.db.query(
    `INSERT INTO auth_sessions
       (id, token_family_id, user_id, refresh_token_hash, session_version,
        user_agent, ip_address, expires_at, mfa_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() + ($8 * INTERVAL '1 second'),$9)`,
    [sessionId, familyId, user.id, hashToken(refreshToken), version,
      metadata.userAgent, metadata.ip, config.refreshTokenExpiration,
      user.role === 'admin' ? new Date().toISOString() : null],
  );

  const accessToken = request.server.jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    sid: sessionId,
    sv: version,
    auth_time: Math.floor(Date.now() / 1000),
  });
  setAccessCookie(reply, accessToken);
  setRefreshCookie(reply, refreshToken);
  return accessToken;
}

export async function rotateSession(request: any, reply: any, presentedToken: string) {
  const sessionId = presentedToken.split('.', 1)[0];
  if (!sessionId) return { status: 'invalid' as const };
  const client = await request.server.db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.*, u.email, u.username, u.role, u.status, u.is_verified,
              u.session_version AS current_session_version
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 FOR UPDATE OF s`,
      [sessionId],
    );
    const session = rows[0];
    const presentedHash = hashToken(presentedToken);
    if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return { status: 'invalid' as const };
    }
    if (session.status !== 'active' || !session.is_verified ||
        Number(session.current_session_version) !== Number(session.session_version)) {
      await client.query(
        `UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'account_invalidated'
         WHERE token_family_id = $1 AND revoked_at IS NULL`, [session.token_family_id]);
      await client.query('COMMIT');
      return { status: 'invalid' as const };
    }
    if (session.refresh_token_hash !== presentedHash) {
      const inGrace = session.previous_token_hash === presentedHash &&
        session.previous_token_valid_until && new Date(session.previous_token_valid_until) > new Date();
      if (inGrace) {
        await client.query('ROLLBACK');
        return { status: 'concurrent' as const };
      }
      await client.query(
        `UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'refresh_reuse'
         WHERE token_family_id = $1 AND revoked_at IS NULL`, [session.token_family_id]);
      await client.query('COMMIT');
      request.log.warn({ userId: session.user_id, sessionId }, 'Refresh token reuse detected');
      return { status: 'reused' as const };
    }

    const nextToken = `${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
    await client.query(
      `UPDATE auth_sessions
       SET previous_token_hash = refresh_token_hash,
           previous_token_valid_until = NOW() + ($2 * INTERVAL '1 second'),
           refresh_token_hash = $3, last_used_at = NOW()
       WHERE id = $1`,
      [sessionId, REFRESH_GRACE_SECONDS, hashToken(nextToken)],
    );
    await client.query('COMMIT');
    const user = {
      id: session.user_id, email: session.email, username: session.username,
      role: session.role, session_version: session.current_session_version,
    };
    const accessToken = request.server.jwt.sign({
      id: user.id, email: user.email, role: user.role,
      sid: sessionId, sv: Number(user.session_version),
      auth_time: session.mfa_verified_at
        ? Math.floor(new Date(session.mfa_verified_at).getTime() / 1000)
        : undefined,
    });
    setAccessCookie(reply, accessToken);
    setRefreshCookie(reply, nextToken);
    return { status: 'ok' as const, token: accessToken, user };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function revokePresentedSession(request: any, token?: string) {
  if (!token) return;
  const sessionId = token.split('.', 1)[0];
  await request.server.db.query(
    `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = 'logout'
     WHERE id = $1`, [sessionId]);
}

export async function revokeAllUserSessions(db: any, userId: number, reason: string) {
  await db.query(
    `UPDATE users SET session_version = session_version + 1 WHERE id = $1`, [userId]);
  await db.query(
    `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = $2
     WHERE user_id = $1 AND revoked_at IS NULL`, [userId, reason]);
}
