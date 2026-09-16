import { Badge, type BadgeProps } from '@/components/ui/badge';
import { LOG_STATUS_CONFIG } from '@/constants/log-status';
import { type LogStatus } from '@/types/machine-log';

export interface LogStatusBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  status: LogStatus;
}

/** Outline style keeps log status visually distinct from the filled machine-state badges beside it. */
export function LogStatusBadge({ status, size = 'md', className }: LogStatusBadgeProps) {
  const config = LOG_STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone} variant="outline" icon={config.icon} size={size} className={className} title={config.description}>
      {config.label}
    </Badge>
  );
}
