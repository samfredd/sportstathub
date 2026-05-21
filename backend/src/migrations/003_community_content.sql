-- ============================================================
-- Creator predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sport         VARCHAR(50)  NOT NULL DEFAULT 'Football',
  league        JSONB        NOT NULL,
  match_data    JSONB        NOT NULL,
  prediction    JSONB        NOT NULL,
  booking_code  JSONB,
  status        VARCHAR(20)  NOT NULL DEFAULT 'open',
  stats         JSONB        NOT NULL DEFAULT '{"likes":0,"comments":0,"views":0,"shares":0}'::jsonb,
  tags          TEXT[]       NOT NULL DEFAULT '{}',
  is_trending   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_premium    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_user    ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_sport   ON predictions(sport);
CREATE INDEX IF NOT EXISTS idx_predictions_status  ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);

DROP TRIGGER IF EXISTS trg_predictions_updated_at ON predictions;
CREATE TRIGGER trg_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Forum threads and comments
-- ============================================================
CREATE TABLE IF NOT EXISTS forum_threads (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category      VARCHAR(100) NOT NULL,
  title         VARCHAR(160) NOT NULL,
  content       TEXT         NOT NULL,
  tags          TEXT[]       NOT NULL DEFAULT '{}',
  is_pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
  stats         JSONB        NOT NULL DEFAULT '{"replies":0,"views":0,"likes":0}'::jsonb,
  last_reply_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category);
CREATE INDEX IF NOT EXISTS idx_forum_threads_latest   ON forum_threads(last_reply_at DESC);

DROP TRIGGER IF EXISTS trg_forum_threads_updated_at ON forum_threads;
CREATE TRIGGER trg_forum_threads_updated_at
  BEFORE UPDATE ON forum_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  target_type VARCHAR(20) NOT NULL,
  target_id   VARCHAR(64) NOT NULL,
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author      JSONB,
  content     TEXT        NOT NULL,
  likes       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ============================================================
-- Affiliate / analytics events
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id            SERIAL PRIMARY KEY,
  tracking_id   VARCHAR(120),
  event_name    VARCHAR(80) NOT NULL,
  bookmaker     VARCHAR(100),
  code          VARCHAR(100),
  affiliate_url TEXT,
  prediction_id VARCHAR(64),
  creator_id    VARCHAR(64),
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking ON tracking_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created  ON tracking_events(created_at DESC);
