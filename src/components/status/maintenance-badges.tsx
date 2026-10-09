import { Badge, type BadgeProps } from '@/components/ui/badge';
import { MAINTENANCE_EVENT_STATUS_CONFIG, MAINTENANCE_STATE_CONFIG } from '@/constants/maintenance';
import { type MaintenanceEventStatus, type MaintenanceScheduleState } from '@/types/maintenance';

export interface MaintenanceStateBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  state: MaintenanceScheduleState;
}

/**
 * Where preventive maintenance stands. This is never the machine's status: a machine whose
 * maintenance is overdue can still be operating.
 */
export function MaintenanceStateBadge({ state, size = 'md', className }: MaintenanceStateBadgeProps) {
  const config = MAINTENANCE_STATE_CONFIG[state];
  return (
    <Badge tone={config.tone} icon={config.icon} size={size} className={className} title={config.description}>
      {config.label}
    </Badge>
  );
}

export interface MaintenanceEventStatusBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  status: MaintenanceEventStatus;
}

/** Lifecycle of one maintenance execution. */
export function MaintenanceEventStatusBadge({ status, size = 'md', className }: MaintenanceEventStatusBadgeProps) {
  const config = MAINTENANCE_EVENT_STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone} variant="outline" icon={config.icon} size={size} className={className} title={config.description}>
      {config.label}
    </Badge>
  );
}
