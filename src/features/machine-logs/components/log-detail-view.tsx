'use client';

import { ArrowDown, Factory, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { LogSubjectBadge } from '@/components/status/log-subject';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { OperationalImpactBadge } from '@/components/status/part-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { useMachinePartHistory } from '@/features/machine-parts/api/queries';
import { useMachineHistoryPage } from '@/features/machines/api/queries';
import { isApiError } from '@/lib/api/errors';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelativeTime, hoursBetween } from '@/lib/utils/date';
import { formatHours } from '@/lib/utils/format';
import { LogScope, type MachineLog } from '@/types/machine-log';
import { useMachineLog } from '../api/queries';
import { buildStateJourney } from '../lib/journey';
import { DeleteLogDialog } from './delete-log-dialog';

const JOURNEY_PAGE_SIZE = 20;

const empty = (text: string) => <span className="text-muted">{text}</span>;

const JOURNEY_PARAMS = { page: 1, limit: JOURNEY_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' } as const;

/** The subject's own path: the part's history for a part log, whole-machine logs otherwise. */
function StateJourneyCard({ log }: { log: MachineLog }) {
  const part = log.scope === LogScope.PART ? log.machinePart : null;
  const partHistory = useMachinePartHistory(part?.id ?? 0, JOURNEY_PARAMS);
  const machineHistory = useMachineHistoryPage(part ? 0 : log.machine.id, { ...JOURNEY_PARAMS, scope: LogScope.MACHINE });
  const history = part ? partHistory : machineHistory;

  return (
    <Card>
      <CardHeader
        title="State journey"
        description={part ? `How ${part.name}'s state moved from this log onward` : "How the machine's system state moved from this log onward"}
      />
      <CardContent>
        {history.isPending ? (
          <LoadingRegion label="Loading state journey" className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-40" />
          </LoadingRegion>
        ) : (
          (() => {
            const items = history.data?.items ?? [];
            const complete = history.data ? history.data.meta.totalPages <= 1 : false;
            const journey = buildStateJourney(log, items, complete);
            return (
              <>
                <ol className="flex flex-col">
                  {journey.steps.map((step, index) => (
                    <li key={`${step.state}-${step.log?.id ?? 'start'}`} className="flex flex-col">
                      {index > 0 ? <ArrowDown className="my-1 ml-2 size-3.5 text-muted" aria-label="then" /> : null}
                      <div className={cn('flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5', step.isCurrentLog && 'bg-steel-soft')}>
                        <MachineStateBadge state={step.state} size="sm" />
                        <span className="text-xs text-muted">
                          {step.log === null ? (
                            'Before this log'
                          ) : step.isCurrentLog ? (
                            <span className="font-semibold text-ink">This log</span>
                          ) : (
                            <Link href={ROUTES.log(step.log.id)} className="hover:underline">
                              Log #{step.log.id} · {step.log.technician.fullName} · {formatRelativeTime(step.log.createdAt)}
                            </Link>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                {history.isError ? <p className="mt-3 text-xs text-muted">Later events couldn&apos;t be loaded.</p> : null}
                {journey.hasMore ? (
                  <Link
                    href={part ? ROUTES.machinePart(log.machine.id, part.id) : ROUTES.machine(log.machine.id)}
                    className="mt-3 inline-block text-xs font-medium text-info-ink hover:underline"
                  >
                    {part ? 'See full part history' : 'See full machine history'}
                  </Link>
                ) : null}
              </>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

export function LogDetailView({ logId }: { logId: number }) {
  const router = useRouter();
  const logQuery = useMachineLog(logId);
  const { can } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (logQuery.isPending) {
    return (
      <LoadingRegion label="Loading log">
        <Skeleton className="mb-2 h-3 w-40" />
        <Skeleton className="mb-6 h-7 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </LoadingRegion>
    );
  }
  if (logQuery.isError) {
    return (
      <Card>
        {isApiError(logQuery.error) && logQuery.error.status === 404 ? (
          <NotFoundState title="Log not found" description="This log doesn't exist or has been deleted." backHref={ROUTES.logs} backLabel="Back to logs" />
        ) : (
          <ErrorState error={logQuery.error} onRetry={() => void logQuery.refetch()} isRetrying={logQuery.isFetching} />
        )}
      </Card>
    );
  }

  const log = logQuery.data;
  const duration = hoursBetween(log.startedAt, log.endedAt);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Machine Logs', href: ROUTES.logs }, { label: `Log #${log.id}` }]}
        title={log.machine.name}
        meta={
          <>
            <LogSubjectBadge log={log} size="md" />
            <LogStatusBadge status={log.logStatus} />
          </>
        }
        description={`Log #${log.id} · recorded by ${log.technician.fullName} on ${formatDateTime(log.createdAt)}`}
        actions={
          <>
            <Link href={ROUTES.machine(log.machine.id)} className={buttonVariants({ variant: 'secondary' })}>
              <Factory className="size-4" aria-hidden />
              View machine
            </Link>
            {can(Permission.UPDATE_LOGS) ? (
              <Link href={ROUTES.editLog(log.id)} className={buttonVariants({ variant: 'secondary' })}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            ) : null}
            {can(Permission.DELETE_LOGS) ? (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Event" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Fault', value: log.faultDescription },
                  { label: 'Cause', value: log.causeDescription ?? empty('Not recorded') },
                  { label: 'Remedy / action taken', value: log.remedyAction ?? empty('Not recorded') },
                  { label: 'Next maintenance plan', value: log.nextMaintenancePlan ?? empty('None planned') },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Timing" />
            <CardContent>
              <DetailList
                items={[
                  { label: 'Started at', value: formatDateTime(log.startedAt) },
                  { label: 'Ended at', value: log.endedAt ? formatDateTime(log.endedAt) : empty('Ongoing') },
                  {
                    label: 'Duration',
                    value: duration !== null ? formatHours(duration) : empty(`Ongoing, started ${formatRelativeTime(log.startedAt)}`),
                  },
                  { label: 'Downtime', value: formatHours(log.downtimeHours) },
                  { label: 'Created at', value: formatDateTime(log.createdAt) },
                  { label: 'Updated at', value: formatDateTime(log.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="State transition"
              description={log.machinePart ? `State of ${log.machinePart.name}` : "The machine's system state"}
            />
            <CardContent>
              <div className="flex flex-col items-start">
                <p className="text-xs text-muted">State before</p>
                <div className="mt-1">
                  <MachineStateBadge state={log.entryStatus} />
                </div>
                <ArrowDown className="my-2 ml-3 size-4 text-muted" aria-label="changed to" />
                <p className="text-xs text-muted">New state</p>
                <div className="mt-1">
                  <MachineStateBadge state={log.resultingState} />
                </div>
                {log.operationalImpact ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    Operational impact <OperationalImpactBadge impact={log.operationalImpact} size="sm" />
                  </div>
                ) : null}
              </div>
              <dl className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-3 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <dt>Machine status at this event</dt>
                  <dd>
                    <StateTransition from={log.machineStatusBefore} to={log.machineStatusAfter} />
                  </dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt>Machine is currently</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    <MachineStateBadge state={log.machine.status} size="sm" />
                    <OperationalStatusBadge status={log.machine.operationalStatus} size="sm" />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <StateJourneyCard log={log} />

          <Card>
            <CardHeader title="Record" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  {
                    label: 'Machine',
                    value: (
                      <Link href={ROUTES.machine(log.machine.id)} className="hover:underline">
                        {log.machine.name} <span className="font-mono text-xs text-muted">{log.machine.serialNumber}</span>
                      </Link>
                    ),
                  },
                  {
                    label: 'Logged against',
                    value: log.machinePart ? (
                      <Link href={ROUTES.machinePart(log.machine.id, log.machinePart.id)} className="hover:underline">
                        <LogSubjectBadge log={log} />
                      </Link>
                    ) : (
                      <LogSubjectBadge log={log} />
                    ),
                  },
                  {
                    label: 'Technician',
                    value: `${log.technician.fullName}${log.technician.position ? ` · ${log.technician.position}` : ''}`,
                  },
                  { label: 'Log status', value: <LogStatusBadge status={log.logStatus} size="sm" /> },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {can(Permission.DELETE_LOGS) ? (
        <DeleteLogDialog log={log} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={() => router.replace(ROUTES.logs)} />
      ) : null}
    </>
  );
}
