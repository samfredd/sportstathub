"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import LeagueHeader from "@/components/LeagueHeader";
import DatePickerBar from "@/components/DatePickerBar";
import MobileLeagueDrawer from "@/components/MobileLeagueDrawer";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTrackingClick } from "@/hooks/useTrackingClick";
import {
  SearchIcon, HomeIcon, CheckIcon, WorldIcon, XIcon,
  BoltIcon, TargetIcon, ClipboardIcon, CrownIcon, RadioIcon,
  MessageCircleIcon, FlameIcon, BarChartIcon, TrendingUpIcon,
  PinIcon, CheckCircleIcon, XCircleIcon, TrophyIcon, ArrowRightIcon,
  ActivityIcon, ChevronDownIcon,
} from "@/components/Icons";
import { fixtureToMatch } from "@/lib/transforms";
import { communityApi } from "@/lib/communityApi";
import { getLeagueColour } from "@/lib/leagueColours";
import AdCarousel, { FEED_SLIDES, HERO_SLIDES } from "@/components/AdCarousel";
import TrendingHeroCarousel from "@/components/TrendingHeroCarousel";
import LeftLeagueSidebar from "@/components/LeftLeagueSidebar";
import RightStatsSidebar from "@/components/RightStatsSidebar";
import SportIcon from "@/components/SportIcon";
import PremiumGate, { ProBadge } from "@/components/PremiumGate";


const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function compactNumber(value) {
  const n = Number(value ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n * 10) / 10);
}

