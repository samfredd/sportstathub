"use client";
import { useState } from "react";
import { useTrackingClick } from "@/hooks/useTrackingClick";

const PLATFORM_COLORS: Record<string, string> = {
  betway:     "from-green-600 to-green-700",
  bet365:     "from-green-500 to-emerald-700",
  sportybet:  "from-orange-500 to-orange-700",
  "1xbet":      "from-blue-600 to-blue-800",
  betking:    "from-purple-600 to-purple-800",
  nairabet:   "from-sky-500 to-sky-700",
  msport:     "from-red-600 to-red-800",
};

function platformColor(name = ""): string {
  const key = name.toLowerCase().replace(/\s+/g, "");
  return PLATFORM_COLORS[key] ?? "from-accent to-accent-hover";
}

interface BookingCode {
  id: string | number;
  code: string;
  platform: string;
  trackingId?: string;
}

interface BookingCodeCardProps {
  code: BookingCode;
}

export default function BookingCodeCard({ code }: BookingCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const { trackCodeCopy } = useTrackingClick();

  function handleCopy() {
    navigator.clipboard.writeText(code.code);
    trackCodeCopy(code.trackingId ?? `public_code_${code.id}`, code.platform, code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const grad = platformColor(code.platform);

  return (
    <div className="group relative glass border border-border/30 rounded-3xl overflow-hidden hover:border-accent/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/10 transition-all duration-300">
      {/* Top colour strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />

      <div className="p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-foreground tracking-tight leading-tight">{code.platform}</h3>
            <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Verified · Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[9px] text-success font-black uppercase tracking-widest">Live</span>
          </div>
        </div>

        {/* Code + Copy */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 bg-background/60 border border-border/50 rounded-2xl px-4 py-3 group-hover:border-accent/20 transition-colors">
            <p className="font-mono text-lg font-black text-foreground tracking-[0.15em] truncate">{code.code}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 font-black text-sm shadow-sm ${
              copied
                ? "bg-success text-white scale-110 shadow-success/30"
                : "bg-accent hover:bg-accent-hover text-white hover:scale-105 active:scale-95"
            }`}
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-[10px] text-muted/60 font-bold text-center">
          {copied ? "✓ Code copied to clipboard" : "Tap to copy · Use before expiry"}
        </p>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
