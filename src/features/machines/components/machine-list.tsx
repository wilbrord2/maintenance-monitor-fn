'use client';

import Link from 'next/link';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { Badge } from '@/components/ui/badge';
import {
  SortableHeaderCell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { describePartsAttention, partBreakdown } from '@/features/machine-parts/lib/summary';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime, formatRelativeTime, toIsoString } from '@/lib/utils/date';
import { pluralize } from '@/lib/utils/format';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type SortOrder } from '@/types/api';
import { type Machine, type MachineSortField } from '@/types/machine';
import { type MaintenanceSchedule } from '@/types/maintenance';
import { MachineRowActions } from './machine-row-actions';

/**
 * Schedules for the machines whose maintenance needs attention, keyed by machine. The machines
 * endpoint does not carry the schedule, so machines missing from this map simply are not due soon.
 */
export type MaintenanceByMachine = ReadonlyMap<number, MaintenanceSchedule>;

function MaintenanceCell({ schedule }: { schedule: MaintenanceSchedule | undefined }) {
  if (!schedule) return <span className="text-xs text-muted">Not due soon</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <MaintenanceStateBadge state={schedule.state} size="sm" />
      <span className="text-xs whitespace-nowrap text-muted">{formatDate(schedule.nextMaintenanceAt)}</span>
    </div>
  );
}

function PartsCell({ machine }: { machine: Machine }) {
  if (machine.parts.total === 0) return <span className="text-xs text-muted">None</span>;
  const breakdown = partBreakdown(machine.parts);
  return (
    <div className="min-w-0">
      <p className="tabular-nums">{pluralize(machine.parts.total, 'part')}</p>
      <p className="truncate text-xs text-muted">{breakdown.map((entry) => `${entry.count} ${entry.label}`).join(' · ')}</p>
    </div>
  );
}

function useHighlight(machineId: number) {
  const highlighted = useRealtimeStore((state) => machineId in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);
  return { highlighted, onAnimationEnd: () => clearHighlight(machineId) };
}

function RelativeTime({ value, fallback = 'No activity yet' }: { value: string | null; fallback?: string }) {
  if (!value) return <span className="text-muted">{fallback}</span>;
  return (
    <time dateTime={toIsoString(value)} title={formatDateTime(value)}>
      {formatRelativeTime(value)}
    </time>
  );
}

function InactiveBadge({ machine }: { machine: Machine }) {
  return machine.isActive ? null : (
    <Badge size="sm" tone="neutral" variant="outline">
      Deactivated
    </Badge>
  );
}

