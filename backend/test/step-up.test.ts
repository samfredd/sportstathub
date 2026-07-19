import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyAdminStepUp } from '../src/features/auth/controllers/auth.controller.js';
import {
  consumeStepUpChallenge,
  createStepUpChallenge,
  peekStepUpChallenge,
  registerStepUpAttempt,
  STEP_UP_MAX_ATTEMPTS,
} from '../src/modules/auth/step-up.service.js';
import { encryptMfaSecret, generateTotpCode, generateTotpSecret } from '../src/modules/auth/mfa.service.js';
import { hashPassword } from '../src/modules/auth/auth.helpers.js';

function createReply() {
  return {
    statusCode: 200,
    body: null,
    cookies: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    setCookie(name: string, value: unknown) {
      this.cookies[name] = value;
      return this;
    },
  };
}

function createFakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setex(key: string, _ttl: number, value: string) {
      store.set(key, value);
    },
    async incr(key: string) {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async expire() {},
    async del(...keys: string[]) {
      for (const key of keys) store.delete(key);
    },
  };
}

function createFakeDb(admin: any, recoveryCodes: { id: number; code_hash: string; used_at: string | null }[] = []) {
  const inserted = { authSessions: 0, auditLogs: [] as any[] };
  return {
    inserted,
    async query(sql: string, params: any[] = []) {
      if (sql.startsWith('SELECT * FROM users WHERE id')) {
        return { rows: params[0] === admin.id ? [admin] : [] };
      }
      if (sql.startsWith('SELECT id, code_hash FROM admin_recovery_codes')) {
        return { rows: recoveryCodes.filter((c) => !c.used_at) };
      }
      if (sql.startsWith('UPDATE admin_recovery_codes SET used_at')) {
        const [id] = params;
        const code = recoveryCodes.find((c) => c.id === id && !c.used_at);
        if (code) code.used_at = new Date().toISOString();
        return { rowCount: code ? 1 : 0 };
      }
      if (sql.startsWith('INSERT INTO admin_logs')) {
        inserted.auditLogs.push({ sql, params });
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO auth_sessions')) {
        inserted.authSessions += 1;
        return { rows: [] };
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    },
  };
}

function buildRequest({ redis, db }: { redis: any; db: any }, body: any) {
  return {
    body,
    log: { error() {}, warn() {} },
    server: {
      redis,
      db,
      jwt: { sign: () => 'signed-access-token' },
    },
  };
}

test('step-up challenge is single-use and expires after consumption', async () => {
  const redis = createFakeRedis();
  const challengeId = await createStepUpChallenge(redis, 42);

  assert.equal(await peekStepUpChallenge(redis, challengeId), 42);
  await consumeStepUpChallenge(redis, challengeId);
  assert.equal(await peekStepUpChallenge(redis, challengeId), null);
});

test('step-up attempts are capped', async () => {
  const redis = createFakeRedis();
  const challengeId = await createStepUpChallenge(redis, 42);
  let last = 0;
  for (let i = 0; i < STEP_UP_MAX_ATTEMPTS + 1; i++) {
    last = await registerStepUpAttempt(redis, challengeId);
  }
  assert.equal(last, STEP_UP_MAX_ATTEMPTS + 1);
});

test('verifyAdminStepUp accepts a correct TOTP code, consumes the challenge, and issues a fresh session', async () => {
  const secret = generateTotpSecret();
  const admin = {
    id: 7, email: 'admin@example.com', username: 'admin', role: 'admin', status: 'active',
    is_verified: true, session_version: 1, mfa_required: true,
    mfa_enrolled_at: new Date().toISOString(),
    mfa_totp_secret_encrypted: encryptMfaSecret(secret),
  };
  const redis = createFakeRedis();
  const db = createFakeDb(admin);
  const challengeId = await createStepUpChallenge(redis, admin.id);
  const reply = createReply();
  const request = buildRequest({ redis, db }, { challengeId, code: generateTotpCode(secret) });

  await verifyAdminStepUp(request, reply);

  assert.equal(reply.statusCode, 200);
  assert.equal(reply.body.data.verified, true);
  assert.equal(await peekStepUpChallenge(redis, challengeId), null, 'challenge must be consumed');
  assert.equal(db.inserted.authSessions, 1, 'a fresh session must be issued');
  assert.ok(db.inserted.auditLogs.some((entry) => entry.sql.includes('admin.step_up_verified')));
});

test('verifyAdminStepUp accepts a correct recovery code and consumes it', async () => {
  const admin = {
    id: 8, email: 'admin2@example.com', username: 'admin2', role: 'admin', status: 'active',
    is_verified: true, session_version: 1, mfa_required: true,
    mfa_enrolled_at: new Date().toISOString(),
  };
  const plainRecoveryCode = 'ABCDEF123456';
  const recoveryCodes = [{ id: 1, code_hash: await hashPassword(plainRecoveryCode), used_at: null }];
  const redis = createFakeRedis();
  const db = createFakeDb(admin, recoveryCodes);
  const challengeId = await createStepUpChallenge(redis, admin.id);
  const reply = createReply();
  const request = buildRequest({ redis, db }, { challengeId, recoveryCode: plainRecoveryCode });

  await verifyAdminStepUp(request, reply);

  assert.equal(reply.statusCode, 200);
  assert.equal(recoveryCodes[0].used_at !== null, true, 'recovery code must be marked used');
});

test('verifyAdminStepUp rejects a wrong TOTP code without consuming the challenge', async () => {
  const secret = generateTotpSecret();
  const admin = {
    id: 9, email: 'admin3@example.com', username: 'admin3', role: 'admin', status: 'active',
    is_verified: true, mfa_required: true, mfa_enrolled_at: new Date().toISOString(),
    mfa_totp_secret_encrypted: encryptMfaSecret(secret),
  };
  const redis = createFakeRedis();
  const db = createFakeDb(admin);
  const challengeId = await createStepUpChallenge(redis, admin.id);
  const reply = createReply();
  const request = buildRequest({ redis, db }, { challengeId, code: '000000' });

  await verifyAdminStepUp(request, reply);

  assert.equal(reply.statusCode, 401);
  assert.equal(await peekStepUpChallenge(redis, challengeId), admin.id, 'wrong code must not burn the challenge');
  assert.ok(db.inserted.auditLogs.some((entry) => entry.sql.includes('admin.step_up_failed')));
});

test('verifyAdminStepUp rejects an expired or unknown challenge', async () => {
  const redis = createFakeRedis();
  const db = createFakeDb({ id: 1 });
  const reply = createReply();
  const request = buildRequest({ redis, db }, { challengeId: 'does-not-exist', code: '123456' });

  await verifyAdminStepUp(request, reply);

  assert.equal(reply.statusCode, 401);
  assert.equal(reply.body.error, 'Invalid or expired verification challenge');
});

test('verifyAdminStepUp enforces the attempts cap', async () => {
  const secret = generateTotpSecret();
  const admin = {
    id: 10, email: 'admin4@example.com', username: 'admin4', role: 'admin', status: 'active',
    is_verified: true, mfa_required: true, mfa_enrolled_at: new Date().toISOString(),
    mfa_totp_secret_encrypted: encryptMfaSecret(secret),
  };
  const redis = createFakeRedis();
  const db = createFakeDb(admin);
  const challengeId = await createStepUpChallenge(redis, admin.id);

  for (let i = 0; i < STEP_UP_MAX_ATTEMPTS; i++) {
    const reply = createReply();
    await verifyAdminStepUp(buildRequest({ redis, db }, { challengeId, code: '000000' }), reply);
    assert.equal(reply.statusCode, 401);
  }

  const finalReply = createReply();
  await verifyAdminStepUp(buildRequest({ redis, db }, { challengeId, code: generateTotpCode(secret) }), finalReply);
  assert.equal(finalReply.statusCode, 429);
});

test('verifyAdminStepUp requires exactly one of code or recoveryCode', async () => {
  const redis = createFakeRedis();
  const db = createFakeDb({ id: 1 });
  const challengeId = await createStepUpChallenge(redis, 1);

  const neither = createReply();
  await verifyAdminStepUp(buildRequest({ redis, db }, { challengeId }), neither);
  assert.equal(neither.statusCode, 400);

  const both = createReply();
  await verifyAdminStepUp(buildRequest({ redis, db }, { challengeId, code: '123456', recoveryCode: 'ABCDEF123456' }), both);
  assert.equal(both.statusCode, 400);
});
