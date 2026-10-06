'use client';

import { ClipboardPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { PageHeader } from '@/components/layout/page-header';
import { OperationalImpactBadge, PartStatusBadge } from '@/components/status/part-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { CRITICALITY_CONFIG, MACHINE_PART_STATUS_CONFIG } from '@/constants/machine-part';
import { buildCreateLogUrl, ROUTES } from '@/constants/routes';
import { TONE_CLASSES } from '@/constants/tones';
import { isApiError } from '@/lib/api/errors';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { useMachine } from '@/features/machines/api/queries';
import { type MachinePart } from '@/types/machine-part';
import { useMachinePart } from '../api/queries';
import { PartHistory } from './part-history';
import { PartRowActions } from './part-row-actions';

function CurrentCondition({ part }: { part: MachinePart }) {
  const config = MACHINE_PART_STATUS_CONFIG[part.status];
  const tone = TONE_CLASSES[config.tone];
  const Icon = config.icon;
  return (
    <Card className="overflow-hidden">
      <div className={cn('flex flex-col gap-4 border-l-4 p-5 sm:flex-row sm:items-center', tone.accent)}>
        <span className={cn('inline-flex size-14 shrink-0 items-center justify-center rounded-lg border', tone.badge)}>
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Part condition</p>
          <p className={cn('mt-0.5 text-2xl font-semibold tracking-tight', tone.text)}>{config.label}</p>
          <p className="text-[13px] text-muted">
            {config.description} · updated {formatRelativeTime(part.updatedAt)}
          </p>
        </div>
        {part.hasDefect ? <OperationalImpactBadge impact={part.operationalImpact} size="lg" /> : null}
      </div>
    </Card>
  );
}

function PartSkeleton() {
  return (
    <LoadingRegion label="Loading part">
      <Skeleton className="mb-2 h-3 w-48" />
      <Skeleton className="mb-6 h-7 w-56" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-28 lg:col-span-2" />
        <Skeleton className="h-64 lg:row-span-2" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    </LoadingRegion>
  );
}

export function PartDetailView({ machineId, partId }: { machineId: number; partId: number }) {
  const router = useRouter();
  const partQuery = useMachinePart(machineId, partId);
  const machineQuery = useMachine(machineId);
  const { can } = usePermissions();

  if (partQuery.isPending) return <PartSkeleton />;
  if (partQuery.isError) {
    if (isApiError(partQuery.error) && partQuery.error.status === 404) {
      return (
        <Card>
          <NotFoundState
            title="Part not found"
            description="This part doesn't exist or has been removed from the machine."
            backHref={ROUTES.machine(machineId)}
            backLabel="Back to the machine"
          />
        </Card>
      );
    }
    return (
      <Card>
        <ErrorState error={partQuery.error} onRetry={() => void partQuery.refetch()} isRetrying={partQuery.isFetching} />
      </Card>
    );
  }

  const part = partQuery.data;
  const machineName = machineQuery.data?.name ?? `Machine #${machineId}`;
  const canRecord = can(Permission.CREATE_LOGS) && part.isActive;
  const criticality = part.isCritical ? CRITICALITY_CONFIG.critical : CRITICALITY_CONFIG.standard;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Machines', href: ROUTES.machines },
          { label: machineName, href: ROUTES.machine(machineId) },
          { label: part.name },
        ]}
        title={part.name}
        meta={
          <>
            <PartStatusBadge status={part.status} />
            {part.isActive ? null : (
              <Badge tone="neutral" variant="outline">
                Out of use
              </Badge>
            )}
          </>
        }
        description={<span className="font-mono">{part.partCode}</span>}
        actions={
          <>
            {canRecord ? (
              <Link href={buildCreateLogUrl(machineId, part.id)} className={buttonVariants()}>
                <ClipboardPlus className="size-4" aria-hidden />
                Record activity
              </Link>
            ) : null}
            <PartRowActions
              part={part}
              machineName={machineName}
              hideDetailLink
              hideRecordButton
              onDeleted={() => router.replace(ROUTES.machine(machineId))}
            />
          </>
        }
      />

      {part.isActive ? null : (
        <Alert tone="warning" className="mb-4">
          This part is out of use. Its history is kept, but it is ignored when the machine&apos;s status is calculated.
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CurrentCondition part={part} />
        </div>
        <div>
          <Card>
            <CardHeader title="Part information" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Name', value: part.name },
                  { label: 'Part code', value: <span className="font-mono">{part.partCode}</span> },
                  {
                    label: 'Description',
                    value: part.description ?? <span className="text-muted">No description</span>,
                  },
                  { label: 'Criticality', value: `${criticality.label} — ${criticality.description.toLowerCase()}` },
                  {
                    label: 'Operational impact',
                    value: part.hasDefect ? (
                      <OperationalImpactBadge impact={part.operationalImpact} size="sm" />
                    ) : (
                      <span className="text-muted">None while the part is active</span>
                    ),
                  },
                  { label: 'In use', value: part.isActive ? 'Yes' : 'No' },
                  { label: 'Added', value: formatDateTime(part.createdAt) },
                  { label: 'Last updated', value: formatDateTime(part.updatedAt) },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full width: the history table needs the room for its eight columns. */}
      <div className="mt-4">
        <PartHistory partId={part.id} />
      </div>
    </>
  );
}
