'use client';

import { Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { MaintenanceEventStatusBadge } from '@/components/status/maintenance-badges';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { MAINTENANCE_EVENT_STATUS_CONFIG } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { isApiError } from '@/lib/api/errors';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { MaintenanceEventStatus } from '@/types/maintenance';
import { useMaintenanceEvent } from '../api/queries';
import {
  CancelMaintenanceDialog,
  CompleteMaintenanceDialog,
  describeEventTarget,
  StartMaintenanceDialog,
} from './maintenance-event-dialogs';

type EventDialog = 'start' | 'complete' | 'cancel' | null;

export function MaintenanceEventDetailView({ eventId }: { eventId: number }) {
  const eventQuery = useMaintenanceEvent(eventId);
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<EventDialog>(null);

  if (eventQuery.isPending) {
    return (
      <LoadingRegion label="Loading maintenance">
        <Skeleton className="mb-2 h-3 w-48" />
        <Skeleton className="mb-6 h-7 w-64" />
        <Skeleton className="h-64" />
      </LoadingRegion>
    );
  }
  if (eventQuery.isError) {
    if (isApiError(eventQuery.error) && eventQuery.error.status === 404) {
      return (
        <Card>
          <NotFoundState
            title="Maintenance not found"
            description="This maintenance doesn't exist or has been removed."
            backHref={ROUTES.maintenance}
            backLabel="Back to maintenance"
          />
        </Card>
      );
    }
    return (
      <Card>
        <ErrorState error={eventQuery.error} onRetry={() => void eventQuery.refetch()} isRetrying={eventQuery.isFetching} />
      </Card>
    );
  }

  const event = eventQuery.data;
  const machineName = event.machine?.name ?? 'Unknown machine';
  const title = event.taskName ?? (event.machinePart ? `One-off — ${event.machinePart.name}` : 'One-off maintenance');
  const config = MAINTENANCE_EVENT_STATUS_CONFIG[event.status];
  const canRun = can(Permission.RUN_MAINTENANCE);
  const isScheduled = event.status === MaintenanceEventStatus.SCHEDULED;
  const isInProgress = event.status === MaintenanceEventStatus.IN_PROGRESS;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Maintenance', href: ROUTES.maintenance }, { label: describeEventTarget(event) }]}
        title={`${title} — ${machineName}`}
        meta={<MaintenanceEventStatusBadge status={event.status} />}
        description={`Scheduled for ${formatDate(event.scheduledFor)}`}
        actions={
          <>
            {canRun && isScheduled ? (
              <Button icon={Play} onClick={() => setDialog('start')}>
                Start maintenance
              </Button>
            ) : null}
            {canRun && isInProgress ? <Button onClick={() => setDialog('complete')}>Complete maintenance</Button> : null}
            {can(Permission.CANCEL_MAINTENANCE) && isScheduled ? (
              <Button variant="danger-ghost" onClick={() => setDialog('cancel')}>
                Cancel
              </Button>
            ) : null}
          </>
        }
      />

      <Alert tone="info" className="mb-4">
        {config.description}. Maintenance state is tracked separately from the machine&apos;s operational status.
      </Alert>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Maintenance details" />
          <CardContent>
            <DetailList
              columns={1}
              items={[
                {
                  label: 'Machine',
                  value: event.machine ? (
                    <Link href={ROUTES.machine(event.machine.id)} className="hover:underline">
                      {event.machine.name} ({event.machine.serialNumber})
                    </Link>
                  ) : (
                    <span className="text-muted">Unknown machine</span>
                  ),
                },
                {
                  label: 'Part',
                  value:
                    event.machinePart && event.machine ? (
                      <Link href={ROUTES.machinePart(event.machine.id, event.machinePart.id)} className="hover:underline">
                        {event.machinePart.name} ({event.machinePart.partCode})
                      </Link>
                    ) : (
                      <span className="text-muted">Whole machine</span>
                    ),
                },
                { label: 'Status', value: <MaintenanceEventStatusBadge status={event.status} size="sm" /> },
                { label: 'Scheduled for', value: formatDate(event.scheduledFor) },
                {
                  label: 'Started',
                  value: event.startedAt ? formatDateTime(event.startedAt) : <span className="text-muted">Not started</span>,
                },
                {
                  label: 'Completed',
                  value: event.completedAt ? (
                    formatDateTime(event.completedAt)
                  ) : (
                    <span className="text-muted">Not completed</span>
                  ),
                },
                {
                  label: 'Performed by',
                  value: event.performedBy?.fullName ?? <span className="text-muted">Not assigned</span>,
                },
                {
                  label: 'Task',
                  value: event.maintenanceScheduleId ? (
                    <span>{event.taskName ?? `Task #${event.maintenanceScheduleId}`}</span>
                  ) : (
                    <span className="text-muted">One-off maintenance, not linked to a task</span>
                  ),
                },
                {
                  label: event.machinePartId !== null ? 'Part log' : 'Machine log',
                  value: event.machineLogId ? (
                    <Link href={ROUTES.log(event.machineLogId)} className="hover:underline">
                      Log #{event.machineLogId}
                    </Link>
                  ) : (
                    <span className="text-muted">No log opened</span>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Notes" />
          <CardContent>
            {event.notes ? (
              <p className="text-[13px] whitespace-pre-wrap text-ink">{event.notes}</p>
            ) : (
              <p className="text-[13px] text-muted">No notes were recorded for this maintenance.</p>
            )}
            {event.machine ? (
              <Link
                href={ROUTES.machine(event.machine.id)}
                className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'mt-4' })}
              >
                Open machine
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <StartMaintenanceDialog open={dialog === 'start'} onOpenChange={() => setDialog(null)} event={event} />
      <CompleteMaintenanceDialog open={dialog === 'complete'} onOpenChange={() => setDialog(null)} event={event} />
      <CancelMaintenanceDialog open={dialog === 'cancel'} onOpenChange={() => setDialog(null)} event={event} />
    </>
  );
}
