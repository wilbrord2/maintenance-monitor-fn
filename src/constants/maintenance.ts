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
