-- Complete user notification coverage with mentions and saved-match reminders.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS mentions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS saved_match_starts BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS saved_matches (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fixture_id VARCHAR(80) NOT NULL,
  sport VARCHAR(40) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  home_team VARCHAR(140) NOT NULL,
  away_team VARCHAR(140) NOT NULL,
  league VARCHAR(140),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,sport,fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_matches_reminders
  ON saved_matches(starts_at,id) WHERE notified_at IS NULL;
