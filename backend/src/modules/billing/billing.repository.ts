export function createBillingRepository(db) {
  async function findActivePlans() {
    const { rows } = await db.query(
      `SELECT *
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, created_at ASC`
    );
    return rows;
  }

  async function findActivePlanBySlug(slug: string) {
    const { rows } = await db.query(
      `SELECT *
       FROM subscription_plans
       WHERE slug = $1 AND is_active = TRUE`,
      [slug]
    );
    return rows[0] ?? null;
  }

  async function createPaymentTransaction({ userId, provider, reference, plan, billingInterval, amount, currency, status, authorizationUrl, accessCode, providerPayload }) {
    const { rows } = await db.query(
      `INSERT INTO payment_transactions
         (user_id, provider, reference, plan, billing_interval, amount, currency, status, authorization_url, access_code, provider_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       RETURNING *`,
      [
        userId,
        provider,
        reference,
        plan,
        billingInterval,
        amount,
        currency,
        status,
        authorizationUrl ?? null,
        accessCode ?? null,
        JSON.stringify(providerPayload ?? {}),
      ]
    );
    return rows[0];
  }

  async function findPaymentByReference(reference: string) {
    const { rows } = await db.query(
      `SELECT * FROM payment_transactions WHERE reference = $1`,
      [reference]
    );
    return rows[0] ?? null;
  }

  async function findPaymentsByUser(userId: number, { limit = 20, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT id, reference, plan, billing_interval, amount, currency, status,
              paid_at, created_at
       FROM payment_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  // Atomically claim a payment for verification. Only one concurrent caller
  // (user-initiated verify vs. Paystack webhook) wins; the loser sees 0 rows.
  // A 'processing' claim older than 2 minutes is reclaimable so a crash
  // mid-verification can't permanently strand the payment.
  async function claimPaymentForProcessing(reference: string) {
    const { rows } = await db.query(
      `UPDATE payment_transactions
       SET status = 'processing', updated_at = NOW()
       WHERE reference = $1
         AND (
           status IN ('pending', 'failed', 'abandoned')
           OR (status = 'processing' AND updated_at < NOW() - INTERVAL '2 minutes')
         )
       RETURNING *`,
      [reference]
    );
    return rows[0] ?? null;
  }

  async function markPaymentStatus(reference: string, { status, providerPayload, paidAt, subscriptionId = null }) {
    const { rows } = await db.query(
      `UPDATE payment_transactions
       SET status = $2,
           provider_payload = $3::jsonb,
           paid_at = COALESCE($4::timestamptz, paid_at),
           subscription_id = COALESCE($5, subscription_id),
           updated_at = NOW()
       WHERE reference = $1
       RETURNING *`,
      [reference, status, JSON.stringify(providerPayload ?? {}), paidAt ?? null, subscriptionId]
    );
    return rows[0] ?? null;
  }

  async function findSubscriptionById(id: number) {
    const { rows } = await db.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function activateSubscription({ userId, plan, expiresAt, reference }) {
    return db.transact(async (client) => {
      await client.query(
        `UPDATE subscriptions
         SET status = 'cancelled',
             notes = COALESCE(notes || E'\n', '') || $2,
             updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [userId, `Replaced by Paystack payment ${reference}`]
      );

      const { rows } = await client.query(
        `INSERT INTO subscriptions (user_id, plan, status, expires_at, notes)
         VALUES ($1, $2, 'active', $3, $4)
         RETURNING *`,
        [userId, plan, expiresAt, `Activated by Paystack payment ${reference}`]
      );
      return rows[0];
    });
  }

  return {
    findActivePlans,
    findActivePlanBySlug,
    createPaymentTransaction,
    findPaymentByReference,
    findPaymentsByUser,
    claimPaymentForProcessing,
    markPaymentStatus,
    findSubscriptionById,
    activateSubscription,
  };
}
