"use client";

import { useEffect } from "react";
import { HomeIcon, WorldIcon, CheckIcon, XIcon, SearchIcon } from "./Icons";

interface League {
  id: string | number;
  name: string;
  country?: string;
  logo?: string | null;
  flag?: string | null;
  sport?: string;
}

interface MobileLeagueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leagues: League[];
  selectedLeague: string | number | null;
  onSelectLeague: (id: string | number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function MobileLeagueDrawer({
  isOpen,
  onClose,
  leagues,
  selectedLeague,
  onSelectLeague,
  searchQuery,
  onSearchChange,
}: MobileLeagueDrawerProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const filtered = searchQuery
    ? leagues.filter(l =>
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.country?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leagues;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "72vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="League filter"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 shrink-0">
          <h2 className="text-[14px] font-black text-foreground uppercase tracking-wider">
            Filter Leagues
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-hover text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon className="w-4 h-4 text-muted" />
            </div>
            <input
              type="search"
              placeholder="Search leagues or countries..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="input-premium pl-10 text-[13px] py-2.5"
              autoFocus={false}
            />
          </div>
        </div>

        {/* League list */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-1.5">
          {/* All Leagues option */}
          <button
            onClick={() => { onSelectLeague(null); onClose(); }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
              !selectedLeague
                ? "bg-accent/10 text-accent border-accent/20"
                : "bg-background/60 text-muted hover:bg-surface-hover border-border/40 hover:text-foreground"
            }`}
          >
            <HomeIcon className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-bold">All Leagues</span>
            {!selectedLeague && <CheckIcon className="w-4 h-4 ml-auto shrink-0" />}
          </button>

          {/* League items */}
          {filtered.length === 0 ? (
            <p className="text-[13px] text-muted text-center py-8 font-bold">No leagues found</p>
          ) : (
            filtered.map(lg => {
              const isActive = selectedLeague === lg.id;
              return (
                <button
                  key={`${lg.sport || 'league'}-${lg.id}`}
                  onClick={() => { onSelectLeague(isActive ? null : lg.id); onClose(); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isActive
                      ? "bg-accent/10 text-accent border-accent/20"
                      : "bg-background/60 text-muted hover:bg-surface-hover border-border/40 hover:text-foreground"
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
                    {lg.logo ? (
                      <img src={lg.logo} alt={lg.name} className="w-4 h-4 object-contain" />
                    ) : lg.flag ? (
                      <img src={lg.flag} alt={lg.country} className="w-5 h-3.5 object-contain" />
                    ) : (
                      <WorldIcon className="w-3.5 h-3.5 text-muted/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold truncate ${isActive ? "text-accent" : "text-foreground"}`}>
                      {lg.name}
                    </p>
                    <p className="text-[10px] text-muted/70">{lg.country}</p>
                  </div>
                  {isActive && <CheckIcon className="w-4 h-4 shrink-0 text-accent" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
