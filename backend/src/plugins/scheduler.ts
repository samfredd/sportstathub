import fp from 'fastify-plugin';
import config from '../config/env.config.js';
import { createFootballService } from '../modules/football/football.service.js';
import { createSettlementService } from '../modules/settlement/settlement.service.js';

const HOUR_MS = 60 * 60 * 1000;
const BOOT_DELAY_MS = 30 * 1000; // let the server finish booting before first sweep

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

  async function expireSubscriptions() {
    try {
      const { rowCount } = await fastify.db.query(
        `UPDATE subscriptions
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'active'
           AND expires_at IS NOT NULL
           AND expires_at < NOW()`
      );
      if (rowCount > 0) fastify.log.info({ expired: rowCount }, 'scheduler: subscriptions expired');
    } catch (err: any) {
      fastify.log.warn({ err: err?.message }, 'scheduler: subscription expiry sweep failed');
    }
  }

  let running = false;
  async function runSweeps() {
    if (running) return; // prevent overlap if a sweep runs long
    running = true;
    try {
      await expireSubscriptions();
      await settlement.settleOpenPredictions();
    } finally {
      running = false;
    }
  }

  // Kick off shortly after boot, then every hour.
  const bootTimer = setTimeout(runSweeps, BOOT_DELAY_MS);
  const intervalTimer = setInterval(runSweeps, HOUR_MS);

  // Don't keep the event loop alive just for the timers.
  bootTimer.unref?.();
  intervalTimer.unref?.();

  fastify.addHook('onClose', async () => {
    clearTimeout(bootTimer);
    clearInterval(intervalTimer);
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
