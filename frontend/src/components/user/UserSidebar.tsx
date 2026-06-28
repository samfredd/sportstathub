"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem { href: string; label: string; icon: React.ReactElement; external?: boolean; creatorOnly?: boolean; }
interface NavSection { section: string; items: NavItem[]; }

const NAV: NavSection[] = [
  {
    section: "Discover",
    items: [
      { href: "/",            label: "Home",          icon: <HomeIcon />,   external: true },
      { href: "/predictions", label: "Predictions",   icon: <ChartIcon />,  external: true },
      { href: "/codes",       label: "Booking Codes", icon: <TicketIcon />, external: true },
      { href: "/forum",       label: "Forum",         icon: <ForumIcon />,  external: true },
      { href: "/stats",       label: "Statistics",    icon: <StatsIcon />,  external: true },
      { href: "/rankings",    label: "Rankings",      icon: <TrophyIcon />, external: true },
    ],
  },
  {
    section: "My Account",
    items: [
      { href: "/dashboard",              label: "Overview",     icon: <GridIcon /> },
      { href: "/dashboard/profile",      label: "Profile",      icon: <UserIcon /> },
      { href: "/dashboard/subscription", label: "Subscription", icon: <CrownIcon /> },
      { href: "/dashboard/creator",      label: "Creator",      icon: <StarIcon /> },
    ],
  },
  {
    section: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: <GearIcon /> },
    ],
  },
];

interface UserSidebarProps {
  user?: { email?: string; username?: string; role?: string } | null;
  onLogout: () => void;
}

export default function UserSidebar({ user, onLogout }: UserSidebarProps) {
  const pathname = usePathname();
  const isCreator = user?.role === "creator";
  const displayName = user?.username || user?.email?.split("@")[0] || "User";

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col glass border-r border-border/40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border/30 flex items-center gap-3">
        <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-sm">
          S
        </div>
        <div>
          <div className="text-foreground font-black text-base leading-tight tracking-tighter">Dashboard</div>
          <div className="text-[10px] text-muted font-bold uppercase tracking-[0.2em]">SportStatHubligence</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto no-scrollbar">
        {NAV.map((section) => (
          <div key={section.section}>
            <p className="text-[10px] font-black text-muted/60 uppercase tracking-[0.2em] px-3 mb-2">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (item.creatorOnly && !isCreator) return null;
                const active = !item.external && (
                  item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
                );
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                      active
                        ? "bg-accent text-white shadow-sm"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 ${active ? "text-white" : ""}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.external && <ExternalIcon className="w-3 h-3 opacity-40" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border/30">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface/50">
          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-accent">
              {displayName[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-foreground truncate">{displayName}</div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${
              user?.role === "creator" ? "text-accent-gold" : "text-accent"
            }`}>{user?.role || "user"}</div>
          </div>
          <button
            onClick={onLogout}
            className="text-muted hover:text-danger transition-colors p-1 rounded-lg hover:bg-danger/10"
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Icons ───────────────────────────────────────────────────
function HomeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function ChartIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function TicketIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>; }
function ForumIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function StatsIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
function TrophyIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>; }
function GridIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function UserIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function CrownIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21 6l-2 13H5L3 6l4.094 3.164a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>; }
function StarIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function GearIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>; }
function LogoutIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function ExternalIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>; }
