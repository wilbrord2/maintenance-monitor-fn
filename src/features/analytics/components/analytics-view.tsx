'use client';

import { CalendarRange, CircleCheckBig, CircleDashed, ClipboardList, Factory, Timer } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { StatTile } from '@/components/data/stat-tile';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { SERIES_COLORS } from '@/constants/chart-colors';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { getStateCounts } from '@/features/dashboard/components/status-distribution';
import { useUrlState } from '@/hooks/use-url-state';
import { formatDate, formatRelativeTime } from '@/lib/utils/date';
import { formatHours, formatNumber, pluralize, toPercent } from '@/lib/utils/format';
import { MACHINE_STATES } from '@/types/machine';
import {
  useAnalyticsOverview,
  useDowntimeAnalytics,
  useFaultAnalytics,
  useMaintenanceEventsAnalytics,
  useTechnicianAnalytics,
} from '../api/queries';
import { describeTimeframe, parseTimeframe } from '../lib/timeframe';
import { ChartCard } from './chart-card';
import { ProportionMeter } from './proportion-meter';
import { TimeframeFilter } from './timeframe-filter';

/** Charts load on demand so the charting library stays out of the initial bundle. */
const HorizontalBarChart = dynamic(() => import('./charts/horizontal-bar-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

const TOP_LIMIT = 10;
const OPEN_CLOSED_SERIES = [
  { key: 'open', label: 'Open', color: SERIES_COLORS.primary },
  { key: 'closed', label: 'Closed', color: SERIES_COLORS.muted },
];

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-7 first:mt-0">
      <div className="mb-3">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

const count = (value: number) => formatNumber(value);

export function AnalyticsView() {
  const { searchParams, setParams } = useUrlState();
  const [today] = useState(() => formatTodayIso());
  const timeframe = parseTimeframe(searchParams, today);
  const enabled = !timeframe.error;
  const top = { ...timeframe.range, limit: TOP_LIMIT };

  const overview = useAnalyticsOverview(timeframe.range, { enabled });
  const downtime = useDowntimeAnalytics(top, { enabled });
  const events = useMaintenanceEventsAnalytics(top, { enabled });
  const technicians = useTechnicianAnalytics(top, { enabled });
  const faults = useFaultAnalytics({ ...top, minOccurrences: 2 }, { enabled });

  const rangeLabel = describeTimeframe(timeframe);
  const machines = overview.data?.machines;
  const stateCounts = machines ? getStateCounts(machines) : [];
  const fleetTotal = stateCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <PageHeader title="Analytics" description="Fleet condition, maintenance workload, downtime and recurring faults." />

      <TimeframeFilter
        timeframe={timeframe}
        today={today}
        label={rangeLabel}
        onPreset={(preset) => setParams({ range: preset === '30' ? null : preset, from: null, to: null })}
        onCustomRange={(from, to) => setParams({ range: 'custom', from, to })}
      />

      {timeframe.error ? (
        <Card>
          <EmptyState icon={CalendarRange} title="Choose a valid date range" description={`${timeframe.error}.`} />
        </Card>
      ) : (
        <>
          <Section id="fleet-overview" title="Machine overview" description="Current fleet state — not limited to the selected timeframe">
            {overview.isError && !overview.data ? (
              <Card>
                <ErrorState compact error={overview.error} onRetry={() => void overview.refetch()} />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <StatTile label="Total machines" icon={Factory} value={count(fleetTotal)} loading={overview.isPending} href={ROUTES.machines} className="col-span-2 md:col-span-1" />
                {MACHINE_STATES.map((state) => {
                  const config = MACHINE_STATE_CONFIG[state];
                  const value = stateCounts.find((row) => row.state === state)?.count ?? 0;
                  return (
                    <StatTile
                      key={state}
                      label={config.label}
                      icon={config.icon}
                      tone={config.tone}
                      value={count(value)}
                      caption={`${toPercent(value, fleetTotal)}% of fleet`}
                      loading={overview.isPending}
                      href={`${ROUTES.machines}?status=${state}`}
                    />
                  );
                })}
              </div>
            )}
          </Section>

          <Section id="maintenance" title="Maintenance analytics" description={`Logs started in ${rangeLabel.toLowerCase()}`}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Maintenance events" icon={ClipboardList} value={count(overview.data?.logs.total ?? 0)} loading={overview.isPending} />
                  <StatTile label="Downtime" icon={Timer} value={formatHours(overview.data?.totalDowntimeHours ?? 0)} loading={overview.isPending} />
                  <StatTile label="Open" icon={CircleDashed} value={count(overview.data?.logs.open ?? 0)} caption="Started in range, still open" loading={overview.isPending} />
                  <StatTile label="Closed" icon={CircleCheckBig} value={count(overview.data?.logs.closed ?? 0)} loading={overview.isPending} />
                </div>
                <Card className="p-4">
                  <p className="mb-3 text-xs font-semibold text-ink-secondary">Open vs closed logs</p>
                  {overview.data ? (
                    <ProportionMeter
                      label="Open versus closed logs"
                      parts={[
                        { label: 'Open', value: overview.data.logs.open, color: SERIES_COLORS.primary },
                        { label: 'Closed', value: overview.data.logs.closed, color: SERIES_COLORS.muted },
                      ]}
                    />
                  ) : (
                    <ChartSkeleton height={24} />
                  )}
                </Card>
              </div>

              <ChartCard
                className="xl:col-span-2"
                title="Maintenance events by machine"
                description={`Top ${TOP_LIMIT} machines by number of events`}
                isLoading={events.isPending}
                isFetching={events.isFetching}
                error={events.error}
                onRetry={() => void events.refetch()}
                isEmpty={(events.data?.byMachine.length ?? 0) === 0}
                emptyTitle="No maintenance events in this timeframe"
                emptyDescription="Try a longer timeframe."
                chart={
                  <HorizontalBarChart
                    summary={`Maintenance events by machine, ${rangeLabel}`}
                    formatValue={count}
                    integerValues
                    series={OPEN_CLOSED_SERIES}
                    data={(events.data?.byMachine ?? []).map((row) => ({
                      id: String(row.machine.id),
                      label: row.machine.name,
                      values: { open: row.openEvents, closed: row.closedEvents },
                    }))}
                  />
                }
                table={
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>Machine</TableHeaderCell>
                        <TableHeaderCell className="text-right">Events</TableHeaderCell>
                        <TableHeaderCell className="text-right">Open</TableHeaderCell>
                        <TableHeaderCell className="text-right">Closed</TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {(events.data?.byMachine ?? []).map((row) => (
                        <TableRow key={row.machine.id}>
                          <TableCell>
                            <MachineLink machine={row.machine} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{count(row.totalEvents)}</TableCell>
                          <TableCell className="text-right tabular-nums">{count(row.openEvents)}</TableCell>
                          <TableCell className="text-right tabular-nums">{count(row.closedEvents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                }
              />
            </div>
          </Section>

          <Section id="performance" title="Machine performance" description="Where downtime is concentrated">
            <ChartCard
              title="Downtime by machine"
              description={
                downtime.data ? `${formatHours(downtime.data.totalDowntimeHours)} in total · top ${TOP_LIMIT} machines` : `Top ${TOP_LIMIT} machines`
              }
              isLoading={downtime.isPending}
              isFetching={downtime.isFetching}
              error={downtime.error}
              onRetry={() => void downtime.refetch()}
              isEmpty={(downtime.data?.byMachine.length ?? 0) === 0}
              emptyTitle="No downtime recorded in this timeframe"
              chart={
                <HorizontalBarChart
                  summary={`Downtime hours by machine, ${rangeLabel}`}
                  formatValue={formatHours}
                  series={[{ key: 'downtime', label: 'Downtime', color: SERIES_COLORS.primary }]}
                  data={(downtime.data?.byMachine ?? []).map((row) => ({
                    id: String(row.machine.id),
                    label: row.machine.name,
                    values: { downtime: row.downtimeHours },
                  }))}
                />
              }
              table={
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>Machine</TableHeaderCell>
                      <TableHeaderCell className="text-right">Downtime</TableHeaderCell>
                      <TableHeaderCell className="text-right">Events</TableHeaderCell>
                      <TableHeaderCell className="text-right">Share</TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {(downtime.data?.byMachine ?? []).map((row) => (
                      <TableRow key={row.machine.id}>
                        <TableCell>
                          <MachineLink machine={row.machine} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(row.downtimeHours)}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(row.events)}</TableCell>
                        <TableCell className="text-right text-muted tabular-nums">
                          {toPercent(row.downtimeHours, downtime.data?.totalDowntimeHours ?? 0)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            />
          </Section>

          <Section id="technicians" title="Technician activity" description={`Logs recorded per technician in ${rangeLabel.toLowerCase()}`}>
            <ChartCard
              title="Logs by technician"
              description={`Top ${TOP_LIMIT} technicians by logs recorded`}
              isLoading={technicians.isPending}
              isFetching={technicians.isFetching}
              error={technicians.error}
              onRetry={() => void technicians.refetch()}
              isEmpty={(technicians.data?.byTechnician.length ?? 0) === 0}
              emptyTitle="No logs recorded in this timeframe"
              chart={
                <HorizontalBarChart
                  summary={`Logs recorded per technician, ${rangeLabel}`}
                  formatValue={count}
                  integerValues
                  series={OPEN_CLOSED_SERIES}
                  data={(technicians.data?.byTechnician ?? []).map((row) => ({
                    id: String(row.technician.id),
                    label: row.technician.fullName,
                    values: { open: row.openLogs, closed: row.closedLogs },
                  }))}
                />
              }
              table={
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>Technician</TableHeaderCell>
                      <TableHeaderCell className="text-right">Logs</TableHeaderCell>
                      <TableHeaderCell className="text-right">Open</TableHeaderCell>
                      <TableHeaderCell className="text-right">Closed</TableHeaderCell>
                      <TableHeaderCell className="text-right">Downtime</TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {(technicians.data?.byTechnician ?? []).map((row) => (
                      <TableRow key={row.technician.id}>
                        <TableCell>
                          <p className="font-medium text-ink">{row.technician.fullName}</p>
                          {row.technician.position ? <p className="text-xs text-muted">{row.technician.position}</p> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{count(row.totalLogs)}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(row.openLogs)}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(row.closedLogs)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(row.downtimeHours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            />
          </Section>

          <Section id="faults" title="Fault analysis" description="Most frequent fault descriptions and issues that keep coming back">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Most common faults" description="Similar descriptions are grouped" />
                {faults.isPending ? (
                  <TableSkeleton rows={5} columns={3} />
                ) : faults.isError && !faults.data ? (
                  <ErrorState compact error={faults.error} onRetry={() => void faults.refetch()} />
                ) : (faults.data?.commonFaults.length ?? 0) === 0 ? (
                  <EmptyState compact title="No faults recorded in this timeframe" />
                ) : (
                  <FaultsTable faults={faults.data?.commonFaults ?? []} />
                )}
              </Card>
              <Card>
                <CardHeader title="Recurring issues" description="The same fault reported at least twice on one machine" />
                {faults.isPending ? (
                  <TableSkeleton rows={5} columns={3} />
                ) : faults.isError && !faults.data ? (
                  <ErrorState compact error={faults.error} onRetry={() => void faults.refetch()} />
                ) : (faults.data?.recurringIssues.length ?? 0) === 0 ? (
                  <EmptyState compact title="No recurring issues" description="No fault was reported more than once on the same machine." />
                ) : (
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>Machine</TableHeaderCell>
                        <TableHeaderCell>Fault</TableHeaderCell>
                        <TableHeaderCell className="text-right">Times</TableHeaderCell>
                        <TableHeaderCell>Period</TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {(faults.data?.recurringIssues ?? []).map((issue) => (
                        <TableRow key={`${issue.machine.id}-${issue.fault}`}>
                          <TableCell className="whitespace-nowrap">
                            <MachineLink machine={issue.machine} />
                          </TableCell>
                          <TableCell className="max-w-64">
                            <p className="line-clamp-2 first-letter:uppercase">{issue.fault}</p>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{count(issue.occurrences)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted">
                            {formatDate(issue.firstSeenAt)} – {formatDate(issue.lastSeenAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </Section>
        </>
      )}
    </>
  );
}

function MachineLink({ machine }: { machine: { id: number; name: string; serialNumber: string } }) {
  return (
    <Link href={ROUTES.machine(machine.id)} className="font-medium text-ink hover:underline">
      {machine.name}
      <span className="ml-1.5 font-mono text-[11px] font-normal text-muted">{machine.serialNumber}</span>
    </Link>
  );
}

function FaultsTable({ faults }: { faults: ReadonlyArray<{ fault: string; occurrences: number; machinesAffected: number; lastSeenAt: string }> }) {
  const max = Math.max(...faults.map((fault) => fault.occurrences), 1);
  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Fault</TableHeaderCell>
          <TableHeaderCell>Occurrences</TableHeaderCell>
          <TableHeaderCell className="text-right">Machines</TableHeaderCell>
          <TableHeaderCell>Last seen</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {faults.map((fault) => (
          <TableRow key={fault.fault}>
            <TableCell className="max-w-64">
              <p className="line-clamp-2 first-letter:uppercase">{fault.fault}</p>
            </TableCell>
            <TableCell className="min-w-32">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-sm bg-line-soft" aria-hidden>
                  <div className="h-full rounded-sm" style={{ width: `${(fault.occurrences / max) * 100}%`, backgroundColor: SERIES_COLORS.primary }} />
                </div>
                <span className="w-8 text-right font-semibold tabular-nums">{count(fault.occurrences)}</span>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums" title={pluralize(fault.machinesAffected, 'machine')}>
              {count(fault.machinesAffected)}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap text-muted">{formatRelativeTime(fault.lastSeenAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
