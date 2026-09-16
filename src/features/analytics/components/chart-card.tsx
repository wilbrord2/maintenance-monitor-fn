'use client';

import { ChartColumn, Rows3 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Card, CardHeader } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

type ChartView = 'chart' | 'table';

export interface ChartCardProps {
  title: string;
  description?: ReactNode;
  isLoading: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?(): void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  chart: ReactNode;
  /** Accessible table twin of the chart with every value. */
  table: ReactNode;
  className?: string;
}

/** A chart with a table view. While refetching, the previous render stays visible at reduced opacity. */
export function ChartCard({
  title,
  description,
  isLoading,
  isFetching = false,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  chart,
  table,
  className,
}: ChartCardProps) {
  const [view, setView] = useState<ChartView>('chart');

  const body = () => {
    if (isLoading) return <ChartSkeleton height={220} className="p-4" />;
    if (error && isEmpty) return <ErrorState compact error={error} onRetry={onRetry} />;
    if (isEmpty) return <EmptyState compact title={emptyTitle} description={emptyDescription} />;
    return view === 'chart' ? <div className="p-4">{chart}</div> : table;
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        description={description}
        actions={
          <SegmentedControl<ChartView>
            label={`${title}: display as`}
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart', icon: ChartColumn, iconOnly: true },
              { value: 'table', label: 'Table', icon: Rows3, iconOnly: true },
            ]}
          />
        }
      />
      <div className={cn('min-h-0 flex-1 transition-opacity', isFetching && !isLoading && 'opacity-60')} aria-busy={isFetching}>
        {body()}
      </div>
    </Card>
  );
}
