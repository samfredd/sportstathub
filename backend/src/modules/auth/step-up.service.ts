import crypto from 'node:crypto';

// Short-lived, single-use challenge issued when a sensitive admin action hits
// a stale `auth_time` (see `requireRecentAdminAuth` in
// ../../plugins/authenticate.ts). The frontend shows a TOTP/recovery-code
// modal, verifies against this challenge, and retries the original request.
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes
const ATTEMPTS_TTL_SECONDS = 300;
export const STEP_UP_MAX_ATTEMPTS = 5;

function challengeKey(challengeId: string) {
  return `step_up_challenge:${challengeId}`;
}

function attemptsKey(challengeId: string) {
  return `step_up_attempts:${challengeId}`;
}

export async function createStepUpChallenge(redis: any, adminId: number): Promise<string> {
  const challengeId = crypto.randomUUID();
  await redis.setex(challengeKey(challengeId), CHALLENGE_TTL_SECONDS, String(adminId));
  return challengeId;
}

// Peek only — does not consume. A wrong code shouldn't burn an otherwise
// valid challenge, only the attempts cap should.
export async function peekStepUpChallenge(redis: any, challengeId: string): Promise<number | null> {
  const raw = await redis.get(challengeKey(challengeId));
  if (!raw) return null;
  const adminId = Number(raw);
  return Number.isInteger(adminId) ? adminId : null;
}

export async function registerStepUpAttempt(redis: any, challengeId: string): Promise<number> {
  const key = attemptsKey(challengeId);
  const attempts = Number(await redis.incr(key));
  if (attempts === 1) await redis.expire(key, ATTEMPTS_TTL_SECONDS);
  return attempts;
}

export async function consumeStepUpChallenge(redis: any, challengeId: string): Promise<void> {
  await redis.del(challengeKey(challengeId), attemptsKey(challengeId));
}
