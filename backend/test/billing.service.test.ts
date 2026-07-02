import test from 'node:test';
import assert from 'node:assert/strict';

import { createBillingService } from '../src/modules/billing/billing.service.js';

const proPlan = {
  id: 2,
  slug: 'pro',
  display_name: 'Pro',
  price_monthly: '9.99',
  price_yearly: '99.99',
  currency: 'USD',
  features: [],
  limits: {},
  is_active: true,
  is_popular: true,
};

function makeRepo(overrides: Record<string, any> = {}) {
  const calls: any[] = [];
  const repo = {
    calls,
    async findActivePlans() {
      calls.push({ method: 'findActivePlans' });
      return [proPlan];
    },
    async findActivePlanBySlug(slug: string) {
      calls.push({ method: 'findActivePlanBySlug', slug });
      return slug === 'pro' ? proPlan : null;
    },
    async createPaymentTransaction(payload: any) {
      calls.push({ method: 'createPaymentTransaction', payload });
      return { id: 10, ...payload };
    },
    async findPaymentByReference(reference: string) {
      calls.push({ method: 'findPaymentByReference', reference });
      return {
        id: 10,
        user_id: 7,
        plan: 'pro',
        billing_interval: 'monthly',
        reference,
        amount: '9.99',
        currency: 'USD',
        status: 'pending',
      };
    },
    async claimPaymentForProcessing(reference: string) {
      calls.push({ method: 'claimPaymentForProcessing', reference });
      return {
        id: 10,
        user_id: 7,
        plan: 'pro',
        billing_interval: 'monthly',
        reference,
        amount: '9.99',
        currency: 'USD',
        status: 'processing',
      };
    },
    async markPaymentStatus(reference: string, payload: any) {
      calls.push({ method: 'markPaymentStatus', reference, payload });
      return { reference, ...payload };
    },
    async findSubscriptionById(id: number) {
      calls.push({ method: 'findSubscriptionById', id });
      return { id, plan: 'pro' };
    },
    async activateSubscription(payload: any) {
      calls.push({ method: 'activateSubscription', payload });
      return { id: 42, ...payload };
    },
    ...overrides,
  };
  return repo;
}

function makePaystack(overrides: Record<string, any> = {}) {
  const calls: any[] = [];
  return {
    calls,
    async initializeTransaction(payload: any) {
      calls.push({ method: 'initializeTransaction', payload });
      return {
        authorizationUrl: 'https://checkout.paystack.com/test',
        accessCode: 'access_code',
        reference: payload.reference,
        raw: { status: true },
      };
    },
    async verifyTransaction(reference: string) {
      calls.push({ method: 'verifyTransaction', reference });
      return {
        status: 'success',
        reference,
        amount: 999,
        currency: 'USD',
        raw: { status: true },
      };
    },
    ...overrides,
  };
}

test('initializeCheckout sends USD cents to Paystack and stores a pending payment', async () => {
  const repo = makeRepo();
  const paystack = makePaystack();
  const service = createBillingService({
    repo,
    paystack,
    callbackUrl: 'https://sportstathub.com/dashboard/subscription',
  });

  const checkout = await service.initializeCheckout(
    { id: 7, email: 'fan@example.com' },
    { plan: 'pro', interval: 'monthly' }
  );

  assert.equal(checkout.currency, 'USD');
  assert.equal(checkout.amount, 9.99);
  assert.equal(checkout.authorizationUrl, 'https://checkout.paystack.com/test');
  assert.equal(paystack.calls[0].payload.amount, 999);
  assert.equal(paystack.calls[0].payload.currency, 'USD');
  assert.equal(paystack.calls[0].payload.email, 'fan@example.com');
  assert.equal(paystack.calls[0].payload.callbackUrl, 'https://sportstathub.com/dashboard/subscription');
  assert.equal(repo.calls[1].method, 'createPaymentTransaction');
  assert.equal(repo.calls[1].payload.status, 'pending');
  assert.equal(repo.calls[1].payload.amount, 9.99);
});

test('verifyPayment activates subscription after a successful Paystack verification', async () => {
  const repo = makeRepo();
  const paystack = makePaystack();
  const service = createBillingService({ repo, paystack });

  const result = await service.verifyPayment({ id: 7 }, 'pst_pro_abc');

  assert.equal(result.payment.status, 'success');
  assert.equal(result.subscription.plan, 'pro');
  const activation = repo.calls.find((call) => call.method === 'activateSubscription');
  assert.equal(activation.payload.userId, 7);
  assert.equal(activation.payload.plan, 'pro');
  assert.equal(repo.calls.at(-1).payload.subscriptionId, 42);
});

test('verifyPayment rejects mismatched Paystack amount without activating subscription', async () => {
  const repo = makeRepo();
  const paystack = makePaystack({
    async verifyTransaction(reference: string) {
      return {
        status: 'success',
        reference,
        amount: 100,
        currency: 'USD',
        raw: { status: true },
      };
    },
  });
  const service = createBillingService({ repo, paystack });

  await assert.rejects(
    () => service.verifyPayment({ id: 7 }, 'pst_pro_abc'),
    /Payment verification mismatch/
  );

  assert.equal(repo.calls.some((call) => call.method === 'activateSubscription'), false);
});

test('verifyPayment reports 409 when another caller holds the processing claim', async () => {
  const repo = makeRepo({
    async claimPaymentForProcessing() {
      return null; // claim lost — webhook/verify race
    },
  });
  const paystack = makePaystack();
  const service = createBillingService({ repo, paystack });

  await assert.rejects(
    () => service.verifyPayment({ id: 7 }, 'pst_pro_abc'),
    (err: any) => err.statusCode === 409
  );

  assert.equal(repo.calls.some((call) => call.method === 'activateSubscription'), false);
  assert.equal(paystack.calls.length, 0); // never hit Paystack without the claim
});

test('verifyPayment returns the settled payment when the race winner already succeeded', async () => {
  let lookups = 0;
  const repo = makeRepo({
    async findPaymentByReference(reference: string) {
      lookups += 1;
      // First lookup: pre-claim read (pending). Second: post-claim-loss read (success).
      return {
        id: 10,
        user_id: 7,
        plan: 'pro',
        billing_interval: 'monthly',
        reference,
        amount: '9.99',
        currency: 'USD',
        status: lookups === 1 ? 'pending' : 'success',
        subscription_id: lookups === 1 ? null : 42,
      };
    },
    async claimPaymentForProcessing() {
      return null; // webhook won the race and finished
    },
  });
  const paystack = makePaystack();
  const service = createBillingService({ repo, paystack });

  const result = await service.verifyPayment({ id: 7 }, 'pst_pro_abc');
  assert.equal(result.payment.status, 'success');
  assert.equal(result.subscription.plan, 'pro');
  assert.equal(paystack.calls.length, 0);
});
