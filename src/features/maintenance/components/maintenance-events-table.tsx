'use client';

import { CalendarRange, SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { MaintenanceEventStatusBadge } from '@/components/status/maintenance-badges';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime, toIsoString } from '@/lib/utils/date';
import { type PaginatedResponse } from '@/types/api';
import { type MaintenanceEvent } from '@/types/maintenance';

/** The task carried out (or "One-off") and the part worked on, if any. */
function EventSubject({ event }: { event: MaintenanceEvent }) {
  return (
    <div className="min-w-0">
      <p className={cn('truncate', event.taskName ? 'text-ink' : 'text-muted')}>{event.taskName ?? 'One-off maintenance'}</p>
      <p className="truncate text-xs text-muted">
        {event.machinePart ? (
          <>
            {event.machinePart.name} <span className="font-mono">{event.machinePart.partCode}</span>
          </>
        ) : (
          'Whole machine'
        )}
      </p>
    </div>
  );
}

export interface MaintenanceEventsTableProps {
  query: {
    data: PaginatedResponse<MaintenanceEvent> | undefined;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    error: unknown;
    refetch(): unknown;
  };
  filtered: boolean;
  onClearFilters(): void;
  onPageChange(page: number): void;
  onPageSizeChange(limit: number): void;
}

/** Maintenance history: what was planned, who carried it out and when it was actually completed. */
export function MaintenanceEventsTable({
  query,
  filtered,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
}: MaintenanceEventsTableProps) {
  const items = query.data?.items ?? [];

  if (query.isPending) return <TableSkeleton rows={8} columns={7} />;
  if (query.isError && !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} isRetrying={query.isFetching} />;
  }
  if (items.length === 0) {
    return filtered ? (
      <EmptyState
        icon={SearchX}
        title="No maintenance matches your filters"
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={CalendarRange}
        title="No maintenance records yet"
        description="Completed maintenance activities will appear here."
      />
    );
  }

  return (
    <>
      <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
        <div className="hidden lg:block">
          <Table>
            <caption className="sr-only">Maintenance events</caption>
            <TableHead>
              <tr>
                <TableHeaderCell>Machine</TableHeaderCell>
                <TableHeaderCell>Task / part</TableHeaderCell>
                <TableHeaderCell>Scheduled</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell>Completed</TableHeaderCell>
                <TableHeaderCell>Performed by</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Details</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {items.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="max-w-56">
                    {event.machine ? (
                      <Link href={ROUTES.machine(event.machine.id)} className="truncate font-medium text-ink hover:underline">
                        {event.machine.name}
                      </Link>
                    ) : (
                      <span className="text-muted">Unknown machine</span>
                    )}
                    {event.machine ? (
                      <p className="truncate font-mono text-xs text-muted">{event.machine.serialNumber}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <EventSubject event={event} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={toIsoString(event.scheduledFor)}>{formatDate(event.scheduledFor)}</time>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-secondary">
                    {event.startedAt ? formatDateTime(event.startedAt) : <span className="text-muted">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-secondary">
                    {event.completedAt ? formatDateTime(event.completedAt) : <span className="text-muted">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {event.performedBy?.fullName ?? <span className="text-muted">Not assigned</span>}
                  </TableCell>
                  <TableCell>
                    <MaintenanceEventStatusBadge status={event.status} size="sm" />
                  </TableCell>
                  <TableCell className="w-px">
                    <Link href={ROUTES.maintenanceEvent(event.id)} className="text-xs font-medium text-info-ink hover:underline">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y divide-line-soft lg:hidden">
          {items.map((event) => (
            <li key={event.id}>
              <Link href={ROUTES.maintenanceEvent(event.id)} className="block px-4 py-3 hover:bg-hover">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {event.machine?.name ?? 'Unknown machine'}
                  </p>
                  <MaintenanceEventStatusBadge status={event.status} size="sm" />
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-secondary">
                  {event.taskName ?? 'One-off maintenance'}
                  {event.machinePart && event.machinePart.name !== event.taskName ? ` · ${event.machinePart.name}` : ''}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Scheduled {formatDate(event.scheduledFor)}
                  {event.completedAt ? ` · completed ${formatDateTime(event.completedAt)}` : ''}
                </p>
                {event.performedBy ? <p className="text-xs text-muted">By {event.performedBy.fullName}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {query.data && query.data.meta.totalItems > 0 ? (
        <Pagination
          meta={query.data.meta}
          itemLabel="maintenance records"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </>
  );
}
