"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchIcon, LockIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";
import { useState, useEffect, useRef } from "react";
import { getSessionUser, logout as sessionLogout, type SessionUser } from "@/lib/session";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/",           label: "Matches" },
  { href: "/predictions", label: "Tips" },
  { href: "/codes",       label: "Codes" },
  { href: "/forum",      label: "Forum" },
  { href: "/news",       label: "News" },
  { href: "/rankings",   label: "Rankings" },
  { href: "/stats",      label: "Stats" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setUser(getSessionUser()));

    function syncUser() { setUser(getSessionUser()); }
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setUser(null);
    void sessionLogout().finally(() => { window.location.href = "/"; });
  }

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/90 backdrop-blur-xl border-b border-border transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">

          {/* Logo + Desktop Nav */}
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center font-black text-white text-lg shadow-premium group-hover:brightness-110 transition-all">
                S
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-foreground font-extrabold text-[16px] leading-none tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
                  SportStatHub
                </span>
                <span className="text-[10px] text-foreground/70 font-semibold mt-1">Football Analytics</span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-2 border-l border-border pl-8 h-8">
              {NAV_LINKS.map(({ href, label }) => (
                <NavLink key={href} href={href} active={isActive(href)}>
                  {label}
                </NavLink>
              ))}
              <Link href="/dashboard/subscription"
                className="ml-3 px-3 py-1.5 bg-accent-gold/10 text-accent-gold-hover text-[10px] font-black rounded-lg hover:bg-accent-gold/20 transition-all flex items-center gap-1.5 border border-accent-gold/25 cursor-pointer"
                aria-label="Open Pro plan details"
                title="Open Pro plan details"
              >
                <LockIcon className="w-3 h-3" /> PRO
              </Link>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link href="/search" className="text-muted hover:text-foreground p-2 hidden sm:flex transition-all hover:bg-surface-hover rounded-xl cursor-pointer" aria-label="Search">
              <SearchIcon className="w-4.5 h-4.5" />
            </Link>
            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-2 border-l border-border ml-1 pl-3">
              {user ? (
                <div className="relative" ref={avatarRef}>
                  <button
                    onClick={() => setAvatarDropdownOpen((o) => !o)}
                    className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center border border-accent/30 hover:border-accent/60 transition-all cursor-pointer"
                    aria-label="Account menu"
                  >
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      : <span className="text-xs font-black text-accent">{user.email?.[0]?.toUpperCase()}</span>
                    }
                  </button>
                  {avatarDropdownOpen && (
                    <div className="absolute right-0 top-10 w-44 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-[11px] text-muted truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setAvatarDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-surface-hover hover:text-accent transition-colors"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={() => { setAvatarDropdownOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/auth/register"
                    className="flex items-center gap-2 px-4 py-2 text-foreground hover:text-accent text-[12px] font-black rounded-xl hover:bg-surface-hover transition-all"
                  >
                    JOIN
                  </Link>
                  <Link
                    href="/auth/login"
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent-hover text-[12px] font-black rounded-xl shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    SIGN IN
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile avatar — visible only on mobile, links to dashboard or login */}
            <Link
              href={user ? "/dashboard" : "/auth/login"}
              className="lg:hidden ml-1 w-10 h-10 rounded-full flex items-center justify-center border transition-all
                bg-accent/10 border-accent/20 hover:border-accent/50"
              aria-label="Account"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : user ? (
                <span className="text-xs font-black text-accent">{user.email?.[0]?.toUpperCase()}</span>
              ) : (
                <UserCircleIcon />
              )}
            </Link>
          </div>
        </div>
      </div>

    </nav>
  );
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  active: boolean;
}

function NavLink({ href, children, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-2 text-[13px] font-bold transition-colors group ${
        active ? "text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
      <span
        className={`absolute bottom-0 left-0 w-full h-0.5 bg-accent transition-transform origin-left ${
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
        }`}
      />
    </Link>
  );
}

function UserCircleIcon() {
  return (
    <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
