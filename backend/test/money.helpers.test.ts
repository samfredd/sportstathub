import test from 'node:test';
import assert from 'node:assert/strict';

import { hasMinorUnitsValue, minorUnitsToDecimal, parseMoneyToMinorUnits } from '../src/helpers/money.helpers.js';

test('parseMoneyToMinorUnits converts exact 2-decimal amounts', () => {
  assert.equal(parseMoneyToMinorUnits(9.99), 999);
  assert.equal(parseMoneyToMinorUnits(0), 0);
  assert.equal(parseMoneyToMinorUnits(29.99), 2999);
  assert.equal(parseMoneyToMinorUnits(100), 10000);
});

test('parseMoneyToMinorUnits rejects more than 2 decimal places', () => {
  assert.throws(() => parseMoneyToMinorUnits(9.999), (err: any) => err.statusCode === 400);
  assert.throws(() => parseMoneyToMinorUnits(0.001), (err: any) => err.statusCode === 400);
});

test('parseMoneyToMinorUnits rejects negative or non-finite amounts', () => {
  assert.throws(() => parseMoneyToMinorUnits(-1), (err: any) => err.statusCode === 400);
  assert.throws(() => parseMoneyToMinorUnits(NaN), (err: any) => err.statusCode === 400);
  assert.throws(() => parseMoneyToMinorUnits('not-a-number'), (err: any) => err.statusCode === 400);
});

test('minorUnitsToDecimal round-trips with parseMoneyToMinorUnits', () => {
  assert.equal(minorUnitsToDecimal(parseMoneyToMinorUnits(9.99)), 9.99);
  assert.equal(minorUnitsToDecimal(499900), 4999);
  assert.equal(minorUnitsToDecimal(null), 0);
});

test('hasMinorUnitsValue distinguishes a genuine zero from a missing value', () => {
  assert.equal(hasMinorUnitsValue(0), true);
  assert.equal(hasMinorUnitsValue(999), true);
  assert.equal(hasMinorUnitsValue(null), false);
  assert.equal(hasMinorUnitsValue(undefined), false);
});
