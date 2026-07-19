import test from 'node:test';
import assert from 'node:assert/strict';

import { resetPassword } from '../src/features/auth/controllers/auth.controller.js';
import { hashPassword } from '../src/modules/auth/auth.helpers.js';

function createReply() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

// Minimal in-memory Redis stand-in with real NX-set semantics — good enough
// to prove the lock actually serializes concurrent callers without spinning
// up a real Redis instance.
function createFakeRedis() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, ...args) {
      const nx = args.includes('NX');
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async setex(key, _ttl, value) {
      store.set(key, value);
    },
    async incr(key) {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async del(...keys) {
      for (const key of keys) store.delete(key);
    },
  };
}

function createFakeDb(users) {
  const sessions = { revokedUserIds: [] };
  return {
    sessions,
    async transact(fn) {
      const client = {
        async query(sql, params) {
          if (sql.startsWith('UPDATE users SET password')) {
            const [, email] = params;
            const user = users.find((u) => u.email === email);
            if (!user) return { rows: [], rowCount: 0 };
            user.password = params[0];
            return { rows: [{ id: user.id }], rowCount: 1 };
          }
          if (sql.startsWith('UPDATE users SET session_version')) {
            const [userId] = params;
            sessions.revokedUserIds.push(userId);
            return { rows: [], rowCount: 1 };
          }
          if (sql.startsWith('UPDATE auth_sessions SET revoked_at')) {
            return { rows: [], rowCount: 0 };
          }
          throw new Error(`Unexpected query in test: ${sql}`);
        },
      };
      return fn(client);
    },
  };
}

async function buildRequest({ redis, db, email, otp, password }) {
  return {
    body: { email, otp, password },
    log: { error() {} },
    server: { redis, db },
  };
}

test('resetPassword allows exactly one of two concurrent requests with the same valid OTP to succeed', async () => {
  const redis = createFakeRedis();
  const email = 'user@example.com';
  const otpHash = await hashPassword('123456');
  redis.store.set(`password_reset:${email}`, otpHash);
  redis.store.set(`password_reset_attempts:${email}`, '0');

  const users = [{ id: 42, email, password: 'old-hash' }];
  const db = createFakeDb(users);

  const replyA = createReply();
  const replyB = createReply();
  const requestA = await buildRequest({ redis, db, email, otp: '123456', password: 'new-password-a' });
  const requestB = await buildRequest({ redis, db, email, otp: '123456', password: 'new-password-b' });

  await Promise.all([resetPassword(requestA, replyA), resetPassword(requestB, replyB)]);

  const results = [replyA, replyB];
  const succeeded = results.filter((r) => r.statusCode === 200);
  const rejected = results.filter((r) => r.statusCode === 400);

  assert.equal(succeeded.length, 1, 'exactly one concurrent request should succeed');
  assert.equal(rejected.length, 1, 'the other should be rejected, not silently ignored');
  assert.equal(rejected[0].body.error, 'Reset code expired or invalid');
  assert.equal(db.sessions.revokedUserIds.length, 1, 'sessions must be revoked exactly once, not twice');
  // Redis key must be gone after the winning request — no replay possible.
  assert.equal(redis.store.has(`password_reset:${email}`), false);
});

test('resetPassword rejects an invalid OTP without consuming the challenge', async () => {
  const redis = createFakeRedis();
  const email = 'user@example.com';
  const otpHash = await hashPassword('123456');
  redis.store.set(`password_reset:${email}`, otpHash);
  redis.store.set(`password_reset_attempts:${email}`, '0');

  const users = [{ id: 42, email, password: 'old-hash' }];
  const db = createFakeDb(users);
  const reply = createReply();
  const request = await buildRequest({ redis, db, email, otp: '000000', password: 'new-password' });

  await resetPassword(request, reply);

  assert.equal(reply.statusCode, 400);
  assert.equal(reply.body.error, 'Invalid reset code');
  assert.equal(redis.store.has(`password_reset:${email}`), true, 'a wrong guess must not burn the challenge');
  assert.equal(db.sessions.revokedUserIds.length, 0);
});

test('resetPassword enforces the max-attempts cap', async () => {
  const redis = createFakeRedis();
  const email = 'user@example.com';
  const otpHash = await hashPassword('123456');
  redis.store.set(`password_reset:${email}`, otpHash);
  redis.store.set(`password_reset_attempts:${email}`, '5');

  const users = [{ id: 42, email, password: 'old-hash' }];
  const db = createFakeDb(users);
  const reply = createReply();
  const request = await buildRequest({ redis, db, email, otp: '123456', password: 'new-password' });

  await resetPassword(request, reply);

  assert.equal(reply.statusCode, 429);
  assert.equal(reply.body.error, 'Too many attempts');
});

test('resetPassword returns generic error for unknown email without a DB match', async () => {
  const redis = createFakeRedis();
  const email = 'ghost@example.com';
  const otpHash = await hashPassword('123456');
  redis.store.set(`password_reset:${email}`, otpHash);
  redis.store.set(`password_reset_attempts:${email}`, '0');

  const db = createFakeDb([]); // no matching user row
  const reply = createReply();
  const request = await buildRequest({ redis, db, email, otp: '123456', password: 'new-password' });

  await resetPassword(request, reply);

  assert.equal(reply.statusCode, 400);
  assert.equal(reply.body.error, 'Invalid request');
});
