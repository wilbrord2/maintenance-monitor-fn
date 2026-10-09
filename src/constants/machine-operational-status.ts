import { CircleCheck, type LucideIcon, OctagonAlert, TriangleAlert } from 'lucide-react';
import { MACHINE_OPERATIONAL_STATUSES, MachineOperationalStatus } from '@/types/machine';
import { STATUS_MARK_COLORS } from './chart-colors';
import { type Tone } from './tones';

export interface MachineOperationalStatusConfig {
  value: MachineOperationalStatus;
  label: string;
  description: string;
  tone: Tone;
  /** Shape cue so status never relies on colour alone. */
  icon: LucideIcon;
  chartColor: string;
}

/**
 * How the machine's resolved operational status is presented. The API owns the value itself:
 * it is derived from the machine's system status and parts and is never recomputed here.
 */
export const MACHINE_OPERATIONAL_STATUS_CONFIG: Readonly<
  Record<MachineOperationalStatus, MachineOperationalStatusConfig>
> = {
  [MachineOperationalStatus.OPERATING]: {
    value: MachineOperationalStatus.OPERATING,
    label: 'Operating',
    description: 'Running normally',
    tone: 'positive',
    icon: CircleCheck,
    chartColor: STATUS_MARK_COLORS.positive,
  },
  [MachineOperationalStatus.OPERATING_WITH_DEFECTS]: {
    value: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
    label: 'Operating with defects',
    description: 'Running, but one or more parts need attention',
    tone: 'warning',
    icon: TriangleAlert,
    chartColor: STATUS_MARK_COLORS.warning,
  },
  [MachineOperationalStatus.NOT_OPERATING]: {
    value: MachineOperationalStatus.NOT_OPERATING,
    label: 'Not operating',
    description: 'Stopped by a blocking condition',
    tone: 'critical',
    icon: OctagonAlert,
    chartColor: STATUS_MARK_COLORS.critical,
  },
};

export const MACHINE_OPERATIONAL_STATUS_OPTIONS = MACHINE_OPERATIONAL_STATUSES.map((status) => ({
  value: status,
  label: MACHINE_OPERATIONAL_STATUS_CONFIG[status].label,
}));

const OPERATIONAL_VALUES: ReadonlySet<string> = new Set(MACHINE_OPERATIONAL_STATUSES);

export function isMachineOperationalStatus(value: unknown): value is MachineOperationalStatus {
  return typeof value === 'string' && OPERATIONAL_VALUES.has(value);
}
