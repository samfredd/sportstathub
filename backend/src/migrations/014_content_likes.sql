-- Per-user like tracking. Replaces the bare counter increments that allowed
-- one visitor to like the same content an unlimited number of times.
-- The jsonb/int counters on predictions/forum_threads/comments remain the
-- denormalized display value; this table is the source of truth for "has
-- this user liked this content", enabling like/unlike toggle semantics.

CREATE TABLE IF NOT EXISTS content_likes (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('prediction', 'thread', 'comment')),
  content_id   INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_likes_content
  ON content_likes(content_type, content_id);
