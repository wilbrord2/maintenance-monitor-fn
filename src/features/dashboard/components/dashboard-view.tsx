'use client';

import { CircleDashed, CircleCheckBig, ClipboardList, Factory, Timer } from 'lucide-react';
import { ErrorState } from '@/components/feedback/error-state';
import { StatTile } from '@/components/data/stat-tile';
import { PageHeader } from '@/components/layout/page-header';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { useAnalyticsOverview } from '@/features/analytics/api/queries';
import { useSession } from '@/lib/auth/session-store';
import { formatHours, formatNumber, toPercent } from '@/lib/utils/format';
import { MACHINE_STATES, MachineState } from '@/types/machine';
import { MaintenanceWork } from './maintenance-work';
import { NeedsAttention } from './needs-attention';
import { QuickActions } from './quick-actions';
import { RecentActivity } from './recent-activity';
import { getStateCounts, StatusDistribution } from './status-distribution';

const RANGE = { days: 30 } as const;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView() {
  const firstName = useSession((state) => state.user?.fullName.split(' ')[0] ?? '');
  const overview = useAnalyticsOverview(RANGE);
  const data = overview.data;
  const loading = overview.isPending;
  const counts = data ? getStateCounts(data.machines) : null;
  const countFor = (state: MachineState) => counts?.find((row) => row.state === state)?.count ?? 0;
  const fleetTotal = counts?.reduce((sum, row) => sum + row.count, 0) ?? 0;

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
        {MACHINE_STATES.map((state) => {
          const config = MACHINE_STATE_CONFIG[state];
          const count = countFor(state);
          return (
            <StatTile
              key={state}
              label={config.label}
              icon={config.icon}
              tone={config.tone}
              value={formatNumber(count)}
              caption={`${toPercent(count, fleetTotal)}% of fleet`}
              href={`${ROUTES.machines}?status=${state}`}
              loading={loading}
              emphasized={state === MachineState.DOWNTIME && count > 0}
            />
          );
        })}
      </section>

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
          <NeedsAttention downtimeCount={data?.machines.downtime} maintenanceCount={data?.machines.underMaintenance} />
        </div>
        <StatusDistribution machines={data?.machines} loading={loading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity />
        <MaintenanceWork openCount={data?.logs.currentlyOpen} />
      </div>
    </>
  );
}
