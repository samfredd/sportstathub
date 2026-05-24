import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMatchup, normalizeAiSport, resolveOddsSportKey } from '../src/modules/ai/ai.routes.js';

test('normalizeAiSport maps visible labels to supported API sport ids', () => {
  assert.equal(normalizeAiSport('Football'), 'football');
  assert.equal(normalizeAiSport('basketball'), 'basketball');
  assert.equal(normalizeAiSport('Volleyball'), 'volleyball');
});

test('normalizeAiSport returns null for unsupported sports', () => {
  assert.equal(normalizeAiSport('Tennis'), null);
  assert.equal(normalizeAiSport('Cricket'), null);
});

test('extractMatchup parses common team-vs-team prompts', () => {
  assert.deepEqual(extractMatchup('Arsenal vs Chelsea, Premier League — who wins?'), {
    homeName: 'Arsenal',
    awayName: 'Chelsea',
  });
  assert.deepEqual(extractMatchup('Lakers versus Celtics prediction'), {
    homeName: 'Lakers',
    awayName: 'Celtics',
  });
});

test('resolveOddsSportKey maps supported AI sports to default odds API sports', () => {
  assert.equal(resolveOddsSportKey('football'), 'soccer_epl');
  assert.equal(resolveOddsSportKey('basketball'), 'basketball_nba');
  assert.equal(resolveOddsSportKey('volleyball'), null);
});
