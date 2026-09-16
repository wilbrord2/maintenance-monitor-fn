'use client';

import Link from 'next/link';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { StateTransition } from '@/components/status/state-transition';
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
import { formatDate, formatDateTime, formatTime, toIsoString } from '@/lib/utils/date';
import { formatHours } from '@/lib/utils/format';
import { type SortOrder } from '@/types/api';
import { type MachineLog, type MachineLogSortField } from '@/types/machine-log';
import { LogRowActions } from './log-row-actions';

const empty = <span className="text-muted">—</span>;

export interface LogTableProps {
  logs: readonly MachineLog[];
  sortBy: MachineLogSortField;
  sortOrder: SortOrder;
  onSort(field: MachineLogSortField): void;
}

/** Full operational table (wide by nature, so it scrolls horizontally inside its container if needed). */
export function LogTable({ logs, sortBy, sortOrder, onSort }: LogTableProps) {
  const sortProps = (field: MachineLogSortField) => ({ active: sortBy === field, direction: sortOrder, onSort: () => onSort(field) });
  return (
    <Table className="min-w-[1120px]">
      <caption className="sr-only">Machine logs</caption>
      <TableHead>
        <tr>
          <TableHeaderCell>Machine</TableHeaderCell>
          <TableHeaderCell>Technician</TableHeaderCell>
          <TableHeaderCell>Fault</TableHeaderCell>
          <TableHeaderCell>Entry state</TableHeaderCell>
          <TableHeaderCell>Action taken</TableHeaderCell>
          <TableHeaderCell>Resulting state</TableHeaderCell>
          <SortableHeaderCell label="Downtime" {...sortProps('downtimeHours')} className="text-right" />
          <TableHeaderCell>Log status</TableHeaderCell>
          <SortableHeaderCell label="Date" {...sortProps('startedAt')} />
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id} className="align-top">
            <TableCell className="max-w-44 align-top">
              <Link href={ROUTES.log(log.id)} className="block truncate font-semibold text-ink hover:underline">
                {log.machine.name}
              </Link>
              <p className="truncate font-mono text-[11px] text-muted">{log.machine.serialNumber}</p>
            </TableCell>
            <TableCell className="max-w-36 truncate align-top text-ink-secondary">{log.technician.fullName}</TableCell>
            <TableCell className="max-w-56 align-top">
              <p className="line-clamp-2">{log.faultDescription}</p>
            </TableCell>
            <TableCell className="align-top">
              <MachineStateBadge state={log.entryStatus} size="sm" />
            </TableCell>
            <TableCell className="max-w-52 align-top text-ink-secondary">
              {log.remedyAction ? <p className="line-clamp-2">{log.remedyAction}</p> : empty}
            </TableCell>
            <TableCell className="align-top">
              <MachineStateBadge state={log.resultingState} size="sm" />
            </TableCell>
            <TableCell className="text-right align-top whitespace-nowrap tabular-nums">
              {log.downtimeHours > 0 ? formatHours(log.downtimeHours) : empty}
            </TableCell>
            <TableCell className="align-top">
              <LogStatusBadge status={log.logStatus} size="sm" />
            </TableCell>
            <TableCell className="align-top whitespace-nowrap">
              <time dateTime={toIsoString(log.startedAt)} title={`Started ${formatDateTime(log.startedAt)}`}>
                {formatDate(log.startedAt)}
              </time>
              <p className="text-xs text-muted tabular-nums">{formatTime(log.startedAt)}</p>
            </TableCell>
            <TableCell className="w-px align-top">
              <LogRowActions log={log} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LogCard({ log }: { log: MachineLog }) {
  return (
    <article className="relative flex min-w-0 flex-col rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">
            <Link href={ROUTES.log(log.id)} className="after:absolute after:inset-0 hover:underline">
              {log.machine.name}
            </Link>
          </h3>
          <p className="truncate font-mono text-[11px] text-muted">
            {log.machine.serialNumber} · #{log.id}
          </p>
        </div>
        <div className="relative z-10 -mt-1 -mr-2 flex items-center gap-1">
          <LogStatusBadge status={log.logStatus} size="sm" />
          <LogRowActions log={log} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] text-ink">{log.faultDescription}</p>
      {log.remedyAction ? <p className="mt-1 line-clamp-1 text-xs text-ink-secondary">{log.remedyAction}</p> : null}
      <div className="mt-3">
        <StateTransition from={log.entryStatus} to={log.resultingState} />
      </div>
      <p className="mt-3 border-t border-line-soft pt-2.5 text-xs text-muted">
        {log.technician.fullName} · {formatDateTime(log.startedAt)}
        {log.downtimeHours > 0 ? ` · ${formatHours(log.downtimeHours)} downtime` : ''}
      </p>
    </article>
  );
}

export function LogCardList({ logs }: { logs: readonly MachineLog[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
      {logs.map((log) => (
        <li key={log.id} className="min-w-0">
          <LogCard log={log} />
        </li>
      ))}
    </ul>
  );
}
