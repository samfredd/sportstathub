CREATE TABLE IF NOT EXISTS runtime_settings (
  key VARCHAR(120) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO runtime_settings(key,value,description) VALUES
 ('ai.daily_user_limit','30','Maximum AI generations per user per UTC day'),
 ('ai.daily_ip_limit','60','Maximum AI generations per IP per UTC day'),
 ('ai.concurrency_limit','10','Maximum AI generations concurrently handled by one API instance'),
 ('ai.predict_max_output_tokens','300','Maximum output tokens for free-text predictions'),
 ('ai.match_max_output_tokens','350','Maximum output tokens for fixture predictions')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  request_id VARCHAR(120),
  endpoint VARCHAR(80) NOT NULL,
  model VARCHAR(160) NOT NULL,
  input_characters INTEGER NOT NULL DEFAULT 0,
  output_characters INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_time ON ai_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_time ON ai_usage_events(user_id,created_at DESC);
