interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: number;
  color?: "accent" | "blue" | "purple" | "amber" | "rose";
}

export default function StatCard({ icon, label, value, sub, trend, color = 'accent' }: StatCardProps) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    accent:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    blue:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
    purple:   { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/20' },
    amber:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
    rose:     { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20' },
  };
  const c = colors[color] || colors.accent;

  return (
    <div className="glass rounded-2xl p-6 border border-border/30 hover:border-border/60 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-3xl font-black text-foreground mb-1 tabular-nums">{value}</div>
      <div className="text-sm font-bold text-muted">{label}</div>
      {sub && <div className="text-xs text-muted/60 mt-1 font-medium">{sub}</div>}
    </div>
  );
}
