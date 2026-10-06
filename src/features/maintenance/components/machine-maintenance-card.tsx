'use client';

import { CalendarClock, CalendarPlus, Pencil, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { EmptyState } from '@/components/feedback/empty-state';
import { MaintenanceEventStatusBadge, MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { describeDaysUntilDue, MAINTENANCE_EVENT_STATUS_CONFIG } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { type MachineDetail } from '@/types/machine';
import { type MaintenanceEvent, MaintenanceEventStatus } from '@/types/maintenance';
import { useMaintenanceEvents } from '../api/queries';
import {
  CancelMaintenanceDialog,
  CompleteMaintenanceDialog,
  PlanMaintenanceDialog,
  StartMaintenanceDialog,
} from './maintenance-event-dialogs';
import { ScheduleFormDialog } from './schedule-form-dialog';

type EventDialog = 'start' | 'complete' | 'cancel' | null;

/** The maintenance that is still open for this machine, if any. */
function findOpenEvent(events: readonly MaintenanceEvent[]): MaintenanceEvent | null {
  return (
    events.find(
      (event) =>
        event.status === MaintenanceEventStatus.IN_PROGRESS || event.status === MaintenanceEventStatus.SCHEDULED,
    ) ?? null
  );
}

function OpenEvent({ event }: { event: MaintenanceEvent }) {
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<EventDialog>(null);
  const inProgress = event.status === MaintenanceEventStatus.IN_PROGRESS;
  const canRun = can(Permission.RUN_MAINTENANCE);

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {inProgress ? 'Maintenance in progress' : 'Maintenance planned'}
          </p>
          <p className="mt-0.5 text-[13px] text-ink">
            {inProgress && event.startedAt
              ? `Started ${formatDateTime(event.startedAt)}`
              : `Scheduled for ${formatDate(event.scheduledFor)}`}
          </p>
        </div>
        <MaintenanceEventStatusBadge status={event.status} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canRun ? (
          inProgress ? (
            <Button size="sm" onClick={() => setDialog('complete')}>
              Complete maintenance
            </Button>
          ) : (
            <Button size="sm" icon={Play} onClick={() => setDialog('start')}>
              Start maintenance
            </Button>
          )
        ) : null}
        <Link href={ROUTES.maintenanceEvent(event.id)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          View maintenance
        </Link>
        {can(Permission.CANCEL_MAINTENANCE) && !inProgress ? (
          <Button variant="danger-ghost" size="sm" onClick={() => setDialog('cancel')}>
            Cancel
          </Button>
        ) : null}
      </div>

      <StartMaintenanceDialog open={dialog === 'start'} onOpenChange={() => setDialog(null)} event={event} />
      <CompleteMaintenanceDialog open={dialog === 'complete'} onOpenChange={() => setDialog(null)} event={event} />
      <CancelMaintenanceDialog open={dialog === 'cancel'} onOpenChange={() => setDialog(null)} event={event} />
    </div>
  );
}

/**
 * The machine's recurring maintenance plan, as the API calculated it. Maintenance state
 * (upcoming, due, overdue) is deliberately shown apart from the machine's operational status:
 * a machine with overdue maintenance can still be operating.
 */
export function MachineMaintenanceCard({ machine }: { machine: MachineDetail }) {
  const { can } = usePermissions();
  const schedule = machine.maintenance;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const canSchedule = can(Permission.MANAGE_MAINTENANCE_SCHEDULE);
  const canRun = can(Permission.RUN_MAINTENANCE);

  const events = useMaintenanceEvents(
    { machineId: machine.id, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
    { enabled: can(Permission.VIEW_MAINTENANCE) },
  );
  const openEvent = findOpenEvent(events.data?.items ?? []);
  const lastCompleted = (events.data?.items ?? []).find(
    (event) => event.status === MaintenanceEventStatus.COMPLETED,
  );

  if (!schedule) {
    return (
      <Card>
        <CardHeader title="Preventive maintenance" />
        <EmptyState
          icon={CalendarClock}
          title="No preventive maintenance schedule"
          description={
            canSchedule
              ? 'Configure recurring maintenance for this machine to get reminders before each service is due.'
              : 'An administrator can configure recurring maintenance for this machine.'
          }
          action={
            canSchedule ? (
              <Button icon={CalendarPlus} onClick={() => setScheduleOpen(true)}>
                Set up schedule
              </Button>
            ) : null
          }
        />
        {canSchedule ? (
          <ScheduleFormDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            machineId={machine.id}
            machineName={machine.name}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Preventive maintenance"
        actions={
          canSchedule ? (
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setScheduleOpen(true)}>
              Edit
            </Button>
          ) : null
        }
      />
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <MaintenanceStateBadge state={schedule.state} />
          <span className="text-[13px] text-ink-secondary">{describeDaysUntilDue(schedule.daysUntilDue)}</span>
          {schedule.isActive ? null : <span className="text-xs text-muted">· schedule paused</span>}
        </div>
        <DetailList
          columns={1}
          items={[
            { label: 'Interval', value: `Every ${schedule.intervalDays} days` },
            { label: 'Next maintenance', value: formatDate(schedule.nextMaintenanceAt) },
            {
              label: 'Last maintenance',
              value: schedule.lastMaintenanceAt ? (
                formatDate(schedule.lastMaintenanceAt)
              ) : (
                <span className="text-muted">Not recorded yet</span>
              ),
            },
            { label: 'Reminder', value: `${schedule.reminderDaysBefore} days before` },
            { label: 'Schedule', value: schedule.isActive ? 'Active' : 'Paused' },
            ...(lastCompleted?.completedAt
              ? [
                  {
                    label: 'Last completed',
                    value: `${formatDateTime(lastCompleted.completedAt)} (${MAINTENANCE_EVENT_STATUS_CONFIG[lastCompleted.status].label.toLowerCase()})`,
                  },
                ]
              : []),
          ]}
        />
        {events.isPending ? <Skeleton className="h-8 w-full" /> : null}
        {!openEvent && canRun && !events.isPending ? (
          <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => setPlanOpen(true)}>
            Plan maintenance
          </Button>
        ) : null}
      </CardContent>

      {openEvent ? <OpenEvent event={openEvent} /> : null}

      {canSchedule ? (
        <ScheduleFormDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          machineId={machine.id}
          machineName={machine.name}
          schedule={schedule}
        />
      ) : null}
      {canRun ? (
        <PlanMaintenanceDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          machineId={machine.id}
          machineName={machine.name}
          schedule={schedule}
        />
      ) : null}
    </Card>
  );
}
