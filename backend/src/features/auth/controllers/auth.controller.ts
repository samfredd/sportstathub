import {
  comparePasswords,
  generateOTP,
  hashPassword,
} from "../helpers/auth.helpers.js";
import config from "../../../config/env.config.js";
import { createMailerService } from "../../../modules/mailer/mailer.service.js";
import crypto from "node:crypto";
import {
  REFRESH_COOKIE_NAME,
  clearSessionCookies,
  createSession,
  revokeAllUserSessions,
  revokePresentedSession,
  rotateSession,
  setAccessCookie,
} from "../../../modules/auth/session.service.js";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  enrollmentUri,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotp,
} from "../../../modules/auth/mfa.service.js";

// OTP lifetime (seconds)
// Tradeoff: longer = better UX, shorter = more secure
const OTP_VALIDITY = 900; // 15 minutes

// Max attempts before blocking
// This protects UX more than security (entropy already high)
const OTP_MAX_ATTEMPTS = 5;

// Cooldown between OTP requests
// Prevents spam + reduces infrastructure load
const OTP_RESEND_COOLDOWN = 60;

const RESET_VALIDITY = 900;
const RESET_RESEND_COOLDOWN = 60;
const RESET_MAX_ATTEMPTS = 5;

// Per-account login lockout — independent of the route's IP-based rate limit,
// which an attacker can dilute across many claimed IPs. Keyed by email so a
// single account can't be brute-forced regardless of how many source IPs (real
// or spoofed) the attempts are spread across.
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCKOUT_WINDOW = 900; // 15 minutes

// Precomputed once and reused so a login attempt against a non-existent (or
// OAuth-only, password-less) account still runs a real bcrypt comparison —
// otherwise returning immediately for "no such user" is measurably faster
// than the found-user path, letting response timing reveal which emails have
// a registered account.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomBytes(32).toString("hex"));
  }
  return dummyHashPromise;
}

/**
 * Set the JWT as an httpOnly cookie so the browser can't read it from JS
 * (XSS-resistant). The token is still returned in the response body for any
 * non-browser API client. Frontend clients should rely on the cookie.
 */
export const setAuthCookie = setAccessCookie;
export const issueSession = createSession;


// ================= REGISTER =================
export async function register(request, reply) {
  try {
    const { username, email, password } = request.body;
    const formattedUsername = username.trim().toLowerCase();
    const formattedEmail = email.trim().toLowerCase();
    const { rows: existing } = await request.server.db.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2", [formattedEmail, formattedUsername]);
    if (existing.length) {
      return reply.status(200).send({
        status: "success",
        message: "If the email exists, a verification code has been sent",
      });
    }

    const hashedPassword = await hashPassword(password);
    if (!config.requireOtp) {
      const { rows } = await request.server.db.query(
        `INSERT INTO users (username,email,password,role,is_verified)
         VALUES ($1,$2,$3,'user',TRUE) RETURNING *`,
        [formattedUsername, formattedEmail, hashedPassword]);
      const u = rows[0];
      const token = await issueSession(request, reply, u);
      return reply.status(200).send({
        status: "success",
        message: "Registration successful",
        data: { token, user: { id: u.id, email: u.email, username: u.username, role: u.role } },
      });
    }

    const resendKey = `otp_req:${formattedEmail}`;
    if (await request.server.redis.get(resendKey)) {
      return reply.status(429).send({
        error: "Please wait before requesting another OTP",
      });
    }

    const otp = generateOTP();
    const hashedOTP = await hashPassword(otp);
    const registrationNonce = crypto.randomBytes(32).toString('base64url');
    const pendingKey = `pending_registration:${crypto.createHash('sha256').update(registrationNonce).digest('hex')}`;
    const pending = {
      email: formattedEmail,
      username: formattedUsername,
      passwordHash: hashedPassword,
      otpHash: hashedOTP,
      createdAt: new Date().toISOString(),
    };
    await request.server.redis.setex(pendingKey, OTP_VALIDITY, JSON.stringify(pending));
    await request.server.redis.setex(`${pendingKey}:attempts`, OTP_VALIDITY, 0);
    reply.setCookie('pending_registration', registrationNonce, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: '/auth/verify-otp', maxAge: OTP_VALIDITY,
    });

    if (config.resendApiKey) {
      try {
        const mailer = createMailerService(config);
        await mailer.sendOtpEmail({ to: formattedEmail, otp });
      } catch (err) {
        await request.server.redis.del(pendingKey, `${pendingKey}:attempts`);
        request.log.error({ err }, "Failed to send OTP email");
        return reply.status(502).send({
          status: "error",
          message: "Could not send verification email",
        });
      }
    }

    // Set resend cooldown
    await request.server.redis.setex(resendKey, OTP_RESEND_COOLDOWN, 1);

    // Log OTP only in development
    // Never expose OTP in production logs
    if (process.env.NODE_ENV === "development") {
      request.log.info(`[OTP] ${formattedEmail}: ${otp}`);
    }

    // Generic response → reduces email enumeration attacks
    return reply.status(200).send({
      status: "success",
      message: "If the email exists, a verification code has been sent",
    });

  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      status: "error",
      message: "Internal server error during registration",
    });

  }
}


