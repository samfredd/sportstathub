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
    if (config.paystackSecretKey) {
      if (!sig) {
        return reply.status(400).send({ error: 'Missing webhook signature' });
      }
      const expected = crypto
        .createHmac('sha512', config.paystackSecretKey)
        .update(request.rawBody as Buffer)
        .digest('hex');
      if (expected !== sig) {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }
    }

    // Acknowledge receipt before doing any async work
    reply.status(200).send({ status: 'ok' });

    const event = request.body as any;
    if (event?.event !== 'charge.success') return;

    const reference = event?.data?.reference as string | undefined;
    if (!reference) return;

    // Process in the background — do not block the acknowledged response
    Promise.resolve().then(async () => {
      try {
        const payment = await repo.findPaymentByReference(reference);
        // Already processed or not ours — skip
        if (!payment || payment.status === 'success') return;

        await service.verifyPayment({ id: payment.user_id }, reference);
        fastify.log.info({ reference }, 'Paystack webhook: subscription activated');
      } catch (err: any) {
        // 409 = a user-initiated verify holds the processing claim — not a failure
        if (err?.statusCode === 409) {
          fastify.log.info({ reference }, 'Paystack webhook: verification already in progress');
        } else {
          fastify.log.error({ err, reference }, 'Paystack webhook: failed to activate subscription');
        }
      }
    });
  });
}

export default fp(billingRoutes, {
  name: 'billing-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
