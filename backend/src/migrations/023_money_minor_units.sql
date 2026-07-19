-- Integer minor-unit (cents/kobo) money columns alongside the existing
-- NUMERIC(10,2) columns. Application code treats *_minor as the source of
-- truth for new writes; the legacy NUMERIC columns are kept in sync for
-- backward compatibility with anything still reading them directly.
-- Safe to re-run: every step is either IF NOT EXISTS/IF EXISTS or an
-- idempotent backfill (re-deriving the same value from the same source row).

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_monthly_minor INTEGER,
  ADD COLUMN IF NOT EXISTS price_yearly_minor  INTEGER;

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS refunded_amount_minor INTEGER;

-- Unlike amount_minor (which must always be explicitly supplied — a missing
-- charge amount should never silently become "free"), refunded_amount_minor
-- is a running total that legitimately starts at 0, mirroring the legacy
-- refunded_amount column's own NOT NULL DEFAULT 0. Without this, a payment
-- row inserted after this migration (whose INSERT doesn't mention this
-- column) would start life NULL, and the refund UPDATE below computes
-- `refunded_amount_minor + $delta`, which is NULL for any NULL operand —
-- silently breaking the very first refund on a brand-new payment.
ALTER TABLE payment_transactions ALTER COLUMN refunded_amount_minor SET DEFAULT 0;

ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS amount_minor INTEGER;

-- Heals an earlier version of this migration that briefly set these NOT
-- NULL before the seed-insert idempotency issue below was discovered. A
-- no-op if the column is already nullable.
ALTER TABLE subscription_plans ALTER COLUMN price_monthly_minor DROP NOT NULL;
ALTER TABLE subscription_plans ALTER COLUMN price_yearly_minor DROP NOT NULL;
ALTER TABLE payment_transactions ALTER COLUMN amount_minor DROP NOT NULL;
ALTER TABLE payment_transactions ALTER COLUMN refunded_amount_minor DROP NOT NULL;
ALTER TABLE payment_refunds ALTER COLUMN amount_minor DROP NOT NULL;

UPDATE subscription_plans SET price_monthly_minor = ROUND(price_monthly * 100)::INTEGER WHERE price_monthly_minor IS NULL;
UPDATE subscription_plans SET price_yearly_minor  = ROUND(price_yearly  * 100)::INTEGER WHERE price_yearly_minor  IS NULL;
UPDATE payment_transactions SET amount_minor = ROUND(amount * 100)::INTEGER WHERE amount_minor IS NULL;
UPDATE payment_transactions SET refunded_amount_minor = ROUND(refunded_amount * 100)::INTEGER WHERE refunded_amount_minor IS NULL;
UPDATE payment_refunds SET amount_minor = ROUND(amount * 100)::INTEGER WHERE amount_minor IS NULL;

-- Deliberately NOT `SET NOT NULL`: this project's migration runner
-- (backend/migrate.ts) re-executes every .sql file on every run with no
-- per-migration tracking table. Older seed-data migrations (e.g. 006, 012)
-- contain `INSERT ... ON CONFLICT (slug) DO NOTHING` statements that don't
-- populate these new columns — and a NOT NULL constraint fails row
-- construction *before* Postgres ever reaches the ON CONFLICT check, so it
-- would break those otherwise-idempotent seed inserts on every re-run.
-- Application code (billing.service.ts, admin.service.ts) already falls
-- back to deriving the minor value from the legacy decimal column when this
-- is NULL, so nullability here doesn't weaken the fail-closed guarantee —
-- it only means "not yet backfilled for this row," which the UPDATE above
-- immediately corrects for any row a re-run seed insert creates.
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_price_monthly_minor_check;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_price_monthly_minor_check CHECK (price_monthly_minor >= 0);
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_price_yearly_minor_check;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_price_yearly_minor_check CHECK (price_yearly_minor >= 0);

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_amount_minor_check;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_amount_minor_check CHECK (amount_minor >= 0);
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_refunded_amount_minor_check;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_refunded_amount_minor_check CHECK (refunded_amount_minor >= 0 AND refunded_amount_minor <= amount_minor);

ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS payment_refunds_amount_minor_check;
ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_amount_minor_check CHECK (amount_minor >= 0);

-- Immutable ISO-4217 currency code, defense in depth alongside application
-- validation (billing.service.ts already restricts to a supported-currency
-- allowlist before any charge is created).
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_currency_iso_check;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_currency_iso_check CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_currency_iso_check;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_currency_iso_check CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS payment_refunds_currency_iso_check;
ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_currency_iso_check CHECK (currency ~ '^[A-Z]{3}$');
