'use client';

import { ClipboardPlus, Ellipsis, Info, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { MACHINE_OPERATIONAL_STATUS_CONFIG } from '@/constants/machine-operational-status';
import { describeDaysUntilDue } from '@/constants/maintenance';
import { buildCreateLogUrl, ROUTES } from '@/constants/routes';
import { TONE_CLASSES } from '@/constants/tones';
import { isApiError } from '@/lib/api/errors';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { useRealtimeStore } from '@/stores/realtime-store';
import { PartsSection } from '@/features/machine-parts/components/parts-section';
import { summarizeSchedules } from '@/features/maintenance/lib/attention';
import { MaintenancePlanSection } from '@/features/maintenance/components/maintenance-plan-section';
import { type MachineDetail } from '@/types/machine';
import { formatDate } from '@/lib/utils/date';
import { useMachine } from '../api/queries';
import { ActivityTimeline } from './activity-timeline';
import { type MachineDialog, MachineManageDialogs } from './machine-manage-dialogs';
import { MachineStats } from './machine-stats';

/**
 * The machine's statuses exactly as the API derived them. The part counts beside them are context,
 * not a calculation: this screen never works a status out from the parts.
 */
function SystemStatusNote({ machine }: { machine: MachineDetail }) {
  // Only worth showing when parts pull the effective status away from the machine's own state.
  if (machine.systemStatus === machine.status) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      System status
      <MachineStateBadge state={machine.systemStatus} size="sm" />
      <Tooltip content="The machine itself is in this state, but one or more of its parts are in a more severe state, so they set the effective status.">
        <button type="button" className="inline-flex text-muted hover:text-ink" aria-label="Why the system status differs">
          <Info className="size-3.5" aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
}

function OperationalStatusCard({ machine }: { machine: MachineDetail }) {
  const config = MACHINE_OPERATIONAL_STATUS_CONFIG[machine.operationalStatus];
  const Icon = config.icon;
  const tone = TONE_CLASSES[config.tone];
  const highlighted = useRealtimeStore((state) => machine.id in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);

  const partsCaption =
    machine.parts.total === 0
      ? 'No parts configured'
      : machine.parts.blocking > 0
        ? `${machine.parts.blocking} of ${machine.parts.total} parts blocking`
        : machine.parts.total - machine.parts.active > 0
          ? `${machine.parts.total - machine.parts.active} of ${machine.parts.total} parts need attention`
          : `All ${machine.parts.total} parts active`;

  return (
    <Card className={cn('overflow-hidden', highlighted && 'animate-row-flash')} onAnimationEnd={() => clearHighlight(machine.id)}>
      <div className={cn('flex flex-col gap-4 border-l-4 p-5 sm:flex-row sm:items-center', tone.accent)}>
        <span className={cn('inline-flex size-14 shrink-0 items-center justify-center rounded-lg border', tone.badge)}>
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Machine status</p>
          <p className={cn('mt-0.5 text-2xl font-semibold tracking-tight', tone.text)}>{config.label}</p>
          <p className="text-[13px] text-muted">
            {partsCaption} · updated {formatRelativeTime(machine.updatedAt)}
          </p>
        </div>
        <LiveIndicator />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-sunken px-5 py-2.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          Status
          <MachineStateBadge state={machine.status} size="sm" />
        </span>
        <SystemStatusNote machine={machine} />
        <MaintenanceSummary machine={machine} />
      </div>
    </Card>
  );
}

/**
 * The most urgent maintenance task, as context beside the status. The state is the API's; a machine
 * with overdue maintenance keeps whatever status its logs and parts give it.
 */
function MaintenanceSummary({ machine }: { machine: MachineDetail }) {
  const summary = summarizeSchedules(machine.maintenanceSchedules);
  if (!summary.next) return null;
  const late = summary.overdue + summary.due;
  return (
    <a href="#maintenance" className="inline-flex items-center gap-1.5 hover:text-ink">
      Preventive maintenance
      <MaintenanceStateBadge state={summary.next.state} size="sm" />
      <span>
        {late > 1
          ? `${late} tasks need attention`
          : `${summary.next.taskName} ${describeDaysUntilDue(summary.next.daysUntilDue).toLowerCase()}`}
      </span>
    </a>
  );
}

function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading machine">
      <Skeleton className="mb-2 h-3 w-40" />
      <Skeleton className="mb-6 h-7 w-64" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-28 lg:col-span-2" />
        <Skeleton className="h-64 lg:row-span-2" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
    </LoadingRegion>
  );
}

