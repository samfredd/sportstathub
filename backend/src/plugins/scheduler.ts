import fp from 'fastify-plugin';
import config from '../config/env.config.js';
import { createFootballService } from '../modules/football/football.service.js';
import { createSettlementService } from '../modules/settlement/settlement.service.js';
import { createBillingRepository } from '../modules/billing/billing.repository.js';
import { createBillingService } from '../modules/billing/billing.service.js';
import { createPaystackClient } from '../modules/billing/paystack.client.js';

const HOUR_MS = 60 * 60 * 1000;
const BOOT_DELAY_MS = 30 * 1000; // let the server finish booting before first sweep

export const SAVED_MATCH_REMINDER_QUERY = `WITH due AS (
  SELECT id FROM saved_matches
  WHERE notified_at IS NULL AND starts_at>NOW() AND starts_at<=NOW()+INTERVAL '15 minutes'
  ORDER BY starts_at,id FOR UPDATE SKIP LOCKED LIMIT 250
), claimed AS (
  UPDATE saved_matches sm SET notified_at=NOW() FROM due WHERE sm.id=due.id RETURNING sm.*
)
INSERT INTO notifications(user_id,category,title,body,link,dedupe_key,metadata)
SELECT c.user_id,'saved_match_starts','Saved match starting soon',
       c.home_team || ' vs ' || c.away_team || ' starts soon.',
       CASE WHEN c.sport='basketball' THEN '/match/basketball/' ELSE '/match/' END || c.fixture_id,
       'saved-match-start:' || c.id,
       jsonb_build_object('fixtureId',c.fixture_id,'sport',c.sport,'startsAt',c.starts_at)
FROM claimed c
WHERE COALESCE((SELECT saved_match_starts FROM notification_preferences WHERE user_id=c.user_id),TRUE)
ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id`;

/**
 * Background scheduler — runs two idempotent sweeps on an interval:
 *
 *   1. Subscription expiry  — flips active subscriptions to 'expired' once their
 *      expires_at has passed, so admin views / leaderboards reflect reality.
 *      (Runtime access checks already treat expired subs as inactive; this keeps
 *      the stored status honest.)
 *   2. Prediction settlement — grades open predictions tied to a finished fixture.
 *
 * Both are safe to run on every instance: the UPDATEs are idempotent, so multiple
 * processes racing just no-op each other.
 */
async function schedulerPlugin(fastify: any) {
  if (process.env.NODE_ENV === 'test') return; // never schedule under tests

  const footballService = createFootballService({
    apiKey: config.footballApiKey,
    sportsApiKey: config.sportsApiKey,
    redis: fastify.redis,
  });
  const settlement = createSettlementService({
    db: fastify.db,
    footballService,
    log: fastify.log,
  });
  const billing = createBillingService({
    repo: createBillingRepository(fastify.db),
    paystack: createPaystackClient({ secretKey: config.paystackSecretKey }),
    callbackUrl: config.paystackCallbackUrl,
  });

  async function expireSubscriptions() {
    try {
      const grace = await fastify.db.query(
        `UPDATE subscriptions s SET status='grace',
           grace_ends_at=s.expires_at + (sp.grace_period_days || ' days')::interval,updated_at=NOW()
         FROM subscription_plans sp WHERE s.plan=sp.slug AND s.status='active'
           AND s.expires_at IS NOT NULL AND s.expires_at<NOW() AND sp.grace_period_days>0
         RETURNING s.id,s.user_id`);
      const expired = await fastify.db.query(
        `UPDATE subscriptions SET status='expired',updated_at=NOW()
         WHERE status IN ('active','grace') AND expires_at IS NOT NULL
           AND COALESCE(grace_ends_at,expires_at)<NOW() RETURNING id,user_id`);
      for (const subscription of grace.rows) {
        await fastify.db.query(
          `INSERT INTO subscription_events(subscription_id,user_id,event_type)
           VALUES($1,$2,'grace_started')`, [subscription.id,subscription.user_id]);
        await fastify.db.query(
          `INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
           SELECT $1,'billing','Subscription grace period started',
                  'Your paid access has entered its grace period. Renew to avoid interruption.',
                  '/dashboard/subscription',$2
           WHERE COALESCE((SELECT billing FROM notification_preferences WHERE user_id=$1),TRUE)
           ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
          [subscription.user_id,`subscription-grace:${subscription.id}`]);
      }
      for (const subscription of expired.rows) {
        await fastify.db.query(
          `INSERT INTO subscription_events(subscription_id,user_id,event_type)
           VALUES($1,$2,'expired')`, [subscription.id,subscription.user_id]);
        await fastify.db.query(
          `INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
           SELECT $1,'billing','Subscription expired',
                  'Your paid access has ended. You can renew at any time.',
                  '/dashboard/subscription',$2
           WHERE COALESCE((SELECT billing FROM notification_preferences WHERE user_id=$1),TRUE)
           ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
          [subscription.user_id,`subscription-expired:${subscription.id}`]);
      }
      if (grace.rowCount > 0 || expired.rowCount > 0) {
        fastify.log.info({ grace: grace.rowCount, expired: expired.rowCount }, 'scheduler: subscription lifecycle advanced');
      }
    } catch (err: any) {
      fastify.log.warn({ err: err?.message }, 'scheduler: subscription expiry sweep failed');
    }
  }

  async function sendSavedMatchReminders() {
    try {
      const {rows}=await fastify.db.query(SAVED_MATCH_REMINDER_QUERY);
      if(rows.length)fastify.log.info({notifications:rows.length},'scheduler: saved-match reminders delivered');
    } catch(err:any){fastify.log.warn({err:err?.message},'scheduler: saved-match reminder sweep failed');}
  }

  let running = false;
  async function runSweeps() {
    if (running) return; // prevent overlap if a sweep runs long
    running = true;
    try {
      await expireSubscriptions();
      await sendSavedMatchReminders();
      await settlement.settleOpenPredictions();
    } finally {
      running = false;
    }
  }

  // Kick off shortly after boot, then every hour.
  const bootTimer = setTimeout(runSweeps, BOOT_DELAY_MS);
  const intervalTimer = setInterval(runSweeps, HOUR_MS);
  const paymentTimer = setInterval(async () => {
    if (!config.paystackSecretKey) return;
    try {
      await billing.processWebhookEvents();
      await billing.reconcilePayments();
    } catch (err: any) {
      fastify.log.error({ err: err?.message }, 'scheduler: payment processing failed');
    }
  }, 60_000);

  // Don't keep the event loop alive just for the timers.
  bootTimer.unref?.();
  intervalTimer.unref?.();
  paymentTimer.unref?.();

  fastify.addHook('onClose', async () => {
    clearTimeout(bootTimer);
    clearInterval(intervalTimer);
    clearInterval(paymentTimer);
  });

  // Expose for manual triggering (admin "settle now" endpoint).
  fastify.decorate('runSettlement', () => settlement.settleOpenPredictions());
  fastify.decorate('runSubscriptionExpiry', () => expireSubscriptions());
}

export default fp(schedulerPlugin, {
  name: 'scheduler',
  fastify: '5.x',
  dependencies: ['infrastructure'],
});
