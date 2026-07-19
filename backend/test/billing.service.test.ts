import test from 'node:test';
import assert from 'node:assert/strict';

import { createBillingService } from '../src/modules/billing/billing.service.js';

const proPlan = {
  id: 2,
  slug: 'pro',
  display_name: 'Pro',
  price_monthly: '9.99',
  price_yearly: '99.99',
  price_monthly_minor: 999,
  price_yearly_minor: 9999,
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
    async settleVerifiedPayment(reference: string, verification: any) {
      calls.push({ method: 'settleVerifiedPayment', reference, verification });
      return {
        payment: { reference, status: 'success', subscription_id: 42 },
        subscription: { id: 42, user_id: 7, plan: 'pro' },
      };
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
  assert.equal(repo.calls[1].payload.amountMinor, 999);
});

test('initializeCheckout derives minor units from the decimal price when *_minor is not yet backfilled', async () => {
  const repo = makeRepo({
    async findActivePlanBySlug(slug: string) {
      return slug === 'pro' ? { ...proPlan, price_monthly_minor: null, price_yearly_minor: null } : null;
    },
  });
  const paystack = makePaystack();
  const service = createBillingService({ repo, paystack });

  const checkout = await service.initializeCheckout({ id: 7, email: 'fan@example.com' }, { plan: 'pro', interval: 'monthly' });

  assert.equal(checkout.amount, 9.99);
  assert.equal(paystack.calls[0].payload.amount, 999);
});

test('verifyPayment activates subscription after a successful Paystack verification', async () => {
  const repo = makeRepo();
  const paystack = makePaystack();
  const service = createBillingService({ repo, paystack });

  const result = await service.verifyPayment({ id: 7 }, 'pst_pro_abc');

  assert.equal(result.payment.status, 'success');
  assert.equal(result.subscription.plan, 'pro');
  const settlement = repo.calls.find((call) => call.method === 'settleVerifiedPayment');
  assert.equal(settlement.reference, 'pst_pro_abc');
  assert.equal(settlement.verification.currency, 'USD');
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

  assert.equal(repo.calls.some((call) => call.method === 'settleVerifiedPayment'), false);
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

test('cancellation preserves the active subscription and schedules period-end cancellation', async () => {
  const repo = makeRepo({ async cancelAtPeriodEnd(userId: number, reason: string) {
    return { id: 42, user_id: userId, status: 'active', cancel_at_period_end: true, cancellation_reason: reason };
  }});
  const service = createBillingService({repo,paystack:makePaystack()});
  const result = await service.cancelSubscription({id:7},'Taking a break');
  assert.equal(result.status,'active');
  assert.equal(result.cancel_at_period_end,true);
});

test('subscription restoration rejects when no paid entitlement remains', async () => {
  const repo = makeRepo({async restoreSubscription(){return null;}});
  const service=createBillingService({repo,paystack:makePaystack()});
  await assert.rejects(()=>service.restoreSubscription({id:7}),(error:any)=>error.statusCode===404);
});

test('receipt access is scoped to the authenticated account', async () => {
  const repo=makeRepo({async findReceiptForUser(receiptNumber:string,userId:number){
    return userId===7?{receipt_number:receiptNumber,user_id:userId}:null;
  }});
  const service=createBillingService({repo,paystack:makePaystack()});
  assert.equal((await service.getReceipt({id:7},'SSH-2026-00000010')).user_id,7);
  await assert.rejects(()=>service.getReceipt({id:8},'SSH-2026-00000010'),(error:any)=>error.statusCode===404);
});

test('admin entitlement repair requires an active paid plan and a future expiry', async () => {
  const repo=makeRepo({async repairEntitlement(adminId:number,input:any){return {id:51,adminId,...input};}});
  const service=createBillingService({repo,paystack:makePaystack()});
  await assert.rejects(()=>service.repairEntitlement({id:1},{userId:7,plan:'pro',expiresAt:'2020-01-01T00:00:00Z',reason:'repair'}),/future/);
  const result=await service.repairEntitlement({id:1},{userId:7,plan:'pro',expiresAt:'2099-01-01T00:00:00Z',reason:'provider reconciliation'});
  assert.equal(result.id,51);
});
