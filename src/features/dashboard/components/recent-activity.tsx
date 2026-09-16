'use client';

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { StateTransition } from '@/components/status/state-transition';
import { Card, CardHeader } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { useMachineLogs } from '@/features/machine-logs/api/queries';
import { formatRelativeTime, toIsoString } from '@/lib/utils/date';

/** The latest machine-log events across the fleet. */
export function RecentActivity() {
  const logs = useMachineLogs({ page: 1, limit: 8, sortBy: 'createdAt', sortOrder: 'desc' });

  return (
    <Card>
      <CardHeader
        title="Recent activity"
        description="Latest maintenance and status events"
        actions={
          <Link href={ROUTES.logs} className="text-xs font-medium text-info-ink hover:underline">
            All logs
          </Link>
        }
      />
      {logs.isPending ? (
        <ListSkeleton rows={5} />
      ) : logs.isError ? (
        <ErrorState compact error={logs.error} onRetry={() => void logs.refetch()} isRetrying={logs.isFetching} />
      ) : logs.data.items.length === 0 ? (
        <EmptyState compact icon={ClipboardList} title="No activity yet" description="Maintenance events will appear here once technicians record them." />
      ) : (
        <ol className="divide-y divide-line-soft">
          {logs.data.items.map((log) => (
            <li key={log.id}>
              <Link href={ROUTES.log(log.id)} className="block px-4 py-3 hover:bg-hover">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[13px] font-semibold text-ink">{log.machine.name}</p>
                  <time dateTime={toIsoString(log.createdAt)} className="shrink-0 text-[11px] text-muted">
                    {formatRelativeTime(log.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-secondary">{log.faultDescription}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <StateTransition from={log.entryStatus} to={log.resultingState} />
                  <span className="text-xs text-muted">{log.technician.fullName}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
