'use client';

import { CalendarCheck } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { describeDaysUntilDue, MAINTENANCE_EVENT_STATUS_OPTIONS, MAINTENANCE_STATE_CONFIG } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { useUrlState } from '@/hooks/use-url-state';
import { formatDate } from '@/lib/utils/date';
import { MAINTENANCE_SCHEDULE_STATES, type MaintenanceScheduleState } from '@/types/maintenance';
import { useMaintenanceEvents } from '../api/queries';
import { useMaintenanceAttention } from '../api/use-attention';
import {
  hasEventFilters,
  MAINTENANCE_EVENT_SORT_OPTIONS,
  MAINTENANCE_FILTER_PARAMS,
  parseMaintenanceFilters,
  toListEventsParams,
} from '../lib/filters';
import { MaintenanceEventsTable } from './maintenance-events-table';

const ALL = 'ALL';
type StateChip = MaintenanceScheduleState | typeof ALL;

function SchedulesTab({ state }: { state: MaintenanceScheduleState | undefined }) {
  const attention = useMaintenanceAttention({ limit: 100 });
  const rows = state ? attention.schedules.filter((schedule) => schedule.state === state) : attention.schedules;

  if (attention.isPending) return <TableSkeleton rows={8} columns={5} />;
  if (attention.isError && attention.schedules.length === 0) {
    return <ErrorState error={attention.error} onRetry={attention.refetch} isRetrying={attention.isFetching} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={state ? `No ${MAINTENANCE_STATE_CONFIG[state].label.toLowerCase()} maintenance` : 'No maintenance needs attention'}
        description="Machines whose preventive maintenance is approaching, due or overdue appear here. The server works out each due date."
      />
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <caption className="sr-only">Maintenance schedules needing attention</caption>
          <TableHead>
            <tr>
              <TableHeaderCell>Machine</TableHeaderCell>
              <TableHeaderCell>Maintenance</TableHeaderCell>
              <TableHeaderCell>Due</TableHeaderCell>
              <TableHeaderCell>Next maintenance</TableHeaderCell>
              <TableHeaderCell>Interval</TableHeaderCell>
              <TableHeaderCell>Last maintenance</TableHeaderCell>
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
                <TableCell className="whitespace-nowrap">{formatDate(schedule.nextMaintenanceAt)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted">Every {schedule.intervalDays} days</TableCell>
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
            <Link href={ROUTES.machine(schedule.machineId)} className="block px-4 py-3 hover:bg-hover">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {schedule.machine?.name ?? `Machine #${schedule.machineId}`}
                </p>
                <MaintenanceStateBadge state={schedule.state} size="sm" />
              </div>
              <p className="mt-1 text-xs text-muted">
                {describeDaysUntilDue(schedule.daysUntilDue)} · due {formatDate(schedule.nextMaintenanceAt)} · every{' '}
                {schedule.intervalDays} days
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Preventive maintenance across the fleet: which machines need attention, and the history of what
 * was actually carried out. Maintenance state never changes a machine's operational status.
 */
export function MaintenanceView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseMaintenanceFilters(searchParams);
  const attention = useMaintenanceAttention({ limit: 100 });
  const events = useMaintenanceEvents(toListEventsParams(filters), { enabled: filters.tab === 'events' });

  const stateOptions: ChipOption<StateChip>[] = [
    {
      value: ALL,
      label: 'All',
      count: attention.counts.overdue + attention.counts.due + attention.counts.upcoming,
    },
    ...MAINTENANCE_SCHEDULE_STATES.map((state) => ({
      value: state,
      label: MAINTENANCE_STATE_CONFIG[state].label,
      swatch: MAINTENANCE_STATE_CONFIG[state].chartColor,
      count:
        state === 'OVERDUE'
          ? attention.counts.overdue
          : state === 'DUE'
            ? attention.counts.due
            : attention.counts.upcoming,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Recurring preventive maintenance and the work carried out on it."
        actions={
          <RefreshButton
            onRefresh={() => {
              attention.refetch();
              void events.refetch();
            }}
            refreshing={attention.isFetching || events.isFetching}
          />
        }
      />

      <Card>
        <Tabs value={filters.tab} onValueChange={(tab) => setParams({ tab: tab === 'schedules' ? null : tab, page: null })}>
          <TabsList>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="events">History</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules">
            <div className="border-b border-line p-3 sm:p-4">
              <ChipGroup<StateChip>
                label="Filter by maintenance state"
                options={stateOptions}
                value={filters.state ?? ALL}
                onChange={(value) => setParams({ state: value === ALL ? null : value })}
              />
            </div>
            <SchedulesTab state={filters.state} />
          </TabsContent>

          <TabsContent value="events">
            <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:p-4 lg:grid-cols-4">
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
                    {filters.invalidRange ? (
                      <FormError>The end date is before the start date and is ignored.</FormError>
                    ) : null}
                  </>
                )}
              </FilterField>
            </div>
            {hasEventFilters(filters) ? (
              <div className="flex justify-end border-b border-line px-4 py-2">
                <Button variant="ghost" size="sm" onClick={() => clearParams(MAINTENANCE_FILTER_PARAMS)}>
                  Clear filters
                </Button>
              </div>
            ) : null}
            <MaintenanceEventsTable
              query={events}
              filtered={hasEventFilters(filters)}
              onClearFilters={() => clearParams(MAINTENANCE_FILTER_PARAMS)}
              onPageChange={(page) => setParams({ page }, { history: 'push' })}
              onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
