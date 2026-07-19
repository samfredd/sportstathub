import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import config from '../../config/env.config.js';
import { createPaystackClient } from './paystack.client.js';
import { createBillingRepository } from './billing.repository.js';
import { createBillingService } from './billing.service.js';
import { createBillingController } from './billing.controller.js';

const checkoutSchema = {
  type: 'object',
  required: ['plan'],
  properties: {
    plan: { type: 'string', minLength: 1, maxLength: 50 },
    interval: { type: 'string', enum: ['monthly', 'yearly'], default: 'monthly' },
  },
  additionalProperties: false,
};

const verifySchema = {
  type: 'object',
  required: ['reference'],
  properties: {
    reference: { type: 'string', minLength: 1, maxLength: 120 },
  },
  additionalProperties: false,
};

async function billingRoutes(fastify) {
  const repo = createBillingRepository(fastify.db);
  const paystack = createPaystackClient({ secretKey: config.paystackSecretKey });
  const service = createBillingService({
    repo,
    paystack,
    callbackUrl: config.paystackCallbackUrl,
  });
  const ctrl = createBillingController(service);

  fastify.get('/api/subscription-plans', ctrl.listPlans);

  fastify.post('/api/billing/paystack/initialize', {
    onRequest: [fastify.authenticate],
    schema: { body: checkoutSchema },
  }, ctrl.initializePaystack);

  fastify.post('/api/billing/paystack/verify', {
    onRequest: [fastify.authenticate],
    schema: { body: verifySchema },
  }, ctrl.verifyPaystack);

  fastify.get('/api/billing/history', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
        additionalProperties: false,
      },
    },
  }, ctrl.listHistory);

  fastify.get('/api/billing/subscription', {
    onRequest: [fastify.authenticate],
  }, ctrl.getSubscription);

  fastify.post('/api/billing/subscription/cancel', {
    onRequest: [fastify.authenticate],
    schema: { body: { type: 'object', properties: { reason: { type: 'string', maxLength: 500 } }, additionalProperties: false } },
  }, ctrl.cancelSubscription);

  fastify.post('/api/billing/subscription/restore', {
    onRequest: [fastify.authenticate],
  }, ctrl.restoreSubscription);

  fastify.get('/api/billing/receipts/:receiptNumber', {
    onRequest: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['receiptNumber'], properties: {
      receiptNumber: { type: 'string', pattern: '^SSH-[0-9]{4}-[0-9]{8}$' },
    } } },
  }, ctrl.getReceipt);

  fastify.post('/api/admin/billing/entitlements/repair', {
    onRequest: [fastify.requireRecentAdminAuth],
    schema: { body: { type: 'object', required: ['userId','plan','expiresAt','reason'], properties: {
      userId: { type: 'integer', minimum: 1 }, plan: { type: 'string', enum: ['pro','enterprise'] },
      expiresAt: { type: 'string', format: 'date-time' }, reason: { type: 'string', minLength: 10, maxLength: 500 },
    }, additionalProperties: false } },
  }, ctrl.repairEntitlement);

  // ── Paystack webhook ────────────────────────────────────────────────────────
  // Paystack POSTs signed events here. We acknowledge immediately (Paystack
  // retries for up to 72 h if we return non-2xx) then process asynchronously.
  // This handles the case where the user closes the browser before being
  // redirected back to /dashboard/subscription after payment.
  fastify.post('/api/billing/paystack/webhook', {
    config: { rawBody: true, rateLimit: false },
  }, async (request: any, reply: any) => {
    // Validate HMAC-SHA512 against the exact raw bytes Paystack signed.
    // Using request.rawBody (Buffer) guarantees byte-perfect comparison;
    // JSON.stringify(parsedBody) can differ from the original bytes.
    const sig = (request.headers['x-paystack-signature'] as string) ?? '';
    if (!config.paystackSecretKey) {
      request.log.error('Rejected Paystack webhook because PAYSTACK_SECRET_KEY is not configured');
      return reply.status(503).send({ error: 'Payment webhook is unavailable' });
    }
    if (!sig) {
      return reply.status(400).send({ error: 'Missing webhook signature' });
    }
      const expected = crypto
        .createHmac('sha512', config.paystackSecretKey)
        .update(request.rawBody as Buffer)
        .digest('hex');
      const expectedBuffer = Buffer.from(expected, 'hex');
      const signatureBuffer = /^[a-f0-9]{128}$/i.test(sig) ? Buffer.from(sig, 'hex') : Buffer.alloc(0);
      if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }

    const event = request.body as any;
    const reference = (event?.data?.reference ?? event?.data?.transaction?.reference) as string | undefined;
    const providerId = event?.data?.id ? String(event.data.id) : '';
    const eventKey = crypto.createHash('sha256').update(
      `${event?.event || 'unknown'}:${providerId}:${reference || ''}:${(request.rawBody as Buffer).toString('base64')}`,
    ).digest('hex');
    await repo.storeWebhookEvent({
      provider: 'paystack', eventKey, reference,
      eventType: String(event?.event || 'unknown'), payload: event,
    });
    // The durable insert is committed before acknowledgement. A scheduler
    // claims and retries the event independently of this HTTP process.
    return reply.status(200).send({ status: 'ok' });
  });
}

export default fp(billingRoutes, {
  name: 'billing-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
