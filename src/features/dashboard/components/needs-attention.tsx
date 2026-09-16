'use client';

import { ChevronRight, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { useMachines } from '@/features/machines/api/queries';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime } from '@/lib/utils/date';
import { formatNumber, pluralize } from '@/lib/utils/format';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type ListMachinesParams, type Machine, MachineState } from '@/types/machine';

const BASE_PARAMS: ListMachinesParams = { limit: 5, page: 1, isActive: true, sortBy: 'updatedAt', sortOrder: 'desc' };

function AttentionRow({ machine }: { machine: Machine }) {
  const highlighted = useRealtimeStore((state) => machine.id in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);
  return (
    <li className={cn(highlighted && 'animate-row-flash')} onAnimationEnd={() => clearHighlight(machine.id)}>
      <Link href={ROUTES.machine(machine.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-hover">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{machine.name}</p>
          <p className="truncate text-xs text-muted">
            <span className="font-mono">{machine.serialNumber}</span> · updated {formatRelativeTime(machine.updatedAt)}
            {machine.activity.openLogs > 0 ? ` · ${pluralize(machine.activity.openLogs, 'open log')}` : ''}
          </p>
        </div>
        <MachineStateBadge state={machine.status} size="sm" />
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Machines that are down or being repaired, most recently changed first. */
export function NeedsAttention({ downtimeCount, maintenanceCount }: { downtimeCount?: number; maintenanceCount?: number }) {
  const downtime = useMachines({ ...BASE_PARAMS, status: MachineState.DOWNTIME });
  const maintenance = useMachines({ ...BASE_PARAMS, status: MachineState.UNDER_MAINTENANCE });

  const machines = [...(downtime.data?.items ?? []), ...(maintenance.data?.items ?? [])];
  const isLoading = downtime.isPending || maintenance.isPending;
  const error = downtime.error ?? maintenance.error;
  const totalDown = downtimeCount ?? downtime.data?.meta.totalItems ?? 0;
  const totalMaintenance = maintenanceCount ?? maintenance.data?.meta.totalItems ?? 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Needs attention"
        description={
          isLoading
            ? 'Machines in downtime or under maintenance'
            : `${pluralize(totalDown, 'machine')} in downtime · ${formatNumber(totalMaintenance)} under maintenance`
        }
        actions={
          <Link href={`${ROUTES.machines}?status=${MachineState.DOWNTIME}`} className="text-xs font-medium text-info-ink hover:underline">
            View all
          </Link>
        }
      />
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState
          compact
          error={error}
          onRetry={() => {
            void downtime.refetch();
            void maintenance.refetch();
          }}
        />
      ) : machines.length === 0 ? (
        <EmptyState compact icon={CircleCheck} title="No machines need attention" description="Nothing is in downtime or under maintenance right now." />
      ) : (
        <ul className="divide-y divide-line-soft">
          {machines.map((machine) => (
            <AttentionRow key={machine.id} machine={machine} />
          ))}
        </ul>
      )}
    </Card>
  );
}
