interface StatsRow {
  key?: string;
  label: string;
  home: React.ReactNode;
  away?: React.ReactNode;
  homeColor?: string;
  awayColor?: string;
}

interface StatsTableProps {
  rows: StatsRow[];
  highlightKey?: string;
}

export default function StatsTable({ rows, highlightKey }: StatsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-border/30 last:border-0 transition-colors ${
                highlightKey && row.key === highlightKey
                  ? "bg-accent/10"
                  : i % 2 === 0 ? "bg-surface" : "bg-background/60"
              }`}
            >
              <td className="px-4 py-2.5 text-muted font-medium text-[12px]">{row.label}</td>
              <td className={`px-4 py-2.5 text-center font-black text-[13px] ${row.homeColor ?? "text-foreground"}`}>
                {row.home}
              </td>
              {row.away !== undefined && (
                <td className={`px-4 py-2.5 text-center font-black text-[13px] ${row.awayColor ?? "text-foreground"}`}>
                  {row.away}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
