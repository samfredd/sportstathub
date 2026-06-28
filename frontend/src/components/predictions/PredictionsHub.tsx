"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  SearchIcon,
  SlidersIcon,
  CalendarIcon,
  BarChartIcon,
  ZapIcon,
} from "@/components/Icons";
import { PREDICTION_SPORT_OPTIONS } from "@/lib/sports";
import PremiumGate from "@/components/PremiumGate";
import { withAuth } from "@/lib/authHeaders";

const FREE_PREDICTIONS = 3;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Sport = "ALL" | string;

type CommunityPrediction = {
  id: string;
  sport: string;
  league: { name: string; country: string } | null;
  match: {
    homeTeam: { name: string; shortName: string };
    awayTeam: { name: string; shortName: string };
    date: string;
    venue?: string;
  } | null;
  prediction: {
    type: string;
    odds: number;
    confidence: number;
    analysis?: string;
  } | null;
  creator: {
    id: string;
    name: string;
    username: string;
    initials: string;
    avatarColor?: string;
    badge?: string;
    badgeLabel?: string;
    stats: { winRate: number; totalPredictions: number; currentStreak: number; followers: number };
  } | null;
  bookingCode: {
    bookmaker: string;
    code: string;
    affiliateUrl?: string;
    trackingId?: string;
    clicks: number;
    successRate: number;
  } | null;
  status: string;
  stats: { likes: number; comments: number; views: number; shares: number };
  isTrending: boolean;
  isPremium: boolean;
  tags: string[];
  timestamp: string;
};

const sportFilters: Array<{ label: string; value: Sport }> = [
  { label: "All", value: "ALL" },
  ...PREDICTION_SPORT_OPTIONS.map(({ label }) => ({ label, value: label })),
];

