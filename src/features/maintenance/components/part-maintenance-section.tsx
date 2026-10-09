'use client';

import { CalendarClock, ListPlus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { type MachinePart } from '@/types/machine-part';
import { useMachineSchedules, useMaintenanceEvents, useOpenMaintenanceEvents } from '../api/queries';
import { MaintenanceEventsTable } from './maintenance-events-table';
import { indexOpenEvents, MaintenanceTaskList } from './maintenance-task-list';
import { ScheduleFormDialog } from './schedule-form-dialog';

export interface PartMaintenanceSectionProps {
  part: MachinePart;
  machineName: string;
  machineActive: boolean;
}

/** The part's own maintenance tasks, loaded by part from the machine's task list. */
function PartTasks({ part, machineName, machineActive }: PartMaintenanceSectionProps) {
  const { can } = usePermissions();
  const canSchedule = can(Permission.MANAGE_MAINTENANCE_SCHEDULE);
  const [addOpen, setAddOpen] = useState(false);
  const schedules = useMachineSchedules(part.machineId, { machinePartId: part.id });
  const open = useOpenMaintenanceEvents({ machinePartId: part.id });
  const canAdd = canSchedule && part.isActive && machineActive;

  const renderContent = () => {
    if (schedules.isPending) return <TableSkeleton rows={3} columns={6} />;
    if (schedules.isError) {
      return <ErrorState compact error={schedules.error} onRetry={() => void schedules.refetch()} isRetrying={schedules.isFetching} />;
    }
    if (schedules.data.length === 0) {
      return (
        <EmptyState
          compact
          icon={CalendarClock}
          title="No maintenance tasks for this part"
          description={
            canSchedule ? 'Add an inspection to get reminders before it is due.' : 'An administrator can add inspections for this part.'
          }
        />
      );
    }
    return (
      <MaintenanceTaskList
        schedules={schedules.data}
        showPart={false}
        caption={`Maintenance tasks of ${part.name}`}
        context={{ machineId: part.machineId, machineName, machineActive, openEvents: indexOpenEvents(open.events) }}
      />
    );
  };

  return (
    <Card>
      <CardHeader
        title="Maintenance tasks"
        description={part.isActive ? undefined : 'Tasks of a part that is out of use are deactivated.'}
        actions={
          canAdd ? (
            <Button size="sm" icon={ListPlus} onClick={() => setAddOpen(true)}>
              Add task
            </Button>
          ) : null
        }
      />
      {renderContent()}
      {canAdd ? (
        <ScheduleFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          machineId={part.machineId}
          machineName={machineName}
          defaultPartId={part.id}
        />
      ) : null}
    </Card>
  );
}

/** Every maintenance carried out on the part, planned or one-off, newest first. */
function PartMaintenanceHistory({ part }: { part: MachinePart }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const events = useMaintenanceEvents({ machinePartId: part.id, page, limit, sortBy: 'scheduledFor', sortOrder: 'desc' });

  return (
    <Card>
      <CardHeader title="Maintenance history" description="Planned and one-off maintenance of this part." />
      <MaintenanceEventsTable
        query={events}
        filtered={false}
        onClearFilters={() => undefined}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
      />
    </Card>
  );
}

/** A part's preventive maintenance: its inspection tasks and the work done on it. */
export function PartMaintenanceSection(props: PartMaintenanceSectionProps) {
  const { can } = usePermissions();
  if (!can(Permission.VIEW_MAINTENANCE)) return null;
  return (
    <div className="flex flex-col gap-4">
      <PartTasks {...props} />
      <PartMaintenanceHistory part={props.part} />
    </div>
  );
}
