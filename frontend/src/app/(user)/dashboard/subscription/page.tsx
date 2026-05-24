"use client";

import { useState, useEffect } from "react";
import { communityApi } from "@/lib/communityApi";
import { billingApi } from "@/lib/billingApi";
import { DISPLAY_CURRENCIES, useDisplayCurrency } from "@/lib/currency";

interface Profile {
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
}

interface Plan {
  id: number; slug: string; display_name: string;
  price_monthly: number; price_yearly: number; currency: string;
  features: string[] | null; is_active: boolean; is_popular: boolean;
  subscriber_count?: number;
}

const FALLBACK_FEATURES: Record<string, string[]> = {
  free: ["Live match scores", "5 predictions/day", "Community forum", "Basic booking codes"],
  pro:  ["Everything in Free", "Unlimited predictions", "Full statistics", "All booking codes", "Priority support"],
};

export default function SubscriptionPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { currency: displayCurrency, setCurrency: setDisplayCurrency, formatUsd, liveRates } = useDisplayCurrency();
  const [message, setMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("reference") || params.get("trxref") ? "Confirming your payment..." : null;
  });

  useEffect(() => {
    Promise.all([
      communityApi.getMe().catch(() => null),
      billingApi.getPlans().catch(() => []),
    ]).then(([p, pl]) => {
      setProfile(p);
      setPlans(Array.isArray(pl) ? pl : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;

    billingApi.verifyPaystack(reference)
      .then(() => communityApi.getMe())
      .then((nextProfile) => {
        setProfile(nextProfile);
        setMessage("Payment confirmed. Your subscription is active.");
      })
      .catch((error) => setMessage(error.message || "Payment could not be verified."))
      .finally(() => {
        params.delete("reference");
        params.delete("trxref");
        const query = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      });
  }, []);

  const currentPlan = profile?.subscription_plan || "free";
  const expires = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const currentPlanData = plans.find((p) => p.slug === currentPlan);
  const currentFeatures = currentPlanData?.features ?? FALLBACK_FEATURES[currentPlan] ?? FALLBACK_FEATURES.free;

  const upgradePlans = plans.filter((p) => p.is_active && p.slug !== currentPlan && p.slug !== "free");
  const formatPrice = (amount: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
  const planPrice = (plan: Plan) => billingInterval === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const displayPrice = (plan: Plan) => {
    const amount = planPrice(plan);
    if ((plan.currency || "USD").toUpperCase() !== "USD") return formatPrice(amount, plan.currency);
    return formatUsd(amount);
  };

  async function startCheckout(plan: Plan) {
    setCheckoutLoading(plan.slug);
    setMessage(null);
    try {
      const checkout = await billingApi.initializePaystack({ plan: plan.slug, interval: billingInterval });
      window.location.assign(checkout.authorizationUrl);
    } catch (error: any) {
      setMessage(error.message || "Unable to start checkout.");
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="space-y-6 h-full">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Subscription</h2>
        <p className="text-muted text-sm font-medium mt-1">Your current plan and upgrade options</p>
      </div>

      {message && (
        <div className="glass rounded-2xl p-4 border border-accent/20 bg-accent/5 text-sm font-bold text-foreground">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — Current plan */}
        <div className="glass rounded-2xl p-6 border border-border/30">
          <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-4">Current Plan</p>

          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-32 bg-surface/60 rounded-xl animate-pulse" />
              <div className="h-4 w-24 bg-surface/60 rounded-lg animate-pulse" />
              <div className="grid grid-cols-2 gap-2 mt-4">{[0,1,2,3].map(i => <div key={i} className="h-6 bg-surface/60 rounded-lg animate-pulse" />)}</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-3xl font-black text-foreground">
                    {currentPlanData?.display_name ?? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  </p>
                  {expires && <p className="text-sm text-muted mt-1">Renews {expires}</p>}
                  {!expires && currentPlan === "free" && <p className="text-sm text-muted mt-1">Free forever</p>}
                  {currentPlanData && currentPlan !== "free" && (
                    <p className="text-sm text-muted mt-1">
                      {formatPrice(currentPlanData.price_monthly, currentPlanData.currency)}/mo · {formatPrice(currentPlanData.price_yearly, currentPlanData.currency)}/yr
                    </p>
                  )}
                </div>
                <PlanBadge plan={currentPlan} large />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {currentFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span className="text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>

            </>
          )}
        </div>

        {/* Right — Upgrade options */}
        <div className="space-y-3">
          {!loading && upgradePlans.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black text-muted uppercase tracking-widest">Upgrade Options</p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <label className="sr-only" htmlFor="display-currency">Display currency</label>
                  <select
                    id="display-currency"
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value as any)}
                    title={liveRates ? "Converted with live USD exchange rates. Checkout is billed in USD." : "Converted with fallback exchange rates. Checkout is billed in USD."}
                    className="rounded-xl border border-border/30 bg-surface/70 px-3 py-2 text-[11px] font-black text-foreground outline-none focus:border-accent/50"
                  >
                    {DISPLAY_CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </select>
                  <div className="flex rounded-xl border border-border/30 bg-surface/40 p-1">
                    {(["monthly", "yearly"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setBillingInterval(mode)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${billingInterval === mode ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
                      >
                        {mode === "monthly" ? "Monthly" : "Yearly"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {upgradePlans.map((plan) => {
                  const features = plan.features ?? FALLBACK_FEATURES[plan.slug] ?? [];
                  const intervalLabel = billingInterval === "yearly" ? "/year" : "/month";
                  return (
                    <div key={plan.id} className="glass rounded-2xl p-5 border border-accent/30 bg-accent/5 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-foreground text-lg">{plan.display_name}</p>
                            {plan.is_popular && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Most Popular</span>
                            )}
                          </div>
                          <p className="text-sm text-muted mt-0.5">Cancel anytime</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-accent">{displayPrice(plan)}</p>
                          <p className="text-[11px] text-muted">{intervalLabel}</p>
                          {displayCurrency !== (plan.currency || "USD").toUpperCase() && (
                            <p className="text-[10px] text-muted/70">Billed in {plan.currency || "USD"}</p>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1.5 mb-5">
                        {features.slice(0, 5).map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-foreground font-medium">
                            <span className="text-emerald-400 shrink-0">✓</span> {f}
                          </li>
                        ))}
                        {features.length > 5 && (
                          <li className="text-[11px] text-muted font-medium pl-4">+{features.length - 5} more features</li>
                        )}
                      </ul>
                      <button
                        onClick={() => startCheckout(plan)}
                        disabled={checkoutLoading !== null}
                        className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all hover:-translate-y-0.5"
                        style={{ background: "var(--accent-gradient)" }}
                      >
                        {checkoutLoading === plan.slug ? "Opening checkout..." : `Upgrade to ${plan.display_name} →`}
                      </button>
                    </div>
                  );
                })}
            </>
          )}

          {!loading && upgradePlans.length === 0 && currentPlan !== "free" && (
            <div className="glass rounded-2xl p-6 border border-accent/20 bg-accent/5">
              <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-4">Your Pro Perks</p>
              <div className="space-y-2">
                {currentFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface/40 border border-border/20">
                    <span className="text-accent shrink-0">✓</span>
                    <span className="text-sm text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && upgradePlans.length === 0 && currentPlan === "free" && (
            <div className="glass rounded-2xl p-6 border border-border/30">
              <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-2">Upgrade Options</p>
              <p className="text-sm text-muted font-medium">No active paid plans are available right now.</p>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[0,1].map(i => <div key={i} className="h-48 rounded-2xl bg-surface/60 animate-pulse" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanBadge({ plan, large = false }: { plan: string; large?: boolean }) {
  const styles: Record<string, string> = {
    enterprise: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    pro:        "bg-accent/10 text-accent border-accent/20",
    free:       "bg-surface text-muted/60 border-border/30",
  };
  return (
    <span className={`font-black rounded-full border uppercase tracking-wider ${large ? "text-sm px-4 py-2" : "text-[10px] px-2.5 py-1"} ${styles[plan] ?? styles.free}`}>
      {plan}
    </span>
  );
}
