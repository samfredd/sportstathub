import {
  comparePasswords,
  generateOTP,
  hashPassword,
} from "../helpers/auth.helpers.js";
import config from "../../../config/env.config.js";
import { createMailerService } from "../../../modules/mailer/mailer.service.js";
import crypto from "crypto";

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

const IS_PROD = process.env.NODE_ENV === "production";

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
export function setAuthCookie(reply: any, token: string) {
  reply.setCookie("token", token, {
    httpOnly: true,
    secure: IS_PROD,          // HTTPS-only in production
    sameSite: "lax",          // sent on same-site requests (incl. localhost dev)
    path: "/",
    maxAge: config.jwtExpiration, // seconds
  });
}

function clearAuthCookie(reply: any) {
  reply.clearCookie("token", { path: "/" });
}

// ── Refresh tokens ─────────────────────────────────────────────────────────
//
// The access-token cookie above is short-lived (config.jwtExpiration, ~15
// min) so a stolen/leaked cookie has a small blast radius. The refresh token
// is what lets a session survive past that without forcing the user to
// log in again: it's a long-lived, single-use, revocable credential stored
// server-side (Redis), scoped narrowly to /auth/* so it isn't sent on every
// request like the access-token cookie is.
//
// Only its SHA-256 hash is stored — mirroring how OTPs are hashed — so a
// Redis read (backup, log, replica) can't hand out a usable token directly.

const REFRESH_COOKIE_NAME = "refresh_token";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(redis: any, userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await redis.setex(`refresh:${hashToken(token)}`, config.refreshTokenExpiration, String(userId));
  return token;
}

async function revokeRefreshToken(redis: any, token?: string): Promise<void> {
  if (!token) return;
  await redis.del(`refresh:${hashToken(token)}`);
}

function setRefreshCookie(reply: any, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/auth", // only sent back on /auth/refresh and /auth/logout, not every request
    maxAge: config.refreshTokenExpiration,
  });
}

function clearRefreshCookie(reply: any) {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
}

/**
 * Issue a full session for a user: signs a short-lived access token into the
 * httpOnly cookie, and a long-lived refresh token into its own httpOnly
 * cookie. Every login path (password, OTP, OAuth, admin) should go through
 * this so they can't drift out of sync with each other.
 */
export async function issueSession(request: any, reply: any, user: any): Promise<string> {
  const token = request.server.jwt.sign({ id: user.id, email: user.email, role: user.role });
  setAuthCookie(reply, token);

  const refreshToken = await issueRefreshToken(request.server.redis, user.id);
  setRefreshCookie(reply, refreshToken);

  return token;
}