const markets = ["All", "1X2", "Moneyline", "Over/Under", "Totals", "Handicap", "Spread", "BTTS", "Player Props"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type RequestState = "idle" | "loading" | "ready" | "error";
type ActiveTab = "tips" | "ai";

export function PredictionsHub() {
  const [sport, setSport]   = useState<Sport>("ALL");
  const [market, setMarket] = useState("All");
  const [date, setDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [league, setLeague] = useState("");
  const [predictions, setPredictions] = useState<CommunityPrediction[]>([]);
  const [expertPicks, setExpertPicks] = useState<CommunityPrediction[]>([]);
  const [state, setState]   = useState<RequestState>("idle");
  const [activeTab, setActiveTab] = useState<ActiveTab>("tips");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Fetch community predictions
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState("loading");
      const params = new URLSearchParams({ limit: "30" });
      if (sport !== "ALL") params.set("sport", sport);
      if (market !== "All") params.set("market", market);
      if (league.trim()) params.set("league", league.trim());
      if (date) params.set("date", date);
      try {
        const res = await fetch(`${API_BASE}/api/predictions?${params}`, withAuth({ signal: controller.signal }));
        if (!res.ok) throw new Error("Unable to load predictions");
        const json = await res.json() as { data?: CommunityPrediction[]; predictions?: CommunityPrediction[] };
        setPredictions(json.data ?? json.predictions ?? []);
        setState("ready");
      } catch (e: any) {
        if (!controller.signal.aborted) { setPredictions([]); setState("error"); }
      }
    }
    void load();
    return () => controller.abort();
  }, [date, league, market, sport]);

  // Fetch admin/expert picks once (no filters — show all admin predictions)
  useEffect(() => {
    async function loadExpert() {
      try {
        const res = await fetch(`${API_BASE}/api/predictions?creatorRole=admin&limit=10`, withAuth());
        if (!res.ok) return;
        const json = await res.json() as { data?: CommunityPrediction[]; predictions?: CommunityPrediction[] };
        setExpertPicks(json.data ?? json.predictions ?? []);
      } catch { /* non-fatal */ }
    }
    void loadExpert();
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCalendarOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const headlineMetrics = useMemo(() => {
    const total     = predictions.length;
    const withOdds  = predictions.filter((p) => p.prediction?.odds != null);
    const avgOdds   = withOdds.length
      ? (withOdds.reduce((s, p) => s + (p.prediction?.odds ?? 0), 0) / withOdds.length).toFixed(2)
      : "—";
    const withCodes = predictions.filter((p) => p.bookingCode != null).length;
    return [
      { label: "Published picks", value: total.toString() },
      { label: "Avg odds",        value: avgOdds },
      { label: "With codes",      value: withCodes.toString() },
    ];
  }, [predictions]);

  return (
    <div className="relative px-4 lg:px-6 pb-28 lg:pb-10 pt-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 glass p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-foreground tracking-tight drop-shadow-md">Predictions Hub</h1>
          <p className="text-muted text-sm mt-1 max-w-lg">Expert picks, creator tips, and AI-powered analysis. Your edge on every match.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <span className="badge-gold animate-pulse-accent">
            <ZapIcon className="w-4 h-4" />
            Live picks
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {headlineMetrics.map((metric) => (
          <div key={metric.label} className="card-premium p-5 transition-all duration-300 relative overflow-hidden">
            <p className="text-[11px] font-black text-muted uppercase tracking-widest mb-1.5">{metric.label}</p>
            <p className="text-3xl font-black text-foreground drop-shadow-sm">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Expert Picks strip */}
      {expertPicks.length > 0 && (
        <ExpertPicksStrip picks={expertPicks} />
      )}

      {/* Filters */}
      <div className="glass p-5 rounded-2xl mb-8 border-border/50 shadow-premium">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-surface border border-border">
            <SlidersIcon className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-sm font-black text-foreground uppercase tracking-wider">Filters & Search</h2>
          {state === "loading" && (
            <span className="ml-auto inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent" role="status">
              <LoadingSpinner className="w-3.5 h-3.5" />
              Updating tips
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Sport */}
          <div className="relative">
            <label htmlFor="prediction-sport" className="sr-only">Filter predictions by sport</label>
            <ChevronIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <select
              id="prediction-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full appearance-none glass border border-border/50 focus:border-accent/50 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground bg-surface focus:outline-none cursor-pointer transition-colors pr-9"
            >
              {sportFilters.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* Market */}
          <div className="relative">
            <label htmlFor="prediction-market" className="sr-only">Filter predictions by market</label>
            <ChevronIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <select
              id="prediction-market"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="w-full appearance-none glass border border-border/50 focus:border-accent/50 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground bg-surface focus:outline-none cursor-pointer transition-colors pr-9"
            >
              {markets.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {/* League search */}
          <div className="relative group">
            <label htmlFor="prediction-league" className="sr-only">Search predictions by league or team</label>
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none group-focus-within:text-accent transition-colors" />
            <input id="prediction-league" type="text" value={league} onChange={(e) => setLeague(e.target.value)}
              placeholder="League / team…"
              className="w-full glass border border-border/50 focus:border-accent/50 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted/40 focus:outline-none transition-colors bg-surface" />
          </div>

          {/* Date */}
          <div className="relative" ref={calendarRef}>
            <span id="prediction-date-label" className="sr-only">Choose prediction date</span>
            <button
              type="button"
              aria-labelledby="prediction-date-label prediction-date-value"
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((open) => !open)}
              className={`w-full glass border rounded-xl pl-4 pr-3 py-2.5 text-sm font-bold text-foreground focus:outline-none transition-colors bg-surface flex items-center justify-between gap-3 ${
                calendarOpen ? "border-accent/50" : "border-border/50 hover:border-accent/30"
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <CalendarIcon className="w-4 h-4 text-accent shrink-0" />
                <span id="prediction-date-value" className="truncate">{formatDateLabel(date)}</span>
              </span>
              <ChevronIcon className={`w-4 h-4 text-muted transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
            </button>
            {calendarOpen && (
              <div className="absolute right-0 top-full mt-2 z-50">
                <MonthCalendar
                  selectedDate={date}
                  onSelect={(iso) => setDate(iso)}
                  onClose={() => setCalendarOpen(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-surface border border-border/50 rounded-xl mb-6 w-fit shadow-sm">
        <TabBtn active={activeTab === "tips"} onClick={() => setActiveTab("tips")}>
          <BarChartIcon className="w-4 h-4" /> Tips
        </TabBtn>
        <TabBtn active={activeTab === "ai"} onClick={() => setActiveTab("ai")}>
          <AiIcon className="w-4 h-4" /> AI Predict
        </TabBtn>
      </div>

      {/* Content */}
      {activeTab === "tips" && <TipsList predictions={predictions} state={state} />}
      {activeTab === "ai" && <AiPredict />}
    </div>
  );
}

// ─── Tab button helper ─────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
        active ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-hover"
      }`}>
      {children}
    </button>
  );
}

function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} aria-hidden="true" />;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateLabel(iso: string) {
  const selected = dateFromIso(iso);
  const today = new Date();
  const todayIso = toIsoDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === todayIso) return "Today";
  if (iso === toIsoDate(tomorrow)) return "Tomorrow";
  if (iso === toIsoDate(yesterday)) return "Yesterday";
  return selected.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function MonthCalendar({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const [viewDate, setViewDate] = useState(() => dateFromIso(selectedDate));
  const todayIso = toIsoDate(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  function selectDate(date: Date) {
    onSelect(toIsoDate(date));
    onClose();
  }

  return (
    <div className="w-[292px] rounded-2xl bg-surface border border-border/80 p-4 shadow-premium" role="dialog" aria-label="Choose prediction date">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg border border-border/40 text-muted hover:text-foreground hover:bg-surface-hover flex items-center justify-center"
          aria-label="Previous month"
        >
          <span className="sr-only">Previous month</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="text-sm font-black text-foreground">{MONTHS[month]} {year}</div>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg border border-border/40 text-muted hover:text-foreground hover:bg-surface-hover flex items-center justify-center"
          aria-label="Next month"
        >
          <span className="sr-only">Next month</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="py-1 text-center text-[9px] font-black uppercase tracking-wider text-muted/60">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDay }, (_, i) => {
          const day = prevMonthDays - firstDay + i + 1;
          const optionDate = new Date(year, month - 1, day);
          const iso = toIsoDate(optionDate);
          return (
            <button
              key={`prev-${day}`}
              type="button"
              onClick={() => selectDate(optionDate)}
              className="aspect-square rounded-lg text-[11px] font-bold text-muted/35 hover:bg-surface-hover hover:text-muted"
              aria-label={`Select ${formatDateLabel(iso)}`}
            >
              {day}
            </button>
          );
        })}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const optionDate = new Date(year, month, day);
          const iso = toIsoDate(optionDate);
          const selected = iso === selectedDate;
          const today = iso === todayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => selectDate(optionDate)}
              aria-pressed={selected}
              aria-label={`Select ${formatDateLabel(iso)}`}
              className={`relative aspect-square rounded-lg text-[12px] font-black transition-colors ${
                selected
                  ? "bg-accent text-white"
                  : today
                    ? "bg-accent/15 text-accent"
                    : "text-foreground hover:bg-accent/10 hover:text-accent"
              }`}
            >
              {day}
              {today && !selected && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
        <button
          type="button"
          onClick={() => selectDate(new Date())}
          className="rounded-xl bg-accent/10 py-2 text-[11px] font-black text-accent hover:bg-accent/20"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-surface-hover py-2 text-[11px] font-black text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Expert Picks strip ────────────────────────────────────────
function ExpertPicksStrip({ picks }: { picks: CommunityPrediction[] }) {
  const STATUS_BAR: Record<string, string> = {
    open: "bg-accent",
    won:  "bg-success",
    lost: "bg-danger",
    void: "bg-accent-gold",
  };
  const STATUS_TEXT: Record<string, string> = {
    open: "text-accent bg-accent/10 border-accent/20",
    won:  "text-success bg-success/10 border-success/20",
    lost: "text-danger bg-danger/10 border-danger/20",
    void: "text-accent-gold bg-accent-gold/10 border-accent-gold/20",
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <span className="text-accent-gold text-xs">★</span>
          <span className="text-[10px] font-black text-accent-gold uppercase tracking-widest">Expert Picks</span>
        </div>
        <span className="text-xs text-muted font-medium">Hand-picked by our analysts</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.slice(0, 6).map((p) => {
          const home = p.match?.homeTeam?.name ?? "Home";
          const away = p.match?.awayTeam?.name ?? "Away";
          const pred = p.prediction;
          return (
            <Link key={p.id} href={`/predictions/${p.id}`}
              className="group glass border border-accent-gold/20 hover:border-accent-gold/40 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 block">
              <div className={`h-0.5 w-full ${STATUS_BAR[p.status] ?? "bg-accent"}`} />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-accent-gold text-xs">★</span>
                    <span className="text-[10px] font-black text-accent-gold uppercase tracking-wider">Expert</span>
                    {p.isTrending && <span className="text-[10px] text-accent-gold">🔥</span>}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border capitalize ${STATUS_TEXT[p.status] ?? STATUS_TEXT.open}`}>
                    {p.status}
                  </span>
                </div>
                <div className="mb-3">
                  <div className="text-sm font-black text-foreground group-hover:text-accent transition-colors truncate">{home} vs {away}</div>
                  <div className="text-xs text-muted mt-0.5">{p.league?.name ?? p.sport}</div>
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 bg-surface/60 rounded-xl border border-border/40">
                  <div>
                    <div className="text-[9px] text-muted font-bold uppercase tracking-wider">Pick</div>
                    <div className="text-sm font-black text-accent">{pred?.type ?? "—"}</div>
                  </div>
                  {pred?.odds != null && (
                    <div className="text-right">
                      <div className="text-[9px] text-muted font-bold uppercase tracking-wider">Odds</div>
                      <div className="text-sm font-black text-foreground">{pred.odds.toFixed(2)}</div>
                    </div>
                  )}
                  {pred?.confidence != null && (
                    <div className="text-right">
                      <div className="text-[9px] text-muted font-bold uppercase tracking-wider">Conf.</div>
                      <div className="text-sm font-black text-foreground">{pred.confidence}%</div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Predict tab ────────────────────────────────────────────
const AI_SPORTS = [
  { label: "Football", supported: true },
  { label: "Basketball", supported: true },
  { label: "Baseball", supported: true },
  { label: "Hockey", supported: true },
  { label: "Volleyball", supported: true },
  { label: "Tennis", supported: false },
  { label: "Rugby", supported: false },
  { label: "Cricket", supported: false },
];

function AiPredict() {
  const [prompt, setPrompt]     = useState("");
  const [sport, setSport]       = useState("Football");
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput]     = useState("");
  const [error, setError]       = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [sources, setSources] = useState<Array<{ label: string; status: string; generatedAt?: string }>>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || streaming) return;
    setStreaming(true);
    setOutput("");
    setError("");
    setGeneratedAt("");
    setSources([]);

    try {
      const res = await fetch(`${API_BASE}/api/ai/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), sport }),
      });

      if (!res.ok || !res.body) {
        setError("AI service is unavailable right now. Please try again later.");
        setStreaming(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const json = JSON.parse(trimmed.slice(5).trim());
            if (json.error) { setError(json.error); break; }
            if (json.done) {
              setGeneratedAt(json.generatedAt || new Date().toISOString());
              setSources(Array.isArray(json.sources) ? json.sources : []);
            }
            if (json.token) {
              setOutput((prev) => prev + json.token);
              // Auto-scroll
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setError("Could not reach AI service. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  // Render markdown-like sections (### headings) into styled blocks
  function renderOutput(text: string) {
    if (!text) return null;
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let key = 0;
    for (const line of lines) {
      if (line.startsWith("### ")) {
        nodes.push(
          <div key={key++} className="text-[10px] font-black text-accent uppercase tracking-widest mt-5 mb-1.5 first:mt-0">
            {line.slice(4)}
          </div>
        );
      } else if (line.startsWith("- ") || line.startsWith("• ")) {
        nodes.push(
          <div key={key++} className="flex gap-2 text-sm text-foreground font-medium mb-1">
            <span className="text-accent shrink-0 mt-0.5">•</span>
            <span>{line.slice(2)}</span>
          </div>
        );
      } else if (line.trim()) {
        nodes.push(<p key={key++} className="text-sm text-foreground font-medium mb-1">{line}</p>);
      }
    }
    return nodes;
  }

  const sourceSummary = sources.length
    ? sources.map((source) => `${source.label} (${source.status})`).join(", ")
    : "API-Sports recent form/H2H when matched; The Odds API when configured";

  const examples = [
    "Arsenal vs Chelsea, Premier League — who will win?",
    "Man City home to Liverpool — predict the scoreline",
    "Real Madrid vs Bayern Munich, will there be over 2.5 goals?",
    "Lakers vs Celtics — estimate the win probability range",
  ];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="glass border border-accent/20 rounded-2xl p-5 flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <AiIcon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <div className="text-sm font-black text-foreground mb-1">AI Prediction Assistant</div>
          <div className="text-xs text-muted font-medium leading-relaxed">
            Describe any match or ask a prediction question. The response includes a tip, probability range, key factors, fair odds estimate, and source freshness.
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sport selector */}
        <fieldset className="flex gap-2 flex-wrap">
          <legend className="sr-only">Choose sport for AI prediction</legend>
          {AI_SPORTS.map((item) => (
            <button key={item.label} type="button" onClick={() => item.supported && setSport(item.label)}
              disabled={!item.supported}
              title={item.supported ? `Use ${item.label} data where available` : `${item.label} support is coming soon`}
              aria-label={item.supported ? `Select ${item.label}` : `${item.label} coming soon`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sport === item.label
                  ? "bg-accent text-white"
                  : item.supported
                    ? "glass border border-border/40 text-muted hover:text-foreground"
                    : "glass border border-border/30 text-muted/40 cursor-not-allowed"
              }`}>{item.label}</button>
          ))}
        </fieldset>

        {/* Prompt textarea */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="ai-predict-prompt" className="sr-only">Prediction question</label>
            <textarea
              id="ai-predict-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && prompt.trim()) { e.preventDefault(); handleSubmit(e as any); } }}
              rows={3}
              placeholder="e.g. Arsenal vs Chelsea, Premier League — who will win and why?"
              title="Press Enter or use Ask AI to submit. Use Shift+Enter for a new line."
              className="w-full glass border border-border/40 focus:border-accent/50 rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted/40 focus:outline-none resize-none transition-colors"
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-muted/40">{prompt.length}/1000</div>
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || streaming}
            aria-busy={streaming}
            className="flex min-h-[52px] sm:w-36 items-center justify-center gap-2 px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all hover:-translate-y-0.5 shadow-sm"
          >
            {streaming ? <LoadingSpinner className="w-4 h-4" /> : <AiIcon className="w-4 h-4" />}
            {streaming ? "Analysing…" : "Ask AI"}
          </button>
        </div>
      </form>

      {/* Example prompts */}
      {!output && !streaming && (
        <div>
          <p className="text-[10px] font-black text-muted uppercase tracking-wider mb-3">Try an example</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => setPrompt(ex)}
                className="text-left glass border border-border/30 hover:border-accent/30 rounded-xl px-4 py-3 text-xs font-medium text-muted hover:text-foreground transition-all">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass border border-danger/20 rounded-2xl p-4 text-sm text-danger font-medium flex items-center gap-3">
          <span className="shrink-0">⚠</span> {error}
        </div>
      )}

      {/* Streaming output */}
      {(streaming || output) && (
        <div className="glass border border-accent/20 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30 bg-accent/5">
            <AiIcon className="w-4 h-4 text-accent" />
            <span className="text-xs font-black text-accent uppercase tracking-wider">AI Analysis</span>
            {streaming && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted" role="status" aria-live="polite">
                <LoadingSpinner className="w-3.5 h-3.5 text-accent" />
                Checking form, H2H, and odds feeds…
              </span>
            )}
          </div>
          <div ref={outputRef} aria-live="polite" className="px-5 py-4 max-h-[420px] overflow-y-auto no-scrollbar space-y-0.5">
            {renderOutput(output)}
            {streaming && !output && (
              <div className="flex gap-1 py-2">
                {[0,1,2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            )}
          </div>
          {!streaming && output && (
            <div className="px-5 py-3 border-t border-border/30 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="block text-[10px] text-muted/60 font-medium">
                  AI estimate, not betting advice{generatedAt ? ` · generated ${new Date(generatedAt).toLocaleString("en-GB")}` : ""}. API-Sports cache up to 1 hour; odds are checked at request time when configured.
                </span>
                <span className="mt-1 block text-[10px] text-muted/60 truncate">
                  Sources: {sourceSummary}
                </span>
              </div>
              <button onClick={() => { setOutput(""); setPrompt(""); }}
                className="shrink-0 text-xs font-bold text-accent hover:underline">New prediction →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tips list (predictions + inline codes) ────────────────────
function TipsList({ predictions, state }: { predictions: CommunityPrediction[]; state: RequestState }) {
  if (state === "loading" || state === "idle") return <PredictionSkeleton />;

  if (state === "error") {
    return (
      <div className="card-premium p-8 text-center">
        <div className="w-12 h-12 bg-surface rounded-xl border border-border flex items-center justify-center mx-auto mb-3">
          <BarChartIcon className="w-5 h-5 text-muted" />
        </div>
        <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">Tips could not be loaded</h3>
        <p className="text-xs text-muted">Check database and API configuration, then try again.</p>
      </div>
    );
  }

  if (!predictions.length) {
    return (
      <div className="card-premium p-8 text-center">
        <div className="w-12 h-12 bg-surface rounded-xl border border-border flex items-center justify-center mx-auto mb-3">
          <SearchIcon className="w-5 h-5 text-muted" />
        </div>
        <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">No tips match these filters</h3>
        <p className="text-xs text-muted">Try a broader sport, market, league, or date.</p>
      </div>
    );
  }

  const STATUS_STYLES: Record<string, { label: string; cls: string; bar: string }> = {
    open: { label: "Open", cls: "bg-accent/15 text-accent border-accent/25",     bar: "bg-gradient-to-r from-accent to-accent-hover" },
    won:  { label: "Won",  cls: "bg-success/15 text-success border-success/25",  bar: "bg-success" },
    lost: { label: "Lost", cls: "bg-danger/15 text-danger border-danger/25",     bar: "bg-danger" },
    void: { label: "Void", cls: "bg-muted/15 text-muted border-muted/25",        bar: "bg-muted" },
  };

  const SPORT_ICONS: Record<string, string> = {
    Football: "⚽", Basketball: "🏀", Tennis: "🎾", Baseball: "⚾", Hockey: "🏒", Volleyball: "🏐",
  };

  const freePredictions   = predictions.slice(0, FREE_PREDICTIONS);
  const lockedPredictions = predictions.slice(FREE_PREDICTIONS);

  function renderCard(prediction: CommunityPrediction) {
    const home       = prediction.match?.homeTeam?.name ?? "Home";
    const away       = prediction.match?.awayTeam?.name ?? "Away";
    const leagueName = prediction.league?.name ?? "Unknown League";
    const pred       = prediction.prediction;
    const statusInfo = STATUS_STYLES[prediction.status] ?? STATUS_STYLES.open;
    const sportIcon  = SPORT_ICONS[prediction.sport] ?? "🏆";
    const isExpert   = prediction.creator?.badge === "elite";

    return (
      <Link key={prediction.id} href={`/predictions/${prediction.id}`}
        className="group card-premium overflow-hidden block relative">
        <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-hover pointer-events-none -z-10" />
        <div className={`h-1 w-full ${statusInfo.bar} transition-all duration-300`} />

        <div className="p-5 sm:p-6 relative z-10">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-border shadow-sm text-base">{sportIcon}</div>
              <span className="text-[11px] text-muted font-bold uppercase tracking-widest">{leagueName}</span>
              {isExpert && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-gold/15 border border-accent-gold/30 text-accent-gold text-[10px] font-black uppercase tracking-wider rounded-md">
                  ★ Expert Pick
                </span>
              )}
              {prediction.isTrending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-gold/15 border border-accent-gold/30 text-accent-gold text-[10px] font-black uppercase tracking-wider rounded-md animate-pulse-live">
                  🔥 Trending
                </span>
              )}
              {prediction.isPremium && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-gold/15 border border-accent-gold/30 text-accent-gold text-[10px] font-black uppercase tracking-wider rounded-md">
                  ★ Premium
                </span>
              )}
            </div>
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <p className="text-lg font-black text-foreground truncate group-hover:text-accent transition-colors">{home}</p>
              <p className="text-[11px] text-muted font-bold uppercase tracking-wider mt-0.5">Home</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border/50 flex items-center justify-center shadow-sm">
                <span className="text-xs font-black text-muted">VS</span>
              </div>
              {prediction.match?.date && (
                <span className="text-[10px] text-muted font-bold tracking-wide whitespace-nowrap mt-1">
                  {fmtDate(prediction.match.date)} · {fmtTime(prediction.match.date)}
                </span>
              )}
            </div>
            <div className="flex-1 text-right">
              <p className="text-lg font-black text-foreground truncate group-hover:text-accent transition-colors">{away}</p>
              <p className="text-[11px] text-muted font-bold uppercase tracking-wider mt-0.5">Away</p>
            </div>
          </div>

          {/* Prediction bar */}
          <div className="relative overflow-hidden flex items-center gap-4 p-4 bg-surface-hover/80 border border-border/50 rounded-xl mb-5 group-hover:border-accent/30 transition-colors shadow-inner">
            {pred?.confidence != null && (
              <div className="absolute top-0 left-0 h-full bg-accent/5 border-r border-accent/20" style={{ width: `${pred.confidence}%` }} />
            )}
            <div className="flex-1 relative z-10">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Pick</p>
              <p className="text-lg font-black text-accent drop-shadow-sm">{pred?.type ?? "—"}</p>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Odds</p>
              <p className="text-2xl font-black text-foreground">{pred?.odds?.toFixed(2) ?? "—"}</p>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Conf.</p>
              <p className="text-base font-black text-foreground">{pred?.confidence != null ? `${pred.confidence}%` : "—"}</p>
            </div>
          </div>

          {/* Booking code — shown inline if attached */}
          {prediction.bookingCode && (
            <PremiumGate feature="Booking Codes" mode="blur" flagKey="hot_codes_full">
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/40 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-accent/10 border border-accent/20 text-accent shrink-0">
                  {prediction.bookingCode.bookmaker}
                </span>
                <div className="font-mono text-sm font-black text-foreground bg-surface px-3 py-1.5 rounded-lg border border-border/80 tracking-wider shadow-inner">
                  {prediction.bookingCode.code}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); void navigator.clipboard.writeText(prediction.bookingCode!.code); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-accent hover:bg-accent-hover text-white transition-all hover:scale-105 active:scale-95"
                >
                  Copy
                </button>
                {prediction.bookingCode.affiliateUrl && prediction.bookingCode.affiliateUrl !== "#" && (
                  <a
                    href={prediction.bookingCode.affiliateUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-surface border border-border hover:border-accent/40 text-muted hover:text-foreground transition-all flex items-center gap-1"
                  >
                    Open ↗
                  </a>
                )}
              </div>
            </PremiumGate>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border ${
                isExpert ? "bg-accent-gold/10 border-accent-gold/20 text-accent-gold" : "bg-gradient-to-br from-accent/20 to-accent/5 border-accent/20 text-accent"
              }`}>
                {isExpert ? "★" : (prediction.creator?.name?.[0] ?? "?")}
              </div>
              <span className="text-xs font-bold text-muted truncate hover:text-foreground transition-colors">
                {isExpert ? "Expert Analyst" : (prediction.creator?.name ?? "Creator")}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-muted">
              <span className="flex items-center gap-1.5 hover:text-accent transition-colors"><BarChartIcon className="w-3.5 h-3.5" /> {prediction.stats.views.toLocaleString()}</span>
              <span className="flex items-center gap-1.5 hover:text-accent transition-colors">👍 {prediction.stats.likes.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {freePredictions.map((p) => renderCard(p))}
      </div>
      {lockedPredictions.length > 0 && (
        <PremiumGate feature="Full Tips" mode="blur" flagKey="predictions_full">
          <div className="grid gap-5 lg:grid-cols-2">
            {lockedPredictions.map((p) => renderCard(p))}
          </div>
        </PremiumGate>
      )}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────
function PredictionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card-premium p-4 animate-pulse">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-border/50 rounded w-2/3" />
              <div className="h-3 bg-border/50 rounded w-1/2" />
            </div>
            <div className="h-6 bg-border/50 rounded w-16 shrink-0" />
          </div>
          <div className="h-12 bg-border/50 rounded mb-3" />
          <div className="flex items-center justify-between">
            <div className="h-3 bg-border/50 rounded w-24" />
            <div className="h-3 bg-border/50 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString())    return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Icons ─────────────────────────────────────────────────────
function AiIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function ChevronIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
