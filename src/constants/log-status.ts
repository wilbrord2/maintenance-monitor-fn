import { CircleCheckBig, CircleDashed, type LucideIcon } from 'lucide-react';
import { LOG_STATUSES, LogStatus } from '@/types/machine-log';
import { type Tone } from './tones';

export interface LogStatusConfig {
  value: LogStatus;
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
}

export const LOG_STATUS_CONFIG: Readonly<Record<LogStatus, LogStatusConfig>> = {
  [LogStatus.OPEN]: {
    value: LogStatus.OPEN,
    label: 'Open',
    description: 'Work is ongoing',
    tone: 'warning',
    icon: CircleDashed,
  },
  [LogStatus.CLOSED]: {
    value: LogStatus.CLOSED,
    label: 'Closed',
    description: 'Work is complete',
    tone: 'neutral',
    icon: CircleCheckBig,
  },
};

export const LOG_STATUS_OPTIONS = LOG_STATUSES.map((status) => ({
  value: status,
  label: LOG_STATUS_CONFIG[status].label,
}));

const STATUS_VALUES: ReadonlySet<string> = new Set(LOG_STATUSES);

export function isLogStatus(value: unknown): value is LogStatus {
  return typeof value === 'string' && STATUS_VALUES.has(value);
}
