import { getLeagueColour } from "@/lib/leagueColours";

interface League {
  id?: number | string;
  name: string;
  country?: string;
  logo?: string;
  matches?: unknown[];
}

interface LeagueHeaderProps {
  league: League;
}

export default function LeagueHeader({ league }: LeagueHeaderProps) {
  const c = getLeagueColour(league.name);

  return (
    <div className={`flex items-center gap-2.5 py-2 px-3 border-b ${c.bg} ${c.border} mt-2 first:mt-0 transition-all`}>

      {/* Colour dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot} opacity-80`} />

      {/* League logo */}
      <div className="w-5 h-5 flex items-center justify-center shrink-0 bg-background/60 rounded-md border border-white/10 overflow-hidden">
        {league.logo ? (
          <img src={league.logo} alt={league.name} className="w-full h-full object-contain p-0.5" />
        ) : (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" className={c.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        )}
      </div>

      {/* League name + country */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <h3 className={`text-[11px] font-black tracking-tight uppercase truncate ${c.text}`}>
          {league.name}
        </h3>
        {league.country && (
          <span className="text-[9px] text-muted font-bold tracking-widest uppercase hidden sm:inline shrink-0">
            {league.country}
          </span>
        )}
      </div>

      {/* Match count badge */}
      <div className={`px-1.5 py-0.5 rounded-md ${c.bg} border ${c.border} text-[9px] font-black ${c.text} tabular-nums shrink-0`}>
        {league.matches?.length ?? 1}
      </div>
    </div>
  );
}
