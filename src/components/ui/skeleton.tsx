import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-line-soft', className)} {...props} />;
}

/** Wraps skeleton content so assistive technology hears a single "Loading" status. */
export function LoadingRegion({ label = 'Loading', className, children }: ComponentProps<'div'> & { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading table" className={cn('divide-y divide-line-soft', className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={cn('h-3.5', column === 0 ? 'w-40 shrink-0' : 'hidden flex-1 sm:block', column > 3 && 'lg:block md:hidden')}
            />
          ))}
        </div>
      ))}
    </LoadingRegion>
  );
}

export function ChartSkeleton({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading chart" className={cn('flex items-end gap-3 px-2', className)}>
      <div className="flex w-full items-end gap-3" style={{ height }}>
        {[62, 38, 80, 45, 70, 28, 55].map((value, index) => (
          <Skeleton key={index} className="flex-1 rounded-b-none" style={{ height: `${value}%` }} />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading list" className={cn('divide-y divide-line-soft', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}
