"use client";
import Link from "next/link";
import { useState } from "react";
import CreatorBadge from "./CreatorBadge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTrackingClick } from "@/hooks/useTrackingClick";

const SPORT_ICONS: Record<string, string> = {
  Football:   "⚽",
  Basketball: "🏀",
  Tennis:     "🎾",
  default:    "🏆",
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  open:  { label: "Open",  cls: "bg-accent/15 text-accent border-accent/25" },
  won:   { label: "Won ✓", cls: "bg-success/15 text-success border-success/25" },
  lost:  { label: "Lost",  cls: "bg-danger/15 text-danger border-danger/25" },
  void:  { label: "Void",  cls: "bg-muted/15 text-muted border-muted/25" },
};

const FORM_COLORS: Record<string, string> = {
  W: "bg-success/20 text-success",
  D: "bg-yellow-500/20 text-yellow-400",
  L: "bg-danger/20 text-danger",
};

const PLATFORM_COLORS: Record<string, string> = {
  bet9ja:    "from-green-600 to-green-700",
  sportybet: "from-orange-500 to-orange-700",
  "1xbet":   "from-blue-600 to-blue-800",
  bet365:    "from-emerald-600 to-emerald-800",
  betway:    "from-green-500 to-teal-700",
  betking:   "from-purple-600 to-purple-800",
  melbet:    "from-sky-500 to-sky-700",
  parimatch: "from-yellow-600 to-orange-600",
  default:   "from-accent to-accent-hover",
};

