-- ── Feature flags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id            SERIAL PRIMARY KEY,
  key           VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  required_plan VARCHAR(50) NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Default flags
INSERT INTO feature_flags (key, name, description, required_plan) VALUES
  ('hot_codes_full',      'Full Hot Codes',             'All hot booking codes beyond the first free one',    'pro'),
  ('picks_unlimited',     'Unlimited Daily Picks',      'All daily picks beyond the first 2 free ones',       'pro'),
  ('h2h_analyser',        'H2H Analyser',               'Head-to-head team comparison tool',                  'pro'),
  ('predictions_full',    'Full Predictions',           'Complete prediction details, odds, and confidence',   'pro'),
  ('live_ai',             'Live AI Insights',           'Real-time AI match analysis and recommendations',    'enterprise'),
  ('advanced_stats',      'Advanced Statistics',        'Detailed match, player, and referee statistics',     'pro'),
  ('creator_program',     'Creator Program',            'Apply to become a verified creator and earn',        'pro'),
  ('booking_codes_copy',  'Booking Code Copy',          'Copy booking codes from other users',                'free'),
  ('forum_post',          'Forum Posting',              'Create threads and comments in the forum',           'free'),
  ('referee_search',      'Referee Search',             'Full referee stats and recent fixtures',             'free')
ON CONFLICT (key) DO NOTHING;
