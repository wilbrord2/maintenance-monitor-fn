'use client';

import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, SearchX } from 'lucide-react';
import Link from 'next/link';
import { FilterField } from '@/components/data/filter-field';
import { RefreshButton } from '@/components/data/refresh-button';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FormError } from '@/components/forms/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  describeDaysUntilDue,
  describeInterval,
  MAINTENANCE_EVENT_STATUS_OPTIONS,
  MAINTENANCE_SCOPE_OPTIONS,
  MAINTENANCE_STATE_CONFIG,
} from '@/constants/maintenance';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useMachineParts } from '@/features/machine-parts/api/queries';
import { useMachines } from '@/features/machines/api/queries';
import { useUrlState } from '@/hooks/use-url-state';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { MAINTENANCE_SCHEDULE_STATES, type MaintenanceSchedule, type MaintenanceScheduleState } from '@/types/maintenance';
import { type MaintenanceBoardState, useMaintenanceBoard, useMaintenanceEvents } from '../api/queries';
import {
  hasBoardFilters,
  hasEventFilters,
  MAINTENANCE_EVENT_SORT_OPTIONS,
  MAINTENANCE_FILTER_PARAMS,
  type MaintenanceViewFilters,
  parseMaintenanceFilters,
  toBoardFilterParams,
  toListEventsParams,
} from '../lib/filters';
import { MaintenanceEventsTable } from './maintenance-events-table';

const BOARD_FOR_STATE: Readonly<Record<MaintenanceScheduleState, MaintenanceBoardState>> = {
  OVERDUE: 'overdue',
  DUE: 'due',
  UPCOMING: 'upcoming',
};

/** Where a task row leads: the part's page for a part task, otherwise the machine's plan. */
function taskHref(schedule: MaintenanceSchedule): string {
  return schedule.machinePartId !== null
    ? ROUTES.machinePart(schedule.machineId, schedule.machinePartId)
    : `${ROUTES.machine(schedule.machineId)}#maintenance`;
}

function TaskCell({ schedule }: { schedule: MaintenanceSchedule }) {
  return (
    <div className="min-w-0">
      <Link href={taskHref(schedule)} className="truncate font-medium text-ink hover:underline">
        {schedule.taskName}
      </Link>
      <p className="truncate text-xs text-muted">
        {schedule.machinePart ? (
          <>
            {schedule.machinePart.name} <span className="font-mono">{schedule.machinePart.partCode}</span>
          </>
        ) : (
          'Machine-wide'
        )}
      </p>
    </div>
  );
}

/** The machine and part filters shared by both tabs; the part list follows the chosen machine. */
function MachinePartFilters({
  filters,
  setParams,
}: {
  filters: MaintenanceViewFilters;
  setParams: ReturnType<typeof useUrlState>['setParams'];
}) {
  const machines = useMachines({ page: 1, limit: MAX_PAGE_SIZE, sortBy: 'name', sortOrder: 'asc' });
  const parts = useMachineParts(filters.machineId ?? 0, { page: 1, limit: MAX_PAGE_SIZE, sortBy: 'name', sortOrder: 'asc' });

  const machineOptions = (machines.data?.items ?? []).map((machine) => ({ value: String(machine.id), label: machine.name }));
  if (filters.machineId && !machineOptions.some((option) => option.value === String(filters.machineId))) {
    machineOptions.unshift({ value: String(filters.machineId), label: `Machine #${filters.machineId}` });
  }
  const partOptions = (parts.data?.items ?? []).map((part) => ({
    value: String(part.id),
    label: `${part.name} · ${part.partCode}${part.isActive ? '' : ' (out of use)'}`,
  }));
  if (filters.machinePartId && !partOptions.some((option) => option.value === String(filters.machinePartId))) {
    partOptions.unshift({ value: String(filters.machinePartId), label: `Part #${filters.machinePartId}` });
  }

  return (
    <>
      <FilterField label="Machine">
        {(id) => (
          <Select
            id={id}
            value={filters.machineId ? String(filters.machineId) : ''}
            options={machineOptions}
            placeholder="All machines"
            onChange={(event) => setParams({ machineId: event.target.value || null, partId: null }, { resetPage: true })}
          />
        )}
      </FilterField>
      <FilterField label="Part">
        {(id) => (
          <Select
            id={id}
            value={filters.machinePartId ? String(filters.machinePartId) : ''}
            options={partOptions}
            placeholder={!filters.machineId ? 'Choose a machine first' : partOptions.length === 0 ? 'No parts' : 'All parts'}
            disabled={!filters.machineId || partOptions.length === 0}
            onChange={(event) =>
              // A part already narrows the listing to part tasks.
              setParams({ partId: event.target.value || null, ...(event.target.value ? { scope: null } : {}) }, { resetPage: true })
            }
          />
        )}
      </FilterField>
    </>
  );
}

