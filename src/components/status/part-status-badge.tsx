import { Badge, type BadgeProps } from '@/components/ui/badge';
import { MACHINE_PART_STATUS_CONFIG, OPERATIONAL_IMPACT_CONFIG } from '@/constants/machine-part';
import { type MachinePartStatus, type OperationalImpact } from '@/types/machine-part';

export interface PartStatusBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  status: MachinePartStatus;
}

/** A part's own condition. Deliberately the same four statuses as the machine log workflow. */
export function PartStatusBadge({ status, size = 'md', className }: PartStatusBadgeProps) {
  const config = MACHINE_PART_STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone} icon={config.icon} size={size} className={className} title={config.description}>
      {config.label}
    </Badge>
  );
}

export interface OperationalImpactBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  impact: OperationalImpact;
}

/**
 * Whether this part's condition stops the machine. Shown in outline so it reads as a separate
 * fact from the part's status beside it: two parts can share a status and differ here.
 */
export function OperationalImpactBadge({ impact, size = 'md', className }: OperationalImpactBadgeProps) {
  const config = OPERATIONAL_IMPACT_CONFIG[impact];
  return (
    <Badge tone={config.tone} variant="outline" icon={config.icon} size={size} className={className} title={config.description}>
      {config.label}
    </Badge>
  );
}