// ================= REGISTER =================
export async function register(request, reply) {
  // Use a dedicated DB client to control lifecycle
  const db = await request.server.db.connect();
  let createdUser = false;

  try {
    const { username, email, password } = request.body;

    // Normalize inputs → prevents duplicate logical users
    const formattedUsername = username.trim().toLowerCase();
    const formattedEmail = email.trim().toLowerCase();

    // Check if user already exists
    // NOTE: This is NOT relied on for uniqueness (DB constraint is)
    let { rows: existing } = await db.query(
      "SELECT id, is_verified FROM users WHERE email = $1",
      [formattedEmail]
    );

    let user;

    if (existing.length === 0) {
      // Hash password before storing (never store raw password)
      const hashedPassword = await hashPassword(password);

      // Insert user safely
      // ON CONFLICT ensures no duplicate even under race conditions
      await db.query(
        `INSERT INTO users (username, email, password, role, is_verified)
         VALUES ($1, $2, $3, $4, FALSE)
         ON CONFLICT (email) DO NOTHING`,
        [formattedUsername, formattedEmail, hashedPassword, "user"]
      );
      createdUser = true;

      // Re-fetch user to ensure we have the row (whether inserted now or earlier)
      const result = await db.query(
        "SELECT id, is_verified FROM users WHERE email = $1",
        [formattedEmail]
      );

      user = result.rows[0];
    } else {
      user = existing[0];
    }

    // If already verified → stop immediately, but respond exactly like the
    // generic success path below (not a distinguishable 409). A different
    // status code here would let an attacker enumerate which emails already
    // have a verified account — the same leak the generic response two
    // branches down is specifically designed to avoid.
    if (user.is_verified) {
      return reply.status(200).send({
        status: "success",
        message: "If the email exists, a verification code has been sent",
      });
    }

    // OTP disabled: auto-verify and return JWT immediately
    if (!config.requireOtp) {
      await db.query(
        "UPDATE users SET is_verified = TRUE WHERE email = $1",
        [formattedEmail]
      );
      const { rows: verified } = await db.query(
        "SELECT id, username, email, role FROM users WHERE email = $1",
        [formattedEmail]
      );
      const u = verified[0];
      const token = await issueSession(request, reply, u);
      return reply.status(200).send({
        status: "success",
        message: "Registration successful",
        data: { token, user: { id: u.id, email: u.email, username: u.username, role: u.role } },
      });
    }

    // Rate limiting OTP requests
    // Prevents:
    // - Email spam
    // - Resource exhaustion
    const resendKey = `otp_req:${formattedEmail}`;
    if (await request.server.redis.get(resendKey)) {
      return reply.status(429).send({
        error: "Please wait before requesting another OTP",
      });
    }

    const otpKey = `otp:${formattedEmail}`;
    const attemptsKey = `otp_attempts:${formattedEmail}`;

    const otp = generateOTP();
    const hashedOTP = await hashPassword(otp);

    try {
      // Store a fresh OTP with expiry. Only the hash is stored, so resends
      // must generate and email a new code rather than pretending to resend
      // a code that can no longer be read from Redis.
      await request.server.redis.setex(otpKey, OTP_VALIDITY, hashedOTP);
      await request.server.redis.setex(attemptsKey, OTP_VALIDITY, 0);
    } catch (err) {
      if (createdUser) {
        await db.query("DELETE FROM users WHERE email = $1", [formattedEmail]);
      }
      throw err;
    }

    if (config.smtpHost) {
      try {
        const mailer = createMailerService(config);
        await mailer.sendOtpEmail({ to: formattedEmail, otp });
      } catch (err) {
        await request.server.redis.del(otpKey);
        await request.server.redis.del(attemptsKey);
        if (createdUser) {
          await db.query("DELETE FROM users WHERE email = $1", [formattedEmail]);
        }
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

  } finally {
    // Always release DB connection
    db.release();
  }
}


// ================= VERIFY OTP =================
export async function verifyOTP(request, reply) {
  try {
    const { email, otp } = request.body;

    // Normalize input
    const formattedEmail = email.trim().toLowerCase();

    const otpKey = `otp:${formattedEmail}`;
    const attemptsKey = `otp_attempts:${formattedEmail}`;

    // Fetch user early → enables idempotency
    const { rows } = await request.server.db.query(
      "SELECT id, username, email, role, created_at, is_verified FROM users WHERE email = $1",
      [formattedEmail]
    );

    const user = rows[0];

    // Generic error → avoids leaking whether user exists
    if (!user) {
      return reply.status(400).send({ error: "Invalid request" });
    }

    // Already verified → do NOT issue a token here. The OTP has not been
    // checked at this point, so returning a session would let anyone who
    // knows a registered email obtain a JWT for that account (auth bypass).
    // Verified users must sign in through /auth/login with their password.
    if (user.is_verified) {
      return reply.status(409).send({
        error: "Account is already verified — please sign in",
      });
    }

    // Fetch OTP from Redis
    const hashedOTP = await request.server.redis.get(otpKey);

    if (!hashedOTP) {
      return reply.status(400).send({
        error: "OTP expired or invalid",
      });
    }

    // Atomically increment before checking — prevents concurrent requests from
    // all passing a GET-then-compare race. INCR is atomic in Redis.
    const attempts = await request.server.redis.incr(attemptsKey);

    if (attempts > OTP_MAX_ATTEMPTS) {
      return reply.status(429).send({
        error: "Too many attempts",
      });
    }

    // Compare provided OTP against stored hash
    const isMatch = await comparePasswords(
      otp.toUpperCase(),
      hashedOTP
    );

    if (!isMatch) {
      return reply.status(400).send({
        error: "Invalid verification code",
      });
    }

    // OTP correct → cleanup ephemeral state
    await request.server.redis.del(otpKey);
    await request.server.redis.del(attemptsKey);

    // Activate account (persistent state change)
    await request.server.db.query(
      "UPDATE users SET is_verified = TRUE WHERE email = $1",
      [formattedEmail]
    );

    // Fire-and-forget welcome email — never block the response on email delivery
    if (config.smtpHost) {
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

      if (config.smtpHost) {
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


// ================= ADMIN REGISTER =================
export async function registerAdmin(request, reply) {
  try {
    const { username, email, password, inviteKey } = request.body;

    // Gate: invite key must be set in env and must match
    if (!config.adminInviteKey) {
      return reply.status(503).send({ error: "Admin registration is not enabled on this server." });
    }

    // Constant-time comparison prevents timing attacks
    const keyBuffer   = Buffer.from(inviteKey);
    const validBuffer = Buffer.from(config.adminInviteKey);
    const keysMatch   = keyBuffer.length === validBuffer.length &&
                        crypto.timingSafeEqual(keyBuffer, validBuffer);

    if (!keysMatch) {
      return reply.status(403).send({ error: "Invalid invite key." });
    }

    const formattedUsername = username.trim().toLowerCase();
    const formattedEmail    = email.trim().toLowerCase();

    // Check for existing account
    const { rows: existing } = await request.server.db.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [formattedEmail, formattedUsername]
    );
    if (existing.length > 0) {
      return reply.status(409).send({ error: "An account with that email or username already exists." });
    }

    const hashedPassword = await hashPassword(password);

    const { rows } = await request.server.db.query(
      `INSERT INTO users (username, email, password, role, is_verified)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING id, username, email, role, created_at`,
      [formattedUsername, formattedEmail, hashedPassword]
    );

    const user = rows[0];

    const token = await issueSession(request, reply, user);

    request.log.info(`[ADMIN_REGISTER] New admin account created: ${formattedEmail}`);

    return reply.status(201).send({
      status: "success",
      message: "Admin account created successfully.",
      data: { token, user: { id: user.id, email: user.email, username: user.username, role: user.role } },
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ status: "error", message: "Internal server error." });
  }
}


// ================= REFRESH =================
export async function refresh(request, reply) {
  try {
    const oldToken = request.cookies?.[REFRESH_COOKIE_NAME];
    if (!oldToken) {
      return reply.status(401).send({ status: "error", error: "No refresh token" });
    }

    const key = `refresh:${hashToken(oldToken)}`;
    const userId = await request.server.redis.get(key);

    // Rotate immediately, whether or not it turns out to be valid — a used or
    // stale key should never be replayable.
    await request.server.redis.del(key);

    if (!userId) {
      clearAuthCookie(reply);
      clearRefreshCookie(reply);
      return reply.status(401).send({ status: "error", error: "Refresh token expired or invalid" });
    }

    const { rows } = await request.server.db.query(
      "SELECT id, username, email, role, status FROM users WHERE id = $1",
      [userId]
    );
    const user = rows[0];

    if (!user || (user.status && user.status !== "active")) {
      clearAuthCookie(reply);
      clearRefreshCookie(reply);
      return reply.status(401).send({ status: "error", error: "Account is not active" });
    }

    const token = await issueSession(request, reply, user);

    return reply.status(200).send({
      status: "success",
      data: {
        token,
        user: { id: user.id, email: user.email, full_name: user.username, role: user.role },
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
  if (refreshToken) {
    await revokeRefreshToken(request.server.redis, refreshToken).catch(() => {});
  }
  clearAuthCookie(reply);
  clearRefreshCookie(reply);
  return reply.status(200).send({ status: "success", message: "Logged out" });
}