function buildPlatformStats(stats) {
  return DEFAULT_PLATFORM_STATS.map(({ suffix, ...item }) => ({
    ...item,
    value: `${compactNumber(stats?.[item.key] ?? 0)}${suffix ?? ""}`,
  }));
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DEFAULT_PLATFORM_STATS = [
  { key: "tipsToday",   label: "Tips Today",    Icon: BoltIcon,         color: "text-accent",      href: "/predictions" },
  { key: "winRate",     label: "Win Rate",       suffix: "%", Icon: TargetIcon,  color: "text-accent-gold", href: "/predictions" },
  { key: "codeCopies",  label: "Code Copies",   Icon: ClipboardIcon,    color: "text-accent",      href: "/codes" },
  { key: "creators",    label: "Creators",       Icon: CrownIcon,        color: "text-accent-gold", href: "/forum" },
  { key: "liveMatches", label: "Live Matches",   Icon: RadioIcon,        color: "text-live",        href: "/?tab=live" },
  { key: "forumPosts",  label: "Forum Posts",    Icon: MessageCircleIcon,color: "text-accent",      href: "/forum" },
];


// ─── HOME PAGE ────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeDate, setActiveDate]         = useState(todayISO);
  const [activeTab, setActiveTab]           = useState("upcoming");
  const [activeSport, setActiveSport]       = useState("football");
  const [sports, setSports]                 = useState([{ id: "football", label: "Football" }]);
  const [matches, setMatches]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [sidebarLeagues, setSidebarLeagues] = useState<any[]>([]);
  const [leagueSearch, setLeagueSearch]     = useState("");
  const [showPromo, setShowPromo]           = useState(true);
  const [showSportDrop, setShowSportDrop]   = useState(false);
  const sportDropRef                        = useRef<HTMLDivElement>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | string | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [platformStats, setPlatformStats]   = useState(null);

  // Fetch available sports
  useEffect(() => {
    fetch(`${BASE}/api/sports`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data?.length) setSports(json.data);
      })
      .catch(() => {});
  }, []);

  // Fetch leagues for all sports concurrently
  useEffect(() => {
    if (!sports.length) return;
    Promise.all(sports.map(sport => {
      const leagueParams = new URLSearchParams({ sport: sport.id, popular: "true" });
      return fetch(`${BASE}/api/leagues?${leagueParams.toString()}`)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (!json?.data?.length) return [];
          return json.data.map((l: any) => ({
            id:      l.league.id,
            name:    l.league.name,
            country: l.country?.name || l.league?.country || "",
            logo:    l.league.logo   || null,
            flag:    l.country?.flag || null,
            sport:   sport.id,
          }));
        })
        .catch(() => []);
    })).then(results => {
      setSidebarLeagues(results.flat());
    });
  }, [sports]);

  useEffect(() => {
    communityApi.getPlatformStats()
      .then(setPlatformStats)
      .catch(() => setPlatformStats(null));
  }, []);

  const fetchMatches = useCallback(() => {
    setLoading(true);
    const url = activeTab === "live"
      ? `${BASE}/api/matches/live?sport=${activeSport}`
      : `${BASE}/api/matches?date=${activeDate}&sport=${activeSport}`;
    fetch(url)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }) => setMatches((data || []).map(fixtureToMatch).filter(Boolean)))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [activeTab, activeDate, activeSport]);

  useEffect(() => {
    queueMicrotask(fetchMatches);
  }, [fetchMatches]);

  // Close sport dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sportDropRef.current && !sportDropRef.current.contains(e.target as Node)) {
        setShowSportDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sidebar filtering
  const filteredLeagues = useMemo(() =>
    sidebarLeagues.filter(l =>
      l.name?.toLowerCase().includes(leagueSearch.toLowerCase()) ||
      l.country?.toLowerCase().includes(leagueSearch.toLowerCase())
    ), [sidebarLeagues, leagueSearch]);

  const countries = useMemo(() => {
    const map = new Map<string, { count: number; flag: string | null }>();
    sidebarLeagues.forEach(l => {
      if (!l.country) return;
      const prev = map.get(l.country);
      map.set(l.country, { count: (prev?.count || 0) + 1, flag: prev?.flag || l.flag || null });
    });
    return Array.from(map, ([name, { count, flag }]) => ({ name, count, flag }))
      .sort((a, b) => b.count - a.count);
  }, [sidebarLeagues]);

  const filteredCountries = useMemo(() =>
    countries.filter(c => c.name?.toLowerCase().includes(leagueSearch.toLowerCase())),
    [countries, leagueSearch]);

  const groupedMatches = useMemo(() => {
    const PRIORITY_LEAGUES = [39, 140, 135, 78, 61, 2, 3, 848, 88];
    const groups = new Map();
    matches.forEach(m => {
      if (selectedLeague && m.leagueId !== selectedLeague) return;
      if (!groups.has(m.leagueId)) {
        groups.set(m.leagueId, { id: m.leagueId, name: m.league, country: m.country, logo: m.leagueLogo, matches: [] });
      }
      groups.get(m.leagueId).matches.push(m);
    });
    return Array.from(groups.values()).sort((a, b) => {
      const pa = PRIORITY_LEAGUES.indexOf(a.id);
      const pb = PRIORITY_LEAGUES.indexOf(b.id);
      if (pa === -1 && pb === -1) return 0;
      if (pa === -1) return 1;
      if (pb === -1) return -1;
      return pa - pb;
    });
  }, [matches, selectedLeague]);

  const liveCount     = activeTab === "live"     ? matches.length : 0;
  const upcomingCount = activeTab === "upcoming" ? matches.length : 0;

  const platformStatRows = buildPlatformStats(platformStats);

  function handleSportChange(sport) {
    setActiveSport(sport);
    setSelectedLeague(null);
  }

  return (
    <div className="pb-24 lg:pb-8">

      {/* ── TICKER ───────────────────────────────────────────────────────────
      <div className="hidden md:flex items-center gap-0 border-b border-border/40 bg-surface/60 overflow-hidden">
        <div className="badge-live shrink-0 px-3 py-1.5 rounded-none border-0 border-r border-live/20">
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
          LIVE
        </div>
        <div className="flex items-center gap-6 px-4 py-1.5 overflow-x-auto no-scrollbar flex-1">
          {platformStatRows.map(({ label, value, Icon, color }) => (
            <span key={label} className="shrink-0 flex items-center gap-1.5 text-[11px] text-muted font-bold">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-foreground font-black">{value}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>
        <Link href="/predictions" className="shrink-0 px-4 py-1.5 text-[10px] font-black text-accent uppercase tracking-wider hover:bg-accent/10 transition-colors flex items-center gap-1">
          All Tips <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div> */}

      {/* ── HERO CAROUSEL (ads + trending predictions) ─────────────────────── */}
      <TrendingHeroCarousel />

      {/* ── PLATFORM STATS ROW ─────────────────────────────────────────────── */}
      <div className="border-b border-border/20 bg-surface/40">
        {/* Mobile: horizontal scroll */}
        <div className="lg:hidden flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
          {platformStatRows.map(({ label, value, Icon, color, href }) => (
            <Link
              key={label}
              href={href}
              className="shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 bg-surface border border-border/50 rounded-xl min-w-[72px] active:scale-95 hover:border-accent/30 transition-all"
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[14px] font-black text-foreground leading-none">{value}</span>
              <span className="text-[9px] text-muted text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
        {/* Desktop: single row */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-3">
          {platformStatRows.map(({ label, value, Icon, color, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 px-3 py-1.5 bg-background/60 border border-border/40 rounded-xl hover:border-accent/30 hover:-translate-y-0.5 transition-all"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[13px] font-black text-foreground">{value}</span>
              <span className="text-[10px] text-muted">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MOBILE QUICK ACTIONS ─────────────────────────────────────────── */}
      <div className="lg:hidden px-4 py-3 border-b border-border/20">
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { href: "/predictions", label: "Tips",     bg: "bg-accent/10    border-accent/20",    icon: <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
            { href: "/codes",       label: "Codes",    bg: "bg-amber-500/10 border-amber-500/20", icon: <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" fill="currentColor" fillOpacity=".15"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
            { href: "/rankings",   label: "Table",    bg: "bg-accent/10    border-accent/20",    icon: <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg> },
            { href: "/h2h",        label: "H2H",      bg: "bg-purple-500/10 border-purple-500/20", icon: <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="12" r="3" fill="currentColor" fillOpacity=".25"/><circle cx="16" cy="12" r="3" fill="currentColor" fillOpacity=".25"/><path d="M3 12h2M19 12h2"/></svg> },
          ].map(({ href, label, bg, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border ${bg} active:scale-95 transition-all`}
            >
              {icon}
              <span className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MAIN 3-COLUMN LAYOUT ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-5 xl:gap-6 px-4 lg:px-6 py-0 lg:py-5">

        {/* ── LEFT SIDEBAR (desktop only) ────────────────────────────────── */}
        <LeftLeagueSidebar
          currentLeagueId={selectedLeague}
          activeSportOverride={activeSport}
          onSportChange={handleSportChange}
          onLeagueSelect={setSelectedLeague}
        />

        {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Advanced date picker (sticky below navbar) */}
          <DatePickerBar
            activeDate={activeDate}
            onDateChange={setActiveDate}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            liveCount={liveCount}
            upcomingCount={upcomingCount}
            activeSport={activeSport}
            onSportChange={handleSportChange}
            onLeaguesClick={() => setDrawerOpen(true)}
            selectedLeagueName={selectedLeague ? sidebarLeagues.find(l => l.id === selectedLeague)?.name ?? null : null}
          />

          <div className="py-4 space-y-5">

            {/* Promo banner */}
            {showPromo && (
              <div className="flex items-center justify-between gap-2 bg-accent/8 border border-accent/20 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <ActivityIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                  <p className="text-[11px] font-bold text-accent truncate">
                    AI-driven insights · Live feed active
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link href="/contact" className="px-2.5 py-1 bg-accent text-white text-[10px] font-black rounded-lg hover:bg-accent-hover transition-all">
                    Connect
                  </Link>
                  <button
                    onClick={() => setShowPromo(false)}
                    className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Match list */}
            <div className="bg-surface rounded-2xl overflow-hidden border border-border/60 shadow-sm">
              {loading ? (
                <div className="py-16 text-center flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted font-bold uppercase tracking-widest">Fetching Matches…</span>
                </div>
              ) : groupedMatches.length > 0 ? (
                groupedMatches.map((league, i) => (
                  <div key={league.id}>
                    {/* In-feed ad after the 3rd league */}
                    {i === 3 && (
                      <div className="px-3 py-2 border-b border-border/30">
                        <AdCarousel slides={FEED_SLIDES} variant="feed" autoplayMs={7000} />
                      </div>
                    )}
                    <LeagueHeader league={league} />
                    <div className="divide-y divide-border/40">
                      {league.matches.map(match => (
                        <MatchCard key={match.id} match={match} sport={activeSport} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-background rounded-xl border border-border flex items-center justify-center mb-3">
                    <SearchIcon className="w-5 h-5 text-muted/50" />
                  </div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">No Matches Found</h3>
                  <p className="text-xs text-muted max-w-[200px] text-center">
                    Try a different date or switch to the Live tab.
                  </p>
                </div>
              )}
            </div>



          </div>
        </div>

        {/* ── RIGHT SIDEBAR (xl+) ────────────────────────────────────────── */}
        <RightStatsSidebar />
      </div>


      {/* ── MOBILE LEAGUE DRAWER ────────────────────────────────────────────── */}
      <MobileLeagueDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        leagues={sidebarLeagues}
        selectedLeague={selectedLeague}
        onSelectLeague={setSelectedLeague}
        searchQuery={leagueSearch}
        onSearchChange={setLeagueSearch}
      />

    </div>
  );
}
