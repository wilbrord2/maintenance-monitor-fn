'use client';

import { SearchX, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/layout/page-header';
import { RoleBadge, UserStatusBadges } from '@/components/status/user-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { useUrlState } from '@/hooks/use-url-state';
import { useSession } from '@/lib/auth/session-store';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { getInitials } from '@/lib/utils/format';
import { serializeSort } from '@/lib/utils/url-params';
import { Role } from '@/types/auth';
import { type User } from '@/types/user';
import { useUsers } from '../api/queries';
import { hasUserFilters, parseUserFilters, toListUsersParams, USER_FILTER_PARAMS, USER_SORT_OPTIONS } from '../lib/filters';
import { TechnicianActionsMenu } from './technician-actions-menu';
import { type TechnicianDialog, TechnicianManageDialogs } from './technician-manage-dialogs';
import { TechnicianFormDialog } from './technician-form-dialog';

type RoleChip = Role | 'ALL';

function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-steel-soft text-[11px] font-semibold text-steel-dark" aria-hidden>
      {getInitials(name)}
    </span>
  );
}

function UserRowActions({ user }: { user: User }) {
  const [dialog, setDialog] = useState<TechnicianDialog>(null);
  return (
    <>
      <TechnicianActionsMenu user={user} onAction={setDialog} />
      <TechnicianManageDialogs user={user} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function YouTag({ user }: { user: User }) {
  const isSelf = useSession((state) => state.user?.id === user.id);
  return isSelf ? <span className="rounded-sm bg-neutral-soft px-1.5 text-[11px] font-semibold text-neutral-ink">You</span> : null;
}

function UserTable({ users }: { users: readonly User[] }) {
  return (
    <Table>
      <caption className="sr-only">Technician and administrator accounts</caption>
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Email</TableHeaderCell>
          <TableHeaderCell>Phone</TableHeaderCell>
          <TableHeaderCell>Position</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Created</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} className={cn(!user.isActive && 'text-muted')}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar name={user.fullName} />
                <Link href={ROUTES.technician(user.id)} className="font-semibold text-ink hover:underline">
                  {user.fullName}
                </Link>
                <YouTag user={user} />
              </div>
            </TableCell>
            <TableCell className="max-w-56 truncate text-ink-secondary">{user.email}</TableCell>
            <TableCell className="whitespace-nowrap text-ink-secondary tabular-nums">{user.phone}</TableCell>
            <TableCell className="max-w-44 truncate text-ink-secondary">{user.position ?? <span className="text-muted">—</span>}</TableCell>
            <TableCell>
              <RoleBadge role={user.role} />
            </TableCell>
            <TableCell>
              <UserStatusBadges user={user} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-ink-secondary">
              <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
                {formatDate(user.createdAt)}
              </time>
            </TableCell>
            <TableCell className="w-px">
              <UserRowActions user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UserCards({ users }: { users: readonly User[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
      {users.map((user) => (
        <li key={user.id}>
          <article className="relative rounded-lg border border-line bg-panel p-4">
            <div className="flex items-start gap-3">
              <Avatar name={user.fullName} />
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                  <Link href={ROUTES.technician(user.id)} className="truncate after:absolute after:inset-0 hover:underline">
                    {user.fullName}
                  </Link>
                  <YouTag user={user} />
                </h3>
                <p className="truncate text-xs text-muted">{user.position ?? 'No position set'}</p>
              </div>
              <div className="relative z-10 -mt-1 -mr-2">
                <UserRowActions user={user} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={user.role} />
              <UserStatusBadges user={user} />
            </div>
            <p className="mt-3 truncate border-t border-line-soft pt-2.5 text-xs text-ink-secondary">
              {user.email} · <span className="tabular-nums">{user.phone}</span>
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function TechniciansView() {
  const { searchParams, setParams, clearParams } = useUrlState();
  const filters = parseUserFilters(searchParams);
  const users = useUsers(toListUsersParams(filters));
  const [createOpen, setCreateOpen] = useState(false);
  const createRequested = searchParams.get('create') === '1';
  const items = users.data?.items ?? [];

  const renderContent = () => {
    if (users.isPending) return <TableSkeleton rows={8} columns={6} />;
    if (users.isError && !users.data) return <ErrorState error={users.error} onRetry={() => void users.refetch()} isRetrying={users.isFetching} />;
    if (items.length === 0) {
      return hasUserFilters(filters) ? (
        <EmptyState
          icon={SearchX}
          title="No accounts match your filters"
          description="Try a different name, email or phone number."
          action={
            <Button variant="secondary" onClick={() => clearParams(USER_FILTER_PARAMS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No technicians yet"
          description="Add a technician to give them access. Sign-in instructions are sent by email."
          action={
            <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
              Add technician
            </Button>
          }
        />
      );
    }
    return (
      <div className={cn('transition-opacity', users.isPlaceholderData && 'opacity-60')} aria-busy={users.isFetching}>
        <div className="hidden lg:block">
          <UserTable users={items} />
        </div>
        <div className="lg:hidden">
          <UserCards users={items} />
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Technicians"
        description="Manage who can access Maintenance Monitor. Passwords are never visible to administrators."
        actions={
          <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
            Add technician
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
          <SearchInput
            label="Search accounts"
            placeholder="Search name, email or phone"
            value={filters.search}
            onChange={(search) => setParams({ search }, { resetPage: true })}
            isSearching={users.isFetching && Boolean(filters.search)}
            className="lg:max-w-sm"
          />
          <ChipGroup<RoleChip>
            label="Filter by role"
            value={filters.role ?? 'ALL'}
            onChange={(value) => setParams({ role: value === 'ALL' ? null : value }, { resetPage: true })}
            options={[
              { value: 'ALL', label: 'All roles' },
              { value: Role.TECHNICIAN, label: 'Technicians' },
              { value: Role.ADMIN, label: 'Administrators' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select
              aria-label="Filter by account status"
              value={filters.active ?? ''}
              onChange={(event) => setParams({ active: event.target.value || null }, { resetPage: true })}
              options={[
                { value: 'true', label: 'Active accounts' },
                { value: 'false', label: 'Deactivated accounts' },
              ]}
              placeholder="All statuses"
              wrapperClassName="min-w-40 flex-1"
            />
            <Select
              aria-label="Sort accounts"
              value={serializeSort(filters)}
              onChange={(event) => setParams({ sort: event.target.value }, { resetPage: true })}
              options={USER_SORT_OPTIONS.map((option) => ({ ...option }))}
              wrapperClassName="min-w-40 flex-1"
            />
          </div>
        </div>

        {renderContent()}

        {users.data && users.data.meta.totalItems > 0 ? (
          <Pagination
            meta={users.data.meta}
            itemLabel="accounts"
            onPageChange={(page) => {
              setParams({ page }, { history: 'push' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(limit) => setParams({ limit }, { resetPage: true })}
          />
        ) : null}
      </Card>

      <TechnicianFormDialog
        open={createOpen || createRequested}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open && createRequested) clearParams(['create']);
        }}
      />
    </>
  );
}
