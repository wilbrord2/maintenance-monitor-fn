'use client';

import { CircleCheckBig, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/constants/routes';
import { useMachineLogs } from '@/features/machine-logs/api/queries';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { formatHours, formatNumber } from '@/lib/utils/format';
import { LogStatus, type MachineLog } from '@/types/machine-log';

const LIMIT = 6;

function WorkRow({ log, completed }: { log: MachineLog; completed: boolean }) {
  return (
    <li>
      <Link href={ROUTES.log(log.id)} className="flex items-start gap-3 px-4 py-3 hover:bg-hover">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">
            {log.machine.name} <span className="font-mono text-[11px] font-normal text-muted">{log.machine.serialNumber}</span>
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-secondary">{log.remedyAction ?? log.faultDescription}</p>
          <p className="mt-1 text-xs text-muted">
            {log.technician.fullName} ·{' '}
            {completed
              ? `completed ${formatRelativeTime(log.endedAt ?? log.updatedAt)}`
              : `started ${formatRelativeTime(log.startedAt)}`}
            {completed && log.downtimeHours > 0 ? ` · ${formatHours(log.downtimeHours)} downtime` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <MachineStateBadge state={log.resultingState} size="sm" />
          <span className="sr-only">{completed ? `Ended ${formatDateTime(log.endedAt)}` : `Started ${formatDateTime(log.startedAt)}`}</span>
        </div>
      </Link>
    </li>
  );
}

function WorkList({ status }: { status: LogStatus }) {
  const completed = status === LogStatus.CLOSED;
  const logs = useMachineLogs({
    page: 1,
    limit: LIMIT,
    logStatus: status,
    sortBy: completed ? 'updatedAt' : 'startedAt',
    sortOrder: 'desc',
  });

  if (logs.isPending) return <ListSkeleton rows={4} />;
  if (logs.isError) return <ErrorState compact error={logs.error} onRetry={() => void logs.refetch()} isRetrying={logs.isFetching} />;
  if (logs.data.items.length === 0) {
    return completed ? (
      <EmptyState compact icon={CircleCheckBig} title="No completed maintenance yet" description="Closed logs will be listed here." />
    ) : (
      <EmptyState compact icon={CircleDashed} title="No open maintenance" description="All recorded maintenance work is closed." />
    );
  }
  return (
    <>
      <ul className="divide-y divide-line-soft">
        {logs.data.items.map((log) => (
          <WorkRow key={log.id} log={log} completed={completed} />
        ))}
      </ul>
      {logs.data.meta.totalItems > LIMIT ? (
        <div className="border-t border-line px-4 py-2.5 text-right">
          <Link href={`${ROUTES.logs}?logStatus=${status}`} className="text-xs font-medium text-info-ink hover:underline">
            View all {formatNumber(logs.data.meta.totalItems)}
          </Link>
        </div>
      ) : null}
    </>
  );
}

/** Maintenance still in progress, and what was recently finished. */
export function MaintenanceWork({ openCount }: { openCount?: number }) {
  return (
    <Card>
      <CardHeader title="Maintenance work" description="Open work orders and recently completed maintenance" className="border-b-0 pb-0" />
      <Tabs defaultValue={LogStatus.OPEN}>
        <TabsList className="px-3">
          <TabsTrigger value={LogStatus.OPEN}>
            Open{openCount !== undefined ? <span className="rounded-sm bg-neutral-soft px-1.5 text-[11px] tabular-nums">{formatNumber(openCount)}</span> : null}
          </TabsTrigger>
          <TabsTrigger value={LogStatus.CLOSED}>Recently completed</TabsTrigger>
        </TabsList>
        <TabsContent value={LogStatus.OPEN}>
          <WorkList status={LogStatus.OPEN} />
        </TabsContent>
        <TabsContent value={LogStatus.CLOSED}>
          <WorkList status={LogStatus.CLOSED} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
