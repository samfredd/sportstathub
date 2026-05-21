"use client";

interface Column<T = Record<string, unknown>> {
  key: string;
  label: React.ReactNode;
  width?: string | number;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id?: string | number }> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  page: number;
  pages: number;
  total?: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading,
  page,
  pages,
  total,
  onPageChange,
  emptyMessage = "No records found",
}: DataTableProps<T>) {
  return (
    <div className="glass rounded-2xl border border-border/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-surface/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-5 py-3.5 text-left text-[11px] font-black text-muted uppercase tracking-widest whitespace-nowrap"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted font-medium">Loading…</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-muted text-sm font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="hover:bg-surface/40 transition-colors duration-150 group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-5 py-3.5 whitespace-nowrap"
                    >
                      {col.render ? col.render(row) : (
                        <span className="text-sm text-foreground font-medium">{String((row as Record<string, unknown>)[col.key] ?? "")}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
          <span className="text-xs text-muted font-medium">
            Page <span className="font-black text-foreground">{page}</span> of <span className="font-black text-foreground">{pages}</span>
            {total !== undefined && <span className="ml-2 text-muted/60">({total} total)</span>}
          </span>
          <div className="flex items-center gap-1">
            <PaginationBtn onClick={() => onPageChange(1)} disabled={page === 1}>«</PaginationBtn>
            <PaginationBtn onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</PaginationBtn>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              let p: number;
              if (pages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= pages - 2) p = pages - 4 + i;
              else p = page - 2 + i;
              return (
                <PaginationBtn key={p} onClick={() => onPageChange(p)} active={p === page}>
                  {p}
                </PaginationBtn>
              );
            })}
            <PaginationBtn onClick={() => onPageChange(page + 1)} disabled={page === pages}>›</PaginationBtn>
            <PaginationBtn onClick={() => onPageChange(pages)} disabled={page === pages}>»</PaginationBtn>
          </div>
        </div>
      )}
    </div>
  );
}

interface PaginationBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function PaginationBtn({ children, onClick, disabled, active }: PaginationBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
        active
          ? "bg-accent text-white shadow-sm"
          : disabled
          ? "text-muted/30 cursor-not-allowed"
          : "text-muted hover:text-foreground hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
