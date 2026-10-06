import { type MaintenanceSchedule, MaintenanceScheduleState } from '@/types/maintenance';

/** Overdue first (most late first), then due today, then the schedules approaching their date. */
const STATE_ORDER: Readonly<Record<MaintenanceScheduleState, number>> = {
  [MaintenanceScheduleState.OVERDUE]: 0,
  [MaintenanceScheduleState.DUE]: 1,
  [MaintenanceScheduleState.UPCOMING]: 2,
};

export function sortByUrgency(schedules: readonly MaintenanceSchedule[]): MaintenanceSchedule[] {
  return [...schedules].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.daysUntilDue - b.daysUntilDue,
  );
}

/** Indexes schedules by machine so a machine list can show each row's maintenance state. */
export function indexByMachine(schedules: readonly MaintenanceSchedule[]): Map<number, MaintenanceSchedule> {
  return new Map(schedules.map((schedule) => [schedule.machineId, schedule]));
}
