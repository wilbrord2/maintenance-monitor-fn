'use client';

import { CalendarClock, CalendarPlus, ListPlus, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { MaintenanceEventStatusBadge } from '@/components/status/maintenance-badges';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { describeMaintenanceSubject, MAINTENANCE_STATE_CONFIG } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { type MachineDetail } from '@/types/machine';
import { type MaintenanceEvent, MaintenanceEventStatus, MAINTENANCE_SCHEDULE_STATES, type MaintenanceScheduleState } from '@/types/maintenance';
import { useOpenMaintenanceEvents } from '../api/queries';
import { summarizeSchedules } from '../lib/attention';
import { CancelMaintenanceDialog, CompleteMaintenanceDialog, PlanMaintenanceDialog, StartMaintenanceDialog } from './maintenance-event-dialogs';
import { indexOpenEvents, MaintenanceTaskList } from './maintenance-task-list';
import { ScheduleFormDialog } from './schedule-form-dialog';

const ALL = 'ALL';
type StateChip = MaintenanceScheduleState | typeof ALL;
type Visibility = 'active' | 'all';
type EventDialog = 'start' | 'complete' | 'cancel' | null;

/** One planned or running maintenance, with the next step for it. */
function OpenEventRow({ event }: { event: MaintenanceEvent }) {
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<EventDialog>(null);
  const inProgress = event.status === MaintenanceEventStatus.IN_PROGRESS;
  const canRun = can(Permission.RUN_MAINTENANCE);
  const subject =
    event.taskName || event.machinePart
      ? describeMaintenanceSubject({ taskName: event.taskName, partName: event.machinePart?.name ?? null })
      : 'Whole machine';

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">
          {subject}
          {event.maintenanceScheduleId === null ? <span className="font-normal text-muted"> · one-off</span> : null}
        </p>
        <p className="text-xs text-muted">
          {inProgress && event.startedAt ? `Started ${formatDateTime(event.startedAt)}` : `Scheduled for ${formatDate(event.scheduledFor)}`}
          {event.performedBy ? ` · ${event.performedBy.fullName}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MaintenanceEventStatusBadge status={event.status} size="sm" />
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
          View
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
    </li>
  );
}

function OpenMaintenance({ events }: { events: readonly MaintenanceEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="border-b border-line">
      <h3 className="bg-sunken px-4 py-1.5 text-xs font-semibold text-ink-secondary">
        {events.some((event) => event.status === MaintenanceEventStatus.IN_PROGRESS) ? 'Maintenance under way' : 'Maintenance planned'}
      </h3>
      <ul className="divide-y divide-line-soft">
        {events.map((event) => (
          <OpenEventRow key={event.id} event={event} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The machine's preventive maintenance plan: machine-wide tasks and part inspections, each on its
 * own frequency, with the state the API derived for each. Maintenance state is shown apart from the
 * machine's status: a machine with overdue maintenance can still be operating.
 */
export function MaintenancePlanSection({ machine }: { machine: MachineDetail }) {
  const { can } = usePermissions();
  const canSchedule = can(Permission.MANAGE_MAINTENANCE_SCHEDULE);
  const canRun = can(Permission.RUN_MAINTENANCE);
  const [stateFilter, setStateFilter] = useState<StateChip>(ALL);
  const [visibility, setVisibility] = useState<Visibility>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const open = useOpenMaintenanceEvents({ machineId: machine.id }, { enabled: can(Permission.VIEW_MAINTENANCE) });
  const schedules = machine.maintenanceSchedules;
  const summary = summarizeSchedules(schedules);

  const shown = schedules.filter(
    (schedule) =>
      (visibility === 'all' || schedule.isActive) && (stateFilter === ALL || (schedule.isActive && schedule.state === stateFilter)),
  );

  const stateOptions: ChipOption<StateChip>[] = [
    { value: ALL, label: 'All', count: visibility === 'all' ? schedules.length : summary.active },
    ...MAINTENANCE_SCHEDULE_STATES.map((state) => ({
      value: state,
      label: MAINTENANCE_STATE_CONFIG[state].label,
      swatch: MAINTENANCE_STATE_CONFIG[state].chartColor,
      count: state === 'OVERDUE' ? summary.overdue : state === 'DUE' ? summary.due : summary.upcoming,
    })),
  ];

  const description =
    summary.active === 0
      ? undefined
      : [
          `${summary.active} active ${summary.active === 1 ? 'task' : 'tasks'}`,
          summary.overdue > 0 ? `${summary.overdue} overdue` : null,
          summary.due > 0 ? `${summary.due} due today` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  const addButton = canSchedule ? (
    <Button size="sm" icon={ListPlus} onClick={() => setAddOpen(true)} disabled={!machine.isActive} title={machine.isActive ? undefined : 'Deactivated machines can’t get new tasks'}>
      Add task
    </Button>
  ) : null;

  return (
    <Card id="maintenance" className="scroll-mt-20">
      <CardHeader
        title="Maintenance plan"
        description={description}
        actions={
          <>
            {canRun && machine.isActive ? (
              <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => setPlanOpen(true)}>
                Plan one-off
              </Button>
            ) : null}
            {addButton}
          </>
        }
      />

      <OpenMaintenance events={open.events} />

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No maintenance tasks"
          description={
            canSchedule
              ? 'Add part inspections and machine-wide tasks such as cleaning to get reminders before each one is due.'
              : 'An administrator can add part inspections and machine-wide tasks for this machine.'
          }
          action={canSchedule ? addButton : null}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <ChipGroup<StateChip> label="Filter tasks by maintenance state" options={stateOptions} value={stateFilter} onChange={setStateFilter} />
            {summary.inactive > 0 ? (
              <SegmentedControl<Visibility>
                label="Which tasks to show"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'all', label: `All (${summary.inactive} inactive)` },
                ]}
              />
            ) : null}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              compact
              title={stateFilter === ALL ? 'No active tasks' : `No ${MAINTENANCE_STATE_CONFIG[stateFilter].label.toLowerCase()} tasks`}
              description={summary.inactive > 0 ? 'Inactive tasks are hidden. Choose “All” to see them.' : 'Choose another state to see more tasks.'}
            />
          ) : (
            <MaintenanceTaskList
              schedules={shown}
              grouped
              caption={`Maintenance tasks of ${machine.name}`}
              context={{
                machineId: machine.id,
                machineName: machine.name,
                machineActive: machine.isActive,
                openEvents: indexOpenEvents(open.events),
              }}
            />
          )}
        </>
      )}

      {canSchedule ? (
        <ScheduleFormDialog open={addOpen} onOpenChange={setAddOpen} machineId={machine.id} machineName={machine.name} />
      ) : null}
      {canRun ? (
        <PlanMaintenanceDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          machineId={machine.id}
          machineName={machine.name}
          parts={machine.partDetails}
        />
      ) : null}
    </Card>
  );
}
