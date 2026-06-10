-- 013_prediction_settlement.sql
-- Adds the columns needed to automatically settle predictions against real
-- match results, so leaderboards and win-rate stats stop showing 0%.
--
--   fixture_id  — API-Football fixture id the prediction is tied to (nullable;
--                 predictions created from a real fixture page carry this, free-text
--                 admin predictions don't and are settled manually).
--   settled_at  — when the prediction was graded (won/lost/void).
--   result      — snapshot of the final score / grading inputs for auditing.

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS fixture_id INTEGER,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result     JSONB;

-- Sweep targets open predictions that carry a fixture id and whose kickoff
-- has passed, so this partial index keeps that query cheap.
CREATE INDEX IF NOT EXISTS idx_predictions_settlement
  ON predictions (fixture_id)
  WHERE status = 'open' AND fixture_id IS NOT NULL;
