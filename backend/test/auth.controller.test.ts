import test from 'node:test';
import assert from 'node:assert/strict';

import { login } from '../src/features/auth/controllers/auth.controller.js';
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

test('login rejects suspended accounts even with valid credentials', async () => {
  const password = 'correct-password';
  const hashed = await hashPassword(password);
  const reply = createReply();
  const request = {
    body: { email: 'user@example.com', password },
    log: { error() {} },
    server: {
      db: {
        async query() {
          return {
            rows: [{
              id: 7,
              email: 'user@example.com',
              username: 'user',
              password: hashed,
              role: 'user',
              is_verified: true,
              status: 'suspended',
            }],
          };
        },
      },
      jwt: {
        sign() {
          return 'token';
        },
      },
      redis: {
        async get() { return null; },
        multi() {
          return {
            incr() { return this; },
            expire() { return this; },
            async exec() { return []; },
          };
        },
        async del() {},
      },
    },
  };

  await login(request, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { error: 'Account is suspended' });
});
