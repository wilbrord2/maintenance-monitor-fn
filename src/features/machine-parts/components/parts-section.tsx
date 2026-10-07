'use client';

import { Component, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { OperationalImpactBadge, PartStatusBadge } from '@/components/status/part-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { MACHINE_PART_STATUS_CONFIG } from '@/constants/machine-part';
import { describeDaysUntilDue } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatRelativeTime } from '@/lib/utils/date';
import { MACHINE_STATES, type MachineDetail, type MachineState } from '@/types/machine';
import { type MachinePart } from '@/types/machine-part';
import { PartFormDialog } from './part-form-dialog';
import { PartRowActions } from './part-row-actions';

const ALL = 'ALL';
type StatusChip = MachineState | typeof ALL;

function PartIdentity({ part, machineId }: { part: MachinePart; machineId: number }) {
  return (
    <div className="min-w-0">
      <Link
        href={ROUTES.machinePart(machineId, part.id)}
        className="font-medium text-ink hover:text-brand-ink hover:underline"
      >
        {part.name}
      </Link>
      <p className="truncate font-mono text-xs text-muted">{part.partCode}</p>
    </div>
  );
}

/** Criticality is the part's standing rule; impact is what its current condition does. */
function CriticalityTag({ isCritical }: { isCritical: boolean }) {
  return isCritical ? (
    <Badge tone="warning" variant="outline" size="sm">
      Critical
    </Badge>
  ) : (
    <span className="text-xs text-muted">Standard</span>
  );
}

/** The part's earliest-due active task, as the API picked it. */
function NextMaintenanceCell({ part }: { part: MachinePart }) {
  const next = part.nextMaintenance;
  if (!next) return <span className="text-xs text-muted">No tasks</span>;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <MaintenanceStateBadge state={next.state} size="sm" />
        <span className="text-xs whitespace-nowrap text-ink-secondary">{formatDate(next.nextMaintenanceAt)}</span>
      </div>
      <p className="truncate text-xs text-muted" title={next.taskName}>
        {next.taskName} · {describeDaysUntilDue(next.daysUntilDue).toLowerCase()}
      </p>
    </div>
  );
}

function PartsTable({ parts, machine }: { parts: MachinePart[]; machine: MachineDetail }) {
  return (
    <Table>
      <caption className="sr-only">Parts of {machine.name}</caption>
      <TableHead>
        <tr>
          <TableHeaderCell>Part</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Operational impact</TableHeaderCell>
          <TableHeaderCell>Criticality</TableHeaderCell>
          <TableHeaderCell>Next maintenance</TableHeaderCell>
          <TableHeaderCell>Last update</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {parts.map((part) => (
          <TableRow key={part.id} className={cn(!part.isActive && 'opacity-60')}>
            <TableCell className="max-w-64">
              <PartIdentity part={part} machineId={machine.id} />
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <PartStatusBadge status={part.status} size="sm" />
                {part.isActive ? null : (
                  <Badge tone="neutral" variant="outline" size="sm">
                    Out of use
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              {part.hasDefect ? (
                <OperationalImpactBadge impact={part.operationalImpact} size="sm" />
              ) : (
                <span className="text-xs text-muted">None</span>
              )}
            </TableCell>
            <TableCell>
              <CriticalityTag isCritical={part.isCritical} />
            </TableCell>
            <TableCell className="max-w-48">
              <NextMaintenanceCell part={part} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted">
              {formatRelativeTime(part.updatedAt)}
            </TableCell>
            <TableCell className="w-px">
              <PartRowActions part={part} machineName={machine.name} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PartCards({ parts, machine }: { parts: MachinePart[]; machine: MachineDetail }) {
  return (
    <ul className="divide-y divide-line-soft">
      {parts.map((part) => (
        <li key={part.id} className={cn('px-4 py-3', !part.isActive && 'opacity-60')}>
          <div className="flex items-start justify-between gap-2">
            <PartIdentity part={part} machineId={machine.id} />
            <PartRowActions part={part} machineName={machine.name} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PartStatusBadge status={part.status} size="sm" />
            {part.hasDefect ? <OperationalImpactBadge impact={part.operationalImpact} size="sm" /> : null}
            {part.isCritical ? (
              <Badge tone="warning" variant="outline" size="sm">
                Critical
              </Badge>
            ) : null}
            {part.isActive ? null : (
              <Badge tone="neutral" variant="outline" size="sm">
                Out of use
              </Badge>
            )}
          </div>
          {part.nextMaintenance ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <MaintenanceStateBadge state={part.nextMaintenance.state} size="sm" />
              {part.nextMaintenance.taskName} · due {formatDate(part.nextMaintenance.nextMaintenanceAt)}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-muted">Updated {formatRelativeTime(part.updatedAt)}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The machine's parts, as returned with the machine itself. The machine's status is shown
 * elsewhere and comes from the API: it is never derived from the conditions listed here.
 */
export function PartsSection({ machine }: { machine: MachineDetail }) {
  const { can } = usePermissions();
  const canManage = can(Permission.MANAGE_PARTS);
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusChip>(ALL);

  const parts = [...machine.partDetails].sort((a, b) => a.partCode.localeCompare(b.partCode));
  const visible = statusFilter === ALL ? parts : parts.filter((part) => part.status === statusFilter);

  const statusOptions: ChipOption<StatusChip>[] = [
    { value: ALL, label: 'All', count: parts.length },
    ...MACHINE_STATES.filter((state) => parts.some((part) => part.status === state)).map((state) => ({
      value: state,
      label: MACHINE_PART_STATUS_CONFIG[state].label,
      swatch: MACHINE_PART_STATUS_CONFIG[state].chartColor,
      count: parts.filter((part) => part.status === state).length,
    })),
  ];

  const addButton = canManage ? (
    <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
      Add part
    </Button>
  ) : null;

  return (
    <Card id="parts" className="scroll-mt-20">
      <CardHeader
        title="Parts"
        description={
          parts.length > 0
            ? `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} monitored. Each part's condition is tracked separately.`
            : undefined
        }
        actions={addButton}
      />

      {parts.length === 0 ? (
        <EmptyState
          icon={Component}
          title="No parts configured"
          description={
            canManage
              ? "This machine doesn't have any parts configured yet. Add the machine's parts to start monitoring component health."
              : "This machine doesn't have any parts configured yet. An administrator can add them."
          }
          action={
            canManage ? (
              <Button icon={Plus} onClick={() => setAddOpen(true)}>
                Add part
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {statusOptions.length > 2 ? (
            <div className="border-b border-line px-4 py-3">
              <ChipGroup<StatusChip>
                label="Filter parts by condition"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <EmptyState title="No parts in this condition" description="Choose another condition to see more parts." />
          ) : (
            <>
              <div className="hidden md:block">
                <PartsTable parts={visible} machine={machine} />
              </div>
              <div className="md:hidden">
                <PartCards parts={visible} machine={machine} />
              </div>
            </>
          )}
        </>
      )}

      {canManage ? (
        <PartFormDialog open={addOpen} onOpenChange={setAddOpen} machineId={machine.id} machineName={machine.name} />
      ) : null}
    </Card>
  );
}
