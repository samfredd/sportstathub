import fp from 'fastify-plugin';
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
}

export default fp(billingRoutes, {
  name: 'billing-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
