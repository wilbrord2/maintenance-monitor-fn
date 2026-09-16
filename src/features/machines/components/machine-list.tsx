'use client';

import Link from 'next/link';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
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
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelativeTime, toIsoString } from '@/lib/utils/date';
import { pluralize } from '@/lib/utils/format';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type SortOrder } from '@/types/api';
import { type Machine, type MachineSortField } from '@/types/machine';
import { MachineRowActions } from './machine-row-actions';

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

function MachineTableRow({ machine }: { machine: Machine }) {
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
        <MachineStateBadge state={machine.status} size="sm" />
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
}

export function MachineTable({ machines, sortBy, sortOrder, onSort }: MachineTableProps) {
  const sortProps = (field: MachineSortField) => ({ active: sortBy === field, direction: sortOrder, onSort: () => onSort(field) });
  return (
    <Table>
      <caption className="sr-only">Machines and their current status</caption>
      <TableHead>
        <tr>
          <SortableHeaderCell label="Machine" {...sortProps('name')} />
          <SortableHeaderCell label="Serial number" {...sortProps('serialNumber')} />
          <SortableHeaderCell label="Status" {...sortProps('status')} />
          <TableHeaderCell>Last activity</TableHeaderCell>
          <SortableHeaderCell label="Last updated" {...sortProps('updatedAt')} />
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {machines.map((machine) => (
          <MachineTableRow key={machine.id} machine={machine} />
        ))}
      </TableBody>
    </Table>
  );
}

export function MachineCard({ machine }: { machine: Machine }) {
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
        <InactiveBadge machine={machine} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-muted">Last activity</dt>
          <dd className="mt-0.5 truncate text-ink">
            <RelativeTime value={machine.activity.lastActivityAt} fallback="None yet" />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Open logs</dt>
          <dd className={cn('mt-0.5 tabular-nums', machine.activity.openLogs > 0 ? 'text-warning-ink' : 'text-ink')}>
            {machine.activity.openLogs}
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

export function MachineCardGrid({ machines, dense = false }: { machines: readonly Machine[]; dense?: boolean }) {
  return (
    <ul className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', dense ? 'p-3' : 'p-4', 'xl:grid-cols-3 2xl:grid-cols-4')}>
      {machines.map((machine) => (
        <li key={machine.id} className="min-w-0">
          <MachineCard machine={machine} />
        </li>
      ))}
    </ul>
  );
}
