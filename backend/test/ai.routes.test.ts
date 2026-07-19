import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMatchup, normalizeAiSport, resolveAiCacheTtl, resolveOddsSportKey } from '../src/modules/ai/ai.routes.js';

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

test('resolveAiCacheTtl varies by live, imminent, future, and finished match status', () => {
  const now = Date.parse('2026-07-19T12:00:00Z');
  const fixture = (short: string, date: string) => ({ fixture: { status: { short }, date } });
  assert.equal(resolveAiCacheTtl(fixture('1H', '2026-07-19T12:30:00Z'), now), 45);
  assert.equal(resolveAiCacheTtl(fixture('NS', '2026-07-19T13:00:00Z'), now), 120);
  assert.equal(resolveAiCacheTtl(fixture('NS', '2026-07-20T00:00:00Z'), now), 600);
  assert.equal(resolveAiCacheTtl(fixture('NS', '2026-07-23T12:00:00Z'), now), 3600);
  assert.equal(resolveAiCacheTtl(fixture('FT', '2026-07-18T12:00:00Z'), now), 604800);
});
