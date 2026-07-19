ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS match_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

UPDATE predictions SET
  match_start_at = CASE WHEN (match_data->>'date') ~ '^\d{4}-\d{2}-\d{2}T'
    THEN (match_data->>'date')::timestamptz ELSE NULL END,
  lock_at = CASE WHEN (match_data->>'date') ~ '^\d{4}-\d{2}-\d{2}T'
    THEN (match_data->>'date')::timestamptz ELSE created_at END
WHERE match_start_at IS NULL;

CREATE TABLE IF NOT EXISTS prediction_versions (
  id BIGSERIAL PRIMARY KEY,
  prediction_id INTEGER NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  editor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  edit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prediction_id, version_number)
);

CREATE OR REPLACE FUNCTION protect_locked_prediction() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lock_at IS NOT NULL AND NOW() >= OLD.lock_at AND (
    NEW.sport IS DISTINCT FROM OLD.sport OR NEW.league IS DISTINCT FROM OLD.league OR
    NEW.match_data IS DISTINCT FROM OLD.match_data OR NEW.prediction IS DISTINCT FROM OLD.prediction OR
    NEW.booking_code IS DISTINCT FROM OLD.booking_code OR NEW.tags IS DISTINCT FROM OLD.tags OR
    NEW.is_premium IS DISTINCT FROM OLD.is_premium OR NEW.fixture_id IS DISTINCT FROM OLD.fixture_id
  ) THEN
    RAISE EXCEPTION 'Prediction content is immutable after lock time' USING ERRCODE='23514';
  END IF;
  IF NEW.sport IS DISTINCT FROM OLD.sport OR NEW.league IS DISTINCT FROM OLD.league OR
     NEW.match_data IS DISTINCT FROM OLD.match_data OR NEW.prediction IS DISTINCT FROM OLD.prediction OR
     NEW.booking_code IS DISTINCT FROM OLD.booking_code OR NEW.tags IS DISTINCT FROM OLD.tags THEN
    INSERT INTO prediction_versions(prediction_id,version_number,snapshot)
    VALUES (OLD.id, COALESCE((SELECT MAX(version_number)+1 FROM prediction_versions WHERE prediction_id=OLD.id),1), to_jsonb(OLD));
    NEW.last_edited_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prediction_lock ON predictions;
CREATE TRIGGER trg_prediction_lock BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION protect_locked_prediction();
