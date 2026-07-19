import crypto from 'node:crypto';

const VALID_INTERVALS = new Set(['monthly', 'yearly']);

function toNumber(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function toSubunit(amount: number): number {
  return Math.round(amount * 100);
}

function addInterval(date: Date, interval: string): Date {
  const next = new Date(date);
  if (interval === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function normalizeReference(reference: string): string {
  return reference.replace(/[^A-Za-z0-9-.=]/g, '');
}

function createReference(userId: number | string, plan: string): string {
  const suffix = crypto.randomBytes(9).toString('hex');
  return normalizeReference(`pst_${userId}_${plan}_${Date.now()}_${suffix}`);
}

function planAmount(plan: any, interval: string): number {
  return toNumber(interval === 'yearly' ? plan.price_yearly : plan.price_monthly);
}

function mapPlan(plan: any) {
  return {
    ...plan,
    price_monthly: toNumber(plan.price_monthly),
    price_yearly: toNumber(plan.price_yearly),
    currency: String(plan.currency || 'USD').toUpperCase(),
  };
}

export function createBillingService({ repo, paystack, callbackUrl = null }: { repo: any; paystack: any; callbackUrl?: string | null }) {
  async function listPlans() {
    const plans = await repo.findActivePlans();
    return plans.map(mapPlan);
  }

  async function initializeCheckout(user: any, { plan: planSlug, interval = 'monthly' }: any) {
    if (!user?.id || !user?.email) {
      throw Object.assign(new Error('Authenticated user email is required'), { statusCode: 400 });
    }
    if (!VALID_INTERVALS.has(interval)) {
      throw Object.assign(new Error('Invalid billing interval'), { statusCode: 400 });
    }
    if (!planSlug || planSlug === 'free') {
      throw Object.assign(new Error('Choose a paid plan'), { statusCode: 400 });
    }

    const plan = await repo.findActivePlanBySlug(planSlug);
    if (!plan) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });

    const currency = String(plan.currency || 'NGN').toUpperCase();
    const amount = planAmount(plan, interval);
    const SUPPORTED = new Set(['NGN', 'USD', 'GHS', 'ZAR', 'KES']);
    if (!SUPPORTED.has(currency)) {
      throw Object.assign(new Error(`Currency ${currency} is not supported by Paystack`), { statusCode: 400 });
    }
    if (amount <= 0) {
      throw Object.assign(new Error('Plan amount must be greater than zero'), { statusCode: 400 });
    }

    const reference = createReference(user.id, plan.slug);
    const metadata = {
      userId: user.id,
      plan: plan.slug,
      billingInterval: interval,
      amount,
      currency,
    };

    const checkout = await paystack.initializeTransaction({
      email: user.email,
      amount: toSubunit(amount),
      currency,
      reference,
      callbackUrl,
      metadata,
    });

    await repo.createPaymentTransaction({
      userId: user.id,
      provider: 'paystack',
      reference: checkout.reference || reference,
      plan: plan.slug,
      billingInterval: interval,
      amount,
      currency,
      status: 'pending',
      authorizationUrl: checkout.authorizationUrl,
      accessCode: checkout.accessCode,
      providerPayload: checkout.raw,
    });

    return {
      authorizationUrl: checkout.authorizationUrl,
      accessCode: checkout.accessCode,
      reference: checkout.reference || reference,
      amount,
      currency,
      plan: mapPlan(plan),
      interval,
    };
  }

  async function verifyPayment(user: any, reference: string) {
    if (!reference) {
      throw Object.assign(new Error('Payment reference is required'), { statusCode: 400 });
    }

    const existing = await repo.findPaymentByReference(reference);
    if (!existing) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    if (Number(existing.user_id) !== Number(user?.id)) {
      throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    }
    if (existing.status === 'success' && existing.subscription_id) {
      return {
        payment: existing,
        subscription: await repo.findSubscriptionById(existing.subscription_id),
      };
    }

    // Claim atomically so the webhook and a user-initiated verify can't both
    // activate the subscription. Exactly one caller proceeds; the other reads
    // back the final state (or reports "in progress" if the winner is mid-flight).
    const payment = await repo.claimPaymentForProcessing(reference);
    if (!payment) {
      const settled = await repo.findPaymentByReference(reference);
      if (settled?.status === 'success' && settled.subscription_id) {
        return {
          payment: settled,
          subscription: await repo.findSubscriptionById(settled.subscription_id),
        };
      }
      throw Object.assign(new Error('Payment is being processed — try again shortly'), { statusCode: 409 });
    }

    const verification = await paystack.verifyTransaction(reference);
    const expectedAmount = toSubunit(toNumber(payment.amount));
    const expectedCurrency = String(payment.currency).toUpperCase();
    const actualCurrency = String(verification.currency || '').toUpperCase();
    const successful = verification.status === 'success';
    const matches = verification.reference === reference
      && Number(verification.amount) === expectedAmount
      && actualCurrency === expectedCurrency;

    if (!successful || !matches) {
      await repo.markPaymentStatus(reference, {
        status: successful ? 'failed' : String(verification.status || 'failed'),
        providerPayload: verification.raw,
        paidAt: verification.paidAt ?? null,
      });
      throw Object.assign(new Error('Payment verification mismatch'), { statusCode: 400 });
    }

    const settled = await repo.settleVerifiedPayment(reference, verification);
    if (!settled) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    return settled;
  }

  async function listPayments(user: any, { limit = 20, offset = 0 } = {}) {
    if (!user?.id) {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    }
    const payments = await repo.findPaymentsByUser(user.id, { limit, offset });
    return payments.map((p: any) => ({ ...p, amount: toNumber(p.amount) }));
  }

  async function getSubscription(user: any) {
    if (!user?.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const [subscription, events] = await Promise.all([
      repo.findCurrentSubscription(user.id), repo.findSubscriptionEvents(user.id),
    ]);
    return { subscription, renewalPolicy: subscription?.renewal_policy ?? 'manual', events };
  }

  async function cancelSubscription(user: any, reason?: string) {
    if (!user?.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const subscription = await repo.cancelAtPeriodEnd(user.id, reason);
    if (!subscription) throw Object.assign(new Error('No active subscription found'), { statusCode: 404 });
    return subscription;
  }

  async function restoreSubscription(user: any) {
    if (!user?.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const subscription = await repo.restoreSubscription(user.id);
    if (!subscription) throw Object.assign(new Error('No restorable subscription found'), { statusCode: 404 });
    return subscription;
  }

  async function getReceipt(user: any, receiptNumber: string) {
    if (!user?.id) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const receipt = await repo.findReceiptForUser(receiptNumber, user.id);
    if (!receipt) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });
    return receipt;
  }

  async function repairEntitlement(admin: any, input: any) {
    const plan = await repo.findActivePlanBySlug(input.plan);
    if (!plan || input.plan === 'free') throw Object.assign(new Error('Active paid plan not found'), { statusCode: 404 });
    if (new Date(input.expiresAt).getTime() <= Date.now()) {
      throw Object.assign(new Error('Entitlement expiry must be in the future'), { statusCode: 400 });
    }
    return repo.repairEntitlement(admin.id, input);
  }

  async function processWebhookEvents() {
    const events = await repo.claimWebhookEvents();
    for (const event of events) {
      try {
        if (event.event_type === 'charge.success' && event.reference) {
          const payment = await repo.findPaymentByReference(event.reference);
          if (payment) await verifyPayment({ id: payment.user_id }, event.reference);
        }
        if (event.reference && (event.event_type.startsWith('refund.') || event.event_type.startsWith('charge.dispute.'))) {
          await repo.applyAdversePaymentEvent(event.reference, event.event_type, event.raw_payload);
        }
        await repo.finishWebhookEvent(event.id);
      } catch (error: any) {
        await repo.finishWebhookEvent(event.id, error?.message || 'Webhook processing failed');
      }
    }
    return { claimed: events.length };
  }

  async function reconcilePayments() {
    const payments = await repo.findStalePayments();
    for (const payment of payments) {
      try {
        const verification = await paystack.verifyTransaction(payment.reference);
        if (verification.status === 'success') {
          await verifyPayment({ id: payment.user_id }, payment.reference);
          await repo.recordReconciliation(payment, verification.status, 'repaired');
        } else {
          const terminal = new Set(['failed', 'abandoned', 'reversed']).has(String(verification.status));
          if (terminal) await repo.markPaymentStatus(payment.reference, {
            status: verification.status, providerPayload: verification.raw,
          });
          await repo.recordReconciliation(payment, verification.status, terminal ? 'terminal' : 'unchanged');
        }
      } catch (error: any) {
        await repo.recordReconciliation(payment, 'unknown', 'error', error?.message);
      }
    }
    return { checked: payments.length };
  }

  return {
    listPlans,
    initializeCheckout,
    verifyPayment,
    listPayments,
    getSubscription,
    cancelSubscription,
    restoreSubscription,
    getReceipt,
    repairEntitlement,
    processWebhookEvents,
    reconcilePayments,
  };
}
