CREATE TABLE IF NOT EXISTS creator_follows (
  id          SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_follows_creator  ON creator_follows(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_follower ON creator_follows(follower_id);