function MachineTableRow({ machine, schedule }: { machine: Machine; schedule: MaintenanceSchedule | undefined }) {
  const { highlighted, onAnimationEnd } = useHighlight(machine.id);
  return (
    <TableRow className={cn(highlighted && 'animate-row-flash', !machine.isActive && 'text-muted')} onAnimationEnd={onAnimationEnd}>
      <TableCell className="max-w-72">
        <div className="flex items-center gap-2">
          <Link href={ROUTES.machine(machine.id)} className="truncate font-semibold text-ink hover:underline">
            {machine.name}
          </Link>
          <InactiveBadge machine={machine} />
        </div>
        {machine.description ? <p className="mt-0.5 truncate text-xs text-muted">{machine.description}</p> : null}
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap text-ink-secondary">{machine.serialNumber}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <MachineStateBadge state={machine.status} size="sm" />
          <OperationalStatusBadge status={machine.operationalStatus} size="sm" />
        </div>
        <p className="mt-1 text-xs text-muted">{describePartsAttention(machine.parts)}</p>
      </TableCell>
      <TableCell>
        <PartsCell machine={machine} />
      </TableCell>
      <TableCell>
        <MaintenanceCell schedule={schedule} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <RelativeTime value={machine.activity.lastActivityAt} />
        {machine.activity.openLogs > 0 ? (
          <p className="text-xs text-warning-ink">{pluralize(machine.activity.openLogs, 'open log')}</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ink-secondary">
        <RelativeTime value={machine.updatedAt} />
      </TableCell>
      <TableCell className="w-px">
        <MachineRowActions machine={machine} />
      </TableCell>
    </TableRow>
  );
}

export interface MachineTableProps {
  machines: readonly Machine[];
  sortBy: MachineSortField;
  sortOrder: SortOrder;
  onSort(field: MachineSortField): void;
  maintenance?: MaintenanceByMachine;
}

export function MachineTable({ machines, sortBy, sortOrder, onSort, maintenance }: MachineTableProps) {
  const sortProps = (field: MachineSortField) => ({ active: sortBy === field, direction: sortOrder, onSort: () => onSort(field) });
  return (
    <Table>
      <caption className="sr-only">Machines and their current status</caption>
      <TableHead>
        <tr>
          <SortableHeaderCell label="Machine" {...sortProps('name')} />
          <SortableHeaderCell label="Serial number" {...sortProps('serialNumber')} />
          <TableHeaderCell>Machine status</TableHeaderCell>
          <TableHeaderCell>Parts</TableHeaderCell>
          <TableHeaderCell>Maintenance</TableHeaderCell>
          <TableHeaderCell>Last activity</TableHeaderCell>
          <SortableHeaderCell label="Last updated" {...sortProps('updatedAt')} />
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {machines.map((machine) => (
          <MachineTableRow key={machine.id} machine={machine} schedule={maintenance?.get(machine.id)} />
        ))}
      </TableBody>
    </Table>
  );
}

export function MachineCard({ machine, schedule }: { machine: Machine; schedule?: MaintenanceSchedule }) {
  const { highlighted, onAnimationEnd } = useHighlight(machine.id);
  return (
    <article
      className={cn('relative flex min-w-0 flex-col rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong', highlighted && 'animate-row-flash')}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">
            <Link href={ROUTES.machine(machine.id)} className="after:absolute after:inset-0 hover:underline">
              {machine.name}
            </Link>
          </h3>
          <p className="truncate font-mono text-xs text-muted">{machine.serialNumber}</p>
        </div>
        <MachineRowActions machine={machine} className="relative z-10 -mt-1 -mr-2" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MachineStateBadge state={machine.status} />
        <OperationalStatusBadge status={machine.operationalStatus} />
        <InactiveBadge machine={machine} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{describePartsAttention(machine.parts)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-muted">Parts</dt>
          <dd className="mt-0.5 truncate text-ink tabular-nums">
            {machine.parts.total === 0 ? <span className="text-muted">None</span> : machine.parts.total}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Maintenance</dt>
          <dd className="mt-0.5 truncate text-ink">
            {schedule ? (
              <span className="inline-flex items-center gap-1.5">
                <MaintenanceStateBadge state={schedule.state} size="sm" />
                {formatDate(schedule.nextMaintenanceAt)}
              </span>
            ) : (
              <span className="text-muted">Not due soon</span>
            )}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-muted">Last activity</dt>
          <dd className="mt-0.5 truncate text-ink">
            <RelativeTime value={machine.activity.lastActivityAt} fallback="None yet" />
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="sr-only">Last updated</dt>
          <dd className="truncate text-muted">
            Updated <RelativeTime value={machine.updatedAt} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function MachineCardGrid({
  machines,
  dense = false,
  maintenance,
}: {
  machines: readonly Machine[];
  dense?: boolean;
  maintenance?: MaintenanceByMachine;
}) {
  return (
    <ul className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', dense ? 'p-3' : 'p-4', 'xl:grid-cols-3 2xl:grid-cols-4')}>
      {machines.map((machine) => (
        <li key={machine.id} className="min-w-0">
          <MachineCard machine={machine} schedule={maintenance?.get(machine.id)} />
        </li>
      ))}
    </ul>
  );
}
