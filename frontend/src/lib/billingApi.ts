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
    throw new Error((json.error as string) || (json.message as string) || "Request failed");
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
};
