'use client';

import { ScrollText, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FilterField } from '@/components/data/filter-field';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FormError } from '@/components/forms/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { AUDIT_ACTION_CONFIG, AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_LABELS, AUDIT_ENTITY_OPTIONS, getAuditEntityHref } from '@/constants/audit';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { useUsers } from '@/features/technicians/api/queries';
import { useUrlState } from '@/hooks/use-url-state';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime, formatTime, toIsoString } from '@/lib/utils/date';
import { type AuditLog } from '@/types/audit';
import { useAuditLogs } from '../api/queries';
import { AUDIT_FILTER_PARAMS, hasAuditFilters, parseAuditFilters, toListAuditLogsParams } from '../lib/filters';
import { AuditEntryDetails } from './audit-entry-details';

function EntityCell({ entry }: { entry: AuditLog }) {
  const href = getAuditEntityHref(entry.entity, entry.entityId);
  return (
    <span className="whitespace-nowrap">
      {AUDIT_ENTITY_LABELS[entry.entity]}
      {entry.entityId ? (
        href ? (
          <Link href={href} className="ml-1 font-mono text-xs text-info-ink hover:underline">
            #{entry.entityId}
          </Link>
        ) : (
          <span className="ml-1 font-mono text-xs text-muted">#{entry.entityId}</span>
        )
      ) : null}
    </span>
  );
}

export function AuditLogsView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseAuditFilters(searchParams);
  const audit = useAuditLogs(toListAuditLogsParams(filters));
  const users = useUsers({ page: 1, limit: MAX_PAGE_SIZE, sortBy: 'fullName', sortOrder: 'asc' });
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const items = audit.data?.items ?? [];

  const userOptions = (users.data?.items ?? []).map((user) => ({ value: String(user.id), label: user.fullName }));
  if (filters.userId && !userOptions.some((option) => option.value === String(filters.userId))) {
    userOptions.unshift({ value: String(filters.userId), label: `User #${filters.userId}` });
  }

  const renderContent = () => {
    if (audit.isPending) return <TableSkeleton rows={10} columns={5} />;
    if (audit.isError && !audit.data) return <ErrorState error={audit.error} onRetry={() => void audit.refetch()} isRetrying={audit.isFetching} />;
    if (items.length === 0) {
      return hasAuditFilters(filters) ? (
        <EmptyState
          icon={SearchX}
          title="No audit entries match your filters"
          action={
            <Button variant="secondary" onClick={() => clearParams(AUDIT_FILTER_PARAMS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState icon={ScrollText} title="No audit entries yet" description="Sign-ins and changes to users, machines and logs will be recorded here." />
      );
    }
    return (
      <div className={cn('transition-opacity', audit.isPlaceholderData && 'opacity-60')} aria-busy={audit.isFetching}>
        <div className="hidden lg:block">
          <Table>
            <caption className="sr-only">Audit trail</caption>
            <TableHead>
              <tr>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>IP address</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Details</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={toIsoString(entry.createdAt)}>{formatDate(entry.createdAt)}</time>
                    <span className="ml-2 text-xs text-muted tabular-nums">{formatTime(entry.createdAt)}</span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    {entry.user ? (
                      <>
                        <p className="truncate font-medium text-ink">{entry.user.fullName}</p>
                        <p className="truncate text-xs text-muted">{entry.user.email}</p>
                      </>
                    ) : (
                      <span className="text-muted">Unknown user</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge size="sm" tone={AUDIT_ACTION_CONFIG[entry.action].tone}>
                      {AUDIT_ACTION_CONFIG[entry.action].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <EntityCell entry={entry} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink-secondary">{entry.ipAddress ?? '—'}</TableCell>
                  <TableCell className="w-px">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(entry)}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y divide-line-soft lg:hidden">
          {items.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => setSelected(entry)} className="block w-full px-4 py-3 text-left hover:bg-hover">
                <div className="flex items-center justify-between gap-3">
                  <Badge size="sm" tone={AUDIT_ACTION_CONFIG[entry.action].tone}>
                    {AUDIT_ACTION_CONFIG[entry.action].label}
                  </Badge>
                  <time className="text-[11px] text-muted" dateTime={toIsoString(entry.createdAt)}>
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1.5 truncate text-[13px] text-ink">{entry.user?.fullName ?? 'Unknown user'}</p>
                <p className="text-xs text-muted">
                  {AUDIT_ENTITY_LABELS[entry.entity]}
                  {entry.entityId ? ` #${entry.entityId}` : ''}
                  {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Sign-ins and every change to accounts, machines and logs. Passwords and tokens are never recorded."
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:p-4 lg:grid-cols-4 2xl:grid-cols-7">
          <FilterField label="Record ID" className="col-span-2 lg:col-span-1">
            {(id) => (
              <SearchInput
                id={id}
                label="Search by record ID"
                placeholder="e.g. 42"
                value={filters.entityId}
                maxLength={64}
                onChange={(entityId) => setParams({ entityId }, { resetPage: true })}
                isSearching={audit.isFetching && Boolean(filters.entityId)}
              />
            )}
          </FilterField>
          <FilterField label="Action">
            {(id) => (
              <Select id={id} value={filters.action ?? ''} options={AUDIT_ACTION_OPTIONS} placeholder="All actions" onChange={(event) => setParams({ action: event.target.value || null }, { resetPage: true })} />
            )}
          </FilterField>
          <FilterField label="Entity">
            {(id) => (
              <Select id={id} value={filters.entity ?? ''} options={AUDIT_ENTITY_OPTIONS} placeholder="All entities" onChange={(event) => setParams({ entity: event.target.value || null }, { resetPage: true })} />
            )}
          </FilterField>
          <FilterField label="User">
            {(id) => (
              <Select id={id} value={filters.userId ? String(filters.userId) : ''} options={userOptions} placeholder="All users" onChange={(event) => setParams({ userId: event.target.value || null }, { resetPage: true })} />
            )}
          </FilterField>
          <FilterField label="From">
            {(id) => <Input id={id} type="date" value={filters.from ?? ''} onChange={(event) => setParams({ from: event.target.value || null }, { resetPage: true })} />}
          </FilterField>
          <FilterField label="To">
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
          <FilterField label="Order">
            {(id) => (
              <Select
                id={id}
                value={filters.sortOrder}
                options={[
                  { value: 'desc', label: 'Newest first' },
                  { value: 'asc', label: 'Oldest first' },
                ]}
                onChange={(event) => setParams({ order: event.target.value === 'desc' ? null : event.target.value }, { resetPage: true })}
              />
            )}
          </FilterField>
        </div>
        {hasAuditFilters(filters) ? (
          <div className="flex justify-end border-b border-line px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => clearParams(AUDIT_FILTER_PARAMS)}>
              Clear filters
            </Button>
          </div>
        ) : null}

        {renderContent()}

        {audit.data && audit.data.meta.totalItems > 0 ? (
          <Pagination
            meta={audit.data.meta}
            itemLabel="entries"
            onPageChange={(page) => {
              setParams({ page }, { history: 'push' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
          />
        ) : null}
      </Card>

      <AuditEntryDetails entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
