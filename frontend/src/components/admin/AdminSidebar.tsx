"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactElement;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: "Overview",
    items: [
      { href: "/admin",               label: "Dashboard",     icon: <GridIcon /> },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/users",         label: "Users",         icon: <UsersIcon /> },
      { href: "/admin/creators",      label: "Creators",      icon: <CrownIcon /> },
      { href: "/admin/predictions",   label: "Predictions",   icon: <ChartIcon /> },
      { href: "/admin/codes",         label: "Booking Codes", icon: <TicketIcon /> },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: <CrownIcon /> },
      { href: "/admin/forum",         label: "Forum",         icon: <ForumIcon /> },
      { href: "/admin/moderation",    label: "Moderation",    icon: <ShieldIcon /> },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/admin/feature-flags", label: "Feature Flags", icon: <ToggleIcon /> },
      { href: "/admin/ai-controls",   label: "AI Controls",   icon: <ChartIcon /> },
      { href: "/admin/audit-logs",    label: "Audit Logs",    icon: <LogIcon /> },
      { href: "/admin/settings",      label: "Settings",      icon: <GearIcon /> },
    ],
  },
];

interface AdminUser {
  email?: string;
}

interface AdminSidebarProps {
  user?: AdminUser | null;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ user, onLogout, open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sidebarContent = (
    <aside className="w-64 shrink-0 h-full flex flex-col glass border-r border-border/40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-sm shrink-0">
            S
          </div>
          <div>
            <div className="text-foreground font-black text-base leading-tight tracking-tighter">Admin Panel</div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-[0.2em]">SportStatHubligence</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          aria-label="Close menu"
        >
          <XIcon />
        </button>
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
                const active = pathname === item.href;
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-border/30">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface/50">
          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-accent">
              {user?.email?.[0]?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-foreground truncate">{user?.email || "Admin"}</div>
            <div className="text-[10px] text-accent font-bold uppercase tracking-wider">Administrator</div>
          </div>
          <button
            onClick={onLogout}
            className="text-muted hover:text-danger transition-colors p-1 rounded-lg hover:bg-danger/10"
            title="Logout"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden lg:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile — slide-in drawer + backdrop */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-10 flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Icons ───────────────────────────────────────────────────
function XIcon()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function ChartIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function ForumIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function ShieldIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/></svg>; }
function GridIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function UsersIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function TicketIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>; }
function CrownIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21 6l-2 13H5L3 6l4.094 3.164a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>; }
function LogIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }
function GearIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>; }
function LogoutIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function ToggleIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="7" width="9" height="10" rx="5"/><rect x="13" y="7" width="9" height="10" rx="5"/><circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.4"/><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none"/></svg>; }
