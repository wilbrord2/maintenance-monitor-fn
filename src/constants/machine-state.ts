import { CircleCheck, FlaskConical, type LucideIcon, OctagonAlert, Wrench } from 'lucide-react';
import { MACHINE_STATES, MachineState } from '@/types/machine';
import { STATUS_MARK_COLORS } from './chart-colors';
import { type Tone } from './tones';

export interface MachineStateConfig {
  value: MachineState;
  label: string;
  description: string;
  tone: Tone;
  /** Shape cue so status never relies on colour alone. */
  icon: LucideIcon;
  /** Mark colour for charts (validated for colour-vision deficiency as a set). */
  chartColor: string;
}

/** Single source of truth for how machine states are named and presented. */
export const MACHINE_STATE_CONFIG: Readonly<Record<MachineState, MachineStateConfig>> = {
  [MachineState.ACTIVE]: {
    value: MachineState.ACTIVE,
    label: 'Active',
    description: 'Operating normally',
    tone: 'positive',
    icon: CircleCheck,
    chartColor: STATUS_MARK_COLORS.positive,
  },
  [MachineState.UNDER_MAINTENANCE]: {
    value: MachineState.UNDER_MAINTENANCE,
    label: 'Under maintenance',
    description: 'Being repaired or serviced',
    tone: 'warning',
    icon: Wrench,
    chartColor: STATUS_MARK_COLORS.warning,
  },
  [MachineState.DOWNTIME]: {
    value: MachineState.DOWNTIME,
    label: 'Downtime',
    description: 'Stopped or unavailable',
    tone: 'critical',
    icon: OctagonAlert,
    chartColor: STATUS_MARK_COLORS.critical,
  },
  [MachineState.UNDER_TEST]: {
    value: MachineState.UNDER_TEST,
    label: 'Under test',
    description: 'Trial run after work, not yet released',
    tone: 'info',
    icon: FlaskConical,
    chartColor: STATUS_MARK_COLORS.info,
  },
};

export const MACHINE_STATE_OPTIONS = MACHINE_STATES.map((state) => ({
  value: state,
  label: MACHINE_STATE_CONFIG[state].label,
}));

const STATE_VALUES: ReadonlySet<string> = new Set(MACHINE_STATES);

export function isMachineState(value: unknown): value is MachineState {
  return typeof value === 'string' && STATE_VALUES.has(value);
}
