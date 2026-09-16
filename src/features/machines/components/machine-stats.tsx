'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { ROUTES } from '@/constants/routes';
import { useDowntimeAnalytics, useMaintenanceEventsAnalytics } from '@/features/analytics/api/queries';
import { formatRelativeTime } from '@/lib/utils/date';
import { formatHours, formatNumber } from '@/lib/utils/format';
import { type Machine } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { useMachineHistoryPage } from '../api/queries';

/** The analytics endpoints return per-machine rows capped at this limit. */
const ANALYTICS_LIMIT = 100;
const STATS_DAYS = 365;

/**
 * Finds this machine in a capped analytics breakdown. If it is absent from a complete list its
 * value is zero; if the list was truncated, the value is unknown.
 */
export function findMachineValue<T extends { machine: { id: number } }>(
  rows: readonly T[] | undefined,
  machineId: number,
  select: (row: T) => number,
): number | null {
  if (!rows) return null;
  const row = rows.find((candidate) => candidate.machine.id === machineId);
  if (row) return select(row);
  return rows.length < ANALYTICS_LIMIT ? 0 : null;
}

function Stat({ label, value, loading, hint }: { label: string; value: string; loading: boolean; hint?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line-soft bg-sunken px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg leading-none font-semibold text-ink">
        {loading ? (
          <Skeleton className="h-5 w-12" />
        ) : hint ? (
          <Tooltip content={hint}>
            <span tabIndex={0}>{value}</span>
          </Tooltip>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function MachineStats({ machine }: { machine: Machine }) {
  const range = { days: STATS_DAYS, limit: ANALYTICS_LIMIT };
  const downtime = useDowntimeAnalytics(range);
  const events = useMaintenanceEventsAnalytics(range);
  const lastClosed = useMachineHistoryPage(machine.id, {
    page: 1,
    limit: 1,
    logStatus: LogStatus.CLOSED,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const downtimeHours = findMachineValue(downtime.data?.byMachine, machine.id, (row) => row.downtimeHours);
  const eventCount = findMachineValue(events.data?.byMachine, machine.id, (row) => row.totalEvents);
  const lastMaintenance = lastClosed.data?.items[0];
  const unknownHint = 'Not available: this machine is outside the top 100 in the analytics breakdown.';

  return (
    <Card>
      <CardHeader title="Statistics" description="Downtime and events cover the last 12 months" />
      <CardContent>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Total logs" value={formatNumber(machine.activity.totalLogs)} loading={false} />
          <Stat label="Open logs" value={formatNumber(machine.activity.openLogs)} loading={false} />
          <Stat
            label="Downtime"
            value={downtimeHours === null ? '—' : formatHours(downtimeHours)}
            loading={downtime.isPending}
            hint={downtime.data && downtimeHours === null ? unknownHint : undefined}
          />
          <Stat
            label="Maintenance events"
            value={eventCount === null ? '—' : formatNumber(eventCount)}
            loading={events.isPending}
            hint={events.data && eventCount === null ? unknownHint : undefined}
          />
        </dl>
        <div className="mt-3 rounded-md border border-line-soft px-3 py-2.5">
          <p className="text-xs text-muted">Last completed maintenance</p>
          {lastClosed.isPending ? (
            <Skeleton className="mt-1.5 h-4 w-40" />
          ) : lastMaintenance ? (
            <Link href={ROUTES.log(lastMaintenance.id)} className="mt-1 block text-[13px] text-ink hover:underline">
              <span className="font-semibold">{formatRelativeTime(lastMaintenance.endedAt ?? lastMaintenance.updatedAt)}</span>
              <span className="text-muted"> · {lastMaintenance.faultDescription}</span>
            </Link>
          ) : (
            <p className="mt-1 text-[13px] text-muted">No completed maintenance yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
