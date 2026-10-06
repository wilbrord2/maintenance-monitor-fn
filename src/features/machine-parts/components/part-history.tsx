'use client';

import { History, SearchX } from 'lucide-react';
import Link from 'next/link';
import { FilterField } from '@/components/data/filter-field';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FormError } from '@/components/forms/form-field';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { MachineStatusChange } from '@/components/status/log-subject';
import { OperationalImpactBadge } from '@/components/status/part-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { LOG_STATUS_OPTIONS } from '@/constants/log-status';
import { MACHINE_PART_STATUS_OPTIONS, OPERATIONAL_IMPACT_OPTIONS } from '@/constants/machine-part';
import { ROUTES } from '@/constants/routes';
import { useUrlState } from '@/hooks/use-url-state';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, toIsoString } from '@/lib/utils/date';
import { formatHours } from '@/lib/utils/format';
import { type MachineLog } from '@/types/machine-log';
import { useMachinePartHistory } from '../api/queries';
import {
  hasPartHistoryFilters,
  PART_HISTORY_FILTER_PARAMS,
  PART_HISTORY_SORT_OPTIONS,
  parsePartHistoryFilters,
  toPartHistoryParams,
} from '../lib/filters';

function HistoryRows({ logs }: { logs: MachineLog[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <caption className="sr-only">Part history</caption>
          <TableHead>
            <tr>
              <TableHeaderCell>Started</TableHeaderCell>
              <TableHeaderCell>Condition change</TableHeaderCell>
              <TableHeaderCell>Impact</TableHeaderCell>
              <TableHeaderCell>What happened</TableHeaderCell>
              <TableHeaderCell>Recorded by</TableHeaderCell>
              <TableHeaderCell className="text-right">Downtime</TableHeaderCell>
              <TableHeaderCell>Record</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Details</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={toIsoString(log.startedAt)}>{formatDateTime(log.startedAt)}</time>
                </TableCell>
                <TableCell>
                  <StateTransition from={log.entryStatus} to={log.resultingState} />
                  <MachineStatusChange log={log} className="mt-1.5" />
                </TableCell>
                <TableCell>
                  {log.operationalImpact ? (
                    <OperationalImpactBadge impact={log.operationalImpact} size="sm" />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-72">
                  <p className="truncate">{log.faultDescription}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{log.technician.fullName}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">
                  {formatHours(log.downtimeHours)}
                </TableCell>
                <TableCell>
                  <LogStatusBadge status={log.logStatus} size="sm" />
                </TableCell>
                <TableCell className="w-px">
                  <Link href={ROUTES.log(log.id)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Details
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-line-soft lg:hidden">
        {logs.map((log) => (
          <li key={log.id}>
            <Link href={ROUTES.log(log.id)} className="block w-full px-4 py-3 text-left hover:bg-hover">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StateTransition from={log.entryStatus} to={log.resultingState} />
                <LogStatusBadge status={log.logStatus} size="sm" />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {log.operationalImpact ? <OperationalImpactBadge impact={log.operationalImpact} size="sm" /> : null}
                <MachineStatusChange log={log} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-[13px] text-ink">{log.faultDescription}</p>
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(log.startedAt)} · {log.technician.fullName} · {formatHours(log.downtimeHours)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * One part's events (`GET /machine-parts/:partId/logs`), the same machine logs as everywhere else.
 * Filtering, sorting and paging all happen on the API.
 */
export function PartHistory({ partId }: { partId: number }) {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parsePartHistoryFilters(searchParams);
  const history = useMachinePartHistory(partId, toPartHistoryParams(filters));
  const items = history.data?.items ?? [];
  const filtered = hasPartHistoryFilters(filters);

  const renderContent = () => {
    if (history.isPending) return <TableSkeleton rows={6} columns={5} />;
    if (history.isError && !history.data) {
      return (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} isRetrying={history.isFetching} />
      );
    }
    if (items.length === 0) {
      return filtered ? (
        <EmptyState
          icon={SearchX}
          title="No records match your filters"
          action={
            <Button variant="secondary" onClick={() => clearParams(PART_HISTORY_FILTER_PARAMS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={History}
          title="No history yet"
          description="Faults and maintenance recorded for this part will appear here."
        />
      );
    }
    return (
      <div className={cn('transition-opacity', history.isPlaceholderData && 'opacity-60')} aria-busy={history.isFetching}>
        <HistoryRows logs={items} />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader title="Part history" description="Every recorded fault and maintenance for this part." />

      <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:p-4 lg:grid-cols-3 2xl:grid-cols-6">
        <FilterField label="Search" className="col-span-2 lg:col-span-1">
          {(id) => (
            <SearchInput
              id={id}
              label="Search part history"
              placeholder="Fault, cause or action"
              value={filters.search}
              onChange={(search) => setParams({ search }, { resetPage: true })}
              isSearching={history.isFetching && Boolean(filters.search)}
            />
          )}
        </FilterField>
        <FilterField label="Condition">
          {(id) => (
            <Select
              id={id}
              value={filters.resultingState ?? ''}
              options={MACHINE_PART_STATUS_OPTIONS}
              placeholder="Any condition"
              onChange={(event) => setParams({ resultingState: event.target.value || null }, { resetPage: true })}
            />
          )}
        </FilterField>
        <FilterField label="Impact">
          {(id) => (
            <Select
              id={id}
              value={filters.operationalImpact ?? ''}
              options={OPERATIONAL_IMPACT_OPTIONS}
              placeholder="Any impact"
              onChange={(event) => setParams({ impact: event.target.value || null }, { resetPage: true })}
            />
          )}
        </FilterField>
        <FilterField label="Record">
          {(id) => (
            <Select
              id={id}
              value={filters.logStatus ?? ''}
              options={LOG_STATUS_OPTIONS}
              placeholder="Open and closed"
              onChange={(event) => setParams({ logStatus: event.target.value || null }, { resetPage: true })}
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <Select
          aria-label="Sort part history"
          value={`${filters.sortBy}:${filters.sortOrder}`}
          options={PART_HISTORY_SORT_OPTIONS.map((option) => ({ ...option }))}
          onChange={(event) => setParams({ sort: event.target.value }, { resetPage: true })}
          wrapperClassName="min-w-44"
        />
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={() => clearParams(PART_HISTORY_FILTER_PARAMS)}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {renderContent()}

      {history.data && history.data.meta.totalItems > 0 ? (
        <Pagination
          meta={history.data.meta}
          itemLabel="records"
          onPageChange={(page) => setParams({ page }, { history: 'push' })}
          onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
        />
      ) : null}
    </Card>
  );
}
