"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/admin/StatCard";
import { adminApi } from "@/lib/adminApi";

// ─── Types ────────────────────────────────────────────────────
interface DailyStat {
  date: string;
  users_count: number;
  codes_count: number;
  predictions_count: number;
}

interface FunnelData {
  total: number;
  pro: number;
  free: number;
}

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ data, valueKey, label }: { data: DailyStat[]; valueKey: keyof DailyStat; label: string }) {
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const chartH = 80;
  const barW = 100 / data.length;
  const gap = 0.8;

  const dayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  };

  return (
    <div className="glass border border-border/30 rounded-2xl p-4 sm:p-5">
      <h4 className="text-xs font-black text-muted uppercase tracking-wider mb-4">{label}</h4>
      <svg width="100%" height={chartH + 24} viewBox={`0 0 100 ${chartH + 24}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {data.map((d, i) => {
          const val = Number(d[valueKey]);
          const barH = max > 0 ? (val / max) * chartH : 0;
          const x = i * barW + gap / 2;
          const w = barW - gap;
          const y = chartH - barH;
          return (
            <g key={i}>
              <rect x={`${x}%`} y={y} width={`${w}%`} height={barH} rx="2" className="fill-accent opacity-80" />
              {val === max && max > 0 && (
                <text x={`${x + w / 2}%`} y={y - 2} textAnchor="middle" className="fill-accent" style={{ fontSize: "4px", fontWeight: 900 }}>
                  {val}
                </text>
              )}
              <text x={`${x + w / 2}%`} y={chartH + 16} textAnchor="middle" className="fill-muted" style={{ fontSize: "4px", fontWeight: 700 }}>
                {dayLabel(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Subscription Funnel Card ─────────────────────────────────
function FunnelCard({ funnel }: { funnel: FunnelData }) {
  const total = funnel.total || 1;
  const proPercent = Math.round((funnel.pro / total) * 100);
  const freePercent = 100 - proPercent;

  return (
    <div className="glass border border-border/30 rounded-2xl p-4 sm:p-6 space-y-5">
      <h3 className="text-sm font-black text-foreground">Subscription Funnel</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Total Users</div>
          <div className="text-lg sm:text-xl font-black text-foreground">{Number(funnel.total).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Pro Users</div>
          <div className="text-lg sm:text-xl font-black text-accent">{Number(funnel.pro).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Free Users</div>
          <div className="text-lg sm:text-xl font-black text-foreground">{Number(funnel.free).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Conversion</div>
          <div className="text-lg sm:text-xl font-black text-accent">{proPercent}%</div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">
          <span>Free {freePercent}%</span>
          <span>Pro {proPercent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface overflow-hidden flex">
          <div className="h-full bg-muted/30 transition-all" style={{ width: `${freePercent}%` }} />
          <div className="h-full bg-accent transition-all" style={{ width: `${proPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats]     = useState<any>(null);
  const [funnel, setFunnel]   = useState<FunnelData | null>(null);
  const [daily, setDaily]     = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.getStats(),
      adminApi.getSubscriptionFunnel().catch(() => null),
      adminApi.getDailyStats().catch(() => null),
    ])
      .then(([s, f, d]) => {
        setStats(s);
        if (f) {
          const fData = f.data ?? f;
          setFunnel(fData as FunnelData);
        }
        if (d) {
          const arr = Array.isArray(d) ? d : (d.data ?? []);
          setDaily(arr as DailyStat[]);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  const { users, subscriptions, recentUsers = [] } = stats;
  const proUsers      = funnel?.pro     ?? subscriptions?.pro      ?? 0;
  const totalCreators = stats.creators?.total ?? "—";

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Dashboard</h2>
          <p className="text-muted text-sm font-medium mt-1">Overview of all platform activity</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black bg-surface border border-border/40 text-muted hover:text-foreground hover:bg-surface-hover transition-all shrink-0"
        >
          Refresh
        </button>
      </div>

      {/* Stat Cards — 2 cols on mobile, 3 on md, 6 on 2xl */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-5">
        <StatCard
          icon={<UsersIcon />}
          label="Total Users"
          value={Number(users.total).toLocaleString()}
          sub={`${users.verified} verified · ${users.new_this_week} this week`}
          color="blue"
        />
        <StatCard
          icon={<ChartIcon />}
          label="Predictions"
          value={Number(stats.predictions?.total ?? 0).toLocaleString()}
          sub={`${stats.predictions?.open ?? 0} open · ${stats.predictions?.this_week ?? 0} this week`}
          color="accent"
        />
        <StatCard
          icon={<CrownIcon />}
          label="Subscriptions"
          value={Number(subscriptions.total).toLocaleString()}
          sub={`${subscriptions.active} active · ${subscriptions.pro} Pro`}
          color="purple"
        />
        <StatCard
          icon={<StarIcon />}
          label="Enterprise"
          value={Number(subscriptions.enterprise).toLocaleString()}
          sub="Enterprise plan users"
          color="amber"
        />
        <StatCard
          icon={<PersonIcon />}
          label="Creators"
          value={typeof totalCreators === "number" ? Number(totalCreators).toLocaleString() : String(totalCreators)}
          sub="Registered creators"
          color="accent"
        />
        <StatCard
          icon={<ShieldIcon />}
          label="Pro Users"
          value={Number(proUsers).toLocaleString()}
          sub="Active Pro subscribers"
          color="purple"
        />
      </div>

      {/* Activity Charts */}
      {daily.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-foreground mb-3 sm:mb-4">Activity — Last 7 Days</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            <BarChart data={daily} valueKey="users_count"       label="New Users (7d)" />
            <BarChart data={daily} valueKey="predictions_count" label="New Predictions (7d)" />
          </div>
        </div>
      )}

      {/* Subscription Funnel */}
      {funnel && <FunnelCard funnel={funnel} />}

      {/* Recent Activity — stacks on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">

        {/* Recent Users */}
        <div className="glass rounded-2xl border border-border/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/30">
            <h3 className="font-black text-foreground text-sm">Recent Users</h3>
            <Link href="/admin/users" className="text-xs text-accent font-bold hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border/20">
            {recentUsers.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">No users yet</p>
            ) : recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-surface/30 transition-colors">
                {/* Avatar */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} className="w-full h-full rounded-full object-cover" />
                    : <span className="text-sm font-black text-accent">{u.username?.[0]?.toUpperCase()}</span>
                  }
                </div>
                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{u.username}</div>
                  <div className="text-xs text-muted truncate hidden sm:block">{u.email}</div>
                </div>
                {/* Badges — hide verified on tiny screens */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <RoleBadge role={u.role} />
                  <span className="hidden sm:inline"><VerifiedBadge verified={u.is_verified} /></span>
                </div>
                {/* Date — hidden on xs */}
                <div className="hidden sm:block text-xs text-muted/60 font-medium shrink-0">
                  {new Date(u.created_at).toLocaleDateString("en-GB")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Predictions */}
        <div className="glass rounded-2xl border border-border/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/30">
            <h3 className="font-black text-foreground text-sm">Recent Predictions</h3>
            <Link href="/admin/predictions" className="text-xs text-accent font-bold hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border/20">
            {(stats.recentPredictions ?? []).length === 0 ? (
              <p className="text-center text-muted text-sm py-8">No predictions yet</p>
            ) : (stats.recentPredictions ?? []).map((p: any) => {
              const match = p.match_data ?? {};
              const pred  = p.prediction ?? {};
              const home  = match.home_team ?? match.homeTeam ?? "—";
              const away  = match.away_team ?? match.awayTeam ?? "—";
              const statusColors: Record<string, string> = {
                open: "bg-accent/10 text-accent",
                won:  "bg-success/10 text-success",
                lost: "bg-danger/10 text-danger",
                void: "bg-accent-gold/10 text-accent-gold",
              };
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-surface/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{home} vs {away}</div>
                    <div className="text-xs text-muted truncate">{pred.tip ?? p.sport}</div>
                  </div>
                  {pred.odds && (
                    <span className="text-xs font-black text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded-full shrink-0">{pred.odds}x</span>
                  )}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize shrink-0 ${statusColors[p.status] ?? "bg-surface text-muted"}`}>
                    {p.status}
                  </span>
                  <div className="hidden sm:block text-xs text-muted/60 font-medium shrink-0">
                    {new Date(p.created_at).toLocaleDateString("en-GB")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-2xl border border-border/30 p-4 sm:p-6">
        <h3 className="font-black text-foreground text-sm mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
          <Link
            href="/admin/predictions"
            className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 bg-accent text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-accent-hover transition-all hover:-translate-y-0.5 shadow-sm text-center"
          >
            <ChartIcon /> <span>Post Prediction</span>
          </Link>
          <Link
            href="/admin/subscriptions"
            className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 bg-accent/10 border border-accent/20 text-accent text-xs sm:text-sm font-bold rounded-xl hover:bg-accent/20 transition-all text-center"
          >
            <CrownIcon /> <span>Subscriptions</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 bg-surface border border-border/40 text-foreground text-xs sm:text-sm font-bold rounded-xl hover:bg-surface-hover transition-all text-center"
          >
            <UsersIcon /> <span>Users</span>
          </Link>
          <Link
            href="/admin/creators"
            className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-xs sm:text-sm font-bold rounded-xl hover:bg-accent-gold/20 transition-all text-center"
          >
            <CrownIcon /> <span>Creators</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
      role === "admin" ? "bg-accent-gold/15 text-accent-gold" : "bg-surface text-muted"
    }`}>
      {role}
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-success/10 text-success">✓</span>
    : <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-danger/10 text-danger">✗</span>;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="glass border border-danger/20 rounded-2xl p-6 text-danger text-sm font-medium">
      &#9888; Failed to load dashboard: {message}
    </div>
  );
}

// Icons
function UsersIcon()  { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function ChartIcon()  { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function TicketIcon() { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>; }
function CrownIcon()  { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21 6l-2 13H5L3 6l4.094 3.164a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>; }
function StarIcon()   { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function PersonIcon() { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21 6l-2 13H5L3 6l4.094 3.164a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>; }
function ShieldIcon() { return <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
