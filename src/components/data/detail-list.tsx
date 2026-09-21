import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Span both columns (long text). */
  wide?: boolean;
}

/** Label/value pairs as a semantic description list. */
export function DetailList({ items, columns = 2, className }: { items: readonly DetailItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.wide && columns === 2 && 'sm:col-span-2')}>
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className="mt-1 text-[13px] wrap-break-word whitespace-pre-line text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
