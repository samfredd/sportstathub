-- Forum safety, appeals, user controls, and in-app notification delivery.
ALTER TABLE forum_threads
  ADD COLUMN IF NOT EXISTS visibility_status VARCHAR(20) NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS visibility_status VARCHAR(20) NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS content_revisions (
  id BIGSERIAL PRIMARY KEY,
  content_type VARCHAR(20) NOT NULL CHECK(content_type IN ('thread','comment')),
  content_id INTEGER NOT NULL,
  editor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  previous_title TEXT,
  previous_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK(content_type IN ('thread','comment')),
  content_id INTEGER NOT NULL,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(reporter_id,content_type,content_id)
);

CREATE TABLE IF NOT EXISTS user_relationships (
  actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type VARCHAR(10) NOT NULL CHECK(relationship_type IN ('block','mute')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(actor_user_id,target_user_id,relationship_type),
  CHECK(actor_user_id <> target_user_id)
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id BIGSERIAL PRIMARY KEY,
  moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  report_id BIGINT REFERENCES content_reports(id) ON DELETE SET NULL,
  content_type VARCHAR(20) NOT NULL,
  content_id INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL CHECK(action IN ('hide','remove','restore','dismiss','warn')),
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id BIGSERIAL PRIMARY KEY,
  action_id BIGINT NOT NULL REFERENCES moderation_actions(id) ON DELETE CASCADE,
  appellant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','upheld','overturned')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(action_id,appellant_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  replies BOOLEAN NOT NULL DEFAULT TRUE,
  follows BOOLEAN NOT NULL DEFAULT TRUE,
  prediction_results BOOLEAN NOT NULL DEFAULT TRUE,
  billing BOOLEAN NOT NULL DEFAULT TRUE,
  security BOOLEAN NOT NULL DEFAULT TRUE,
  moderation BOOLEAN NOT NULL DEFAULT TRUE,
  email_digest VARCHAR(10) NOT NULL DEFAULT 'off' CHECK(email_digest IN ('off','daily','weekly')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  dedupe_key VARCHAR(180),
  metadata JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_reports_queue ON content_reports(status,created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_content ON moderation_actions(content_type,content_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id,read_at,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON user_relationships(target_user_id,relationship_type);
