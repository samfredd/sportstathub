CREATE TABLE IF NOT EXISTS subscription_plans (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(50)   NOT NULL UNIQUE,
  display_name  VARCHAR(100)  NOT NULL,
  description   TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly  NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(10)   NOT NULL DEFAULT 'USD',
  features      JSONB         NOT NULL DEFAULT '[]',
  limits        JSONB         NOT NULL DEFAULT '{}',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  is_popular    BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO subscription_plans
  (slug, display_name, description, price_monthly, price_yearly, currency, features, limits, is_active, is_popular, sort_order)
VALUES
  (
    'free', 'Free', 'Get started with basic features',
    0, 0, 'USD',
    '["View all public tips","Basic forum access","5 code copies per day","Match scores & stats"]',
    '{"code_copies_per_day": 5}',
    true, false, 0
  ),
  (
    'pro', 'Pro', 'Everything you need to win more',
    9.99, 99.99, 'USD',
    '["Unlimited code copies","AI match predictions","Full forum access","Follow creators","Priority support","Advanced stats"]',
    '{"code_copies_per_day": 9999}',
    true, true, 1
  ),
  (
    'enterprise', 'Enterprise', 'For serious bettors and syndicates',
    29.99, 299.99, 'USD',
    '["All Pro features","Dedicated account manager","Custom odds alerts","API access","White-label tips","Bulk analytics"]',
    '{"code_copies_per_day": 9999}',
    true, false, 2
  )
ON CONFLICT (slug) DO NOTHING;
