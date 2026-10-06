import { Component, Factory } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { type MachineLog } from '@/types/machine-log';
import { StateTransition } from './state-transition';

export interface LogSubjectBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  log: Pick<MachineLog, 'machinePart'>;
}

/** What a log is about: "Machine" for whole-machine events, or the part as `partCode – name`. */
export function LogSubjectBadge({ log, size = 'sm', className }: LogSubjectBadgeProps) {
  const part = log.machinePart;
  if (!part) {
    return (
      <Badge tone="neutral" variant="outline" icon={Factory} size={size} className={className} title="Whole-machine event">
        Machine
      </Badge>
    );
  }
  const label = `${part.partCode} – ${part.name}`;
  return (
    <Badge
      tone="info"
      variant="outline"
      icon={Component}
      size={size}
      className={cn('min-w-0', className)}
      title={`Part event: ${label}${part.isCritical ? ' (critical part)' : ''}`}
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
}

/**
 * How the event moved the machine's effective status. Shown only when it changed, so part events
 * that leave the machine as it was stay quiet.
 */
export function MachineStatusChange({
  log,
  className,
  label = 'Machine',
}: {
  log: Pick<MachineLog, 'machineStatusBefore' | 'machineStatusAfter'>;
  className?: string;
  label?: string;
}) {
  if (log.machineStatusBefore === log.machineStatusAfter) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5 text-xs text-muted', className)}>
      {label}
      <StateTransition from={log.machineStatusBefore} to={log.machineStatusAfter} />
    </span>
  );
}
