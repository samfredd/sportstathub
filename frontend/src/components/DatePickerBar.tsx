"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
  CalendarIcon, SlidersIcon,
} from "./Icons";
import { MATCH_SPORT_OPTIONS } from "@/lib/sports";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getWeekOffset(iso: string): number {
  const today = new Date();
  const target = new Date(iso + "T12:00:00");
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return Math.floor((diffDays + 1) / 7);
}

function getDateLabel(iso: string): string {
  const today = new Date();
  const todayISO  = today.toISOString().slice(0, 10);
  const tomorrowISO = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const yesterdayISO = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayISO)     return "Today";
  if (iso === tomorrowISO)  return "Tmrw";
  if (iso === yesterdayISO) return "Yest";
  return DAY_ABBR[new Date(iso + "T12:00:00Z").getUTCDay()];
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getFullDateLabel(iso: string): string {
  const today = new Date();
  const todayISO     = today.toISOString().slice(0, 10);
  const tomorrowISO  = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const yesterdayISO = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayISO)     return "Today";
  if (iso === tomorrowISO)  return "Tomorrow";
  if (iso === yesterdayISO) return "Yesterday";
  const d = new Date(iso + "T12:00:00Z");
  return `${DAY_ABBR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

// ─── MONTH CALENDAR POPUP ─────────────────────────────────────────────────────

interface MonthCalendarProps {
  selectedDate: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

function MonthCalendar({ selectedDate, onSelect, onClose }: MonthCalendarProps) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState(() =>
    selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()
  );

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const prevMonthDays   = new Date(year, month, 0).getDate();

  function fmt(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  const today = new Date();
  function pickTomorrow() {
    const d = new Date(today);
    d.setDate(today.getDate() + 1);
    onSelect(d.toISOString().slice(0, 10));
    onClose();
  }

  return (
    <div className="w-[288px] bg-surface border border-border/80 rounded-2xl p-4 shadow-premium z-50">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span
          className="text-[13px] font-black text-foreground"
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-[9px] font-black text-muted/50 py-1 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {/* Prev month trailing days */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => {
          const day = prevMonthDays - firstDayOfMonth + 1 + i;
          const prevM = month === 0 ? 11 : month - 1;
          const prevY = month === 0 ? year - 1 : year;
          const iso = fmt(prevY, prevM, day);
          return (
            <button
              key={`prev-${i}`}
              onClick={() => { onSelect(iso); onClose(); }}
              className="aspect-square flex items-center justify-center rounded-lg text-[11px] font-bold text-muted/25 hover:text-muted/50 hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {day}
            </button>
          );
        })}

        {/* Current month days */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = fmt(year, month, day);
          const isSelected = iso === selectedDate;
          const isToday    = iso === todayISO;
          const isPast     = iso < todayISO;

          return (
            <button
              key={day}
              onClick={() => { onSelect(iso); onClose(); }}
              className={`relative aspect-square flex items-center justify-center rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                isSelected
                  ? "bg-accent text-white font-black shadow-[0_0_10px_rgba(59,130,246,0.35)]"
                  : isToday
                  ? "bg-accent/15 text-accent font-black"
                  : isPast
                  ? "text-muted/40 hover:bg-surface-hover hover:text-muted/70"
                  : "text-foreground hover:bg-accent/10 hover:text-accent"
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick jumps */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40">
        <button
          onClick={() => { onSelect(todayISO); onClose(); }}
          className="py-2 text-[11px] font-black text-accent bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors cursor-pointer"
        >
          Today
        </button>
        <button
          onClick={pickTomorrow}
          className="py-2 text-[11px] font-black text-muted bg-surface-hover rounded-xl hover:text-foreground transition-colors cursor-pointer"
        >
          Tomorrow
        </button>
      </div>
    </div>
  );
}

// ─── DATE PICKER BAR ──────────────────────────────────────────────────────────

