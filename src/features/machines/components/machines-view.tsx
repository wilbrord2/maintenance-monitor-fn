'use client';

import { Factory, LayoutGrid, Plus, Rows3, SearchX } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { RefreshButton } from '@/components/data/refresh-button';
import { PageHeader } from '@/components/layout/page-header';
import { LiveIndicator } from '@/components/status/live-indicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { useAnalyticsOverview } from '@/features/analytics/api/queries';
import { getStateCounts } from '@/features/dashboard/components/status-distribution';
import { useUrlState } from '@/hooks/use-url-state';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { serializeSort } from '@/lib/utils/url-params';
import { type MachineViewMode, useUiStore } from '@/stores/ui-store';
import { MACHINE_STATES, type MachineSortField, type MachineState } from '@/types/machine';
import { useMachines } from '../api/queries';
import {
  hasMachineFilters,
  MACHINE_SORT_DEFAULT_ORDER,
  MACHINE_SORT_OPTIONS,
  parseMachineFilters,
  toListMachinesParams,
} from '../lib/filters';
import { MachineCardGrid, MachineTable } from './machine-list';
import { MachineFormDialog } from './machine-form-dialog';

const ALL = 'ALL';
type StatusChip = MachineState | typeof ALL;

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table view', icon: Rows3, iconOnly: true },
  { value: 'grid', label: 'Card view', icon: LayoutGrid, iconOnly: true },
] as const;

export function MachinesView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseMachineFilters(searchParams);
  const { can } = usePermissions();
  const canManage = can(Permission.MANAGE_MACHINES);

  const machines = useMachines(toListMachinesParams(filters));
  const overview = useAnalyticsOverview({ days: 30 });
  const viewMode = useUiStore((state) => state.machineViewMode);
  const setViewMode = useUiStore((state) => state.setMachineViewMode);

  const [createOpen, setCreateOpen] = useState(false);
  const createRequested = canManage && searchParams.get('create') === '1';
  const isCreateOpen = createOpen || createRequested;

  // Counts describe the whole active fleet, so they are shown only when they match the list.
  const showCounts = !filters.search && filters.active !== 'false' && overview.data !== undefined;
  const counts = overview.data ? getStateCounts(overview.data.machines) : [];
  const statusOptions: ChipOption<StatusChip>[] = [
    { value: ALL, label: 'All', count: showCounts ? counts.reduce((sum, row) => sum + row.count, 0) : undefined },
    ...MACHINE_STATES.map((state) => ({
      value: state,
      label: MACHINE_STATE_CONFIG[state].label,
      swatch: MACHINE_STATE_CONFIG[state].chartColor,
      count: showCounts ? counts.find((row) => row.state === state)?.count : undefined,
    })),
  ];

  const handleSort = (field: MachineSortField) => {
    const sortOrder =
      filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : MACHINE_SORT_DEFAULT_ORDER[field];
    setParams({ sort: serializeSort({ sortBy: field, sortOrder }) }, { resetPage: true });
  };

  const items = machines.data?.items ?? [];
  const filtered = hasMachineFilters(filters);

  const renderContent = () => {
    if (machines.isPending) return <TableSkeleton rows={8} columns={5} />;
    if (machines.isError && !machines.data) {
      return <ErrorState error={machines.error} onRetry={() => void machines.refetch()} isRetrying={machines.isFetching} />;
    }
    if (items.length === 0) {
      return filtered ? (
        <EmptyState
          icon={SearchX}
          title="No machines match your filters"
          description="Try a different search term or status."
          action={
            <Button variant="secondary" onClick={() => clearParams(['search', 'status', 'active', 'page'])}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Factory}
          title="No machines yet"
          description={canManage ? 'Add the first machine to start monitoring the fleet.' : 'An administrator needs to add machines before they appear here.'}
          action={
            canManage ? (
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Add machine
              </Button>
            ) : null
          }
        />
      );
    }
    return (
      <div className={cn('transition-opacity', machines.isPlaceholderData && 'opacity-60')} aria-busy={machines.isFetching}>
        {viewMode === 'table' ? (
          <>
            <div className="hidden lg:block">
              <MachineTable machines={items} sortBy={filters.sortBy} sortOrder={filters.sortOrder} onSort={handleSort} />
            </div>
            <div className="lg:hidden">
              <MachineCardGrid machines={items} dense />
            </div>
          </>
        ) : (
          <MachineCardGrid machines={items} />
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Machines"
        description="Live status of every machine. Status changes only through maintenance logs."
        meta={<LiveIndicator />}
        actions={
          <>
            <RefreshButton onRefresh={() => void machines.refetch()} refreshing={machines.isFetching && !machines.isPending} />
            {canManage ? (
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Add machine
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <ChipGroup
            label="Filter by status"
            options={statusOptions}
            value={filters.status ?? ALL}
            onChange={(value) => setParams({ status: value === ALL ? null : value }, { resetPage: true })}
          />
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              label="Search machines by name or serial number"
              placeholder="Search name or serial number"
              value={filters.search}
              onChange={(search) => setParams({ search }, { resetPage: true })}
              isSearching={machines.isFetching && Boolean(filters.search)}
              className="lg:max-w-sm"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {canManage ? (
                <Select
                  aria-label="Filter by record status"
                  value={filters.active ?? ''}
                  onChange={(event) => setParams({ active: event.target.value || null }, { resetPage: true })}
                  options={[
                    { value: 'true', label: 'Active machines' },
                    { value: 'false', label: 'Deactivated machines' },
                  ]}
                  placeholder="All machines"
                  wrapperClassName="min-w-40 flex-1 sm:flex-none"
                />
              ) : null}
              <Select
                aria-label="Sort machines"
                value={serializeSort(filters)}
                onChange={(event) => setParams({ sort: event.target.value }, { resetPage: true })}
                options={MACHINE_SORT_OPTIONS.map((option) => ({ ...option }))}
                wrapperClassName={cn('min-w-40 flex-1 sm:flex-none', viewMode === 'table' && 'lg:hidden')}
              />
              <SegmentedControl<MachineViewMode>
                label="Layout"
                options={VIEW_OPTIONS}
                value={viewMode}
                onChange={setViewMode}
              />
            </div>
          </div>
        </div>

        {renderContent()}

        {machines.data && machines.data.meta.totalItems > 0 ? (
          <Pagination
            meta={machines.data.meta}
            itemLabel="machines"
            onPageChange={(page) => {
              setParams({ page }, { history: 'push' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
          />
        ) : null}
      </Card>

      {canManage ? (
        <MachineFormDialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open && createRequested) clearParams(['create']);
          }}
        />
      ) : null}
    </>
  );
}
