-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(32)  UNIQUE NOT NULL,
  email           VARCHAR(254) UNIQUE NOT NULL,
  password        TEXT,                                    -- NULL for OAuth-only users
  role            VARCHAR(20)  NOT NULL DEFAULT 'user',
  is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  google_id       VARCHAR(255) UNIQUE,
  avatar_url      TEXT,
  oauth_provider  VARCHAR(32),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Booking codes
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_codes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  code        VARCHAR(100) NOT NULL,
  bookmaker   VARCHAR(100) NOT NULL,
  description TEXT,
  total_odds  DECIMAL(10, 2),
  stake_type  VARCHAR(50),
  category    VARCHAR(50),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codes_bookmaker ON booking_codes(bookmaker);
CREATE INDEX IF NOT EXISTS idx_codes_created   ON booking_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codes_active    ON booking_codes(is_active) WHERE is_active = TRUE;
