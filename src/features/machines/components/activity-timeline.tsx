'use client';

import { ClipboardList, Timer } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatDayHeading, formatTime, toIsoString, toLocalDayKey } from '@/lib/utils/date';
import { formatHours, formatNumber } from '@/lib/utils/format';
import { LogStatus, type MachineLog } from '@/types/machine-log';
import { useMachineHistory } from '../api/queries';

const PAGE_SIZE = 15;
type HistoryFilter = LogStatus | 'ALL';

export function groupLogsByDay(logs: readonly MachineLog[]): Array<{ key: string; logs: MachineLog[] }> {
  const groups: Array<{ key: string; logs: MachineLog[] }> = [];
  for (const log of logs) {
    const key = toLocalDayKey(log.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.logs.push(log);
    else groups.push({ key, logs: [log] });
  }
  return groups;
}

function TimelineEntry({ log }: { log: MachineLog }) {
  return (
    <li className="relative pb-5 pl-6 last:pb-1">
      <span className="absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-panel bg-steel ring-1 ring-line" aria-hidden />
      <span className="absolute top-4 bottom-0 left-[4.5px] w-px bg-line last:hidden" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StateTransition from={log.entryStatus} to={log.resultingState} />
        <time dateTime={toIsoString(log.startedAt)} className="text-xs text-muted tabular-nums">
          {formatTime(log.startedAt)}
        </time>
      </div>
      <Link href={ROUTES.log(log.id)} className="mt-1.5 block text-[13px] font-semibold text-ink hover:underline">
        {log.faultDescription}
      </Link>
      {log.remedyAction ? <p className="mt-0.5 text-[13px] text-ink-secondary">{log.remedyAction}</p> : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{log.technician.fullName}</span>
        <LogStatusBadge status={log.logStatus} size="sm" />
        {log.downtimeHours > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3" aria-hidden />
            {formatHours(log.downtimeHours)} downtime
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function ActivityTimeline({ machineId, emptyAction }: { machineId: number; emptyAction?: ReactNode }) {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const history = useMachineHistory(machineId, {
    limit: PAGE_SIZE,
    sortBy: 'startedAt',
    sortOrder: 'desc',
    logStatus: filter === 'ALL' ? undefined : filter,
  });

  const logs = history.data?.pages.flatMap((page) => page.items) ?? [];
  const total = history.data?.pages[0]?.meta.totalItems ?? 0;

  return (
    <Card>
      <CardHeader
        title="Activity history"
        description={history.data ? `${formatNumber(total)} recorded ${total === 1 ? 'event' : 'events'}, newest first` : 'Recorded events, newest first'}
        actions={
          <ChipGroup<HistoryFilter>
            label="Filter history by log status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All' },
              { value: LogStatus.OPEN, label: 'Open' },
              { value: LogStatus.CLOSED, label: 'Closed' },
            ]}
          />
        }
      />
      {history.isPending ? (
        <ListSkeleton rows={4} />
      ) : history.isError && logs.length === 0 ? (
        <ErrorState compact error={history.error} onRetry={() => void history.refetch()} isRetrying={history.isFetching} />
      ) : logs.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardList}
          title={filter === 'ALL' ? 'No activity recorded yet' : `No ${filter === LogStatus.OPEN ? 'open' : 'closed'} logs`}
          description={filter === 'ALL' ? 'Maintenance and status events for this machine will appear here.' : 'Try another filter.'}
          action={filter === 'ALL' ? emptyAction : null}
        />
      ) : (
        <div className="px-4 py-4 sm:px-5">
          {groupLogsByDay(logs).map((group) => (
            <section key={group.key} aria-label={formatDayHeading(group.logs[0]?.startedAt)} className="mb-2">
              <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-wider text-muted uppercase">
                {formatDayHeading(group.logs[0]?.startedAt)}
              </h3>
              <ol>
                {group.logs.map((log) => (
                  <TimelineEntry key={log.id} log={log} />
                ))}
              </ol>
            </section>
          ))}
          {history.hasNextPage ? (
            <div className="border-t border-line-soft pt-3 text-center">
              <Button variant="secondary" size="sm" onClick={() => void history.fetchNextPage()} loading={history.isFetchingNextPage}>
                Load older activity
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
