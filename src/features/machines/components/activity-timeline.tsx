'use client';

import { ClipboardList, Timer } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { LogSubjectBadge, MachineStatusChange } from '@/components/status/log-subject';
import { OperationalImpactBadge } from '@/components/status/part-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Card, CardHeader } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import { formatDayHeading, formatTime, toIsoString, toLocalDayKey } from '@/lib/utils/date';
import { formatHours, formatNumber } from '@/lib/utils/format';
import { LogScope, LogStatus, type MachineLog } from '@/types/machine-log';
import { type MachinePart } from '@/types/machine-part';
import { useMachineHistoryPage } from '../api/queries';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
type HistoryFilter = LogStatus | 'ALL';
type ScopeFilter = LogScope | 'ALL';

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
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <LogSubjectBadge log={log} />
          <StateTransition from={log.entryStatus} to={log.resultingState} />
          {log.operationalImpact ? <OperationalImpactBadge impact={log.operationalImpact} size="sm" /> : null}
        </span>
        <time dateTime={toIsoString(log.startedAt)} className="text-xs text-muted tabular-nums">
          {formatTime(log.startedAt)}
        </time>
      </div>
      <Link href={ROUTES.log(log.id)} className="mt-1.5 block text-[13px] font-semibold text-ink hover:underline">
        {log.faultDescription}
      </Link>
      {log.remedyAction ? <p className="mt-0.5 text-[13px] text-ink-secondary">{log.remedyAction}</p> : null}
      <MachineStatusChange log={log} label="Machine status" className="mt-1.5" />
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

export interface ActivityTimelineProps {
  machineId: number;
  /** The machine's parts, for the part filter. */
  parts?: readonly MachinePart[];
  emptyAction?: ReactNode;
}

/** The machine's history: whole-machine and part events in one list, filterable by scope and part. */
export function ActivityTimeline({ machineId, parts = [], emptyAction }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [scope, setScope] = useState<ScopeFilter>('ALL');
  const [partId, setPartId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const history = useMachineHistoryPage(machineId, {
    page,
    limit,
    sortBy: 'startedAt',
    sortOrder: 'desc',
    logStatus: filter === 'ALL' ? undefined : filter,
    // A chosen part implies part events.
    scope: partId ? LogScope.PART : scope === 'ALL' ? undefined : scope,
    machinePartId: partId ? Number(partId) : undefined,
  });

  const logs = history.data?.items ?? [];
  const total = history.data?.meta.totalItems ?? 0;
  const filtered = filter !== 'ALL' || scope !== 'ALL' || partId !== '';
  const partOptions = [...parts]
    .sort((a, b) => a.partCode.localeCompare(b.partCode))
    .map((part) => ({ value: String(part.id), label: `${part.partCode} – ${part.name}` }));

  return (
    <Card>
      <CardHeader
        title="Activity history"
        description={history.data ? `${formatNumber(total)} recorded ${total === 1 ? 'event' : 'events'}, newest first` : 'Recorded events, newest first'}
        actions={
          <ChipGroup<HistoryFilter>
            label="Filter history by log status"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: LogStatus.OPEN, label: 'Open' },
              { value: LogStatus.CLOSED, label: 'Closed' },
            ]}
          />
        }
      />
      {parts.length > 0 ? (
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <ChipGroup<ScopeFilter>
            label="Filter history by scope"
            value={partId ? LogScope.PART : scope}
            onChange={(value) => {
              setScope(value);
              if (value !== LogScope.PART) setPartId('');
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All events' },
              { value: LogScope.MACHINE, label: 'Machine' },
              { value: LogScope.PART, label: 'Parts' },
            ]}
          />
          <Select
            aria-label="Filter history by part"
            value={partId}
            onChange={(event) => {
              setPartId(event.target.value);
              setPage(1);
            }}
            options={partOptions}
            placeholder="All parts"
            wrapperClassName="sm:ml-auto sm:min-w-56"
          />
        </div>
      ) : null}
      {history.isPending ? (
        <ListSkeleton rows={4} />
      ) : history.isError && !history.data ? (
        <ErrorState compact error={history.error} onRetry={() => void history.refetch()} isRetrying={history.isFetching} />
      ) : logs.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardList}
          title={!filtered ? 'No activity recorded yet' : 'No events match these filters'}
          description={!filtered ? 'Maintenance and status events for this machine and its parts will appear here.' : 'Try another filter.'}
          action={!filtered ? emptyAction : null}
        />
      ) : (
        <div
          className={cn('px-4 py-4 transition-opacity sm:px-5', history.isPlaceholderData && 'opacity-60')}
          aria-busy={history.isFetching}
        >
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
        </div>
      )}
      {history.data && total > 0 ? (
        <Pagination
          meta={history.data.meta}
          itemLabel="events"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      ) : null}
    </Card>
  );
}
