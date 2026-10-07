'use client';

import { Ellipsis, Eye, Pencil, Play, Power, PowerOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { MaintenanceEventStatusBadge, MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { describeDaysUntilDue, describeInterval } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { notify } from '@/lib/notify';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDate, toIsoString } from '@/lib/utils/date';
import { type MaintenanceEvent, MaintenanceEventStatus, type MaintenanceSchedule } from '@/types/maintenance';
import { useUpdateMaintenanceSchedule } from '../api/mutations';
import { groupSchedules, sortByDueDate } from '../lib/attention';
import { CompleteMaintenanceDialog, StartMaintenanceDialog, StartTaskMaintenanceDialog } from './maintenance-event-dialogs';
import { ScheduleFormDialog } from './schedule-form-dialog';

type TaskDialog = 'start' | 'complete' | 'edit' | null;

/** Activates or deactivates a task. Deactivated tasks keep their history but stop producing reminders. */
function useToggleTask() {
  const update = useUpdateMaintenanceSchedule();
  const toggle = (schedule: MaintenanceSchedule) =>
    update.mutate(
      { id: schedule.id, body: { isActive: !schedule.isActive } },
      {
        onSuccess: ({ data }) =>
          notify.success(
            data.isActive ? 'Task reactivated' : 'Task deactivated',
            data.isActive
              ? `${data.taskName} is next due on ${formatDate(data.nextMaintenanceAt)}.`
              : `${data.taskName} no longer produces reminders and is left off the dashboards.`,
          ),
        onError: (error) => notify.error(error, `Couldn't update ${schedule.taskName}`),
      },
    );
  return { toggle, isPending: update.isPending, pendingId: update.isPending ? update.variables?.id : undefined };
}

export interface TaskContext {
  machineId: number;
  machineName: string;
  /** Deactivated machines can't start maintenance. */
  machineActive: boolean;
  /** The open event of each task, by task id. */
  openEvents: ReadonlyMap<number, MaintenanceEvent>;
}

function TaskActions({ schedule, context }: { schedule: MaintenanceSchedule; context: TaskContext }) {
  const router = useRouter();
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<TaskDialog>(null);
  const { toggle } = useToggleTask();
  const openEvent = context.openEvents.get(schedule.id);
  const inProgress = openEvent?.status === MaintenanceEventStatus.IN_PROGRESS;
  const canRun = can(Permission.RUN_MAINTENANCE) && schedule.isActive && context.machineActive;
  const canSchedule = can(Permission.MANAGE_MAINTENANCE_SCHEDULE);

  return (
    <div className="flex items-center justify-end gap-1">
      {canRun ? (
        inProgress ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog('complete')} aria-label={`Complete maintenance: ${schedule.taskName}`}>
            Complete
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={Play} onClick={() => setDialog('start')} aria-label={`Start maintenance: ${schedule.taskName}`}>
            Start
          </Button>
        )
      ) : null}

      {canSchedule || openEvent ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${schedule.taskName}`}>
              <Ellipsis className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {openEvent ? (
              <DropdownMenuItem icon={Eye} onSelect={() => router.push(ROUTES.maintenanceEvent(openEvent.id))}>
                {inProgress ? 'View maintenance in progress' : 'View planned maintenance'}
              </DropdownMenuItem>
            ) : null}
            {canSchedule ? (
              <>
                {openEvent ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem icon={Pencil} onSelect={() => setDialog('edit')}>
                  Edit task
                </DropdownMenuItem>
                <DropdownMenuItem icon={schedule.isActive ? PowerOff : Power} onSelect={() => toggle(schedule)}>
                  {schedule.isActive ? 'Deactivate task' : 'Activate task'}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {canRun && !openEvent ? (
        <StartTaskMaintenanceDialog
          open={dialog === 'start'}
          onOpenChange={() => setDialog(null)}
          schedule={schedule}
          machineName={context.machineName}
        />
      ) : null}
      {canRun && openEvent && !inProgress ? (
        <StartMaintenanceDialog open={dialog === 'start'} onOpenChange={() => setDialog(null)} event={openEvent} />
      ) : null}
      {canRun && openEvent && inProgress ? (
        <CompleteMaintenanceDialog open={dialog === 'complete'} onOpenChange={() => setDialog(null)} event={openEvent} />
      ) : null}
      {canSchedule ? (
        <ScheduleFormDialog
          open={dialog === 'edit'}
          onOpenChange={() => setDialog(null)}
          machineId={context.machineId}
          machineName={context.machineName}
          schedule={schedule}
        />
      ) : null}
    </div>
  );
}

/** Administrators switch a task on or off in place; everyone else sees whether it is active. */
function ActiveToggle({ schedule }: { schedule: MaintenanceSchedule }) {
  const { can } = usePermissions();
  const { toggle, pendingId } = useToggleTask();
  if (!can(Permission.MANAGE_MAINTENANCE_SCHEDULE)) {
    return schedule.isActive ? <span className="text-xs text-ink-secondary">Active</span> : <span className="text-xs text-muted">Inactive</span>;
  }
  return (
    <input
      type="checkbox"
      checked={schedule.isActive}
      disabled={pendingId === schedule.id}
      onChange={() => toggle(schedule)}
      aria-label={`${schedule.taskName} active`}
      className="size-4 cursor-pointer rounded-sm accent-brand disabled:cursor-wait"
    />
  );
}

function TaskName({ schedule, openEvent }: { schedule: MaintenanceSchedule; openEvent: MaintenanceEvent | undefined }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-ink">{schedule.taskName}</span>
        {openEvent ? <MaintenanceEventStatusBadge status={openEvent.status} size="sm" /> : null}
        {schedule.isActive ? null : (
          <Badge tone="neutral" variant="outline" size="sm">
            Inactive
          </Badge>
        )}
      </div>
      {schedule.description ? (
        <p className="line-clamp-1 text-xs text-muted" title={schedule.description}>
          {schedule.description}
        </p>
      ) : null}
    </div>
  );
}

function PartName({ schedule }: { schedule: MaintenanceSchedule }) {
  if (!schedule.machinePart) return <span className="text-xs text-muted">Whole machine</span>;
  return (
    <div className="min-w-0">
      <p className="truncate">{schedule.machinePart.name}</p>
      <p className="truncate font-mono text-xs text-muted">{schedule.machinePart.partCode}</p>
    </div>
  );
}

function NextDue({ schedule }: { schedule: MaintenanceSchedule }) {
  return (
    <div className="whitespace-nowrap">
      <time dateTime={toIsoString(schedule.nextMaintenanceAt)}>{formatDate(schedule.nextMaintenanceAt)}</time>
      <p className="text-xs text-muted">{describeDaysUntilDue(schedule.daysUntilDue)}</p>
    </div>
  );
}

function TaskRow({ schedule, context, showPart }: { schedule: MaintenanceSchedule; context: TaskContext; showPart: boolean }) {
  const openEvent = context.openEvents.get(schedule.id);
  return (
    <TableRow className={cn(!schedule.isActive && 'opacity-60')}>
      <TableCell className="max-w-64">
        <TaskName schedule={schedule} openEvent={openEvent} />
      </TableCell>
      {showPart ? (
        <TableCell className="max-w-48">
          <PartName schedule={schedule} />
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap">{describeInterval(schedule.intervalDays)}</TableCell>
      <TableCell className="whitespace-nowrap text-ink-secondary">
        {schedule.lastMaintenanceAt ? formatDate(schedule.lastMaintenanceAt) : <span className="text-muted">Not yet</span>}
      </TableCell>
      <TableCell>
        <NextDue schedule={schedule} />
      </TableCell>
      <TableCell>
        <MaintenanceStateBadge state={schedule.state} size="sm" />
      </TableCell>
      <TableCell>
        <ActiveToggle schedule={schedule} />
      </TableCell>
      <TableCell className="w-px">
        <TaskActions schedule={schedule} context={context} />
      </TableCell>
    </TableRow>
  );
}

function TaskCard({ schedule, context }: { schedule: MaintenanceSchedule; context: TaskContext }) {
  const openEvent = context.openEvents.get(schedule.id);
  return (
    <li className={cn('px-4 py-3', !schedule.isActive && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <TaskName schedule={schedule} openEvent={openEvent} />
        <MaintenanceStateBadge state={schedule.state} size="sm" />
      </div>
      <p className="mt-1 text-xs text-muted">
        {describeInterval(schedule.intervalDays)} · due {formatDate(schedule.nextMaintenanceAt)} (
        {describeDaysUntilDue(schedule.daysUntilDue).toLowerCase()})
        {schedule.lastMaintenanceAt ? ` · last done ${formatDate(schedule.lastMaintenanceAt)}` : ''}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ActiveToggle schedule={schedule} />
        <TaskActions schedule={schedule} context={context} />
      </div>
    </li>
  );
}

export interface MaintenanceTaskListProps {
  schedules: readonly MaintenanceSchedule[];
  context: TaskContext;
  /** Group into machine-wide tasks and one group per part (the machine page). */
  grouped?: boolean;
  /** Show the part column; pointless on a part's own page. */
  showPart?: boolean;
  caption: string;
}

/**
 * A machine's maintenance tasks with their frequency, dates and the state the API derived. Sorted
 * by due date inside each group; nothing here works out a due date or a state.
 */
export function MaintenanceTaskList({ schedules, context, grouped = false, showPart = true, caption }: MaintenanceTaskListProps) {
  const groups = grouped
    ? groupSchedules(schedules)
    : [{ key: 'all', label: '', part: null, schedules: sortByDueDate(schedules) }];
  const columnCount = showPart ? 8 : 7;

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHead>
            <tr>
              <TableHeaderCell>Task</TableHeaderCell>
              {showPart ? <TableHeaderCell>Part</TableHeaderCell> : null}
              <TableHeaderCell>Frequency</TableHeaderCell>
              <TableHeaderCell>Last done</TableHeaderCell>
              <TableHeaderCell>Next due</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
              <TableHeaderCell>Active</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                {grouped ? (
                  <tr className="bg-sunken">
                    <th scope="colgroup" colSpan={columnCount} className="px-4 py-1.5 text-left text-xs font-semibold text-ink-secondary">
                      {group.part ? (
                        <>
                          Part inspections · {group.label}{' '}
                          <span className="font-mono font-normal text-muted">{group.part.partCode}</span>
                        </>
                      ) : (
                        group.label
                      )}
                    </th>
                  </tr>
                ) : null}
                {group.schedules.map((schedule) => (
                  <TaskRow key={schedule.id} schedule={schedule} context={context} showPart={showPart} />
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        {groups.map((group) => (
          <section key={group.key} aria-label={grouped ? group.label : caption}>
            {grouped ? (
              <h3 className="border-y border-line bg-sunken px-4 py-1.5 text-xs font-semibold text-ink-secondary">
                {group.part ? `Part inspections · ${group.label}` : group.label}
              </h3>
            ) : null}
            <ul className="divide-y divide-line-soft">
              {group.schedules.map((schedule) => (
                <TaskCard key={schedule.id} schedule={schedule} context={context} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/** Indexes the open events by the task they carry out; one-off events have no task and are skipped. */
export function indexOpenEvents(events: readonly MaintenanceEvent[]): Map<number, MaintenanceEvent> {
  const index = new Map<number, MaintenanceEvent>();
  for (const event of events) {
    if (event.maintenanceScheduleId !== null && !index.has(event.maintenanceScheduleId)) index.set(event.maintenanceScheduleId, event);
  }
  return index;
}
