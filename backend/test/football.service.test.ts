import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeGameScore,
  normalizeExpectedGoalValue,
  normalizePredictionPercentages,
  sanitizePredictionResponse,
} from '../src/modules/football/football.service.js';

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

test('normalizeExpectedGoalValue clamps impossible negative expected goals', () => {
  assert.equal(normalizeExpectedGoalValue('-2.5'), '0');
  assert.equal(normalizeExpectedGoalValue(-1.5), '0');
  assert.equal(normalizeExpectedGoalValue('2.45'), '2.5');
  assert.equal(normalizeExpectedGoalValue('Over 2.5'), 'Over 2.5');
});

test('normalizePredictionPercentages returns a 100 percent outcome set', () => {
  const percent = normalizePredictionPercentages({ home: '0.14%', draw: '21%', away: '92%' });
  const total = ['home', 'draw', 'away']
    .map(key => Number(percent[key].replace('%', '')))
    .reduce((sum, value) => sum + value, 0);

  assert.equal(total, 100);
  assert.deepEqual(Object.keys(percent), ['home', 'draw', 'away']);
});

test('sanitizePredictionResponse cleans goals and probabilities without dropping fields', () => {
  const [item] = sanitizePredictionResponse([
    {
      predictions: {
        winner: { name: 'Home FC' },
        goals: { home: '-2.5', away: '1.8' },
        percent: { home: '50%', draw: '25%', away: '50%' },
        advice: 'Home FC or draw',
      },
    },
  ]);

  assert.equal(item.predictions.goals.home, '0');
  assert.equal(item.predictions.goals.away, '1.8');
  assert.equal(item.predictions.winner.name, 'Home FC');

  const total = ['home', 'draw', 'away']
    .map(key => Number(item.predictions.percent[key].replace('%', '')))
    .reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);
});
