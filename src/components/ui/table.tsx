import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';
import { type SortOrder } from '@/types/api';

/** Scroll container: only a genuinely wide table scrolls horizontally, never the page. */
export function Table({ className, containerClassName, ...props }: ComponentProps<'table'> & { containerClassName?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', containerClassName)}>
      <table className={cn('w-full border-collapse text-[13px]', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-sunken', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&>tr:last-child]:border-b-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-line-soft transition-colors hover:bg-hover', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-9 border-b border-line px-3 text-left align-middle text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle text-ink', className)} {...props} />;
}

export interface SortableHeaderProps extends Omit<ComponentProps<'th'>, 'onClick'> {
  label: string;
  active: boolean;
  direction: SortOrder;
  onSort(): void;
}

/** Column header that toggles sorting and announces the current order. */
export function SortableHeaderCell({ label, active, direction, onSort, className, ...props }: SortableHeaderProps) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHeaderCell
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-1.5', className)}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex h-7 items-center gap-1 rounded-sm px-1.5 uppercase hover:bg-hover hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-60')} aria-hidden />
      </button>
    </TableHeaderCell>
  );
}