// ================= VERIFY OTP =================
export async function verifyOTP(request, reply) {
  try {
    const { email, otp } = request.body;
    const formattedEmail = email.trim().toLowerCase();
    const nonce = request.cookies?.pending_registration;
    if (!nonce) return reply.status(400).send({ error: 'Invalid request' });
    const pendingKey = `pending_registration:${crypto.createHash('sha256').update(nonce).digest('hex')}`;
    const rawPending = await request.server.redis.get(pendingKey);
    if (!rawPending) return reply.status(400).send({ error: 'Verification code expired or invalid' });
    const pending = JSON.parse(rawPending);
    if (pending.email !== formattedEmail) return reply.status(400).send({ error: 'Invalid request' });
    const attempts = await request.server.redis.incr(`${pendingKey}:attempts`);

    if (attempts > OTP_MAX_ATTEMPTS) {
      return reply.status(429).send({
        error: "Too many attempts",
      });
    }

    // Compare provided OTP against stored hash
    const isMatch = await comparePasswords(otp.toUpperCase(), pending.otpHash);

    if (!isMatch) {
      return reply.status(400).send({
        error: "Invalid verification code",
      });
    }

    const lockKey = `${pendingKey}:lock`;
    const locked = await request.server.redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (!locked) return reply.status(409).send({ error: 'Verification already in progress' });
    let user;
    try {
      const { rows } = await request.server.db.query(
        `INSERT INTO users (username,email,password,role,is_verified)
         VALUES ($1,$2,$3,'user',TRUE)
         ON CONFLICT DO NOTHING RETURNING *`,
        [pending.username, pending.email, pending.passwordHash]);
      user = rows[0];
      if (!user) return reply.status(409).send({ error: 'Unable to complete registration' });
      await request.server.redis.del(pendingKey, `${pendingKey}:attempts`);
      reply.clearCookie('pending_registration', { path: '/auth/verify-otp' });
    } finally {
      await request.server.redis.del(lockKey);
    }

    // Fire-and-forget welcome email — never block the response on email delivery
    if (config.resendApiKey) {
      const mailer = createMailerService(config);
      mailer.sendWelcomeEmail({ to: user.email, username: user.username }).catch(() => {});
    }

    // Issue JWT token
    const token = await issueSession(request, reply, user);

    return reply.status(200).send({
      status: "success",
      message: "User verified successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.username,
          role: user.role,
          created_at: user.created_at,
        },
        token,
      },
    });

  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      status: "error",
      message: "Internal server error during OTP verification",
    });
  }
}


