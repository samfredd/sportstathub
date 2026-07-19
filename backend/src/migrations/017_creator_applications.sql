CREATE TABLE IF NOT EXISTS creator_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  terms_version VARCHAR(40) NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  statement TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_application_pending
  ON creator_applications(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_creator_applications_review
  ON creator_applications(status, submitted_at);