function SchedulesTab({
  filters,
  setParams,
  clearFilters,
}: {
  filters: MaintenanceViewFilters;
  setParams: ReturnType<typeof useUrlState>['setParams'];
  clearFilters(): void;
}) {
  const filterParams = toBoardFilterParams(filters);
  const board = useMaintenanceBoard(BOARD_FOR_STATE[filters.state], { ...filterParams, page: filters.page, limit: filters.limit });
  // One-row requests: only the totals are read, for the chip counts.
  const overdue = useMaintenanceBoard('overdue', { ...filterParams, page: 1, limit: 1 });
  const due = useMaintenanceBoard('due', { ...filterParams, page: 1, limit: 1 });
  const upcoming = useMaintenanceBoard('upcoming', { ...filterParams, page: 1, limit: 1 });
  const counts: Record<MaintenanceScheduleState, number | undefined> = {
    OVERDUE: overdue.data?.meta.totalItems,
    DUE: due.data?.meta.totalItems,
    UPCOMING: upcoming.data?.meta.totalItems,
  };

  const stateOptions: ChipOption<MaintenanceScheduleState>[] = MAINTENANCE_SCHEDULE_STATES.map((state) => ({
    value: state,
    label: MAINTENANCE_STATE_CONFIG[state].label,
    swatch: MAINTENANCE_STATE_CONFIG[state].chartColor,
    count: counts[state],
  }));

  const rows = board.data?.items ?? [];
  const filtered = hasBoardFilters(filters);
  const otherState = MAINTENANCE_SCHEDULE_STATES.find((state) => state !== filters.state && (counts[state] ?? 0) > 0);

  const renderRows = () => {
    if (board.isPending) return <TableSkeleton rows={8} columns={7} />;
    if (board.isError && !board.data) {
      return <ErrorState error={board.error} onRetry={() => void board.refetch()} isRetrying={board.isFetching} />;
    }
    if (rows.length === 0) {
      const label = MAINTENANCE_STATE_CONFIG[filters.state].label.toLowerCase();
      return (
        <EmptyState
          icon={filtered ? SearchX : CalendarCheck}
          title={`No ${label} maintenance${filtered ? ' matches your filters' : ''}`}
          description="Active tasks whose maintenance is approaching, due or overdue appear here. The server works out each due date."
          action={
            otherState ? (
              <Button variant="secondary" onClick={() => setParams({ state: otherState }, { resetPage: true })}>
                Show {MAINTENANCE_STATE_CONFIG[otherState].label.toLowerCase()} ({counts[otherState]})
              </Button>
            ) : filtered ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      );
    }
    return (
      <>
        <div className={cn('transition-opacity', board.isPlaceholderData && 'opacity-60')} aria-busy={board.isFetching}>
          <div className="hidden lg:block">
            <Table>
              <caption className="sr-only">{MAINTENANCE_STATE_CONFIG[filters.state].label} maintenance tasks</caption>
              <TableHead>
                <tr>
                  <TableHeaderCell>Machine</TableHeaderCell>
                  <TableHeaderCell>Task / part</TableHeaderCell>
                  <TableHeaderCell>State</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell>Next due</TableHeaderCell>
                  <TableHeaderCell>Frequency</TableHeaderCell>
                  <TableHeaderCell>Last done</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="max-w-56">
                      <Link href={ROUTES.machine(schedule.machineId)} className="truncate font-medium text-ink hover:underline">
                        {schedule.machine?.name ?? `Machine #${schedule.machineId}`}
                      </Link>
                      {schedule.machine ? <p className="truncate font-mono text-xs text-muted">{schedule.machine.serialNumber}</p> : null}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <TaskCell schedule={schedule} />
                    </TableCell>
                    <TableCell>
                      <MaintenanceStateBadge state={schedule.state} size="sm" />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{describeDaysUntilDue(schedule.daysUntilDue)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(schedule.nextMaintenanceAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted">{describeInterval(schedule.intervalDays)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {schedule.lastMaintenanceAt ? formatDate(schedule.lastMaintenanceAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y divide-line-soft lg:hidden">
            {rows.map((schedule) => (
              <li key={schedule.id}>
                <Link href={taskHref(schedule)} className="block px-4 py-3 hover:bg-hover">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-ink">{schedule.taskName}</p>
                    <MaintenanceStateBadge state={schedule.state} size="sm" />
                  </div>
                  <p className="truncate text-xs text-ink-secondary">
                    {schedule.machine?.name ?? `Machine #${schedule.machineId}`}
                    {schedule.machinePart ? ` · ${schedule.machinePart.name}` : ' · machine-wide'}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {describeDaysUntilDue(schedule.daysUntilDue)} · due {formatDate(schedule.nextMaintenanceAt)} ·{' '}
                    {describeInterval(schedule.intervalDays).toLowerCase()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {board.data && board.data.meta.totalItems > 0 ? (
          <Pagination
            meta={board.data.meta}
            itemLabel="tasks"
            onPageChange={(page) => setParams({ page }, { history: 'push' })}
            onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
          />
        ) : null}
      </>
    );
  };

  return (
    <>
      <div className="border-b border-line p-3 sm:p-4">
        <ChipGroup<MaintenanceScheduleState>
          label="Filter by maintenance state"
          options={stateOptions}
          value={filters.state}
          onChange={(value) => setParams({ state: value === 'OVERDUE' ? null : value }, { resetPage: true })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 border-b border-line p-3 sm:grid-cols-3 sm:p-4">
        <MachinePartFilters filters={filters} setParams={setParams} />
        <FilterField label="Task type">
          {(id) => (
            <Select
              id={id}
              value={filters.machinePartId ? 'part' : (filters.scope ?? '')}
              options={MAINTENANCE_SCOPE_OPTIONS}
              placeholder="All tasks"
              disabled={Boolean(filters.machinePartId)}
              onChange={(event) =>
                // Machine-wide tasks have no part, so the part filter is dropped with them.
                setParams({ scope: event.target.value || null, ...(event.target.value === 'machine' ? { partId: null } : {}) }, { resetPage: true })
              }
            />
          )}
        </FilterField>
      </div>
      {filtered ? (
        <div className="flex justify-end border-b border-line px-4 py-2">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}
      {renderRows()}
    </>
  );
}

/**
 * Preventive maintenance across the fleet: which tasks need attention, and the history of what was
 * actually carried out. Maintenance state never changes a machine's operational status.
 */
export function MaintenanceView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseMaintenanceFilters(searchParams);
  const events = useMaintenanceEvents(toListEventsParams(filters), { enabled: filters.tab === 'events' });
  const clearFilters = () => clearParams(MAINTENANCE_FILTER_PARAMS);
  const queryClient = useQueryClient();
  const fetchingCount = useIsFetching({ queryKey: queryKeys.maintenance.all });

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Part inspections and machine-wide tasks, and the work carried out on them."
        actions={
          <RefreshButton
            // The boards, their counts and the history all live under the maintenance key.
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all })}
            refreshing={fetchingCount > 0}
          />
        }
      />

      <Card>
        <Tabs value={filters.tab} onValueChange={(tab) => setParams({ tab: tab === 'schedules' ? null : tab, page: null })}>
          <TabsList>
            <TabsTrigger value="schedules">Tasks</TabsTrigger>
            <TabsTrigger value="events">History</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules">
            <SchedulesTab filters={filters} setParams={setParams} clearFilters={clearFilters} />
          </TabsContent>

          <TabsContent value="events">
            <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:p-4 lg:grid-cols-3 xl:grid-cols-6">
              <MachinePartFilters filters={filters} setParams={setParams} />
              <FilterField label="Status">
                {(id) => (
                  <Select
                    id={id}
                    value={filters.status ?? ''}
                    options={MAINTENANCE_EVENT_STATUS_OPTIONS}
                    placeholder="Any status"
                    onChange={(event) => setParams({ status: event.target.value || null }, { resetPage: true })}
                  />
                )}
              </FilterField>
              <FilterField label="Sort">
                {(id) => (
                  <Select
                    id={id}
                    value={`${filters.sortBy}:${filters.sortOrder}`}
                    options={MAINTENANCE_EVENT_SORT_OPTIONS.map((option) => ({ ...option }))}
                    onChange={(event) => setParams({ sort: event.target.value }, { resetPage: true })}
                  />
                )}
              </FilterField>
              <FilterField label="From">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={filters.from ?? ''}
                    onChange={(event) => setParams({ from: event.target.value || null }, { resetPage: true })}
                  />
                )}
              </FilterField>
              <FilterField label="To">
                {(id) => (
                  <>
                    <Input
                      id={id}
                      type="date"
                      min={filters.from}
                      value={filters.to ?? ''}
                      aria-invalid={filters.invalidRange || undefined}
                      onChange={(event) => setParams({ to: event.target.value || null }, { resetPage: true })}
                    />
                    {filters.invalidRange ? <FormError>The end date is before the start date and is ignored.</FormError> : null}
                  </>
                )}
              </FilterField>
            </div>
            {hasEventFilters(filters) ? (
              <div className="flex justify-end border-b border-line px-4 py-2">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
            <MaintenanceEventsTable
              query={events}
              filtered={hasEventFilters(filters)}
              onClearFilters={clearFilters}
              onPageChange={(page) => setParams({ page }, { history: 'push' })}
              onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
