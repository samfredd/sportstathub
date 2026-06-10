const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage?.getItem("token");
}

async function billingFetch(path: string, options: RequestInit = {}): Promise<any> {
  const authToken = token();
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include", // send the httpOnly auth cookie
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
