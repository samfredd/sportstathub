import test from 'node:test';
import assert from 'node:assert/strict';

import { createCodesService, normalizeBookingCodeInput } from '../src/modules/codes/codes.service.js';

test('normalizeBookingCodeInput trims, uppercases, and validates codes', () => {
  assert.equal(normalizeBookingCodeInput(' sth-safe_25 '), 'STH-SAFE_25');
  assert.throws(() => normalizeBookingCodeInput('abc'), /at least 4/);
  assert.throws(() => normalizeBookingCodeInput('bad code'), /letters, numbers/);
});

test('convertCode rejects unsupported or identical bookmakers with useful messages', async () => {
  const service = createCodesService({
    findAll: async () => [],
    count: async () => 0,
  });

  await assert.rejects(
    service.convertCode({ code: 'STH123', fromBookmaker: 'Bet9ja', toBookmaker: 'Bet9ja' }),
    (err: any) => err.statusCode === 422 && /different bookmakers/.test(err.message)
  );

  await assert.rejects(
    service.convertCode({ code: 'STH123', fromBookmaker: 'Unknown', toBookmaker: 'Bet9ja' }),
    (err: any) => err.statusCode === 422 && /only supports/.test(err.message)
  );
});