// ================= FORGOT PASSWORD =================
export async function forgotPassword(request, reply) {
  const { email } = request.body;
  const formattedEmail = email.trim().toLowerCase();

  const resetKey = `password_reset:${formattedEmail}`;
  const attemptsKey = `password_reset_attempts:${formattedEmail}`;
  const cooldownKey = `password_reset_req:${formattedEmail}`;

  try {
    if (await request.server.redis.get(cooldownKey)) {
      return reply.status(429).send({
        error: "Please wait before requesting another reset code",
      });
    }

    const { rows } = await request.server.db.query(
      "SELECT id, email FROM users WHERE email = $1",
      [formattedEmail]
    );

    if (rows[0]) {
      const otp = generateOTP();
      const hashedOTP = await hashPassword(otp);
      await request.server.redis.setex(resetKey, RESET_VALIDITY, hashedOTP);
      await request.server.redis.setex(attemptsKey, RESET_VALIDITY, 0);

      if (config.resendApiKey) {
        const mailer = createMailerService(config);
        await mailer.sendPasswordResetEmail({ to: formattedEmail, otp });
      }

      if (process.env.NODE_ENV === "development") {
        request.log.info(`[PASSWORD_RESET] ${formattedEmail}: ${otp}`);
      }
    }

    await request.server.redis.setex(cooldownKey, RESET_RESEND_COOLDOWN, 1);

    return reply.status(200).send({
      status: "success",
      message: "If the email exists, a reset code has been sent",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      status: "error",
      message: "Internal server error during password reset request",
    });
  }
}


// ================= RESET PASSWORD =================
export async function resetPassword(request, reply) {
  const { email, otp, password } = request.body;
  const formattedEmail = email.trim().toLowerCase();

  const resetKey = `password_reset:${formattedEmail}`;
  const attemptsKey = `password_reset_attempts:${formattedEmail}`;

  try {
    const hashedOTP = await request.server.redis.get(resetKey);
    if (!hashedOTP) {
      return reply.status(400).send({ error: "Reset code expired or invalid" });
    }

    const attempts = await request.server.redis.incr(attemptsKey);
    if (attempts > RESET_MAX_ATTEMPTS) {
      return reply.status(429).send({ error: "Too many attempts" });
    }

    const isMatch = await comparePasswords(otp, hashedOTP);
    if (!isMatch) {
      return reply.status(400).send({ error: "Invalid reset code" });
    }

    const hashedPassword = await hashPassword(password);
    const { rowCount } = await request.server.db.query(
      "UPDATE users SET password = $1 WHERE email = $2",
      [hashedPassword, formattedEmail]
    );

    await request.server.redis.del(resetKey);
    await request.server.redis.del(attemptsKey);

    if (rowCount === 0) {
      return reply.status(400).send({ error: "Invalid request" });
    }

    const { rows: changedUsers } = await request.server.db.query(
      'SELECT id FROM users WHERE email = $1', [formattedEmail]);
    if (changedUsers[0]) {
      await revokeAllUserSessions(request.server.db, changedUsers[0].id, 'password_reset');
    }

    return reply.status(200).send({
      status: "success",
      message: "Password reset successfully",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      status: "error",
      message: "Internal server error during password reset",
    });
  }
}


