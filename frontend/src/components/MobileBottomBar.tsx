"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAuthed } from "@/lib/session";

interface NavIconProps { active: boolean }

/* ─── Bottom nav items ─── */
const NAV_ITEMS = [
  { href: "/",            label: "Home",  icon: HomeIcon  },
  { href: "/predictions", label: "Tips",  icon: TipsIcon  },
  { href: "/codes",       label: "Codes", icon: CodesIcon },
  { href: "/forum",       label: "Forum", icon: ForumIcon },
];

/* ─── Sheet menu items ─── */
const SHEET_LINKS = [
  { href: "/rankings",  label: "Rankings",  icon: RankingsIcon  },
  { href: "/stats",     label: "Stats",     icon: StatsIcon     },
  { href: "/h2h",       label: "H2H",       icon: H2HIcon       },
  { href: "/news",      label: "News",      icon: NewsIcon      },
  { href: "/referees",  label: "Referees",  icon: RefereesIcon  },
  { href: "/creators",  label: "Creators",  icon: CreatorsIcon  },
  { href: "/contact",   label: "Contact",   icon: ContactIcon   },
];

export default function MobileBottomBar() {
  const pathname    = usePathname();
  const [open, setOpen]   = useState(false);
  const [authed, setAuthed] = useState(false);
  const sheetRef=useRef<HTMLDivElement>(null);
  const moreButtonRef=useRef<HTMLButtonElement>(null);

  /* Read auth state on mount + react to login/logout */
  useEffect(() => {
    const check = () => setAuthed(isAuthed());
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  /* Close sheet on navigation */
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(()=>{
    if(!open)return;
    const trigger=moreButtonRef.current;
    const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const focusable=()=>Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')??[]);
    focusable()[0]?.focus();
    function onKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
      if(event.key!=='Tab')return;const items=focusable();if(!items.length)return;const first=items[0],last=items.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',onKeyDown);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKeyDown);trigger?.focus();};
  },[open]);

  const moreActive = open || pathname.startsWith("/dashboard");

  return (
    <>
      {/* ── Backdrop ── */}
      {open && (
        <button type="button" aria-label="Close more navigation"
          className="fixed inset-0 z-[48] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Slide-up sheet ── */}
      {open&&<div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="more-navigation-title"
        className={`fixed inset-x-0 bottom-0 z-[49] lg:hidden
          bg-background border-t border-border/50 rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          translate-y-0`}
      >
        <h2 id="more-navigation-title" className="sr-only">More navigation</h2>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-border/60" />
        </div>

        <div className="px-5 pb-8 max-h-[75vh] overflow-y-auto no-scrollbar space-y-5">

          {/* Auth strip */}
          {authed ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent"
            >
              <DashboardIcon />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black">My Dashboard</p>
                <p className="text-[11px] text-accent/70 font-medium">Profile · Settings · Subscription</p>
              </div>
              <ChevronRight className="text-accent/60" />
            </Link>
          ) : (
            <div className="flex gap-3">
              <Link
                href="/auth/login"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-accent text-white text-sm font-black hover:bg-accent-hover transition-colors"
              >
                <LoginIcon /> Sign In
              </Link>
              <Link
                href="/auth/register"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-border/50 text-foreground text-sm font-black hover:bg-surface-hover transition-colors"
              >
                <RegisterIcon /> Register
              </Link>
            </div>
          )}

          {/* Navigation grid */}
          <div>
            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-3">Explore</p>
            <div className="grid grid-cols-3 gap-2">
              {SHEET_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center gap-2 px-3 py-3.5 rounded-2xl border transition-all
                      ${active
                        ? "bg-accent/10 border-accent/25 text-accent"
                        : "bg-surface/60 border-border/30 text-muted hover:border-accent/20 hover:text-foreground"
                      }`}
                  >
                    <Icon active={active} />
                    <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>}

      {/* ── Fixed bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around px-2 py-1 safe-area-bottom">

          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon active={active} />
                <span className={`text-[9px] font-black uppercase tracking-wider ${active ? "text-accent" : "text-muted"}`}>
                  {label}
                </span>
                {active && <span className="w-1 h-1 rounded-full bg-accent" />}
              </Link>
            );
          })}

          {/* More button */}
          <button
            ref={moreButtonRef}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close more navigation" : "Open more navigation"}
            aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
              moreActive ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            <MoreIcon active={moreActive} />
            <span className={`text-[9px] font-black uppercase tracking-wider ${moreActive ? "text-accent" : "text-muted"}`}>
              More
            </span>
            {moreActive && <span className="w-1 h-1 rounded-full bg-accent" />}
          </button>

        </div>
      </nav>
    </>
  );
}

/* ─────────────── Icons ─────────────── */

function HomeIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function TipsIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function CodesIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill={active ? "currentColor" : "none"} />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function ForumIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function MoreIcon({ active }: NavIconProps) {
  const f = active ? "currentColor" : "none";
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"  y="3"  width="7" height="7" rx="1" fill={f} />
      <rect x="14" y="3"  width="7" height="7" rx="1" fill={f} />
      <rect x="3"  y="14" width="7" height="7" rx="1" fill={f} />
      <rect x="14" y="14" width="7" height="7" rx="1" fill={f} />
    </svg>
  );
}

/* Sheet-only icons */
function RankingsIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 20 18 10" strokeWidth={active?"2.5":"2"} />
      <polyline points="12 20 12 4"  strokeWidth={active?"2.5":"2"} />
      <polyline points="6 20 6 14"   strokeWidth={active?"2.5":"2"} />
    </svg>
  );
}
function StatsIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" strokeWidth={active?"2.5":"2"} />
      <line x1="12" y1="20" x2="12" y2="4"  strokeWidth={active?"2.5":"2"} />
      <line x1="6"  y1="20" x2="6"  y2="14" strokeWidth={active?"2.5":"2"} />
      <line x1="2"  y1="20" x2="22" y2="20" />
    </svg>
  );
}
function H2HIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9"  cy="12" r="3" fill={active ? "currentColor" : "none"} />
      <circle cx="15" cy="12" r="3" fill={active ? "currentColor" : "none"} />
      <path d="M3 12h3M18 12h3" />
    </svg>
  );
}
function NewsIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" fill={active ? "currentColor" : "none"} strokeOpacity={active ? 0 : 1} />
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
      <line x1="10" y1="7" x2="18" y2="7" />
      <line x1="10" y1="11" x2="18" y2="11" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </svg>
  );
}
function RefereesIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3" fill={active ? "currentColor" : "none"} />
      <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M9 13l3 3 3-3" strokeWidth={active ? "2.5" : "2"} />
    </svg>
  );
}
function CreatorsIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
function ContactIcon({ active }: NavIconProps) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function LoginIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
function RegisterIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