interface DatePickerBarProps {
  activeDate: string;
  onDateChange: (iso: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  liveCount?: number;
  upcomingCount?: number;
  activeSport?: string;
  onSportChange: (sport: string) => void;
  onLeaguesClick: () => void;
  selectedLeagueName?: string | null;
}

export default function DatePickerBar({
  activeDate,
  onDateChange,
  activeTab,
  onTabChange,
  liveCount      = 0,
  upcomingCount  = 0,
  activeSport,
  onSportChange,
  onLeaguesClick,
  selectedLeagueName,
}: DatePickerBarProps) {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [weekOffset, setWeekOffset] = useState(() => getWeekOffset(activeDate || todayISO));
  const [showCalendar, setShowCalendar] = useState(false);
  const calRef       = useRef<HTMLDivElement>(null);
  const mobileCalRef = useRef<HTMLDivElement>(null);

  // 7 dates for the current week window
  const weekDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + weekOffset * 7 + (i - 1));
      return d.toISOString().slice(0, 10);
    });
  }, [weekOffset]);

  // Close calendar on outside click / Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideMobile  = mobileCalRef.current?.contains(target);
      const insideDesktop = calRef.current?.contains(target);
      if (!insideMobile && !insideDesktop) setShowCalendar(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowCalendar(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  function handleDateSelect(iso: string) {
    onDateChange(iso);
    if (activeTab === "live") onTabChange("upcoming");
  }

  function handleCalendarJump(iso: string) {
    setWeekOffset(getWeekOffset(iso));
    handleDateSelect(iso);
    setShowCalendar(false);
  }

  return (
    <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-md border-b border-border/50">

      {/* ── MOBILE-ONLY: Sport selector ──────────────────────────────────── */}
      <div className="lg:hidden flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto no-scrollbar">
        {MATCH_SPORT_OPTIONS.map((sport) => {
          const comingSoon = "comingSoon" in sport && sport.comingSoon;
          return (
            <button
              key={sport.id}
              onClick={() => !comingSoon && onSportChange(sport.id)}
              disabled={comingSoon}
              title={comingSoon ? "Coming soon" : undefined}
              className={`shrink-0 flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wide rounded-lg border transition-all ${
                comingSoon
                  ? "text-muted/40 border-transparent cursor-not-allowed"
                  : activeSport === sport.id
                  ? "bg-accent/20 text-accent border-accent/25 cursor-pointer"
                  : "text-muted border-transparent hover:bg-surface-hover hover:text-foreground cursor-pointer"
              }`}
            >
              {sport.label}
              {comingSoon && (
                <span className="px-1 py-0.5 rounded bg-muted/15 text-muted/60 text-[9px] tracking-wider">
                  SOON
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── MOBILE-ONLY: Date + League dropdown row ──────────────────────── */}
      <div className="lg:hidden flex items-center gap-2 px-3 pb-2">
        {/* Date dropdown */}
        <div className="relative flex-1" ref={mobileCalRef}>
          <button
            onClick={() => setShowCalendar(s => !s)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
              showCalendar
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-surface border-border/60 text-foreground hover:border-accent/30"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <CalendarIcon className={`w-3.5 h-3.5 shrink-0 ${showCalendar ? "text-accent" : "text-muted"}`} />
              <span className="text-[12px] font-black truncate">{getFullDateLabel(activeDate)}</span>
            </span>
            <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${showCalendar ? "rotate-180" : ""}`} />
          </button>

          {showCalendar && (
            <div className="absolute left-0 top-full mt-2 z-50">
              <MonthCalendar
                selectedDate={activeDate}
                onSelect={handleCalendarJump}
                onClose={() => setShowCalendar(false)}
              />
            </div>
          )}
        </div>

        {/* League dropdown */}
        <button
          onClick={onLeaguesClick}
          className={`flex-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
            selectedLeagueName
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-surface border-border/60 text-foreground hover:border-accent/30"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <SlidersIcon className={`w-3.5 h-3.5 shrink-0 ${selectedLeagueName ? "text-accent" : "text-muted"}`} />
            <span className="text-[12px] font-black truncate">
              {selectedLeagueName || "All Leagues"}
            </span>
          </span>
          <ChevronDownIcon className="w-3.5 h-3.5 shrink-0 text-muted" />
        </button>
      </div>

      {/* ── DATE STRIP ROW (desktop only) ───────────────────────────────── */}
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-2">
        {/* Prev week */}
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-border/60 text-muted hover:text-foreground hover:border-accent/30 transition-all cursor-pointer"
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        {/* Date buttons */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {weekDates.map(iso => {
            const isSelected = activeDate === iso && activeTab !== "live";
            const isToday    = iso === todayISO;
            return (
              <button
                key={iso}
                onClick={() => handleDateSelect(iso)}
                className={`relative flex flex-col items-center justify-center min-w-[48px] sm:min-w-[54px] h-[52px] rounded-xl border flex-1 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent/15 text-accent border-accent/35 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
                    : isToday
                    ? "bg-surface text-foreground border-accent/20"
                    : "bg-surface text-muted hover:text-foreground border-border/50 hover:border-border"
                }`}
              >
                <span className={`text-[9px] font-black uppercase tracking-[0.08em] leading-none mb-0.5 ${
                  isSelected ? "text-accent/80" : isToday ? "text-accent/60" : "text-muted/55"
                }`}>
                  {getDateLabel(iso)}
                </span>
                <span className={`text-[15px] font-black tabular-nums leading-none ${
                  isToday && !isSelected ? "text-accent" : ""
                }`}>
                  {parseInt(iso.slice(8), 10)}
                </span>
                {isToday && (
                  <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-accent" : "bg-accent/50"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Next week */}
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-border/60 text-muted hover:text-foreground hover:border-accent/30 transition-all cursor-pointer"
          aria-label="Next week"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        {/* Calendar popup */}
        <div className="relative shrink-0" ref={calRef}>
          <button
            onClick={() => setShowCalendar(s => !s)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
              showCalendar
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-surface border-border/60 text-muted hover:text-foreground hover:border-accent/30"
            }`}
            aria-label="Open calendar"
          >
            <CalendarIcon className="w-4 h-4" />
          </button>

          {showCalendar && (
            <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2">
              <MonthCalendar
                selectedDate={activeDate}
                onSelect={handleCalendarJump}
                onClose={() => setShowCalendar(false)}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-border/50 shrink-0 mx-0.5" />

        {/* Live / Upcoming tabs — desktop */}
        <div className="hidden sm:flex items-center bg-surface rounded-xl p-1 border border-border/60 shrink-0 gap-0.5">
          <button
            onClick={() => onTabChange("upcoming")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === "upcoming" ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            Upcoming
            {upcomingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px] font-black tabular-nums">
                {upcomingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange("live")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "live" ? "bg-live/20 text-live" : "text-muted hover:text-foreground"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === "live" ? "bg-live animate-pulse-live" : "bg-muted"}`} />
            Live
            {liveCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-live/20 text-live text-[9px] font-black tabular-nums">
                {liveCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── MOBILE-ONLY: Live / Upcoming tabs (full-width row) ──────────── */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 px-3 pb-2.5">
        <button
          onClick={() => onTabChange("upcoming")}
          className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "upcoming"
              ? "bg-accent/20 text-accent border border-accent/25"
              : "bg-surface text-muted border border-border/60 hover:text-foreground"
          }`}
        >
          Upcoming
          {upcomingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px] font-black tabular-nums">
              {upcomingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange("live")}
          className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "live"
              ? "bg-live/20 text-live border border-live/25"
              : "bg-surface text-muted border border-border/60 hover:text-foreground"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === "live" ? "bg-live animate-pulse-live" : "bg-muted"}`} />
          Live
          {liveCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-live/20 text-live text-[9px] font-black tabular-nums">
              {liveCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
