/**
 * Settlement service — grades open predictions against real match results.
 *
 * Grading is intentionally conservative: a prediction is only auto-settled when
 * exactly one market can be parsed from its tip text AND the fixture has finished.
 * Anything ambiguous (combos, exotic markets, free-text) is left `open` for an
 * admin to settle manually via the existing admin endpoint.
 */

export type Grade = 'won' | 'lost' | 'void';

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const VOIDED = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'WO', 'AWD']);

function tipText(prediction: any): string {
  const raw = prediction?.type ?? prediction?.tip ?? prediction?.pick ?? '';
  return String(raw).toLowerCase().trim();
}

// ── Pure graders ─────────────────────────────────────────────────────────────
// Each returns a Grade if it recognises and can grade the tip, else null.

export function gradeOneX2(tip: string, home: number, away: number): Grade | null {
  // Match clear 1X2 phrasings. Avoid matching "both teams" / double chance here.
  const isHome = /\bhome win\b/.test(tip) || /^home$/.test(tip) || /\bwin(?:s)?\b.*\bhome\b/.test(tip) || tip === '1';
  const isAway = /\baway win\b/.test(tip) || /^away$/.test(tip) || /\bwin(?:s)?\b.*\baway\b/.test(tip) || tip === '2';
  const isDraw = /\bdraw\b/.test(tip) || tip === 'x';
  const hits = [isHome, isAway, isDraw].filter(Boolean).length;
  if (hits !== 1) return null;
  if (isHome) return home > away ? 'won' : 'lost';
  if (isAway) return away > home ? 'won' : 'lost';
  return home === away ? 'won' : 'lost';
}

export function gradeDoubleChance(tip: string, home: number, away: number): Grade | null {
  if (/\b(home or draw|1x|draw or home)\b/.test(tip)) return home >= away ? 'won' : 'lost';
  if (/\b(away or draw|x2|draw or away)\b/.test(tip)) return away >= home ? 'won' : 'lost';
  if (/\b(home or away|12)\b/.test(tip)) return home !== away ? 'won' : 'lost';
  return null;
}

export function gradeOverUnder(tip: string, home: number, away: number): Grade | null {
  const m = tip.match(/\b(over|under)\b\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const total = home + away;
  const line = Number(m[2]);
  if (total === line) return 'void'; // exact push (whole-number lines)
  if (m[1] === 'over') return total > line ? 'won' : 'lost';
  return total < line ? 'won' : 'lost';
}

export function gradeBtts(tip: string, home: number, away: number): Grade | null {
  if (!/\b(btts|both teams? to score)\b/.test(tip)) return null;
  const both = home > 0 && away > 0;
  const isNo = /\bno\b/.test(tip);
  return (isNo ? !both : both) ? 'won' : 'lost';
}

/**
 * Grade a prediction against a finished fixture.
 * Returns a Grade, or null when the tip can't be confidently graded.
 */
export function gradePrediction(prediction: any, fixture: any): Grade | null {
  const statusShort = fixture?.fixture?.status?.short ?? '';
  if (VOIDED.has(statusShort)) return 'void';
  if (!FINISHED.has(statusShort)) return null; // not finished yet → stay open

  const home = fixture?.goals?.home;
  const away = fixture?.goals?.away;
  if (typeof home !== 'number' || typeof away !== 'number') return null;

  const tip = tipText(prediction);
  if (!tip) return null;

  // Collect results from every grader; only auto-settle on a single unambiguous match.
  const results = [
    gradeOverUnder(tip, home, away),
    gradeBtts(tip, home, away),
    gradeDoubleChance(tip, home, away),
    gradeOneX2(tip, home, away),
  ].filter((g): g is Grade => g !== null);

  return results.length === 1 ? results[0] : null;
}

// ── Runner ───────────────────────────────────────────────────────────────────

const MAX_PER_RUN = 25; // cap external API calls per sweep (football free tier)

export function createSettlementService({ db, footballService, log }: any) {
  async function settleOpenPredictions() {
    const { rows } = await db.query(
      `SELECT id, sport, prediction, fixture_id
       FROM predictions
       WHERE status = 'open' AND fixture_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [MAX_PER_RUN]
    );

    let settled = 0;
    for (const row of rows) {
      try {
        const sport = String(row.sport ?? 'football').toLowerCase();
        const fixture = await footballService.getMatchById(row.fixture_id, sport);
        if (!fixture) continue;

        const grade = gradePrediction(row.prediction, fixture);
        if (!grade) continue;

        const result = {
          gradedAt: new Date().toISOString(),
          fixtureId: row.fixture_id,
          score: { home: fixture?.goals?.home ?? null, away: fixture?.goals?.away ?? null },
          statusShort: fixture?.fixture?.status?.short ?? null,
        };

        const upd = await db.query(
          `UPDATE predictions
           SET status = $2, settled_at = NOW(), result = $3::jsonb
           WHERE id = $1 AND status = 'open'`,
          [row.id, grade, JSON.stringify(result)]
        );
        if (upd.rowCount > 0) settled++;
      } catch (err: any) {
        log?.warn?.({ err: err?.message, predictionId: row.id }, 'settlement: failed to grade prediction');
      }
    }

    if (settled > 0) log?.info?.({ settled, scanned: rows.length }, 'settlement: predictions settled');
    return { scanned: rows.length, settled };
  }

  return { settleOpenPredictions };
}
