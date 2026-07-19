-- Durable subscription lifecycle, receipts, refunds/disputes, and audit timeline.
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 0;

ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_grace_period_days_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_grace_period_days_check
  CHECK (grace_period_days BETWEEN 0 AND 30);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS renewal_policy VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_renewal_policy_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_renewal_policy_check
  CHECK (renewal_policy IN ('manual', 'automatic'));

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(30);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id               BIGSERIAL PRIMARY KEY,
  payment_id       INTEGER NOT NULL UNIQUE REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  receipt_number   VARCHAR(60) NOT NULL UNIQUE,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_snapshot JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id                 BIGSERIAL PRIMARY KEY,
  payment_id         INTEGER NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  provider_refund_id VARCHAR(120) NOT NULL,
  amount             NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency           VARCHAR(10) NOT NULL,
  status             VARCHAR(30) NOT NULL,
  reason             TEXT,
  provider_payload   JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at       TIMESTAMPTZ,
  UNIQUE (payment_id, provider_refund_id)
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id              BIGSERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id      INTEGER REFERENCES payment_transactions(id) ON DELETE SET NULL,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type      VARCHAR(60) NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_time
  ON subscription_events(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id);

-- Account deletion must not be blocked by dependent financial display rows.
-- Provider payload/audit retention belongs in the external payment provider;
-- locally these records follow the owning payment transaction.
ALTER TABLE payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_payment_id_fkey;
ALTER TABLE payment_receipts ADD CONSTRAINT payment_receipts_payment_id_fkey
  FOREIGN KEY(payment_id) REFERENCES payment_transactions(id) ON DELETE CASCADE;
ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS payment_refunds_payment_id_fkey;
ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_payment_id_fkey
  FOREIGN KEY(payment_id) REFERENCES payment_transactions(id) ON DELETE CASCADE;

-- Backfill a durable receipt and activation event for already-settled payments.
INSERT INTO payment_receipts (payment_id, receipt_number, issued_at, billing_snapshot)
SELECT p.id,
       'SSH-' || TO_CHAR(COALESCE(p.paid_at, p.created_at), 'YYYY') || '-' || LPAD(p.id::text, 8, '0'),
       COALESCE(p.paid_at, p.created_at),
       jsonb_build_object('plan', p.plan, 'interval', p.billing_interval,
                          'amount', p.amount, 'currency', p.currency,
                          'reference', p.reference)
FROM payment_transactions p
WHERE p.status = 'success'
ON CONFLICT (payment_id) DO NOTHING;
