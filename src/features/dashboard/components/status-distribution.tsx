import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { MACHINE_OPERATIONAL_STATUS_CONFIG } from '@/constants/machine-operational-status';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { formatNumber, toPercent } from '@/lib/utils/format';
import { type AnalyticsOverview, type MachineOperationalCounts } from '@/types/analytics';
import {
  MACHINE_OPERATIONAL_STATUSES,
  MACHINE_STATES,
  MachineOperationalStatus,
  MachineState,
} from '@/types/machine';

const COUNT_KEYS: Record<MachineState, keyof AnalyticsOverview['machines']> = {
  [MachineState.ACTIVE]: 'active',
  [MachineState.UNDER_MAINTENANCE]: 'underMaintenance',
  [MachineState.DOWNTIME]: 'downtime',
  [MachineState.UNDER_TEST]: 'underTest',
};

const OPERATIONAL_KEYS: Record<MachineOperationalStatus, keyof MachineOperationalCounts> = {
  [MachineOperationalStatus.OPERATING]: 'operating',
  [MachineOperationalStatus.OPERATING_WITH_DEFECTS]: 'operatingWithDefects',
  [MachineOperationalStatus.NOT_OPERATING]: 'notOperating',
};

/** Counts by effective machine status (`Machine.status`), as the API reported them. */
export function getStateCounts(machines: AnalyticsOverview['machines']) {
  const counted = MACHINE_STATES.reduce((sum, state) => sum + machines[COUNT_KEYS[state]], 0);
  return MACHINE_STATES.map((state) => ({
    state,
    count: machines[COUNT_KEYS[state]],
    percent: toPercent(machines[COUNT_KEYS[state]], counted),
  }));
}

/** Counts by resolved operational status, exactly as the API reported them. */
export function getOperationalCounts(counts: MachineOperationalCounts) {
  const total = MACHINE_OPERATIONAL_STATUSES.reduce((sum, status) => sum + counts[OPERATIONAL_KEYS[status]], 0);
  return MACHINE_OPERATIONAL_STATUSES.map((status) => ({
    status,
    count: counts[OPERATIONAL_KEYS[status]],
    percent: toPercent(counts[OPERATIONAL_KEYS[status]], total),
  }));
}

export interface StatusDistributionProps {
  overview: AnalyticsOverview | undefined;
  loading: boolean;
}

/**
 * Part-to-whole of the fleet by operational status: a single stacked bar with 2px gaps, plus a
 * legend that lists every value (the bar's table view). Status colours always sit beside a label.
 *
 * The figures come from the API, which resolves each machine's status from its parts.
 */
export function StatusDistribution({ overview, loading }: StatusDistributionProps) {
  const rows = overview ? getOperationalCounts(overview.machineOperational) : [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const summary = rows.map((row) => `${MACHINE_OPERATIONAL_STATUS_CONFIG[row.status].label} ${row.count}`).join(', ');
  const workflow = overview ? getStateCounts(overview.machines) : [];

  return (
    <Card>
      <CardHeader title="Machine status distribution" description="Current operating state of the fleet" />
      <CardContent>
        {loading || !overview ? (
          <LoadingRegion label="Loading status distribution">
            <Skeleton className="h-3 w-full" />
            <div className="mt-4 space-y-3">
              {MACHINE_OPERATIONAL_STATUSES.map((status) => (
                <Skeleton key={status} className="h-4 w-full" />
              ))}
            </div>
          </LoadingRegion>
        ) : (
          <>
            <div
              role="img"
              aria-label={total > 0 ? `Fleet status: ${summary}` : 'No machines yet'}
              className="flex h-3 w-full gap-[2px] overflow-hidden rounded-sm bg-line-soft"
            >
              {rows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <div
                    key={row.status}
                    className="h-full first:rounded-l-sm last:rounded-r-sm"
                    style={{
                      flexGrow: row.count,
                      flexBasis: 0,
                      backgroundColor: MACHINE_OPERATIONAL_STATUS_CONFIG[row.status].chartColor,
                    }}
                    title={`${MACHINE_OPERATIONAL_STATUS_CONFIG[row.status].label}: ${row.count}`}
                  />
                ))}
            </div>
            <ul className="mt-4 divide-y divide-line-soft">
              {rows.map((row) => {
                const config = MACHINE_OPERATIONAL_STATUS_CONFIG[row.status];
                const Icon = config.icon;
                return (
                  <li key={row.status}>
                    <Link
                      href={`${ROUTES.machines}?status=${row.status}`}
                      className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-hover"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: config.chartColor }}
                        aria-hidden
                      />
                      <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                      <span className="flex-1 text-ink">{config.label}</span>
                      <span className="font-semibold text-ink tabular-nums">{formatNumber(row.count)}</span>
                      <span className="w-10 text-right text-xs text-muted tabular-nums">{row.percent}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-line-soft pt-3">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">By status</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {workflow
                  .filter((row) => row.count > 0)
                  .map((row) => (
                    <li key={row.state}>
                      <Link
                        href={`${ROUTES.machines}?workflow=${row.state}`}
                        className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink hover:underline"
                      >
                        <span
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: MACHINE_STATE_CONFIG[row.state].chartColor }}
                          aria-hidden
                        />
                        {MACHINE_STATE_CONFIG[row.state].label}
                        <span className="font-semibold tabular-nums">{formatNumber(row.count)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {overview.machines.inactive > 0 ? (
              <p className="mt-3 text-xs text-muted">
                {formatNumber(overview.machines.inactive)} deactivated{' '}
                {overview.machines.inactive === 1 ? 'machine is' : 'machines are'} not counted.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
