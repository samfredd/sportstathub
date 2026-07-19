import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSecret,
  verifyTotp,
} from '../src/modules/auth/mfa.service.js';
import { comparePasswords } from '../src/modules/auth/auth.helpers.js';

test('TOTP secrets are encrypted at rest and valid codes tolerate one time step', () => {
  const secret = generateTotpSecret();
  const encrypted = encryptMfaSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptMfaSecret(encrypted), secret);
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.equal(verifyTotp(secret, generateTotpCode(secret, now), now), true);
  assert.equal(verifyTotp(secret, '00000x', now), false);
});

test('administrator recovery codes are random and stored only as password hashes', async () => {
  const recovery = await generateRecoveryCodes();
  assert.equal(recovery.plain.length, 10);
  assert.equal(new Set(recovery.plain).size, 10);
  assert.equal(await comparePasswords(recovery.plain[0], recovery.hashes[0]), true);
  assert.equal(recovery.hashes.includes(recovery.plain[0]), false);
});
