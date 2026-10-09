import { CircleCheck, CircleSlash, type LucideIcon, OctagonAlert } from 'lucide-react';
import { OPERATIONAL_IMPACTS, OperationalImpact } from '@/types/machine-part';
import { MACHINE_STATES, MachineState } from '@/types/machine';
import { MACHINE_STATE_CONFIG } from './machine-state';
import { STATUS_MARK_COLORS } from './chart-colors';
import { type Tone } from './tones';

/**
 * Parts reuse the four workflow statuses, so they reuse their tone, icon and chart colour too.
 * Only the wording differs: these descriptions talk about a component, not the whole machine.
 */
const PART_STATUS_DESCRIPTIONS: Readonly<Record<MachineState, string>> = {
  [MachineState.ACTIVE]: 'Functioning normally',
  [MachineState.UNDER_MAINTENANCE]: 'Being repaired or serviced',
  [MachineState.DOWNTIME]: 'Unavailable',
  [MachineState.UNDER_TEST]: 'Being tested after work',
};

export interface MachinePartStatusConfig {
  value: MachineState;
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
  chartColor: string;
}

export const MACHINE_PART_STATUS_CONFIG: Readonly<Record<MachineState, MachinePartStatusConfig>> =
  Object.fromEntries(
    MACHINE_STATES.map((state) => [
      state,
      { ...MACHINE_STATE_CONFIG[state], description: PART_STATUS_DESCRIPTIONS[state] },
    ]),
  ) as Record<MachineState, MachinePartStatusConfig>;

export const MACHINE_PART_STATUS_OPTIONS = MACHINE_STATES.map((state) => ({
  value: state,
  label: MACHINE_PART_STATUS_CONFIG[state].label,
}));

export interface OperationalImpactConfig {
  value: OperationalImpact;
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
  chartColor: string;
}

/** Whether a part's condition stops the machine. Separate from the part's status. */
export const OPERATIONAL_IMPACT_CONFIG: Readonly<Record<OperationalImpact, OperationalImpactConfig>> = {
  [OperationalImpact.BLOCKING]: {
    value: OperationalImpact.BLOCKING,
    label: 'Blocking',
    description: 'This condition stops the machine',
    tone: 'critical',
    icon: OctagonAlert,
    chartColor: STATUS_MARK_COLORS.critical,
  },
  [OperationalImpact.NON_BLOCKING]: {
    value: OperationalImpact.NON_BLOCKING,
    label: 'Non-blocking',
    description: 'The machine can keep running',
    tone: 'neutral',
    icon: CircleSlash,
    chartColor: STATUS_MARK_COLORS.info,
  },
};

export const OPERATIONAL_IMPACT_OPTIONS = OPERATIONAL_IMPACTS.map((impact) => ({
  value: impact,
  label: OPERATIONAL_IMPACT_CONFIG[impact].label,
}));

/** Criticality is the part's default impact, not its current one. */
export const CRITICALITY_CONFIG = {
  critical: { label: 'Critical', description: 'Failure normally stops the machine', icon: OctagonAlert },
  standard: { label: 'Standard', description: 'Failure normally leaves the machine running', icon: CircleCheck },
} as const;

const IMPACT_VALUES: ReadonlySet<string> = new Set(OPERATIONAL_IMPACTS);

export function isOperationalImpact(value: unknown): value is OperationalImpact {
  return typeof value === 'string' && IMPACT_VALUES.has(value);
}
