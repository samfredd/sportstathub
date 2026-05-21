"use client";

import Link from "next/link";
import { XIcon, CheckCircleIcon, CrownIcon } from "@/components/Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

const PRO_FEATURES = [
  "Unlimited daily predictions",
  "Full booking codes access",
  "Live AI match insights",
  "H2H analyser",
  "Priority support",
  "Ad-free experience",
];

const FREE_FEATURES = [
  "5 predictions per day",
  "3 booking codes per day",
  "Community forum access",
  "Basic match scores",
];

export default function UpgradeModal({ open, onClose, feature }: Props) {
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
              <h2 className="text-[15px] font-black text-foreground">Upgrade to Pro</h2>
            </div>
            {feature && (
              <p className="text-[12px] text-muted">
                <span className="font-bold text-accent">{feature}</span> requires a Pro or Enterprise plan.
              </p>
            )}
            {!feature && (
              <p className="text-[12px] text-muted">Unlock the full platform — unlimited picks, AI insights & more.</p>
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
          <p className="text-[10px] font-black text-muted uppercase tracking-wider mb-2">Your current plan — Free</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FREE_FEATURES.map(f => (
              <span key={f} className="flex items-center gap-1 text-[11px] text-muted">
                <CheckCircleIcon className="w-3 h-3 text-muted/50 shrink-0" />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Pro plan */}
        <div className="p-5">
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-black text-accent">Pro</span>
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border text-accent border-accent/40 opacity-70">
                Most Popular
              </span>
            </div>
            <div className="mb-4">
              <span className="text-[24px] font-black text-accent">₦2,500</span>
              <span className="text-[10px] text-muted">/month</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-5">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
                  <CheckCircleIcon className="w-3 h-3 shrink-0 mt-px text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/subscription"
              onClick={onClose}
              className="w-full flex items-center justify-center py-2.5 rounded-lg text-[12px] font-black text-white transition-all hover:opacity-90"
              style={{ background: "var(--accent-gradient, var(--accent))" }}
            >
              Upgrade to Pro →
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