// ================= LOGIN =================
export async function login(request, reply) {
  try {
    const { email, password } = request.body;

    const formattedEmail = email.trim().toLowerCase();
    const attemptsKey = `login_attempts:${formattedEmail}`;

    const priorAttempts = Number((await request.server.redis.get(attemptsKey)) ?? 0);
    if (priorAttempts >= LOGIN_MAX_ATTEMPTS) {
      return reply.status(429).send({
        error: "Too many failed login attempts. Please try again later.",
      });
    }

    // Fetch user
    const { rows } = await request.server.db.query(
      "SELECT * FROM users WHERE email = $1",
      [formattedEmail]
    );

    const user = rows[0];

    // Always run a real bcrypt comparison — even when the account doesn't
    // exist or has no password (OAuth-only) — against a fixed dummy hash, so
    // this branch takes the same time as a genuine wrong-password check and
    // can't be used to enumerate which emails are registered.
    const valid = await comparePasswords(password, user?.password ?? (await getDummyHash()));

    // Do not reveal whether email exists
    if (!user || !user.password || !valid) {
      await request.server.redis
        .multi()
        .incr(attemptsKey)
        .expire(attemptsKey, LOGIN_LOCKOUT_WINDOW)
        .exec();

      if (user && !user.password) {
        return reply.status(401).send({
          error: "Use Google sign-in for this account",
        });
      }
      return reply.status(401).send({
        error: "Invalid credentials",
      });
    }

    // Enforce verification before login
    // Prevents bypassing OTP system
    if (!user.is_verified) {
      return reply.status(403).send({
        error: "Please verify your account before logging in",
      });
    }

    if (user.status && user.status !== "active") {
      return reply.status(403).send({
        error: `Account is ${user.status}`,
      });
    }

    // Successful login — reset the lockout counter
    await request.server.redis.del(attemptsKey);

    // Administrator passwords are only the first factor. A narrowly-scoped,
    // five-minute token may proceed to enrollment/verification but cannot be
    // used as an access token because it has no normal session id/version.
    if (user.role === 'admin') {
      const mfaToken = request.server.jwt.sign(
        { id: user.id, purpose: 'admin_mfa' }, { expiresIn: 300 });
      return reply.status(202).send({
        status: 'mfa_required',
        data: { mfaRequired: true, enrollmentRequired: !user.mfa_enrolled_at, mfaToken },
      });
    }

    // Issue token
    const token = await issueSession(request, reply, user);

    return reply.status(200).send({
      status: "success",
      message: "Login successful",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.username,
          role: user.role,
        },
      },
    });

  } catch (error) {
    request.log.error(error);

    return reply.status(500).send({
      status: "error",
      message: "Internal server error during login",
    });
  }
}

function verifyMfaChallenge(request: any): { id: number; purpose: string } {
  const token = request.body?.mfaToken;
  if (!token) throw Object.assign(new Error('Invalid MFA challenge'), { statusCode: 401 });
  const payload = request.server.jwt.verify(token) as any;
  if (payload?.purpose !== 'admin_mfa' || !payload?.id) {
    throw Object.assign(new Error('Invalid MFA challenge'), { statusCode: 401 });
  }
  return payload;
}

export async function beginAdminMfaEnrollment(request: any, reply: any) {
  try {
    const challenge = verifyMfaChallenge(request);
    const { rows } = await request.server.db.query(
      `SELECT id,email,role,status,mfa_enrolled_at FROM users WHERE id = $1`, [challenge.id]);
    const user = rows[0];
    if (!user || user.role !== 'admin' || user.status !== 'active' || user.mfa_enrolled_at) {
      return reply.status(400).send({ error: 'Unable to start MFA enrollment' });
    }
    const secret = generateTotpSecret();
    await request.server.db.query(
      `UPDATE users SET mfa_totp_secret_encrypted = $1, mfa_required = TRUE WHERE id = $2`,
      [encryptMfaSecret(secret), user.id]);
    await request.server.db.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, metadata)
       VALUES ($1,'admin.mfa_enrollment_started','user',$1,'{}'::jsonb)`, [user.id]).catch(() => {});
    return reply.status(200).send({
      status: 'success', data: { secret, uri: enrollmentUri(secret, user.email) },
    });
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired MFA challenge' });
  }
}

export async function verifyAdminMfa(request: any, reply: any) {
  try {
    const challenge = verifyMfaChallenge(request);
    const { rows } = await request.server.db.query(
      `SELECT * FROM users WHERE id = $1`, [challenge.id]);
    const user = rows[0];
    if (!user || user.role !== 'admin' || user.status !== 'active' || !user.mfa_totp_secret_encrypted) {
      return reply.status(401).send({ error: 'Invalid verification code' });
    }
    const attemptsKey = `admin_mfa_attempts:${user.id}`;
    const attempts = Number(await request.server.redis.incr(attemptsKey));
    if (attempts === 1) await request.server.redis.expire(attemptsKey, 300);
    if (attempts > 5) return reply.status(429).send({ error: 'Too many verification attempts' });
    if (!verifyTotp(decryptMfaSecret(user.mfa_totp_secret_encrypted), request.body.code)) {
      return reply.status(401).send({ error: 'Invalid verification code' });
    }

    let recoveryCodes: string[] | undefined;
    if (!user.mfa_enrolled_at) {
      const recovery = await generateRecoveryCodes();
      const client = await request.server.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE users SET mfa_enrolled_at = NOW(), mfa_required = TRUE WHERE id = $1`, [user.id]);
        await client.query(`DELETE FROM admin_recovery_codes WHERE user_id = $1`, [user.id]);
        for (const codeHash of recovery.hashes) {
          await client.query(`INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES ($1,$2)`, [user.id, codeHash]);
        }
        await client.query('COMMIT');
        recoveryCodes = recovery.plain;
        user.mfa_enrolled_at = new Date();
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    await request.server.redis.del(attemptsKey);
    const token = await issueSession(request, reply, user);
    return reply.status(200).send({
      status: 'success',
      data: { user: { id: user.id, email: user.email, username: user.username, role: user.role }, recoveryCodes },
    });
  } catch (error: any) {
    request.log.warn({ err: error }, 'Administrator MFA verification failed');
    return reply.status(error?.statusCode || 401).send({ error: 'Invalid or expired MFA challenge' });
  }
}

