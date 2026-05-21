import test from 'node:test';
import assert from 'node:assert/strict';

import { generateOTP } from '../src/modules/auth/auth.helpers.js';

test('generateOTP returns a six-digit numeric verification code by default', () => {
  const otp = generateOTP();

  assert.match(otp, /^\d{6}$/);
});

test('generateOTP honors an explicit numeric code length', () => {
  const otp = generateOTP(4);

  assert.match(otp, /^\d{4}$/);
});
