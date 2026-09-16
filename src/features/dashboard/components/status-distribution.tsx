import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { formatNumber, toPercent } from '@/lib/utils/format';
import { type AnalyticsOverview } from '@/types/analytics';
import { MACHINE_STATES, MachineState } from '@/types/machine';
import Link from 'next/link';

const COUNT_KEYS: Record<MachineState, keyof AnalyticsOverview['machines']> = {
  [MachineState.ACTIVE]: 'active',
  [MachineState.UNDER_MAINTENANCE]: 'underMaintenance',
  [MachineState.DOWNTIME]: 'downtime',
  [MachineState.UNDER_TEST]: 'underTest',
};

export function getStateCounts(machines: AnalyticsOverview['machines']) {
  const counted = MACHINE_STATES.reduce((sum, state) => sum + machines[COUNT_KEYS[state]], 0);
  return MACHINE_STATES.map((state) => ({
    state,
    count: machines[COUNT_KEYS[state]],
    percent: toPercent(machines[COUNT_KEYS[state]], counted),
  }));
}

/**
 * Part-to-whole of the fleet by state: a single stacked bar with 2px gaps between segments, plus a
 * legend that lists every value (the bar's table view). Status colours always sit beside a text label.
 */
export function StatusDistribution({ machines, loading }: { machines: AnalyticsOverview['machines'] | undefined; loading: boolean }) {
  const rows = machines ? getStateCounts(machines) : [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const summary = rows.map((row) => `${MACHINE_STATE_CONFIG[row.state].label} ${row.count}`).join(', ');

  return (
    <Card>
      <CardHeader title="Machine status distribution" description="Current state of the fleet" />
      <CardContent>
        {loading || !machines ? (
          <LoadingRegion label="Loading status distribution">
            <Skeleton className="h-3 w-full" />
            <div className="mt-4 space-y-3">
              {MACHINE_STATES.map((state) => (
                <Skeleton key={state} className="h-4 w-full" />
              ))}
            </div>
          </LoadingRegion>
        ) : (
          <>
            <div role="img" aria-label={total > 0 ? `Fleet status: ${summary}` : 'No machines yet'} className="flex h-3 w-full gap-[2px] overflow-hidden rounded-sm bg-line-soft">
              {rows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <div
                    key={row.state}
                    className="h-full first:rounded-l-sm last:rounded-r-sm"
                    style={{ flexGrow: row.count, flexBasis: 0, backgroundColor: MACHINE_STATE_CONFIG[row.state].chartColor }}
                    title={`${MACHINE_STATE_CONFIG[row.state].label}: ${row.count}`}
                  />
                ))}
            </div>
            <ul className="mt-4 divide-y divide-line-soft">
              {rows.map((row) => {
                const config = MACHINE_STATE_CONFIG[row.state];
                const Icon = config.icon;
                return (
                  <li key={row.state}>
                    <Link
                      href={`${ROUTES.machines}?status=${row.state}`}
                      className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-hover"
                    >
                      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: config.chartColor }} aria-hidden />
                      <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                      <span className="flex-1 text-ink">{config.label}</span>
                      <span className="font-semibold text-ink tabular-nums">{formatNumber(row.count)}</span>
                      <span className="w-10 text-right text-xs text-muted tabular-nums">{row.percent}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {machines.inactive > 0 ? (
              <p className="mt-3 text-xs text-muted">
                {formatNumber(machines.inactive)} deactivated {machines.inactive === 1 ? 'machine is' : 'machines are'} not counted.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
