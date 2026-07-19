CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_key CHAR(64) NOT NULL,
  reference VARCHAR(120),
  event_type VARCHAR(100) NOT NULL,
  raw_payload JSONB NOT NULL,
  signature_verified BOOLEAN NOT NULL,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_key)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending
  ON payment_webhook_events(received_at) WHERE processing_status IN ('pending','failed','processing');

CREATE TABLE IF NOT EXISTS payment_reconciliation_history (
  id BIGSERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  provider_status VARCHAR(30),
  outcome VARCHAR(30) NOT NULL,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_payment_time
  ON payment_reconciliation_history(payment_id, checked_at DESC);
