'use client';

import { ClipboardList, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { RoleBadge, UserStatusBadges } from '@/components/status/user-badges';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ListSkeleton, LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { useTechnicianAnalytics } from '@/features/analytics/api/queries';
import { useMachineLogs } from '@/features/machine-logs/api/queries';
import { isApiError } from '@/lib/api/errors';
import { useSession } from '@/lib/auth/session-store';
import { ROLE_LABELS } from '@/lib/permissions/permissions';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { formatHours, formatNumber } from '@/lib/utils/format';
import { type User } from '@/types/user';
import { useUser } from '../api/queries';
import { TechnicianActionsMenu } from './technician-actions-menu';
import { type TechnicianDialog, TechnicianManageDialogs } from './technician-manage-dialogs';

const ACTIVITY_DAYS = 30;
const ANALYTICS_LIMIT = 100;

function ActivityStats({ user }: { user: User }) {
  const analytics = useTechnicianAnalytics({ days: ACTIVITY_DAYS, limit: ANALYTICS_LIMIT });
  const rows = analytics.data?.byTechnician;
  const row = rows?.find((entry) => entry.technician.id === user.id);
  const known = row !== undefined || (rows !== undefined && rows.length < ANALYTICS_LIMIT);
  const stats = [
    { label: 'Logs recorded', value: row ? formatNumber(row.totalLogs) : '0' },
    { label: 'Open', value: row ? formatNumber(row.openLogs) : '0' },
    { label: 'Closed', value: row ? formatNumber(row.closedLogs) : '0' },
    { label: 'Downtime logged', value: row ? formatHours(row.downtimeHours) : formatHours(0) },
  ];

  return (
    <Card>
      <CardHeader title="Activity" description={`Last ${ACTIVITY_DAYS} days`} />
      <CardContent>
        {analytics.isPending ? (
          <LoadingRegion label="Loading activity" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <Skeleton key={stat.label} className="h-14" />
            ))}
          </LoadingRegion>
        ) : analytics.isError ? (
          <ErrorState compact error={analytics.error} onRetry={() => void analytics.refetch()} />
        ) : (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md border border-line-soft bg-sunken px-3 py-2.5">
                <dt className="text-xs text-muted">{stat.label}</dt>
                <dd className="mt-1 text-lg leading-none font-semibold text-ink">{known ? stat.value : '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function RecentLogs({ user }: { user: User }) {
  const logs = useMachineLogs({ page: 1, limit: 8, userId: user.id, sortBy: 'createdAt', sortOrder: 'desc' });
  return (
    <Card>
      <CardHeader
        title="Recent logs"
        description="Latest activity recorded by this user"
        actions={
          <Link href={`${ROUTES.logs}?userId=${user.id}`} className="text-xs font-medium text-info-ink hover:underline">
            View all
          </Link>
        }
      />
      {logs.isPending ? (
        <ListSkeleton rows={4} />
      ) : logs.isError ? (
        <ErrorState compact error={logs.error} onRetry={() => void logs.refetch()} />
      ) : logs.data.items.length === 0 ? (
        <EmptyState compact icon={ClipboardList} title="No logs recorded yet" />
      ) : (
        <ul className="divide-y divide-line-soft">
          {logs.data.items.map((log) => (
            <li key={log.id}>
              <Link href={ROUTES.log(log.id)} className="block px-4 py-3 hover:bg-hover">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[13px] font-semibold text-ink">{log.machine.name}</p>
                  <span className="shrink-0 text-[11px] text-muted">{formatRelativeTime(log.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-secondary">{log.faultDescription}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StateTransition from={log.entryStatus} to={log.resultingState} />
                  <LogStatusBadge status={log.logStatus} size="sm" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TechnicianDetailView({ userId }: { userId: number }) {
  const router = useRouter();
  const userQuery = useUser(userId);
  const isSelf = useSession((state) => state.user?.id === userId);
  const [dialog, setDialog] = useState<TechnicianDialog>(null);

  if (userQuery.isPending) {
    return (
      <LoadingRegion label="Loading account">
        <Skeleton className="mb-2 h-3 w-40" />
        <Skeleton className="mb-6 h-7 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </LoadingRegion>
    );
  }
  if (userQuery.isError) {
    return (
      <Card>
        {isApiError(userQuery.error) && userQuery.error.status === 404 ? (
          <NotFoundState title="Account not found" description="This account doesn't exist or has been deleted." backHref={ROUTES.technicians} backLabel="Back to technicians" />
        ) : (
          <ErrorState error={userQuery.error} onRetry={() => void userQuery.refetch()} />
        )}
      </Card>
    );
  }

  const user = userQuery.data;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Technicians', href: ROUTES.technicians }, { label: user.fullName }]}
        title={user.fullName}
        meta={
          <>
            <RoleBadge role={user.role} />
            <UserStatusBadges user={user} />
          </>
        }
        description={user.position ?? undefined}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>
              Edit
            </Button>
            <TechnicianActionsMenu user={user} onAction={setDialog} showView={false} triggerVariant="secondary" />
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        {isSelf ? <Alert tone="info">This is your own account. You can&apos;t deactivate or delete it.</Alert> : null}
        {user.isLocked ? (
          <Alert tone="critical" title="Sign-in temporarily locked">
            Too many failed sign-in attempts. The lock is lifted automatically after the lockout period.
          </Alert>
        ) : null}
        {user.mustChangePassword && user.isActive ? (
          <Alert tone="warning" title="Awaiting first sign-in">
            A temporary password was emailed. It expires if unused — send a new one from the actions menu if needed.
          </Alert>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <ActivityStats user={user} />
          <RecentLogs user={user} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Contact" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Email', value: <a href={`mailto:${user.email}`} className="hover:underline">{user.email}</a> },
                  { label: 'Phone', value: <span className="tabular-nums">{user.phone}</span> },
                  { label: 'Position', value: user.position ?? <span className="text-muted">Not set</span> },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Account" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Role', value: ROLE_LABELS[user.role] },
                  { label: 'Status', value: user.isActive ? 'Active' : 'Deactivated' },
                  { label: 'Password', value: user.mustChangePassword ? 'Temporary — must be changed at next sign-in' : 'Set by the user' },
                  { label: 'Last sign-in', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never' },
                  { label: 'Created', value: formatDateTime(user.createdAt) },
                  { label: 'Last updated', value: formatDateTime(user.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <TechnicianManageDialogs user={user} dialog={dialog} onClose={() => setDialog(null)} onDeleted={() => router.replace(ROUTES.technicians)} />
    </>
  );
}
