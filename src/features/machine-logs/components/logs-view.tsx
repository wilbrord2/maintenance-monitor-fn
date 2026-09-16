'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, ClipboardPlus, Funnel, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { FilterField } from '@/components/data/filter-field';
import { RefreshButton } from '@/components/data/refresh-button';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FormError } from '@/components/forms/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { MACHINE_STATE_OPTIONS } from '@/constants/machine-state';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { buildCreateLogUrl } from '@/constants/routes';
import { useMachines } from '@/features/machines/api/queries';
import { useUsers } from '@/features/technicians/api/queries';
import { useUrlState } from '@/hooks/use-url-state';
import { useSession } from '@/lib/auth/session-store';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { serializeSort } from '@/lib/utils/url-params';
import { LogStatus, type MachineLogSortField } from '@/types/machine-log';
import { useMachineLogs } from '../api/queries';
import {
  countAdvancedLogFilters,
  hasLogFilters,
  LOG_FILTER_PARAMS,
  LOG_SORT_OPTIONS,
  parseLogFilters,
  toListMachineLogsParams,
} from '../lib/filters';
import { LogCardList, LogTable } from './log-list';

type StatusChip = LogStatus | 'ALL';

export function LogsView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseLogFilters(searchParams);
  const currentUserId = useSession((state) => state.user?.id);
  const { can } = usePermissions();
  const canViewUsers = can(Permission.VIEW_USERS);
  const panelId = useId();

  const logs = useMachineLogs(toListMachineLogsParams(filters, currentUserId), { enabled: !filters.mine || currentUserId !== undefined });
  const machines = useMachines({ page: 1, limit: MAX_PAGE_SIZE, sortBy: 'name', sortOrder: 'asc' });
  const users = useUsers({ page: 1, limit: MAX_PAGE_SIZE, sortBy: 'fullName', sortOrder: 'asc' }, { enabled: canViewUsers });

  const advancedCount = countAdvancedLogFilters(filters);
  const [panelOpen, setPanelOpen] = useState(advancedCount > 0);

  const machineOptions = (machines.data?.items ?? []).map((machine) => ({ value: String(machine.id), label: machine.name }));
  if (filters.machineId && !machineOptions.some((option) => option.value === String(filters.machineId))) {
    machineOptions.unshift({ value: String(filters.machineId), label: `Machine #${filters.machineId}` });
  }
  const userOptions = (users.data?.items ?? []).map((user) => ({ value: String(user.id), label: user.fullName }));
  if (filters.userId && !userOptions.some((option) => option.value === String(filters.userId))) {
    userOptions.unshift({ value: String(filters.userId), label: `User #${filters.userId}` });
  }

  const handleSort = (field: MachineLogSortField) => {
    const sortOrder = filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
    setParams({ sort: serializeSort({ sortBy: field, sortOrder }) }, { resetPage: true });
  };

  const items = logs.data?.items ?? [];

  const renderContent = () => {
    if (logs.isPending) return <TableSkeleton rows={8} columns={7} />;
    if (logs.isError && !logs.data) return <ErrorState error={logs.error} onRetry={() => void logs.refetch()} isRetrying={logs.isFetching} />;
    if (items.length === 0) {
      return hasLogFilters(filters) ? (
        <EmptyState
          icon={SearchX}
          title="No maintenance logs found"
          description="Try adjusting your filters or search term."
          action={
            <Button variant="secondary" onClick={() => clearParams(LOG_FILTER_PARAMS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No maintenance logs found"
          description="Try adjusting your filters or record the first maintenance activity."
          action={
            can(Permission.CREATE_LOGS) ? (
              <Link href={buildCreateLogUrl()} className={buttonVariants()}>
                <ClipboardPlus className="size-4" aria-hidden />
                Record activity
              </Link>
            ) : null
          }
        />
      );
    }
    return (
      <div className={cn('transition-opacity', logs.isPlaceholderData && 'opacity-60')} aria-busy={logs.isFetching}>
        <div className="hidden xl:block">
          <LogTable logs={items} sortBy={filters.sortBy} sortOrder={filters.sortOrder} onSort={handleSort} />
        </div>
        <div className="xl:hidden">
          <LogCardList logs={items} />
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Machine Logs"
        description="Every fault, repair, test and inspection across the fleet."
        actions={
          <>
            <RefreshButton onRefresh={() => void logs.refetch()} refreshing={logs.isFetching && !logs.isPending} />
            {can(Permission.CREATE_LOGS) ? (
              <Link href={buildCreateLogUrl()} className={buttonVariants()}>
                <ClipboardPlus className="size-4" aria-hidden />
                Record activity
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              label="Search logs"
              placeholder="Search fault, cause or action"
              value={filters.search}
              onChange={(search) => setParams({ search }, { resetPage: true })}
              isSearching={logs.isFetching && Boolean(filters.search)}
              className="lg:max-w-sm"
            />
            <ChipGroup<StatusChip>
              label="Filter by log status"
              value={filters.logStatus ?? 'ALL'}
              onChange={(value) => setParams({ logStatus: value === 'ALL' ? null : value }, { resetPage: true })}
              options={[
                { value: 'ALL', label: 'All' },
                { value: LogStatus.OPEN, label: 'Open' },
                { value: LogStatus.CLOSED, label: 'Closed' },
              ]}
            />
            <div className="flex items-center gap-2 lg:ml-auto">
              <Button
                variant={advancedCount > 0 ? 'primary' : 'secondary'}
                icon={Funnel}
                aria-expanded={panelOpen}
                aria-controls={panelId}
                onClick={() => setPanelOpen((open) => !open)}
              >
                Filters{advancedCount > 0 ? ` (${advancedCount})` : ''}
              </Button>
              <Select
                aria-label="Sort logs"
                value={serializeSort(filters)}
                onChange={(event) => setParams({ sort: event.target.value }, { resetPage: true })}
                options={LOG_SORT_OPTIONS.map((option) => ({ ...option }))}
                wrapperClassName="min-w-44 flex-1"
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {panelOpen ? (
              <motion.div
                id={panelId}
                key="filters"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-3 border-t border-line-soft pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  <FilterField label="Machine">
                    {(id) => (
                      <Select
                        id={id}
                        value={filters.machineId ? String(filters.machineId) : ''}
                        onChange={(event) => setParams({ machineId: event.target.value || null }, { resetPage: true })}
                        options={machineOptions}
                        placeholder="All machines"
                      />
                    )}
                  </FilterField>
                  {canViewUsers ? (
                    <FilterField label="Technician">
                      {(id) => (
                        <Select
                          id={id}
                          value={filters.userId ? String(filters.userId) : ''}
                          onChange={(event) => setParams({ userId: event.target.value || null, mine: null }, { resetPage: true })}
                          options={userOptions}
                          placeholder="All technicians"
                        />
                      )}
                    </FilterField>
                  ) : (
                    <div className="flex items-end">
                      <label className="flex h-9 items-center gap-2 text-[13px] text-ink">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-primary)]"
                          checked={filters.mine}
                          onChange={(event) => setParams({ mine: event.target.checked ? 1 : null }, { resetPage: true })}
                        />
                        Only logs I recorded
                      </label>
                    </div>
                  )}
                  <FilterField label="Entry state">
                    {(id) => (
                      <Select
                        id={id}
                        value={filters.entryStatus ?? ''}
                        onChange={(event) => setParams({ entryStatus: event.target.value || null }, { resetPage: true })}
                        options={MACHINE_STATE_OPTIONS}
                        placeholder="Any entry state"
                      />
                    )}
                  </FilterField>
                  <FilterField label="Resulting state">
                    {(id) => (
                      <Select
                        id={id}
                        value={filters.resultingState ?? ''}
                        onChange={(event) => setParams({ resultingState: event.target.value || null }, { resetPage: true })}
                        options={MACHINE_STATE_OPTIONS}
                        placeholder="Any resulting state"
                      />
                    )}
                  </FilterField>
                  <FilterField label="Started from">
                    {(id) => (
                      <Input
                        id={id}
                        type="date"
                        value={filters.from ?? ''}
                        onChange={(event) => setParams({ from: event.target.value || null }, { resetPage: true })}
                      />
                    )}
                  </FilterField>
                  <FilterField label="Started to">
                    {(id) => (
                      <>
                        <Input
                          id={id}
                          type="date"
                          value={filters.to ?? ''}
                          min={filters.from}
                          aria-invalid={filters.invalidRange || undefined}
                          onChange={(event) => setParams({ to: event.target.value || null }, { resetPage: true })}
                        />
                        {filters.invalidRange ? <FormError>The end date is before the start date and is ignored.</FormError> : null}
                      </>
                    )}
                  </FilterField>
                </div>
                {hasLogFilters(filters) ? (
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => clearParams(LOG_FILTER_PARAMS)}>
                      Clear all filters
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {renderContent()}

        {logs.data && logs.data.meta.totalItems > 0 ? (
          <Pagination
            meta={logs.data.meta}
            itemLabel="logs"
            onPageChange={(page) => {
              setParams({ page }, { history: 'push' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
          />
        ) : null}
      </Card>
    </>
  );
}
