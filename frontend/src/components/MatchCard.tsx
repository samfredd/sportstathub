import Link from "next/link";
import { LockIcon } from "./Icons";

interface Match {
  id: string | number;
  time: string;
  status?: string;
  homeTeam: string;
  homeLogo?: string;
  awayTeam: string;
  awayLogo?: string;
  score?: string;
  prediction?: string;
  odds?: string | number;
  locked?: boolean;
}

interface MatchCardProps {
  match: Match;
  sport?: string;
}

function TeamLogo({ name, logo, size = "sm" }: { name: string; logo?: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-7 h-7 rounded-lg" : "w-6 h-6 rounded";
  return (
    <div className={`${dim} shrink-0 bg-surface flex items-center justify-center border border-border/50 overflow-hidden`}>
      {logo
        ? <img src={logo} alt={name} className="w-full h-full object-contain p-0.5" />
        : <span className="text-[9px] font-black text-muted leading-none">{name.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
}

export default function MatchCard({ match, sport }: MatchCardProps) {
  const hasPrediction = Boolean(match.prediction && match.odds);
  const isLive        = match.status === "Live";
  const isWideScore   = (match.score?.length ?? 0) > 6;
  const href = (sport && sport !== "football")
    ? `/match/${sport}/${match.id}`
    : `/match/${match.id}`;

  return (
    <Link href={href} className="block group cursor-pointer active:bg-surface-hover transition-colors">
      <div className="border-b border-border/30 group-last:border-none relative overflow-hidden">
        {/* Hover accent bar */}
        <div className="absolute left-0 top-0 w-[3px] h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />

        {/* ─── MOBILE LAYOUT ─────────────────────────────────────────── */}
        <div className="sm:hidden flex items-center gap-2 px-3 py-3.5 hover:bg-surface-hover/50 transition-colors">

          {/* Time / Live */}
          <div className="w-9 shrink-0 flex flex-col items-center gap-0.5">
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-live animate-pulse-live" />
                <span className="text-[8px] font-black text-live uppercase tracking-widest">Live</span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-muted tabular-nums leading-tight text-center">{match.time}</span>
            )}
          </div>

          {/* Home team: name → logo */}
          <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
            <span className="text-[12px] font-bold text-foreground truncate text-right leading-tight group-hover:text-accent transition-colors">
              {match.homeTeam}
            </span>
            <TeamLogo name={match.homeTeam} logo={match.homeLogo} size="md" />
          </div>

          {/* Score / VS */}
          <div className="shrink-0 w-16 flex items-center justify-center">
            {match.score ? (
              <span className={`text-center whitespace-nowrap font-black text-foreground tabular-nums px-2 py-1 rounded-xl bg-surface border border-border/60 ${isWideScore ? "text-[11px]" : "text-[14px]"}`}>
                {match.score}
              </span>
            ) : (
              <span className="text-[10px] font-black text-muted/30 tracking-widest">—</span>
            )}
          </div>

          {/* Away team: logo → name */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <TeamLogo name={match.awayTeam} logo={match.awayLogo} size="md" />
            <span className="text-[12px] font-bold text-foreground truncate leading-tight group-hover:text-accent transition-colors">
              {match.awayTeam}
            </span>
          </div>

          {/* Odds / Lock */}
          <div className="w-10 shrink-0 flex justify-end">
            {match.locked ? (
              <div className="w-7 h-7 rounded-xl bg-surface border border-border/50 flex items-center justify-center">
                <LockIcon className="w-3 h-3 text-accent-gold" />
              </div>
            ) : hasPrediction ? (
              <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-1.5 rounded-xl border border-accent/20 tabular-nums">
                {match.odds}
              </span>
            ) : null}
          </div>
        </div>

        {/* ─── DESKTOP LAYOUT ────────────────────────────────────────── */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-2.5 hover:bg-surface-hover transition-all duration-200">

          {/* Time & Live */}
          <div className="flex flex-col w-11 shrink-0">
            <span className="text-[11px] font-bold text-muted group-hover:text-foreground/80 transition-colors tracking-widest tabular-nums">
              {match.time}
            </span>
            {isLive && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
                <span className="text-[9px] text-live font-black tracking-widest uppercase">Live</span>
              </div>
            )}
          </div>

          {/* Teams symmetric */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-4">
            {/* Home */}
            <div className="flex-1 flex justify-end items-center gap-2 min-w-0">
              <span className="text-[13px] font-bold text-foreground truncate text-right group-hover:text-accent transition-colors">
                {match.homeTeam}
              </span>
              <TeamLogo name={match.homeTeam} logo={match.homeLogo} />
            </div>

            {/* Score */}
            <div className={`flex items-center justify-center shrink-0 ${isWideScore ? "w-[82px]" : "w-16"}`}>
              {match.score ? (
                <span className={`w-full text-center whitespace-nowrap font-black text-white bg-accent/20 px-2 py-0.5 rounded border border-accent/30 tabular-nums shadow-[0_0_10px_rgba(59,130,246,0.1)] ${isWideScore ? "text-[13px]" : "text-[15px]"}`}>
                  {match.score}
                </span>
              ) : (
                <div className="flex items-center gap-0.5 opacity-30">
                  <div className="w-0.5 h-0.5 rounded-full bg-muted" />
                  <span className="text-[9px] text-muted font-black tracking-tighter">VS</span>
                  <div className="w-0.5 h-0.5 rounded-full bg-muted" />
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 flex justify-start items-center gap-2 min-w-0">
              <TeamLogo name={match.awayTeam} logo={match.awayLogo} />
              <span className="text-[13px] font-bold text-foreground truncate text-left group-hover:text-accent transition-colors">
                {match.awayTeam}
              </span>
            </div>
          </div>

          {/* Prediction / Lock */}
          <div className="flex flex-col items-end justify-center gap-1 shrink-0">
            {match.locked ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border/50 text-muted text-[9px] font-black rounded cursor-pointer hover:border-accent-gold/30 hover:text-accent-gold transition-all">
                <LockIcon className="w-3 h-3 text-accent-gold" />
                <span className="tracking-widest opacity-80">LOCKED</span>
              </div>
            ) : hasPrediction ? (
              <div className="flex items-center gap-1 group/tip">
                <div className="flex flex-col items-end mr-1">
                  <span className="text-[8px] font-black text-muted uppercase tracking-[0.2em] leading-none mb-1">Pick</span>
                  <span className="text-[11px] text-foreground font-black whitespace-nowrap leading-none group-hover/tip:text-accent transition-colors">
                    {match.prediction}
                  </span>
                </div>
                <div className="h-7 w-[1px] bg-border/50 mx-0.5" />
                <span className="text-[13px] text-accent font-black bg-accent/10 px-2.5 py-1 rounded border border-accent/20 tabular-nums group-hover/tip:bg-accent group-hover/tip:text-white transition-all shadow-sm">
                  {match.odds}
                </span>
              </div>
            ) : (
              <span className="text-[9px] font-black text-muted/40 tracking-widest">NO TIP</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
