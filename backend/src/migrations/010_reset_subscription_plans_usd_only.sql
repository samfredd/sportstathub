CREATE TABLE IF NOT EXISTS app_migration_flags (
  key        TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_migration_flags WHERE key = 'subscription_plans_usd_reset_20260521'
  ) THEN
    DELETE FROM subscription_plans;

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
      );

    INSERT INTO app_migration_flags (key)
    VALUES ('subscription_plans_usd_reset_20260521');
  END IF;
END $$;

UPDATE subscription_plans
SET currency = 'USD',
    updated_at = NOW()
WHERE currency <> 'USD';

ALTER TABLE subscription_plans
  ALTER COLUMN currency SET DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_currency_usd'
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT subscription_plans_currency_usd CHECK (currency = 'USD');
  END IF;
END $$;
