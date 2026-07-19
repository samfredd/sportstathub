const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function billingFetch(path: string, options: RequestInit = {}): Promise<any> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include", // auth travels in the httpOnly cookie, sent automatically
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((json.error as string) || (json.message as string) || "Request failed") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json.data ?? json;
}

export const billingApi = {
  getPlans: () => billingFetch("/api/subscription-plans"),
  initializePaystack: (body: { plan: string; interval: "monthly" | "yearly" }) =>
    billingFetch("/api/billing/paystack/initialize", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  verifyPaystack: (reference: string) =>
    billingFetch("/api/billing/paystack/verify", {
      method: "POST",
      body: JSON.stringify({ reference }),
    }),
  getHistory: (limit = 20, offset = 0) =>
    billingFetch(`/api/billing/history?limit=${limit}&offset=${offset}`),
  getSubscription: () => billingFetch('/api/billing/subscription'),
  cancelSubscription: (reason = '') => billingFetch('/api/billing/subscription/cancel', {
    method: 'POST', body: JSON.stringify({ reason }),
  }),
  restoreSubscription: () => billingFetch('/api/billing/subscription/restore', { method: 'POST' }),
  getReceipt: (receiptNumber: string) => billingFetch(`/api/billing/receipts/${encodeURIComponent(receiptNumber)}`),
};

export interface PaymentRecord {
  id: number;
  reference: string;
  plan: string;
  billing_interval: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  refunded_amount?: number;
  dispute_status?: string | null;
  receipt_number?: string | null;
}