function platformGrad(name = ""): string {
  return PLATFORM_COLORS[name.toLowerCase().replace(/\s+/g, "")] ?? PLATFORM_COLORS.default;
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

interface TeamData {
  name: string;
  form?: string[];
}

interface PredictionData {
  shorthand: string;
  type: string;
  odds: number;
  confidence: number;
}

interface BookingCodeData {
  code: string;
  bookmaker: string;
  clicks: number;
  trackingId: string;
  affiliateUrl?: string;
  successRate: number;
  conversionStatus?: string;
}

interface CreatorStats {
  winRate: number;
  totalPredictions: number;
  currentStreak: number;
}

interface CreatorData {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  badge?: string;
  badgeLabel?: string;
  stats: CreatorStats;
}

interface MatchData {
  date: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
}

interface LeagueData {
  name: string;
}

interface PredictionItem {
  id: string;
  match: MatchData;
  prediction: PredictionData;
  creator: CreatorData;
  bookingCode?: BookingCodeData;
  status: string;
  stats: { likes: number; comments: number; views: number };
  sport: string;
  league: LeagueData;
  isTrending?: boolean;
  isPremium?: boolean;
}

interface PredictionCardProps {
  prediction: PredictionItem;
  compact?: boolean;
}

export default function PredictionCard({ prediction, compact = false }: PredictionCardProps) {
  const { match, prediction: pred, creator, bookingCode, status, stats, sport, league, isTrending, isPremium } = prediction;
  const { copied, copy } = useCopyToClipboard();
  const { trackCodeCopy, trackBookmakerOpen } = useTrackingClick();
  const [showCode, setShowCode] = useState(false);

  const statusInfo = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  const grad = platformGrad(bookingCode?.bookmaker);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!bookingCode) return;
    await copy(bookingCode.code);
    trackCodeCopy(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.code, prediction.id, creator.id);
  }

  function handleBookmakerOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!bookingCode) return;
    trackBookmakerOpen(bookingCode.trackingId, bookingCode.bookmaker, bookingCode.affiliateUrl, prediction.id, creator.id);
    if (bookingCode.affiliateUrl && bookingCode.affiliateUrl !== '#') {
      window.open(bookingCode.affiliateUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="group relative card-premium overflow-hidden">
      {/* Accent top bar based on status */}
      <div className={`h-0.5 w-full ${status === 'won' ? 'bg-success' : status === 'lost' ? 'bg-danger' : 'bg-gradient-to-r from-accent to-accent-hover'}`} />

      <div className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{SPORT_ICONS[sport] ?? SPORT_ICONS.default}</span>
            <span className="text-[11px] text-muted font-bold uppercase tracking-wider">{league.name}</span>
            {isTrending && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[9px] font-black uppercase tracking-wider rounded-full">
                🔥 Trending
              </span>
            )}
            {isPremium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-[9px] font-black uppercase tracking-wider rounded-full">
                ★ Premium
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted">{fmtDate(match.date)} · {fmtTime(match.date)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Match */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TeamName name={match.homeTeam.name} form={match.homeTeam.form} />
              <span className="text-muted text-xs font-bold shrink-0">vs</span>
              <TeamName name={match.awayTeam.name} form={match.awayTeam.form} right />
            </div>
          </div>
        </div>

        {/* Prediction pill + odds + confidence */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl">
            <span className="text-accent font-black text-sm">{pred.shorthand}</span>
            <span className="text-[10px] text-muted font-bold hidden sm:inline">· {pred.type}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border rounded-xl">
            <span className="text-[10px] text-muted font-bold">ODDS</span>
            <span className="text-foreground font-black text-sm">{pred.odds.toFixed(2)}</span>
          </div>
          <ConfidenceBar value={pred.confidence} />
        </div>

        {/* Booking code (collapsible on mobile) */}
        {bookingCode && !compact && (
          <div className="mb-3">
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border/50 bg-background/40 hover:border-accent/30 transition-colors"
              onClick={() => setShowCode(!showCode)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${grad}`} />
                <span className="text-[12px] font-bold text-muted">{bookingCode.bookmaker}</span>
                <span className="font-mono text-[12px] font-black text-foreground tracking-wider">{bookingCode.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">{fmtCount(bookingCode.clicks)} clicks</span>
                <ChevronIcon open={showCode} />
              </div>
            </button>

            {showCode && (
              <div className="mt-2 p-3 bg-background/60 border border-border/40 rounded-xl space-y-2">
                {/* Tracking metadata — visible to creator/admin, hidden from users */}
                <input type="hidden" data-tracking-id={bookingCode.trackingId} data-conversion={bookingCode.conversionStatus ?? 'pending'} />

                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm font-black text-foreground bg-surface px-3 py-2 rounded-lg border border-border/50 tracking-[0.15em] truncate">
                    {bookingCode.code}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-black transition-all duration-200 ${copied ? 'bg-success text-white' : 'bg-accent hover:bg-accent-hover text-white'}`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleBookmakerOpen}
                    className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-black bg-surface border border-border hover:border-accent/40 text-muted hover:text-foreground transition-all"
                  >
                    Open ↗
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted">
                  <span>{fmtCount(bookingCode.clicks)} clicks</span>
                  <span>·</span>
                  <span className="text-success">{bookingCode.successRate}% success rate</span>
                  <span>·</span>
                  <span>by <Link href={`/creators/${creator.id}`} className="text-accent hover:underline" onClick={e => e.stopPropagation()}>{creator.name}</Link></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Creator + stats + CTAs */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
          <CreatorBadge creator={creator} size="sm" />
          <div className="flex items-center gap-2">
            <StatIcon icon="♡" count={stats.likes} />
            <StatIcon icon="💬" count={stats.comments} />
            <StatIcon icon="👁" count={stats.views} />
          </div>
        </div>

        {/* CTA row */}
        {!compact && (
          <div className="flex gap-2 mt-3">
            <Link
              href={`/predictions/${prediction.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface border border-border/50 hover:border-accent/40 text-muted hover:text-foreground text-[12px] font-bold rounded-xl transition-all"
            >
              View Analysis
            </Link>
            <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl transition-all ${
                copied
                  ? "bg-success text-white"
                  : "btn-gradient"
              }`}
            >
              {copied ? "✓ Code Copied" : "Copy Code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TeamNameProps {
  name: string;
  form?: string[];
  right?: boolean;
}

function TeamName({ name, form, right = false }: TeamNameProps) {
  return (
    <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${right ? "justify-end flex-row-reverse" : ""}`}>
      <span className="text-foreground font-black text-sm truncate">{name}</span>
      {form && (
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          {form.slice(-3).map((r, i) => (
            <span key={i} className={`w-4 h-4 rounded-sm text-[8px] font-black flex items-center justify-center ${FORM_COLORS[r] ?? FORM_COLORS.D}`}>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ConfidenceBarProps {
  value: number;
}

function ConfidenceBar({ value }: ConfidenceBarProps) {
  const color = value >= 75 ? "bg-success" : value >= 55 ? "bg-yellow-500" : "bg-danger";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted font-bold hidden sm:inline">CONF.</span>
      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-black" style={{ color: value >= 75 ? 'var(--success)' : value >= 55 ? '#EAB308' : 'var(--danger)' }}>
        {value}%
      </span>
    </div>
  );
}

interface StatIconProps {
  icon: string;
  count: number;
}

function StatIcon({ icon, count }: StatIconProps) {
  return (
    <span className="flex items-center gap-1 text-muted text-[11px]">
      {icon} {fmtCount(count)}
    </span>
  );
}

interface ChevronIconProps {
  open: boolean;
}

function ChevronIcon({ open }: ChevronIconProps) {
  return (
    <svg className={`w-3 h-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
