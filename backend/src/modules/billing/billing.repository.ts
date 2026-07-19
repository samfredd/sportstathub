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

  async function createPaymentTransaction({ userId, provider, reference, plan, billingInterval, amountMinor, currency, status, authorizationUrl = null, accessCode = null, providerPayload }) {
    const { rows } = await db.query(
      `INSERT INTO payment_transactions
         (user_id, provider, reference, plan, billing_interval, amount, amount_minor, currency, status, authorization_url, access_code, provider_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING *`,
      [
        userId,
        provider,
        reference,
        plan,
        billingInterval,
        amountMinor / 100,
        amountMinor,
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
      `SELECT p.id, p.reference, p.plan, p.billing_interval, p.amount, p.currency,
              p.status, p.refunded_amount, p.dispute_status, p.paid_at, p.created_at,
              r.receipt_number
       FROM payment_transactions p
       LEFT JOIN payment_receipts r ON r.payment_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
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

  async function findCurrentSubscription(userId: number) {
    const { rows } = await db.query(
      `SELECT s.*, sp.grace_period_days
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.slug = s.plan
       WHERE s.user_id = $1 AND s.status IN ('active','grace')
       ORDER BY s.expires_at DESC NULLS LAST, s.id DESC LIMIT 1`, [userId]);
    return rows[0] ?? null;
  }

  async function cancelAtPeriodEnd(userId: number, reason?: string) {
    return db.transact(async (client) => {
      const { rows } = await client.query(
        `UPDATE subscriptions SET cancel_at_period_end=TRUE, cancelled_at=NOW(),
           cancellation_reason=$2, renewal_policy='manual', updated_at=NOW()
         WHERE id=(SELECT id FROM subscriptions WHERE user_id=$1 AND status IN ('active','grace')
                   ORDER BY expires_at DESC NULLS LAST,id DESC LIMIT 1 FOR UPDATE)
         RETURNING *`, [userId, reason?.slice(0, 500) ?? null]);
      const subscription = rows[0];
      if (!subscription) return null;
      await client.query(
        `INSERT INTO subscription_events(subscription_id,user_id,actor_user_id,event_type,metadata)
         VALUES($1,$2,$2,'cancellation_scheduled',$3::jsonb)`,
        [subscription.id, userId, JSON.stringify({ reason: reason ?? null, effectiveAt: subscription.expires_at })]);
      await client.query(`INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
        SELECT $1,'billing','Cancellation scheduled','Your paid access remains active through the current period.','/dashboard/subscription',$2
        WHERE COALESCE((SELECT billing FROM notification_preferences WHERE user_id=$1),TRUE)
        ON CONFLICT(user_id,dedupe_key) DO NOTHING`,[userId,`billing:cancel:${subscription.id}`]);
      return subscription;
    });
  }

  async function restoreSubscription(userId: number) {
    return db.transact(async (client) => {
      const { rows } = await client.query(
        `UPDATE subscriptions SET cancel_at_period_end=FALSE, cancelled_at=NULL,
           cancellation_reason=NULL, updated_at=NOW()
         WHERE id=(SELECT id FROM subscriptions WHERE user_id=$1 AND status IN ('active','grace')
                   AND (expires_at IS NULL OR COALESCE(grace_ends_at,expires_at)>NOW())
                   ORDER BY expires_at DESC NULLS LAST,id DESC LIMIT 1 FOR UPDATE)
         RETURNING *`, [userId]);
      const subscription = rows[0];
      if (!subscription) return null;
      await client.query(
        `INSERT INTO subscription_events(subscription_id,user_id,actor_user_id,event_type)
         VALUES($1,$2,$2,'cancellation_reversed')`, [subscription.id, userId]);
      return subscription;
    });
  }

  async function findReceiptForUser(receiptNumber: string, userId: number) {
    const { rows } = await db.query(
      `SELECT r.receipt_number,r.issued_at,r.billing_snapshot,
              p.reference,p.plan,p.billing_interval,p.amount,p.currency,p.status,p.paid_at,
              u.username,u.email
       FROM payment_receipts r JOIN payment_transactions p ON p.id=r.payment_id
       JOIN users u ON u.id=p.user_id
       WHERE r.receipt_number=$1 AND p.user_id=$2`, [receiptNumber, userId]);
    return rows[0] ?? null;
  }

  async function findSubscriptionEvents(userId: number, limit = 50) {
    const { rows } = await db.query(
      `SELECT id,subscription_id,payment_id,event_type,metadata,created_at
       FROM subscription_events WHERE user_id=$1
       ORDER BY created_at DESC,id DESC LIMIT $2`, [userId, limit]);
    return rows;
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

  async function settleVerifiedPayment(reference: string, verification: any) {
    return db.transact(async (client) => {
      const { rows: paymentRows } = await client.query(
        `SELECT * FROM payment_transactions WHERE reference = $1 FOR UPDATE`, [reference]);
      const payment = paymentRows[0];
      if (!payment) return null;
      if (payment.status === 'success' && payment.subscription_id) {
        const { rows } = await client.query(`SELECT * FROM subscriptions WHERE id = $1`, [payment.subscription_id]);
        return { payment, subscription: rows[0] ?? null };
      }
      const { rows: activeRows } = await client.query(
        `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'
         ORDER BY expires_at DESC NULLS LAST FOR UPDATE`, [payment.user_id]);
      const active = activeRows[0];
      const base = active?.expires_at && new Date(active.expires_at) > new Date()
        ? new Date(active.expires_at) : new Date();
      const expiresAt = new Date(base);
      if (payment.billing_interval === 'yearly') expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
      else expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);

      await client.query(
        `UPDATE subscriptions SET status='cancelled', updated_at=NOW(),
           notes=COALESCE(notes || E'\n','') || $2
         WHERE user_id=$1 AND status='active'`,
        [payment.user_id, `Replaced by Paystack payment ${reference}`]);
      const { rows: subscriptionRows } = await client.query(
        `INSERT INTO subscriptions (user_id,plan,status,expires_at,notes)
         VALUES ($1,$2,'active',$3,$4) RETURNING *`,
        [payment.user_id, payment.plan, expiresAt.toISOString(), `Activated by Paystack payment ${reference}`]);
      const subscription = subscriptionRows[0];
      const { rows: paidRows } = await client.query(
        `UPDATE payment_transactions SET status='success', provider_payload=$2::jsonb,
           paid_at=COALESCE($3::timestamptz,NOW()), subscription_id=$4, updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [payment.id, JSON.stringify(verification.raw ?? {}), verification.paidAt ?? null, subscription.id]);
      await client.query(
        `INSERT INTO payment_receipts(payment_id,receipt_number,issued_at,billing_snapshot)
         VALUES($1::integer,'SSH-'||TO_CHAR(COALESCE($2::timestamptz,NOW()),'YYYY')||'-'||LPAD(($1::integer)::text,8,'0'),
                COALESCE($2::timestamptz,NOW()),$3::jsonb)
         ON CONFLICT(payment_id) DO NOTHING`,
        [payment.id, verification.paidAt ?? null, JSON.stringify({ plan: payment.plan, interval: payment.billing_interval,
          amount: payment.amount, currency: payment.currency, reference: payment.reference })]);
      await client.query(
        `INSERT INTO subscription_events(subscription_id,user_id,payment_id,event_type,metadata)
         VALUES($1,$2,$3,'activated',$4::jsonb)`,
        [subscription.id, payment.user_id, payment.id, JSON.stringify({ plan: payment.plan, interval: payment.billing_interval,
          expiresAt: expiresAt.toISOString() })]);
      await client.query(`INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
        SELECT $1,'billing','Payment confirmed','Your subscription is active and your receipt is ready.','/dashboard/subscription',$2
        WHERE COALESCE((SELECT billing FROM notification_preferences WHERE user_id=$1),TRUE)
        ON CONFLICT(user_id,dedupe_key) DO NOTHING`,[payment.user_id,`billing:paid:${payment.id}`]);
      return { payment: paidRows[0], subscription };
    });
  }

  async function applyAdversePaymentEvent(reference: string, eventType: string, payload: any) {
    return db.transact(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM payment_transactions WHERE reference=$1 FOR UPDATE`, [reference]);
      const payment = rows[0];
      if (!payment) return null;
      const isRefund = eventType.startsWith('refund.');
      // Paystack's webhook `data.amount` is already integer minor units
      // (kobo/cents) — no /100 float division needed to reach our own
      // minor-unit columns; the legacy decimal column is derived from it,
      // not the other way around.
      const rawAmountMinor = Math.round(Number(payload?.data?.amount ?? 0));
      const amountMinor = rawAmountMinor > 0 ? rawAmountMinor : Number(payment.amount_minor ?? Math.round(Number(payment.amount) * 100));
      const amountDecimal = amountMinor / 100;
      const providerId = String(payload?.data?.id ?? payload?.data?.refund_reference ?? `${eventType}:${reference}`);
      if (isRefund) {
        await client.query(
          `INSERT INTO payment_refunds(payment_id,provider_refund_id,amount,amount_minor,currency,status,reason,provider_payload,processed_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW()) ON CONFLICT(payment_id,provider_refund_id) DO NOTHING`,
          [payment.id, providerId, amountDecimal, amountMinor, payment.currency, String(payload?.data?.status ?? 'processed'),
            payload?.data?.customer_note ?? null, JSON.stringify(payload)]);
      }
      const status = isRefund ? 'refunded' : 'chargeback';
      const { rows: updatedRows } = await client.query(
        `UPDATE payment_transactions SET status=$2::varchar,
           refunded_amount_minor=CASE WHEN $2::varchar='refunded' THEN LEAST(COALESCE(amount_minor,0),COALESCE(refunded_amount_minor,0)+$3::integer) ELSE refunded_amount_minor END,
           refunded_amount=CASE WHEN $2::varchar='refunded' THEN LEAST(COALESCE(amount_minor,0),COALESCE(refunded_amount_minor,0)+$3::integer)::numeric/100 ELSE refunded_amount END,
           dispute_status=CASE WHEN $2::varchar='chargeback' THEN $4::varchar ELSE dispute_status END,updated_at=NOW()
         WHERE id=$1 RETURNING *`, [payment.id, status, amountMinor, eventType]);
      if (payment.subscription_id) {
        await client.query(
          `UPDATE subscriptions SET status='cancelled',revoked_at=NOW(),revocation_reason=$2,
             cancel_at_period_end=FALSE,updated_at=NOW()
           WHERE id=$1 AND status IN ('active','grace')`, [payment.subscription_id, status]);
      }
      await client.query(
        `INSERT INTO subscription_events(subscription_id,user_id,payment_id,event_type,metadata)
         VALUES($1,$2,$3,$4,$5::jsonb)`, [payment.subscription_id, payment.user_id, payment.id, status,
          JSON.stringify({ providerEvent: eventType, providerId, amountMinor })]);
      await client.query(`INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
        SELECT $1,'billing',$2,$3,'/dashboard/subscription',$4
        WHERE COALESCE((SELECT billing FROM notification_preferences WHERE user_id=$1),TRUE)
        ON CONFLICT(user_id,dedupe_key) DO NOTHING`,[payment.user_id,status==='refunded'?'Payment refunded':'Payment disputed',
          status==='refunded'?'The related entitlement has been updated.':'Access was suspended while the charge dispute is active.',`billing:${status}:${providerId}`]);
      return updatedRows[0];
    });
  }

  async function repairEntitlement(adminId: number, input: any) {
    return db.transact(async (client) => {
      await client.query(
        `UPDATE subscriptions SET status='cancelled',revoked_at=NOW(),revocation_reason='admin_repair',updated_at=NOW()
         WHERE user_id=$1 AND status IN ('active','grace')`, [input.userId]);
      const { rows } = await client.query(
        `INSERT INTO subscriptions(user_id,plan,status,expires_at,renewal_policy,notes)
         VALUES($1,$2,'active',$3,'manual',$4) RETURNING *`,
        [input.userId, input.plan, input.expiresAt, `Entitlement repaired: ${input.reason}`]);
      const subscription = rows[0];
      await client.query(
        `INSERT INTO subscription_events(subscription_id,user_id,actor_user_id,event_type,metadata)
         VALUES($1,$2,$3,'admin_entitlement_repair',$4::jsonb)`,
        [subscription.id, input.userId, adminId, JSON.stringify({ plan: input.plan, expiresAt: input.expiresAt, reason: input.reason })]);
      await client.query(
        `INSERT INTO admin_logs(admin_id,action,target_type,target_id,metadata)
         VALUES($1,'subscription.entitlement_repaired','subscription',$2,$3::jsonb)`,
        [adminId, subscription.id, JSON.stringify({ userId: input.userId, plan: input.plan, expiresAt: input.expiresAt, reason: input.reason })]);
      return subscription;
    });
  }

  async function storeWebhookEvent(event: any) {
    const { rows } = await db.query(
      `INSERT INTO payment_webhook_events
         (provider,event_key,reference,event_type,raw_payload,signature_verified)
       VALUES ($1,$2,$3,$4,$5::jsonb,TRUE)
       ON CONFLICT (provider,event_key) DO UPDATE SET event_key=EXCLUDED.event_key
       RETURNING id,processing_status`,
      [event.provider, event.eventKey, event.reference ?? null, event.eventType, JSON.stringify(event.payload)]);
    return rows[0];
  }

  async function claimWebhookEvents(limit = 20) {
    return db.transact(async (client) => {
      const { rows } = await client.query(
        `WITH candidates AS (
           SELECT id FROM payment_webhook_events
           WHERE (processing_status IN ('pending','failed')
             OR (processing_status='processing' AND processing_started_at < NOW()-INTERVAL '5 minutes'))
             AND attempt_count < 10
           ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE payment_webhook_events e SET processing_status='processing',
           processing_started_at=NOW(), attempt_count=attempt_count+1
         FROM candidates c WHERE e.id=c.id RETURNING e.*`, [limit]);
      return rows;
    });
  }

  async function finishWebhookEvent(id: number, error?: string) {
    await db.query(
      `UPDATE payment_webhook_events SET processing_status=$2,
         processed_at=CASE WHEN $2='processed' THEN NOW() ELSE processed_at END,
         last_error=$3 WHERE id=$1`, [id, error ? 'failed' : 'processed', error?.slice(0, 1000) ?? null]);
  }

  async function findStalePayments(limit = 50) {
    const { rows } = await db.query(
      `SELECT p.* FROM payment_transactions p
       WHERE p.status IN ('pending','processing') AND p.created_at < NOW()-INTERVAL '15 minutes'
         AND NOT EXISTS (SELECT 1 FROM payment_reconciliation_history r
           WHERE r.payment_id=p.id AND r.checked_at > NOW()-INTERVAL '30 minutes')
       ORDER BY p.created_at LIMIT $1`, [limit]);
    return rows;
  }

  async function recordReconciliation(payment: any, providerStatus: string, outcome: string, error?: string) {
    await db.query(
      `INSERT INTO payment_reconciliation_history
       (payment_id,previous_status,provider_status,outcome,error) VALUES ($1,$2,$3,$4,$5)`,
      [payment.id, payment.status, providerStatus, outcome, error?.slice(0, 1000) ?? null]);
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
    findCurrentSubscription,
    cancelAtPeriodEnd,
    restoreSubscription,
    findReceiptForUser,
    findSubscriptionEvents,
    activateSubscription,
    settleVerifiedPayment,
    applyAdversePaymentEvent,
    repairEntitlement,
    storeWebhookEvent,
    claimWebhookEvents,
    finishWebhookEvent,
    findStalePayments,
    recordReconciliation,
  };
}
