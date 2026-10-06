'use client';

import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { describeDaysUntilDue } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/lib/utils/date';
import { useMaintenanceAttention } from '../api/use-attention';

export interface MaintenanceAttentionProps {
  /** How many rows to show before linking to the full list. */
  limit?: number;
}

/**
 * Machines whose preventive maintenance is overdue, due today or approaching. The API decides
 * which schedules appear here; this list never works out a due date for itself.
 */
export function MaintenanceAttention({ limit = 6 }: MaintenanceAttentionProps) {
  const attention = useMaintenanceAttention({ limit: 50 });
  const rows = attention.schedules.slice(0, limit);
  const total = attention.counts.overdue + attention.counts.due + attention.counts.upcoming;

  const renderContent = () => {
    if (attention.isPending) return <ListSkeleton rows={4} />;
    if (attention.isError && rows.length === 0) {
      return <ErrorState compact error={attention.error} onRetry={attention.refetch} isRetrying={attention.isFetching} />;
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={CalendarCheck}
          title="No maintenance needs attention"
          description="Machines with maintenance approaching, due or overdue will appear here."
        />
      );
    }
    return (
      <Table>
        <caption className="sr-only">Machines whose preventive maintenance needs attention</caption>
        <TableHead>
          <tr>
            <TableHeaderCell>Machine</TableHeaderCell>
            <TableHeaderCell>Maintenance</TableHeaderCell>
            <TableHeaderCell>Due</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Date</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell className="max-w-56">
                <Link href={ROUTES.machine(schedule.machineId)} className="truncate font-medium text-ink hover:underline">
                  {schedule.machine?.name ?? `Machine #${schedule.machineId}`}
                </Link>
                {schedule.machine ? (
                  <p className="truncate font-mono text-xs text-muted">{schedule.machine.serialNumber}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <MaintenanceStateBadge state={schedule.state} size="sm" />
              </TableCell>
              <TableCell className="whitespace-nowrap">{describeDaysUntilDue(schedule.daysUntilDue)}</TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted sm:table-cell">
                {formatDate(schedule.nextMaintenanceAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Maintenance attention"
        description="Preventive maintenance that is approaching, due or overdue"
        actions={
          <Link href={ROUTES.maintenance} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            View all
          </Link>
        }
      />
      {renderContent()}
      {total > rows.length ? (
        <CardFooter>
          <span>
            Showing {rows.length} of {total}
          </span>
          <Link href={ROUTES.maintenance} className="font-medium text-info-ink hover:underline">
            Open maintenance
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
