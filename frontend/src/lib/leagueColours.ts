export interface LeagueColour {
  bg:     string;
  border: string;
  text:   string;
  dot:    string;
}

const NAMED: Record<string, LeagueColour> = {
  "Premier League":         { bg: "bg-purple-500/10",   border: "border-purple-500/25",   text: "text-purple-300",   dot: "bg-purple-400"   },
  "La Liga":                { bg: "bg-red-500/10",       border: "border-red-500/25",       text: "text-red-400",      dot: "bg-red-400"      },
  "Serie A":                { bg: "bg-blue-600/10",      border: "border-blue-600/25",      text: "text-blue-400",     dot: "bg-blue-400"     },
  "Bundesliga":             { bg: "bg-rose-500/10",      border: "border-rose-500/25",      text: "text-rose-400",     dot: "bg-rose-400"     },
  "Ligue 1":                { bg: "bg-sky-500/10",       border: "border-sky-500/25",       text: "text-sky-400",      dot: "bg-sky-400"      },
  "UEFA Champions League":  { bg: "bg-indigo-500/10",    border: "border-indigo-500/25",    text: "text-indigo-300",   dot: "bg-indigo-400"   },
  "UEFA Europa League":     { bg: "bg-orange-500/10",    border: "border-orange-500/25",    text: "text-orange-400",   dot: "bg-orange-400"   },
  "UEFA Conference League": { bg: "bg-teal-500/10",      border: "border-teal-500/25",      text: "text-teal-400",     dot: "bg-teal-400"     },
  "FA Cup":                 { bg: "bg-violet-500/10",    border: "border-violet-500/25",    text: "text-violet-300",   dot: "bg-violet-400"   },
  "EFL Championship":       { bg: "bg-amber-500/10",     border: "border-amber-500/25",     text: "text-amber-400",    dot: "bg-amber-400"    },
  "Eredivisie":             { bg: "bg-orange-600/10",    border: "border-orange-600/25",    text: "text-orange-400",   dot: "bg-orange-500"   },
  "Primeira Liga":          { bg: "bg-green-500/10",     border: "border-green-500/25",     text: "text-green-400",    dot: "bg-green-400"    },
  "Super Lig":              { bg: "bg-red-600/10",       border: "border-red-600/25",       text: "text-red-400",      dot: "bg-red-500"      },
  "Pro League":             { bg: "bg-yellow-500/10",    border: "border-yellow-500/25",    text: "text-yellow-400",   dot: "bg-yellow-400"   },
  "Scottish Premiership":   { bg: "bg-blue-500/10",      border: "border-blue-500/25",      text: "text-blue-400",     dot: "bg-blue-400"     },
  "World Cup":              { bg: "bg-emerald-500/10",   border: "border-emerald-500/25",   text: "text-emerald-400",  dot: "bg-emerald-400"  },
  "Euro Championship":      { bg: "bg-blue-400/10",      border: "border-blue-400/25",      text: "text-blue-300",     dot: "bg-blue-300"     },
  "Africa Cup of Nations":  { bg: "bg-green-600/10",     border: "border-green-600/25",     text: "text-green-400",    dot: "bg-green-500"    },
  "Copa America":           { bg: "bg-cyan-500/10",      border: "border-cyan-500/25",      text: "text-cyan-400",     dot: "bg-cyan-400"     },
};

const PALETTE: LeagueColour[] = [
  { bg: "bg-accent/10",      border: "border-accent/25",      text: "text-accent",      dot: "bg-accent"      },
  { bg: "bg-pink-500/10",    border: "border-pink-500/25",    text: "text-pink-400",    dot: "bg-pink-400"    },
  { bg: "bg-lime-500/10",    border: "border-lime-500/25",    text: "text-lime-400",    dot: "bg-lime-400"    },
  { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/25", text: "text-fuchsia-400", dot: "bg-fuchsia-400" },
  { bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    text: "text-cyan-400",    dot: "bg-cyan-400"    },
  { bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-400",   dot: "bg-amber-400"   },
  { bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-300",  dot: "bg-violet-400"  },
  { bg: "bg-teal-500/10",    border: "border-teal-500/25",    text: "text-teal-400",    dot: "bg-teal-400"    },
  { bg: "bg-rose-500/10",    border: "border-rose-500/25",    text: "text-rose-400",    dot: "bg-rose-400"    },
  { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400",     dot: "bg-sky-400"     },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", dot: "bg-emerald-400" },
  { bg: "bg-indigo-500/10",  border: "border-indigo-500/25",  text: "text-indigo-300",  dot: "bg-indigo-400"  },
];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export function getLeagueColour(name: string): LeagueColour {
  if (NAMED[name]) return NAMED[name];
  for (const key of Object.keys(NAMED)) {
    if (name.includes(key) || key.includes(name)) return NAMED[key];
  }
  return PALETTE[hash(name)];
}
