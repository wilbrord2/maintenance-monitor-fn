import { type Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { LogsView } from '@/features/machine-logs/components/logs-view';

export const metadata: Metadata = { title: 'Machine logs' };

export default function LogsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <LogsView />
    </Suspense>
  );
}
