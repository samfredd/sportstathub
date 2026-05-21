"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { XIcon, CheckCircleIcon, CrownIcon } from "@/components/Icons";
import { billingApi } from "@/lib/billingApi";

interface Props {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

interface Plan {
  id: number;
  slug: string;
  display_name: string;
  description?: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features?: string[] | null;
  is_active: boolean;
  is_popular?: boolean;
}

const FALLBACK_FREE_FEATURES = [
  "Basic match scores",
  "Community forum access",
];

function formatPrice(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString("en-US")}`;
  }
}

export default function UpgradeModal({ open, onClose, feature }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);
    billingApi.getPlans()
      .then((data) => {
        if (alive) setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setPlans([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const freePlan = useMemo(() => plans.find((plan) => plan.slug === "free"), [plans]);
  const paidPlans = useMemo(
    () => plans.filter((plan) => plan.is_active && plan.slug !== "free"),
    [plans]
  );
  const highlightedPlan = paidPlans.find((plan) => plan.is_popular) ?? paidPlans[0] ?? null;
  const freeFeatures = freePlan?.features?.length ? freePlan.features : FALLBACK_FREE_FEATURES;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="h-1 w-full bg-gradient-to-r from-accent via-accent to-amber-500" />
        <div className="flex items-start justify-between px-5 py-4 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CrownIcon className="w-4 h-4 text-accent-gold" />
              <h2 className="text-[15px] font-black text-foreground">
                Upgrade{highlightedPlan ? ` to ${highlightedPlan.display_name}` : ""}
              </h2>
            </div>
            {feature && (
              <p className="text-[12px] text-muted">
                <span className="font-bold text-accent">{feature}</span> requires a paid plan.
              </p>
            )}
            {!feature && (
              <p className="text-[12px] text-muted">Unlock the full platform with the plans configured by the admin.</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Free tier */}
        <div className="px-5 py-3 border-b border-border/40 bg-background/40">
          <p className="text-[10px] font-black text-muted uppercase tracking-wider mb-2">
            Your current plan — {freePlan?.display_name ?? "Free"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {freeFeatures.map(f => (
              <span key={f} className="flex items-center gap-1 text-[11px] text-muted">
                <CheckCircleIcon className="w-3 h-3 text-muted/50 shrink-0" />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Pro plan */}
        <div className="p-5">
          <div className="space-y-3">
            {loading && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
                <div className="h-5 w-28 rounded bg-surface/70 animate-pulse mb-4" />
                <div className="h-8 w-36 rounded bg-surface/70 animate-pulse mb-5" />
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-4 rounded bg-surface/70 animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {!loading && paidPlans.map((plan) => {
              const features = plan.features?.length ? plan.features : [];
              return (
                <div key={plan.id} className="rounded-xl border border-accent/40 bg-accent/5 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-black text-accent">{plan.display_name}</span>
                    {plan.is_popular && (
                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border text-accent border-accent/40 opacity-70">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="text-[24px] font-black text-accent">{formatPrice(plan.price_monthly, plan.currency)}</span>
                    <span className="text-[10px] text-muted">/month</span>
                  </div>
                  {features.length > 0 && (
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-5">
                      {features.slice(0, 6).map(f => (
                        <li key={f} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
                          <CheckCircleIcon className="w-3 h-3 shrink-0 mt-px text-accent" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {!loading && paidPlans.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-surface/40 p-5">
                <p className="text-[12px] font-bold text-muted">
                  No active paid plans are available right now.
                </p>
              </div>
            )}

            <Link
              href="/dashboard/subscription"
              onClick={onClose}
              className="w-full flex items-center justify-center py-2.5 rounded-lg text-[12px] font-black text-white transition-all hover:opacity-90"
              style={{ background: "var(--accent-gradient, var(--accent))" }}
            >
              View Plans →
            </Link>
          </div>
        </div>

        <div className="px-5 pb-4 text-center">
          <p className="text-[10px] text-muted">
            Cancel anytime · Secure payment · Instant activation
          </p>
        </div>
      </div>
    </div>
  );
}
