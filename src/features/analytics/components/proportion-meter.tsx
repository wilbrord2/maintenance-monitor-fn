import { formatNumber, toPercent } from '@/lib/utils/format';

export interface ProportionPart {
  label: string;
  value: number;
  color: string;
}

/** Two-to-four part share of a whole as one bar with 2px gaps, every value also written out. */
export function ProportionMeter({ parts, label }: { parts: readonly ProportionPart[]; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${parts.map((part) => `${part.label} ${part.value}`).join(', ')}`}
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-sm bg-line-soft"
      >
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <div key={part.label} className="h-full first:rounded-l-sm last:rounded-r-sm" style={{ flexGrow: part.value, flexBasis: 0, backgroundColor: part.color }} />
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5 text-ink-secondary">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: part.color }} aria-hidden />
            {part.label}
            <span className="font-semibold text-ink tabular-nums">{formatNumber(part.value)}</span>
            <span className="text-muted tabular-nums">({toPercent(part.value, total)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