export async function recoverAdminMfa(request: any, reply: any) {
  try {
    const challenge = verifyMfaChallenge(request);
    const { rows: users } = await request.server.db.query(`SELECT * FROM users WHERE id=$1`, [challenge.id]);
    const user = users[0];
    if (!user || user.role !== 'admin' || user.status !== 'active' || !user.mfa_enrolled_at) {
      return reply.status(401).send({ error: 'Invalid recovery code' });
    }
    const attemptsKey = `admin_mfa_recovery_attempts:${user.id}`;
    const attempts = Number(await request.server.redis.incr(attemptsKey));
    if (attempts === 1) await request.server.redis.expire(attemptsKey, 900);
    if (attempts > 5) return reply.status(429).send({ error: 'Too many recovery attempts' });
    const { rows: codes } = await request.server.db.query(
      `SELECT id,code_hash FROM admin_recovery_codes WHERE user_id=$1 AND used_at IS NULL`, [user.id]);
    let matched: any = null;
    for (const candidate of codes) {
      if (await comparePasswords(String(request.body.recoveryCode).toUpperCase(), candidate.code_hash)) {
        matched = candidate; break;
      }
    }
    if (!matched) return reply.status(401).send({ error: 'Invalid recovery code' });
    const { rowCount } = await request.server.db.query(
      `UPDATE admin_recovery_codes SET used_at=NOW() WHERE id=$1 AND used_at IS NULL`, [matched.id]);
    if (!rowCount) return reply.status(401).send({ error: 'Invalid recovery code' });
    await request.server.redis.del(attemptsKey);
    await request.server.db.query(
      `INSERT INTO admin_logs(admin_id,action,target_type,target_id,metadata)
       VALUES($1,'admin.mfa_recovery_used','user',$1,'{}'::jsonb)`, [user.id]).catch(() => {});
    await issueSession(request, reply, user);
    return reply.status(200).send({ status: 'success', data: {
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    } });
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired MFA challenge' });
  }
}


// ================= REFRESH =================
export async function refresh(request, reply) {
  try {
    const oldToken = request.cookies?.[REFRESH_COOKIE_NAME];
    if (!oldToken) {
      return reply.status(401).send({ status: "error", error: "No refresh token" });
    }

    const rotated = await rotateSession(request, reply, oldToken);
    if (rotated.status === 'concurrent') {
      return reply.status(409).send({ status: 'error', error: 'Refresh already completed by another request' });
    }
    if (rotated.status !== 'ok') {
      clearSessionCookies(reply);
      return reply.status(401).send({ status: 'error', error: 'Refresh token expired or invalid' });
    }

    return reply.status(200).send({
      status: "success",
      data: {
        token: rotated.token,
        user: { id: rotated.user.id, email: rotated.user.email, full_name: rotated.user.username, role: rotated.user.role },
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      status: "error",
      message: "Internal server error during token refresh",
    });
  }
}


// ================= LOGOUT =================
export async function logout(request, reply) {
  const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
  await revokePresentedSession(request, refreshToken).catch(() => {});
  clearSessionCookies(reply);
  return reply.status(200).send({ status: "success", message: "Logged out" });
}
