'use client';

import { CalendarCheck, CircleDashed, CircleCheckBig, ClipboardList, Component, Factory, Timer } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { StatTile } from '@/components/data/stat-tile';
import { PageHeader } from '@/components/layout/page-header';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MACHINE_OPERATIONAL_STATUS_CONFIG } from '@/constants/machine-operational-status';
import { MAINTENANCE_STATE_CONFIG } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { useAnalyticsOverview, useMaintenanceAnalytics } from '@/features/analytics/api/queries';
import { MaintenanceAttention } from '@/features/maintenance/components/maintenance-attention';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { useSession } from '@/lib/auth/session-store';
import { formatHours, formatNumber, toPercent } from '@/lib/utils/format';
import { MACHINE_OPERATIONAL_STATUSES, MachineOperationalStatus } from '@/types/machine';
import { MaintenanceScheduleState } from '@/types/maintenance';
import { MaintenanceWork } from './maintenance-work';
import { NeedsAttention } from './needs-attention';
import { QuickActions } from './quick-actions';
import { RecentActivity } from './recent-activity';
import { getOperationalCounts, StatusDistribution } from './status-distribution';

const RANGE = { days: 30 } as const;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView() {
  const firstName = useSession((state) => state.user?.fullName.split(' ')[0] ?? '');
  const { can } = usePermissions();
  const overview = useAnalyticsOverview(RANGE);
  const data = overview.data;
  const loading = overview.isPending;
  const counts = data ? getOperationalCounts(data.machineOperational) : null;
  const countFor = (status: MachineOperationalStatus) => counts?.find((row) => row.status === status)?.count ?? 0;
  const fleetTotal = counts?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const partsNeedingAttention = data ? data.parts.total - data.parts.active : 0;

  const canSeeMaintenance = can(Permission.VIEW_MAINTENANCE);
  const maintenanceAnalytics = useMaintenanceAnalytics(RANGE, { enabled: canSeeMaintenance });
  const maintenanceCounts = data?.maintenance;

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting(new Date().getHours())}, ${firstName}` : 'Dashboard'}
        description="Fleet condition and maintenance activity at a glance."
        meta={<LiveIndicator />}
        actions={<QuickActions />}
      />

      {overview.isError && !data ? (
        <div className="mb-4 rounded-lg border border-line bg-panel">
          <ErrorState compact error={overview.error} onRetry={() => void overview.refetch()} isRetrying={overview.isFetching} />
        </div>
      ) : null}

      <section aria-label="Fleet status" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Total machines"
          icon={Factory}
          value={formatNumber(fleetTotal)}
          caption={data && data.machines.inactive > 0 ? `${formatNumber(data.machines.inactive)} deactivated` : 'Active in the fleet'}
          href={ROUTES.machines}
          loading={loading}
          className="col-span-2 md:col-span-1"
        />
        {MACHINE_OPERATIONAL_STATUSES.map((status) => {
          const config = MACHINE_OPERATIONAL_STATUS_CONFIG[status];
          const count = countFor(status);
          return (
            <StatTile
              key={status}
              label={config.label}
              icon={config.icon}
              tone={config.tone}
              value={formatNumber(count)}
              caption={`${toPercent(count, fleetTotal)}% of fleet`}
              href={`${ROUTES.machines}?status=${status}`}
              loading={loading}
              emphasized={status === MachineOperationalStatus.NOT_OPERATING && count > 0}
            />
          );
        })}
        <StatTile
          label="Parts needing attention"
          icon={Component}
          tone={partsNeedingAttention > 0 ? 'warning' : undefined}
          value={formatNumber(partsNeedingAttention)}
          caption={data ? `of ${formatNumber(data.parts.total)} parts monitored` : 'Across the fleet'}
          loading={loading}
        />
      </section>

      {canSeeMaintenance ? (
        <section aria-label="Preventive maintenance" className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.UPCOMING].label}
            icon={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.UPCOMING].icon}
            tone="info"
            value={formatNumber(maintenanceCounts?.upcoming ?? 0)}
            caption="Approaching their due date"
            href={`${ROUTES.maintenance}?state=UPCOMING`}
            loading={loading}
          />
          <StatTile
            label={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.DUE].label}
            icon={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.DUE].icon}
            tone="warning"
            value={formatNumber(maintenanceCounts?.due ?? 0)}
            caption="Due today"
            href={`${ROUTES.maintenance}?state=DUE`}
            loading={loading}
          />
          <StatTile
            label={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.OVERDUE].label}
            icon={MAINTENANCE_STATE_CONFIG[MaintenanceScheduleState.OVERDUE].icon}
            tone="critical"
            value={formatNumber(maintenanceCounts?.overdue ?? 0)}
            caption="Past their due date"
            href={`${ROUTES.maintenance}?state=OVERDUE`}
            loading={loading}
            emphasized={(maintenanceCounts?.overdue ?? 0) > 0}
          />
          <StatTile
            label="Completed"
            icon={CalendarCheck}
            tone="positive"
            value={formatNumber(maintenanceAnalytics.data?.compliance.completed ?? 0)}
            caption="Last 30 days"
            href={`${ROUTES.maintenance}?tab=events&status=COMPLETED`}
            loading={maintenanceAnalytics.isPending}
          />
        </section>
      ) : null}

      <section aria-label="Maintenance metrics" className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Open logs"
          icon={CircleDashed}
          value={formatNumber(data?.logs.currentlyOpen ?? 0)}
          caption="Work in progress right now"
          href={`${ROUTES.logs}?logStatus=OPEN`}
          loading={loading}
        />
        <StatTile label="Closed logs" icon={CircleCheckBig} value={formatNumber(data?.logs.closed ?? 0)} caption="Last 30 days" loading={loading} />
        <StatTile label="Logs recorded" icon={ClipboardList} value={formatNumber(data?.logs.total ?? 0)} caption="Last 30 days" loading={loading} />
        <StatTile label="Downtime" icon={Timer} value={formatHours(data?.totalDowntimeHours ?? 0)} caption="Last 30 days" loading={loading} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NeedsAttention
            notOperatingCount={data?.machineOperational.notOperating}
            withDefectsCount={data?.machineOperational.operatingWithDefects}
          />
        </div>
        <StatusDistribution overview={data} loading={loading} />
      </div>

      {canSeeMaintenance ? (
        <div className="mt-4">
          <MaintenanceAttention />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity />
        <MaintenanceWork openCount={data?.logs.currentlyOpen} />
      </div>
    </>
  );
}
