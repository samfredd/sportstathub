const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export function createPaystackClient({ secretKey, baseUrl = PAYSTACK_BASE_URL }: { secretKey?: string | null; baseUrl?: string } = {}) {
  async function request(path: string, init: RequestInit = {}) {
    if (!secretKey) {
      throw Object.assign(new Error('Paystack is not configured'), { statusCode: 503 });
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok || !body?.status) {
      const message = body?.message || 'Paystack request failed';
      throw Object.assign(new Error(message), { statusCode: res.status || 502 });
    }
    return body;
  }

  async function initializeTransaction({ email, amount, currency, reference, callbackUrl, metadata }: any) {
    const body: Record<string, unknown> = {
      email,
      amount: String(amount),
      currency,
      reference,
      metadata: JSON.stringify(metadata ?? {}),
    };
    if (callbackUrl) body.callback_url = callbackUrl;

    const result = await request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
      raw: result,
    };
  }

  async function verifyTransaction(reference: string) {
    const result = await request(`/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      status: result.data.status,
      reference: result.data.reference,
      amount: result.data.amount,
      currency: result.data.currency,
      paidAt: result.data.paid_at ?? result.data.paidAt ?? null,
      raw: result,
    };
  }

  return { initializeTransaction, verifyTransaction };
}
