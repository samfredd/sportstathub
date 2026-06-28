"use client";

import { useUpgradeModal } from "@/context/UpgradeModalContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { CrownIcon } from "@/components/Icons";

interface PremiumGateProps {
  children: React.ReactNode;
  /** Feature name shown in the upgrade modal */
  feature?: string;
  /** How to render the locked state: "blur" blurs children, "replace" hides them entirely */
  mode?: "blur" | "replace";
  /** Compact inline lock badge instead of a full overlay */
  inline?: boolean;
  /**
   * Feature flag key (from feature_flags table). When provided, the required
   * plan is read from the DB instead of a hardcoded default. If the flag is
   * disabled (is_enabled=false) or required_plan='free', everyone can access.
   */
  flagKey?: string;
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

function planRank(plan?: string | null) {
  if (!plan) return 0;
  return PLAN_RANK[plan] ?? 1;
}

export default function PremiumGate({
  children,
  feature,
  mode = "blur",
  inline = false,
  flagKey,
}: PremiumGateProps) {
  const { isPro, isAdmin, plan, loading: subLoading } = useSubscription();
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const { openUpgradeModal } = useUpgradeModal();

  // ── Compute access state upfront (hooks must not be called conditionally) ──
  const loading = subLoading || (!!flagKey && flagsLoading);

  let hasAccess = true; // pass-through while loading — no flash of gate
  if (!loading) {
    if (flagKey) {
      const flag = flags[flagKey];
      if (flag) {
        // Admin settings are law
        if (!flag.is_enabled || flag.required_plan === "free") {
          hasAccess = true;
        } else {
          hasAccess = isAdmin || (isPro && planRank(plan) >= planRank(flag.required_plan));
        }
      } else {
        // Flag not in DB → fail closed → require pro
        hasAccess = isAdmin || (isPro && planRank(plan) >= planRank("pro"));
      }
    } else {
      hasAccess = isAdmin || (isPro && planRank(plan) >= planRank("pro"));
    }
  }

  // The modal is opened only on an explicit user action (clicking a locked
  // overlay/badge below) — never auto-popped on mount, which would slam a
  // paywall in front of every visitor the moment a page loads.

  // Pass-through while loading or user has access
  if (loading || hasAccess) return <>{children}</>;

  // ── Inline badge mode (nav items, section headers) ─────────────────────────
  if (inline) {
    return (
      <button
        onClick={() => openUpgradeModal(feature)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent-gold/15 border border-accent-gold/30 text-accent-gold cursor-pointer hover:bg-accent-gold/25 transition-colors"
      >
        <CrownIcon className="w-2.5 h-2.5" /> PRO
      </button>
    );
  }

  // ── Replace mode — locked card ─────────────────────────────────────────────
  if (mode === "replace") {
    return (
      <button
        onClick={() => openUpgradeModal(feature)}
        className="w-full flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border border-border/50 bg-surface/50 hover:bg-surface-hover transition-colors cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <CrownIcon className="w-4 h-4 text-accent-gold" />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-black text-foreground">
            {feature ? `${feature} is Pro` : "Pro Feature"}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Upgrade to unlock</p>
        </div>
        <span className="text-[10px] font-black text-accent group-hover:underline">View plans →</span>
      </button>
    );
  }

  // ── Blur mode (default) — blurred content with overlay ────────────────────
  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content */}
      <div className="select-none pointer-events-none blur-[3px] opacity-50">
        {children}
      </div>
      {/* Overlay */}
      <button
        onClick={() => openUpgradeModal(feature)}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/70 backdrop-blur-[1px] cursor-pointer group hover:bg-surface/80 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center">
          <CrownIcon className="w-4 h-4 text-accent-gold" />
        </div>
        <div className="text-center px-4">
          <p className="text-[11px] font-black text-foreground">
            {feature ?? "Pro Feature"}
          </p>
          <p className="text-[10px] text-muted">Upgrade to unlock</p>
        </div>
      </button>
    </div>
  );
}

/** Lightweight inline PRO badge — just shows the tag, no gating */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent-gold/15 border border-accent-gold/30 text-accent-gold ${className}`}>
      <CrownIcon className="w-2.5 h-2.5" /> PRO
    </span>
  );
}
