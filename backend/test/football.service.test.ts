import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeGameScore } from '../src/modules/football/football.service.js';

test('normalizeGameScore extracts primitive and nested totals', () => {
  assert.equal(normalizeGameScore(4), 4);
  assert.equal(normalizeGameScore('12'), 12);
  assert.equal(normalizeGameScore({ total: 7, innings: { 1: 2 } }), 7);
});

test('normalizeGameScore ignores missing or non-numeric score objects', () => {
  assert.equal(normalizeGameScore(null), null);
  assert.equal(normalizeGameScore(undefined), null);
  assert.equal(normalizeGameScore({ total: null, innings: { 1: null } }), null);
  assert.equal(normalizeGameScore({ hits: 4, errors: 1 }), null);
});
