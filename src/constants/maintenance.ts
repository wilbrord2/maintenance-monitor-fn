import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { STATUS_MARK_COLORS } from './chart-colors';
import { type Tone } from './tones';
import {
  MAINTENANCE_EVENT_STATUSES,
  MAINTENANCE_SCHEDULE_STATES,
  MaintenanceEventStatus,
  MaintenanceScheduleState,
  type MaintenanceScheduleScope,
} from '@/types/maintenance';

export interface MaintenanceStateConfig {
  value: MaintenanceScheduleState;
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
  chartColor: string;
}

/**
 * Where a schedule stands relative to today. This is a maintenance state only — a machine whose
 * maintenance is overdue can still be operating, and the two are never shown as the same thing.
 */
export const MAINTENANCE_STATE_CONFIG: Readonly<Record<MaintenanceScheduleState, MaintenanceStateConfig>> = {
  [MaintenanceScheduleState.UPCOMING]: {
    value: MaintenanceScheduleState.UPCOMING,
    label: 'Upcoming',
    description: 'Scheduled for a future date',
    tone: 'info',
    icon: CalendarClock,
    chartColor: STATUS_MARK_COLORS.info,
  },
  [MaintenanceScheduleState.DUE]: {
    value: MaintenanceScheduleState.DUE,
    label: 'Due',
    description: 'Due today',
    tone: 'warning',
    icon: TriangleAlert,
    chartColor: STATUS_MARK_COLORS.warning,
  },
  [MaintenanceScheduleState.OVERDUE]: {
    value: MaintenanceScheduleState.OVERDUE,
    label: 'Overdue',
    description: 'Past its due date',
    tone: 'critical',
    icon: CalendarX,
    chartColor: STATUS_MARK_COLORS.critical,
  },
};

export const MAINTENANCE_STATE_OPTIONS = MAINTENANCE_SCHEDULE_STATES.map((state) => ({
  value: state,
  label: MAINTENANCE_STATE_CONFIG[state].label,
}));

export interface MaintenanceEventStatusConfig {
  value: MaintenanceEventStatus;
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
}

/** Lifecycle of one maintenance execution, distinct from the schedule state above. */
export const MAINTENANCE_EVENT_STATUS_CONFIG: Readonly<
  Record<MaintenanceEventStatus, MaintenanceEventStatusConfig>
> = {
  [MaintenanceEventStatus.SCHEDULED]: {
    value: MaintenanceEventStatus.SCHEDULED,
    label: 'Scheduled',
    description: 'Planned, not started yet',
    tone: 'neutral',
    icon: CalendarClock,
  },
  [MaintenanceEventStatus.IN_PROGRESS]: {
    value: MaintenanceEventStatus.IN_PROGRESS,
    label: 'In progress',
    description: 'Being carried out now',
    tone: 'info',
    icon: Wrench,
  },
  [MaintenanceEventStatus.COMPLETED]: {
    value: MaintenanceEventStatus.COMPLETED,
    label: 'Completed',
    description: 'Finished; the next cycle starts from the completion time',
    tone: 'positive',
    icon: CircleCheck,
  },
  [MaintenanceEventStatus.MISSED]: {
    value: MaintenanceEventStatus.MISSED,
    label: 'Missed',
    description: 'Not carried out in time',
    tone: 'critical',
    icon: OctagonAlert,
  },
  [MaintenanceEventStatus.CANCELLED]: {
    value: MaintenanceEventStatus.CANCELLED,
    label: 'Cancelled',
    description: 'Called off before it started',
    tone: 'neutral',
    icon: Ban,
  },
};

export const MAINTENANCE_EVENT_STATUS_OPTIONS = MAINTENANCE_EVENT_STATUSES.map((status) => ({
  value: status,
  label: MAINTENANCE_EVENT_STATUS_CONFIG[status].label,
}));

export const MAINTENANCE_COMPLETED_ICON = CalendarCheck;

const STATE_VALUES: ReadonlySet<string> = new Set(MAINTENANCE_SCHEDULE_STATES);

export function isMaintenanceScheduleState(value: unknown): value is MaintenanceScheduleState {
  return typeof value === 'string' && STATE_VALUES.has(value);
}

/**
 * Phrases the distance to the due date the way the API counts it: 0 is today and negatives are
 * days late. The API owns the number; this only renders it.
 */
export function describeDaysUntilDue(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Today';
  if (daysUntilDue === 1) return 'Tomorrow';
  if (daysUntilDue === -1) return '1 day late';
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days late`;
  return `In ${daysUntilDue} days`;
}

/** The plant's three standard frequencies; any other interval is shown as "Every N days". */
export type MaintenanceFrequency = 'daily' | 'weekly' | 'monthly';

export const MAINTENANCE_FREQUENCY_DAYS: Readonly<Record<MaintenanceFrequency, number>> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export const MAINTENANCE_FREQUENCY_OPTIONS: readonly { value: MaintenanceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function frequencyForInterval(intervalDays: number): MaintenanceFrequency | null {
  return MAINTENANCE_FREQUENCY_OPTIONS.find((option) => MAINTENANCE_FREQUENCY_DAYS[option.value] === intervalDays)?.value ?? null;
}

/** "Daily", "Weekly", "Monthly", or "Every N days" for any other interval. */
export function describeInterval(intervalDays: number): string {
  const frequency = frequencyForInterval(intervalDays);
  if (frequency) return MAINTENANCE_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ?? '';
  return `Every ${intervalDays} days`;
}

export const MAINTENANCE_SCOPE_LABELS: Readonly<Record<MaintenanceScheduleScope, string>> = {
  machine: 'Machine-wide',
  part: 'Part inspections',
};

export const MAINTENANCE_SCOPE_OPTIONS = (Object.keys(MAINTENANCE_SCOPE_LABELS) as MaintenanceScheduleScope[]).map(
  (scope) => ({ value: scope, label: MAINTENANCE_SCOPE_LABELS[scope] }),
);

/**
 * What a maintenance is about, for messages: the task and the part it inspects. A part task is
 * named after its part by default, so the part is not repeated then. Without a part, the task alone.
 */
export function describeMaintenanceSubject(subject: { taskName: string | null; partName: string | null }): string {
  const { taskName, partName } = subject;
  if (!partName) return taskName ?? 'Maintenance';
  if (!taskName || taskName === partName) return partName;
  return `${taskName} – ${partName}`;
}

/** e.g. "is overdue by 2 days", "is due today", "is due in 3 days", from the API's own count. */
export function describeDuePhrase(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const late = Math.abs(daysUntilDue);
    return `is overdue by ${late} ${late === 1 ? 'day' : 'days'}`;
  }
  if (daysUntilDue === 0) return 'is due today';
  if (daysUntilDue === 1) return 'is due tomorrow';
  return `is due in ${daysUntilDue} days`;
}

/** "Cutting head (Laser Cutting System 1)", or the machine alone when neither task nor part is known. */
export function describeMaintenanceTarget(target: { taskName: string | null; partName: string | null; machineName: string }): string {
  if (!target.taskName && !target.partName) return target.machineName;
  return `${describeMaintenanceSubject(target)} (${target.machineName})`;
}

/** e.g. "Cutting head (Laser Cutting System 1 - CNC Laser Cutting Machine) is overdue by 2 days". */
export function describeMaintenanceReminder(reminder: {
  taskName: string;
  partName: string | null;
  machineName: string;
  daysUntilDue: number;
}): string {
  return `${describeMaintenanceTarget(reminder)} ${describeDuePhrase(reminder.daysUntilDue)}`;
}