export function MachineDetailView({ machineId }: { machineId: number }) {
  const router = useRouter();
  const machineQuery = useMachine(machineId);
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<MachineDialog>(null);

  if (machineQuery.isPending) return <DetailSkeleton />;
  if (machineQuery.isError) {
    if (isApiError(machineQuery.error) && machineQuery.error.status === 404) {
      return (
        <Card>
          <NotFoundState
            title="Machine not found"
            description="This machine doesn't exist or has been deleted."
            backHref={ROUTES.machines}
            backLabel="Back to machines"
          />
        </Card>
      );
    }
    return (
      <Card>
        <ErrorState error={machineQuery.error} onRetry={() => void machineQuery.refetch()} isRetrying={machineQuery.isFetching} />
      </Card>
    );
  }

  const machine = machineQuery.data;
  const nextTask = summarizeSchedules(machine.maintenanceSchedules).next;
  const canManage = can(Permission.MANAGE_MACHINES);
  const canRecord = can(Permission.CREATE_LOGS);

  const recordButton = canRecord ? (
    machine.isActive ? (
      <Link href={buildCreateLogUrl(machine.id)} className={buttonVariants()}>
        <ClipboardPlus className="size-4" aria-hidden />
        Record activity
      </Link>
    ) : (
      <Button icon={ClipboardPlus} disabled title="Deactivated machines can't receive new logs">
        Record activity
      </Button>
    )
  ) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Machines', href: ROUTES.machines }, { label: machine.name }]}
        title={machine.name}
        meta={
          <>
            <MachineStateBadge state={machine.status} />
            <OperationalStatusBadge status={machine.operationalStatus} />
            {machine.isActive ? null : (
              <Badge tone="neutral" variant="outline">
                Deactivated
              </Badge>
            )}
          </>
        }
        description={<span className="font-mono">{machine.serialNumber}</span>}
        actions={
          <>
            {canManage ? (
              <>
                <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>
                  Edit
                </Button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="More machine actions">
                      <Ellipsis className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {machine.isActive ? (
                      <DropdownMenuItem icon={PowerOff} onSelect={() => setDialog('deactivate')}>
                        Deactivate machine
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem icon={Power} onSelect={() => setDialog('activate')}>
                        Reactivate machine
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => setDialog('delete')}>
                      Delete machine
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
            {recordButton}
          </>
        }
      />

      {machine.isActive ? null : (
        <Alert tone="warning" className="mb-4">
          This machine is deactivated. Its history is available, but new maintenance logs can&apos;t be recorded
          {canManage ? ' until you reactivate it.' : '.'}
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* One cell per column, so the two columns flow independently instead of sharing row heights. */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <OperationalStatusCard machine={machine} />
          <PartsSection machine={machine} />
          <MaintenancePlanSection machine={machine} />
        </div>
        <div className="flex flex-col gap-4">
          <MachineStats machine={machine} />
          <Card>
            <CardHeader title="Machine information" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Name', value: machine.name },
                  { label: 'Serial number', value: <span className="font-mono">{machine.serialNumber}</span> },
                  { label: 'Description', value: machine.description ?? <span className="text-muted">No description</span> },
                  { label: 'Record status', value: machine.isActive ? 'Active' : 'Deactivated' },
                  {
                    label: 'Parts',
                    value:
                      machine.parts.total === 0 ? (
                        <span className="text-muted">None configured</span>
                      ) : (
                        `${machine.parts.total} (${machine.parts.active} active)`
                      ),
                  },
                  {
                    label: 'Next maintenance',
                    value: nextTask ? (
                      `${formatDate(nextTask.nextMaintenanceAt)} · ${nextTask.taskName}`
                    ) : (
                      <span className="text-muted">No active tasks</span>
                    ),
                  },
                  { label: 'Created', value: formatDateTime(machine.createdAt) },
                  { label: 'Last updated', value: formatDateTime(machine.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full width, and last on small screens so the parts and maintenance plan come first. */}
      <div className="mt-4">
        <ActivityTimeline machineId={machine.id} parts={machine.partDetails} emptyAction={machine.isActive ? recordButton : null} />
      </div>

      {canManage ? (
        <MachineManageDialogs
          machine={machine}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDeleted={() => router.replace(ROUTES.machines)}
        />
      ) : null}
    </>
  );
}
