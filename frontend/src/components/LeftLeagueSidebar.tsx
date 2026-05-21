"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { SearchIcon, HomeIcon, CheckIcon, WorldIcon, ChevronDownIcon } from "@/components/Icons";
import SportIcon from "@/components/SportIcon";
import { getLeagueColour } from "@/lib/leagueColours";
import AdCarousel, { SIDEBAR_SLIDES } from "@/components/AdCarousel";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface League {
  id: number;
  name: string;
  country: string;
  logo: string | null;
  flag: string | null;
  sport: string;
}

interface Props {
  currentLeagueId?: number | string | null;
  activeSportOverride?: string;
  onSportChange?: (sport: string) => void;
  onLeagueSelect?: (leagueId: number | string | null) => void;
}

export default function LeftLeagueSidebar({
  currentLeagueId,
  activeSportOverride,
  onSportChange,
  onLeagueSelect,
}: Props) {
  const [internalActiveSport, setInternalActiveSport] = useState("football");
  const activeSport = activeSportOverride ?? internalActiveSport;

  const [sports, setSports] = useState([{ id: "football", label: "Football" }]);
  const [sidebarLeagues, setSidebarLeagues] = useState<League[]>([]);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [showSportDrop, setShowSportDrop] = useState(false);
  const sportDropRef = useRef<HTMLDivElement>(null);

  // Load sports
  useEffect(() => {
    fetch(`${BASE}/api/sports`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data?.length) setSports(json.data); })
      .catch(() => {});
  }, []);

  // Load leagues for all sports
  useEffect(() => {
    if (!sports.length) return;
    Promise.all(sports.map(sport =>
      fetch(`${BASE}/api/leagues?sport=${sport.id}&popular=true`)
        .then(r => r.ok ? r.json() : null)
        .then(json => (json?.data ?? []).map((l: any) => ({
          id:      l.league.id,
          name:    l.league.name,
          country: l.country?.name || l.league?.country || "",
          logo:    l.league.logo || null,
          flag:    l.country?.flag || null,
          sport:   sport.id,
        })))
        .catch(() => [] as League[])
    )).then(results => setSidebarLeagues(results.flat()));
  }, [sports]);

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

  function handleSportSelect(sportId: string) {
    if (onSportChange) onSportChange(sportId);
    else setInternalActiveSport(sportId);
    setShowSportDrop(false);
    if (onLeagueSelect) onLeagueSelect(null);
  }

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

  return (
    <aside className="hidden lg:flex flex-col w-[220px] xl:w-[240px] shrink-0 gap-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto no-scrollbar">

      {/* Sport selector dropdown */}
      <div className="relative" ref={sportDropRef}>
        <button
          onClick={() => setShowSportDrop(s => !s)}
          className="w-full bg-surface border border-border rounded-xl overflow-hidden flex items-center justify-between px-4 py-2.5 hover:border-accent/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <SportIcon sport={activeSport} className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-black text-foreground uppercase tracking-wider">
              {sports.find(s => s.id === activeSport)?.label ?? "Sport"}
            </span>
          </div>
          <ChevronDownIcon className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${showSportDrop ? "rotate-180" : ""}`} />
        </button>

        {showSportDrop && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl overflow-hidden shadow-lg z-50">
            {sports.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleSportSelect(id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold transition-colors cursor-pointer border-b border-border/40 last:border-0 ${
                  activeSport === id
                    ? "bg-accent/8 text-accent"
                    : "text-foreground hover:bg-surface-hover"
                }`}
              >
                <SportIcon sport={id} className={`w-3.5 h-3.5 ${activeSport === id ? "text-accent" : "text-muted"}`} />
                {label}
                {activeSport === id && <CheckIcon className="w-3 h-3 text-accent ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* League search */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3">
          <SearchIcon className="w-3.5 h-3.5 text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search leagues..."
            value={leagueSearch}
            onChange={e => setLeagueSearch(e.target.value)}
            className="w-full py-2.5 text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      {/* Sidebar ad */}
      <AdCarousel slides={SIDEBAR_SLIDES} variant="sidebar" size="lg" autoplayMs={6000} />

      {/* Leagues list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-0.5 bg-accent w-full" />

        {/* All Matches */}
        <div
          onClick={() => {
            setLeagueSearch("");
            if (onLeagueSelect) onLeagueSelect(null);
          }}
          className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors ${
            !currentLeagueId ? "bg-accent/8 text-accent" : "text-muted hover:bg-surface-hover"
          }`}
        >
          <HomeIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider">All Matches</span>
        </div>

        <div className="overflow-y-auto no-scrollbar max-h-[calc(100vh-24rem)]">
          {sports.map(sport => {
            const sportLeagues = filteredLeagues.filter(l => l.sport === sport.id);
            if (sportLeagues.length === 0) return null;
            return (
              <div key={sport.id}>
                <div className="px-4 py-1.5 bg-background/50 border-b border-border/30">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                    {leagueSearch ? `${sport.label} Results` : sport.label}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {sportLeagues.map(lg => {
                    const isActive = currentLeagueId === lg.id && activeSport === sport.id;
                    const lc = getLeagueColour(lg.name);
                    return (
                      <Link
                        key={`${sport.id}-${lg.id}`}
                        href={`/?league=${lg.id}`}
                        onClick={(e) => {
                          if (onLeagueSelect || onSportChange) {
                            e.preventDefault();
                            if (activeSport !== sport.id && onSportChange) onSportChange(sport.id);
                            if (onLeagueSelect) onLeagueSelect(currentLeagueId === lg.id && activeSport === sport.id ? null : lg.id);
                          }
                        }}
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                          isActive ? `${lc.bg} border-l-2 ${lc.border}` : "hover:bg-surface-hover border-l-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            {lg.logo ? (
                              <img src={lg.logo} alt={lg.name} className="w-5 h-5 object-contain" />
                            ) : lg.flag ? (
                              <img src={lg.flag} alt={lg.country} className="w-4 h-3 object-contain" />
                            ) : (
                              <WorldIcon className={`w-3.5 h-3.5 ${isActive ? lc.text : "text-muted"}`} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[11px] font-bold leading-tight truncate ${isActive ? lc.text : "text-foreground/90"}`}>
                              {lg.name}
                            </p>
                            <p className="text-[9px] text-muted truncate">{lg.country}</p>
                          </div>
                        </div>
                        {isActive && <CheckIcon className={`w-3 h-3 shrink-0 ${lc.text}`} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!leagueSearch && countries.length > 0 && (
            <div>
              <div className="px-4 py-1.5 bg-background/50 border-y border-border/30">
                <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Countries</span>
              </div>
              <div className="divide-y divide-border/30">
                {filteredCountries.slice(0, 10).map(ct => (
                  <div
                    key={ct.name}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {ct.flag
                        ? <img src={ct.flag} alt={ct.name} className="w-4 h-3 object-contain rounded-sm" />
                        : <WorldIcon className="w-3.5 h-3.5 text-muted/40" />
                      }
                      <span className="text-[11px] font-bold text-muted">{ct.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-muted/60">{ct.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
