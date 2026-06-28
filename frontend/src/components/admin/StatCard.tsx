interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: number;
  color?: "accent" | "blue" | "purple" | "amber" | "rose";
}

export default function StatCard({ icon, label, value, sub, trend, color = 'accent' }: StatCardProps) {
  // On-brand palette only: emerald (default/info), gold (premium-ish), red (alerts).
  const emerald = { bg: 'bg-accent-soft',      text: 'text-accent',      border: 'border-accent/20' };
  const gold    = { bg: 'bg-accent-gold-soft', text: 'text-accent-gold', border: 'border-accent-gold/25' };
  const red     = { bg: 'bg-danger/10',        text: 'text-danger',      border: 'border-danger/20' };
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    accent: emerald,
    blue:   emerald,
    purple: gold,
    amber:  gold,
    rose:   red,
  };
  const c = colors[color] || colors.accent;

  return (
    <div className="glass rounded-2xl p-6 border border-border/30 hover:border-border/60 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${trend >= 0 ? 'bg-accent-soft text-accent' : 'bg-danger/10 text-danger'}`}>
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
