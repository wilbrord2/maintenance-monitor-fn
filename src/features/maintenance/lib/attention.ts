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

/**
 * Indexes tasks by machine so a machine list can show each row's maintenance state. A machine has
 * many tasks; the first one met wins, so pass them sorted by urgency to keep the most urgent.
 */
export function indexByMachine(schedules: readonly MaintenanceSchedule[]): Map<number, MaintenanceSchedule> {
  const index = new Map<number, MaintenanceSchedule>();
  for (const schedule of schedules) {
    if (!index.has(schedule.machineId)) index.set(schedule.machineId, schedule);
  }
  return index;
}

export interface ScheduleSummary {
  active: number;
  inactive: number;
  overdue: number;
  due: number;
  upcoming: number;
  /** The active task due first, or null when the machine has none. */
  next: MaintenanceSchedule | null;
}

/**
 * Counts a machine's tasks by the state the API gave each one. Only active tasks count: inactive
 * ones produce no reminders and are left out of the dashboards.
 */
export function summarizeSchedules(schedules: readonly MaintenanceSchedule[]): ScheduleSummary {
  const active = schedules.filter((schedule) => schedule.isActive);
  const count = (state: MaintenanceScheduleState) => active.filter((schedule) => schedule.state === state).length;
  return {
    active: active.length,
    inactive: schedules.length - active.length,
    overdue: count(MaintenanceScheduleState.OVERDUE),
    due: count(MaintenanceScheduleState.DUE),
    upcoming: count(MaintenanceScheduleState.UPCOMING),
    next: sortByUrgency(active)[0] ?? null,
  };
}

/** By due date, then by name, so ties read alphabetically. */
export function sortByDueDate(schedules: readonly MaintenanceSchedule[]): MaintenanceSchedule[] {
  return [...schedules].sort(
    (a, b) => Date.parse(a.nextMaintenanceAt) - Date.parse(b.nextMaintenanceAt) || a.taskName.localeCompare(b.taskName),
  );
}

export interface ScheduleGroup {
  /** `machine` for the machine-wide tasks, otherwise `part:<id>`. */
  key: string;
  label: string;
  part: MaintenanceSchedule['machinePart'];
  schedules: MaintenanceSchedule[];
}

/**
 * Machine-wide tasks first, then one group per part (by part name), each sorted by due date —
 * the order the API lists them in, kept even if a filter or an update reshuffles them.
 */
export function groupSchedules(schedules: readonly MaintenanceSchedule[]): ScheduleGroup[] {
  const machineWide = schedules.filter((schedule) => schedule.machinePartId === null);
  const byPart = new Map<number, MaintenanceSchedule[]>();
  for (const schedule of schedules) {
    if (schedule.machinePartId === null) continue;
    byPart.set(schedule.machinePartId, [...(byPart.get(schedule.machinePartId) ?? []), schedule]);
  }
  const groups: ScheduleGroup[] = [];
  if (machineWide.length > 0) {
    groups.push({ key: 'machine', label: 'Machine-wide tasks', part: null, schedules: sortByDueDate(machineWide) });
  }
  const partGroups = [...byPart.entries()].map(([partId, tasks]) => {
    const part = tasks[0]?.machinePart ?? null;
    return { key: `part:${partId}`, label: part?.name ?? `Part #${partId}`, part, schedules: sortByDueDate(tasks) };
  });
  partGroups.sort((a, b) => a.label.localeCompare(b.label));
  return [...groups, ...partGroups];
}
