ALTER TABLE subscription_plans
  ALTER COLUMN currency SET DEFAULT 'USD';

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
ON CONFLICT (slug) DO UPDATE
SET currency = 'USD',
    updated_at = NOW()
WHERE subscription_plans.currency <> 'USD';

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id   INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider          VARCHAR(40) NOT NULL DEFAULT 'paystack',
  reference         VARCHAR(120) NOT NULL UNIQUE,
  plan              VARCHAR(50) NOT NULL,
  billing_interval  VARCHAR(20) NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  authorization_url TEXT,
  access_code       TEXT,
  provider_payload  JSONB NOT NULL DEFAULT '{}',
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);

DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
