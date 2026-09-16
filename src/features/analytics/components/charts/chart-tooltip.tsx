export interface ChartTooltipItem {
  label: string;
  value: string;
  color: string;
}

/** Hover card for chart marks. Values use text colours; the swatch carries series identity. */
export function ChartTooltip({ title, items }: { title: string; items: readonly ChartTooltipItem[] }) {
  return (
    <div className="min-w-40 rounded-md border border-line bg-panel px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1.5 font-semibold text-ink">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden />
            <span className="flex-1 text-muted">{item.label}</span>
            <span className="font-semibold text-ink tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
