'use client';

import { ClipboardPlus, Ellipsis, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
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
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { buildCreateLogUrl, ROUTES } from '@/constants/routes';
import { TONE_CLASSES } from '@/constants/tones';
import { isApiError } from '@/lib/api/errors';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type Machine } from '@/types/machine';
import { useMachine } from '../api/queries';
import { ActivityTimeline } from './activity-timeline';
import { type MachineDialog, MachineManageDialogs } from './machine-manage-dialogs';
import { MachineStats } from './machine-stats';

function CurrentState({ machine }: { machine: Machine }) {
  const config = MACHINE_STATE_CONFIG[machine.status];
  const Icon = config.icon;
  const tone = TONE_CLASSES[config.tone];
  const highlighted = useRealtimeStore((state) => machine.id in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);

  return (
    <Card className={cn('overflow-hidden', highlighted && 'animate-row-flash')} onAnimationEnd={() => clearHighlight(machine.id)}>
      <div className={cn('flex flex-col gap-4 border-l-4 p-5 sm:flex-row sm:items-center', tone.accent)}>
        <span className={cn('inline-flex size-14 shrink-0 items-center justify-center rounded-lg border', tone.badge)}>
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Current state</p>
          <p className={cn('mt-0.5 text-2xl font-semibold tracking-tight', tone.text)}>{config.label}</p>
          <p className="text-[13px] text-muted">
            {config.description} · updated {formatRelativeTime(machine.updatedAt)}
          </p>
        </div>
        <LiveIndicator />
      </div>
    </Card>
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
        <div className="lg:col-span-2">
          <CurrentState machine={machine} />
        </div>
        <div className="flex flex-col gap-4 lg:row-span-2">
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
                  { label: 'Created', value: formatDateTime(machine.createdAt) },
                  { label: 'Last updated', value: formatDateTime(machine.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <ActivityTimeline machineId={machine.id} emptyAction={machine.isActive ? recordButton : null} />
        </div>
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
