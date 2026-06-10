-- 012_plans_ngn.sql
-- Paystack test accounts (and most Nigerian merchant accounts) operate in NGN.
-- Drop the USD-only constraint and reprice plans in Naira.

ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_currency_usd;

ALTER TABLE subscription_plans
  ALTER COLUMN currency DROP DEFAULT;

UPDATE subscription_plans SET
  price_monthly  = 4999,
  price_yearly   = 49999,
  currency       = 'NGN',
  updated_at     = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans SET
  price_monthly  = 14999,
  price_yearly   = 149999,
  currency       = 'NGN',
  updated_at     = NOW()
WHERE slug = 'enterprise';

UPDATE subscription_plans SET
  currency       = 'NGN',
  updated_at     = NOW()
WHERE slug = 'free';

ALTER TABLE subscription_plans
  ALTER COLUMN currency SET DEFAULT 'NGN';
