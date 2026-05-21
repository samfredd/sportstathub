"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { communityApi } from "@/lib/communityApi";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])) as any; } catch { return null; }
}

export default function DashboardOverviewPage() {
  const router   = useRouter();
  const [user, setUser]           = useState<any>(null);
  const [profile, setProfile]     = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/auth/login"); return; }
    const u = decodeJwt(token);
    if (!u || (u.exp && u.exp < Date.now() / 1000)) { router.replace("/auth/login"); return; }
    setUser(u);
    const isCreator = u?.role === "creator";
    Promise.all([
      communityApi.getMe().catch(() => null),
      (isCreator ? communityApi.getCreatorDashboard() : communityApi.getUserDashboard()).catch(() => null),
    ]).then(([p, d]) => { setProfile(p); setDashboard(d); });
  }, [router]);

  if (!user) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isCreator   = user.role === "creator";
  const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "User";
  const plan        = profile?.subscription_plan || dashboard?.subscription?.plan || "free";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "—";

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today    = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const completionItems = [
    { label: "Avatar",       done: !!profile?.avatar_url },
    { label: "Display name", done: !!profile?.display_name },
    { label: "Bio",          done: !!profile?.bio },
    { label: "Verified",     done: !!profile?.is_verified },
  ];
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / 4) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Overview</h2>
        <p className="text-muted text-sm font-medium mt-1">{today}</p>
      </div>

      {/* Greeting banner */}
      <div className="glass rounded-2xl p-6 border border-border/30 bg-gradient-to-br from-accent/6 to-transparent">
        <p className="text-[11px] font-black text-accent uppercase tracking-widest mb-1">{greeting}</p>
        <h3 className="text-2xl font-black text-foreground leading-tight">{displayName}</h3>
        <p className="text-sm text-muted mt-1">
          <span className="font-bold text-foreground/60">{plan.charAt(0).toUpperCase() + plan.slice(1)} plan</span>
          {" · "}Member since {memberSince}
        </p>
      </div>

      {/* Creator KPIs */}
      {isCreator && dashboard?.overview && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Clicks",      value: Number(dashboard.overview.totalClicks      ?? 0).toLocaleString(), change: dashboard.overview.weeklyChange?.clicks },
              { label: "Conversions", value: Number(dashboard.overview.totalConversions ?? 0).toLocaleString(), change: dashboard.overview.weeklyChange?.conversions },
              { label: "Earnings",    value: `₦${Number(dashboard.overview.estimatedEarnings ?? 0).toLocaleString()}`, change: dashboard.overview.weeklyChange?.earnings },
              { label: "Win Rate",    value: `${dashboard.overview.winRate ?? 0}%`, accent: true },
            ].map((k: any) => (
              <StatCard key={k.label} label={k.label} value={k.value} change={k.change} accent={k.accent} />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
            <ActivityChart chartData={dashboard.chartData ?? []} />
            <WinRateRing rate={dashboard.overview.winRate ?? 0} predictions={dashboard.predictions ?? []} />
          </div>

          <RecentTips predictions={dashboard.predictions ?? []} />

          {dashboard.topCodes?.length > 0 && (
            <Section title="Top Performing Codes">
              <div className="space-y-3">
                {dashboard.topCodes.slice(0, 3).map((code: any, i: number) => (
                  <div key={code.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{code.bookmaker}</span>
                        <span className="font-mono text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded">{code.code}</span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{code.clicks?.toLocaleString()} clicks · {code.successRate}% success</p>
                    </div>
                    <span className="text-[13px] font-black text-accent shrink-0">₦{code.earnings?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Regular user stats */}
      {!isCreator && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickStat label="Member Since" value={memberSince}                                                   icon={<CalendarIcon />} />
            <QuickStat label="Plan"         value={plan.charAt(0).toUpperCase() + plan.slice(1)}                 icon={<CrownIcon />}  accent={plan !== "free"} />
            <QuickStat label="Role"         value={user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || "User"} icon={<UserIcon />} />
            <QuickStat label="Profile"      value={`${completionPct}%`}                                          icon={<EditIcon />}   accent={completionPct === 100} />
          </div>

          {completionPct < 100 && (
            <Section title="Profile Completion">
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xl font-black text-foreground">{completionPct}%</p>
                <Link href="/dashboard/profile" className="text-sm font-bold text-accent hover:underline">Complete →</Link>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full transition-all" style={{ width: `${completionPct}%`, background: "var(--accent-gradient)" }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {completionItems.map((item) => (
                  <span key={item.label} className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${item.done ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-border/40 text-muted/60"}`}>
                    {item.done ? "✓" : "○"} {item.label}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Upgrade banner */}
      {plan === "free" && (
        <div className="glass rounded-2xl p-5 border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-foreground">You&apos;re on the Free plan</p>
            <p className="text-sm text-muted mt-0.5">Upgrade to Pro for full statistics, unlimited predictions, and more.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:-translate-y-0.5 transition-all" style={{ background: "var(--accent-gradient)" }}>
            Upgrade
          </Link>
        </div>
      )}

      {/* Become creator CTA */}
      {!isCreator && (
        <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-foreground">Become a Creator</p>
            <p className="text-sm text-muted mt-0.5">Post tips, share booking codes, and earn affiliate commissions.</p>
          </div>
          <Link href="/dashboard/creator" className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all">
            Learn more
          </Link>
        </div>
      )}

      {/* Quick links */}
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/predictions", label: "Browse Tips",   desc: "Today's picks",    icon: <ChartIcon /> },
            { href: "/codes",       label: "Booking Codes", desc: "Latest slips",     icon: <TicketIcon /> },
            { href: "/forum",       label: "Forum",         desc: "Discussions",      icon: <ForumIcon /> },
            { href: "/stats",       label: "Stats",         desc: "Team analytics",   icon: <StatsIcon /> },
            { href: "/rankings",    label: "Rankings",      desc: "League tables",    icon: <TrophyIcon /> },
            { href: "/h2h",         label: "Head to Head",  desc: "Compare teams",    icon: <H2HIcon /> },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-start gap-0.5 p-4 rounded-xl hover:bg-surface-hover border border-border/40 transition-all hover:-translate-y-0.5">
              <span className="w-5 h-5 text-accent mb-1">{item.icon}</span>
              <span className="text-sm font-black text-foreground">{item.label}</span>
              <span className="text-[10px] text-muted">{item.desc}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 border border-border/30">
      <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value, change, accent }: { label: string; value: string; change?: number; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 border ${accent ? "border-accent/20 bg-accent/5" : "border-border/30"}`}>
      <p className={`text-2xl font-black tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
      <p className="text-[11px] text-muted mt-0.5 font-medium">{label}</p>
      {change !== undefined && (
        <p className={`text-[10px] font-black mt-1 ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last week
        </p>
      )}
    </div>
  );
}

function QuickStat({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-4 h-4 ${accent ? "text-accent" : "text-muted"}`}>{icon}</span>
        <span className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-lg font-black tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ActivityChart({ chartData }: { chartData: Array<{ day: string; clicks: number; conversions: number }> }) {
  const maxVal = Math.max(...chartData.map((d) => d.clicks), 1);
  return (
    <div className="glass rounded-2xl p-5 border border-border/30">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-black text-muted uppercase tracking-widest">7-Day Activity</p>
        <div className="flex items-center gap-3 text-[10px] text-muted font-bold">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent/60 inline-block" />Clicks</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" />Conversions</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {chartData.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex items-end gap-0.5 h-20">
              <div className="flex-1 bg-accent/25 hover:bg-accent/45 rounded-sm transition-all" style={{ height: `${(d.clicks / maxVal) * 100}%`, minHeight: d.clicks > 0 ? "3px" : "0" }} title={`${d.clicks} clicks`} />
              <div className="flex-1 bg-emerald-400/50 hover:bg-emerald-400/70 rounded-sm transition-all" style={{ height: `${(d.conversions / maxVal) * 100}%`, minHeight: d.conversions > 0 ? "3px" : "0" }} title={`${d.conversions} conversions`} />
            </div>
            <span className="text-[9px] text-muted font-bold">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinRateRing({ rate, predictions }: { rate: number; predictions: any[] }) {
  const won  = predictions.filter((p) => p.status === "won").length;
  const lost = predictions.filter((p) => p.status === "lost").length;
  const open = predictions.filter((p) => p.status === "open").length;
  const circumference = 2 * Math.PI * 36;
  const dash = (rate / 100) * circumference;
  return (
    <div className="glass rounded-2xl p-5 border border-border/30 flex flex-col items-center justify-center gap-3">
      <p className="text-[11px] font-black text-muted uppercase tracking-widest">Win Rate</p>
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[18px] font-black text-foreground leading-none">{rate}%</span>
        </div>
      </div>
      <div className="flex gap-2.5 text-[10px] font-black">
        <span className="text-emerald-400">{won}W</span>
        <span className="text-rose-400">{lost}L</span>
        <span className="text-accent">{open} open</span>
      </div>
    </div>
  );
}

function RecentTips({ predictions }: { predictions: any[] }) {
  const recent = predictions.slice(0, 3);
  if (!recent.length) return null;
  const statusColor: Record<string, string> = {
    won: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    lost: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    open: "text-accent bg-accent/10 border-accent/20",
  };
  return (
    <Section title="Recent Tips">
      <div className="space-y-2">
        {recent.map((pred: any) => (
          <div key={pred.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface/40 border border-border/20">
            <div className={`w-1 self-stretch rounded-full shrink-0 ${pred.status === "won" ? "bg-emerald-400" : pred.status === "lost" ? "bg-rose-400" : "bg-accent"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{pred.match?.homeTeam?.name} vs {pred.match?.awayTeam?.name}</p>
              <p className="text-[10px] text-muted mt-0.5">{pred.prediction?.type} · @{pred.prediction?.odds} · {pred.prediction?.confidence}% conf</p>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusColor[pred.status] ?? "text-muted border-border/40"}`}>{pred.status}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Icons ──────────────────────────────────────────────────
function CalendarIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function CrownIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21 6l-2 13H5L3 6l4.094 3.164a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>; }
function UserIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function EditIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function ChartIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function TicketIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>; }
function ForumIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function StatsIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
function TrophyIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>; }
function H2HIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>; }
