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

    const payment = await repo.findPaymentByReference(reference);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    if (Number(payment.user_id) !== Number(user?.id)) {
      throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    }
    if (payment.status === 'success' && payment.subscription_id) {
      return {
        payment,
        subscription: await repo.findSubscriptionById(payment.subscription_id),
      };
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

    const subscription = await repo.activateSubscription({
      userId: payment.user_id,
      plan: payment.plan,
      expiresAt: addInterval(new Date(), payment.billing_interval).toISOString(),
      reference,
    });

    const paidPayment = await repo.markPaymentStatus(reference, {
      status: 'success',
      providerPayload: verification.raw,
      paidAt: verification.paidAt ?? new Date().toISOString(),
      subscriptionId: subscription.id,
    });

    return {
      payment: paidPayment,
      subscription,
    };
  }

  return {
    listPlans,
    initializeCheckout,
    verifyPayment,
  };
}
