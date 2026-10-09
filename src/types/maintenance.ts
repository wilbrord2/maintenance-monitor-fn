import { type PageParams, type SortParams } from './api';
import { type MachineRef } from './machine';
import { type LogTechnician } from './machine-log';

/**
 * Where a recurring schedule stands relative to today. Derived by the API on every read and
 * deliberately separate from machine status: a machine whose maintenance is DUE can still be
 * OPERATING.
 */
export enum MaintenanceScheduleState {
  UPCOMING = 'UPCOMING',
  DUE = 'DUE',
  OVERDUE = 'OVERDUE',
}

export const MAINTENANCE_SCHEDULE_STATES: readonly MaintenanceScheduleState[] = [
  MaintenanceScheduleState.UPCOMING,
  MaintenanceScheduleState.DUE,
  MaintenanceScheduleState.OVERDUE,
];

/** Lifecycle of a single maintenance execution. */
export enum MaintenanceEventStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  CANCELLED = 'CANCELLED',
}

export const MAINTENANCE_EVENT_STATUSES: readonly MaintenanceEventStatus[] = [
  MaintenanceEventStatus.SCHEDULED,
  MaintenanceEventStatus.IN_PROGRESS,
  MaintenanceEventStatus.COMPLETED,
  MaintenanceEventStatus.MISSED,
  MaintenanceEventStatus.CANCELLED,
];

/** Which tasks a listing covers: machine-wide tasks (no part) or part inspections. */
export type MaintenanceScheduleScope = 'machine' | 'part';

export const MAINTENANCE_SCHEDULE_SCOPES: readonly MaintenanceScheduleScope[] = ['machine', 'part'];

/** Compact part reference embedded in maintenance tasks and events. */
export interface MaintenancePartSummary {
  id: number;
  name: string;
  partCode: string;
}

/**
 * One recurring maintenance task of a machine. A machine has many: one per inspected part and
 * any number of machine-wide tasks (cleaning, general inspection, …), each on its own interval.
 */
export interface MaintenanceSchedule {
  id: number;
  machineId: number;
  /** Present on fleet-wide listings; null when the schedule was loaded through its machine. */
  machine: MachineRef | null;
  /** The inspected part; null for a machine-wide task. */
  machinePartId: number | null;
  machinePart: MaintenancePartSummary | null;
  /** Unique per part, and per machine among machine-wide tasks. */
  taskName: string;
  /** Inspection instructions. */
  description: string | null;
  intervalDays: number;
  reminderDaysBefore: number;
  lastMaintenanceAt: string | null;
  /** Calculated by the API from the maintenance history; never recomputed here. */
  nextMaintenanceAt: string;
  isActive: boolean;
  state: MaintenanceScheduleState;
  /** Whole days until the due date: 0 on the due day, negative when overdue. */
  daysUntilDue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceScheduleRequest {
  /** Omit for a machine-wide task. */
  machinePartId?: number;
  /** Required for a machine-wide task; a part task defaults to the part's name. */
  taskName?: string;
  description?: string;
  intervalDays: number;
  /** Omit to let the API default it (at most 3 days, 0 for daily tasks). */
  reminderDaysBefore?: number;
  /** When the task was last done, if known; the first due date is derived from it. */
  lastMaintenanceAt?: string;
  /** Explicit first due date, overriding the derived one. */
  nextMaintenanceAt?: string;
}

/** The part of a task is fixed: to move it, create a new task and deactivate this one. */
export interface UpdateMaintenanceScheduleRequest {
  taskName?: string;
  description?: string | null;
  intervalDays?: number;
  reminderDaysBefore?: number;
  lastMaintenanceAt?: string | null;
  nextMaintenanceAt?: string;
  isActive?: boolean;
}

export interface MaintenanceEvent {
  id: number;
  maintenanceScheduleId: number | null;
  /** The task this event carries out; null for one-off work. */
  taskName: string | null;
  machine: MachineRef | null;
  /** The part worked on, for part tasks and one-off part work. */
  machinePartId: number | null;
  machinePart: MaintenancePartSummary | null;
  performedBy: LogTechnician | null;
  /** The machine or part log opened at start, when the part or machine was taken out of service. */
  machineLogId: number | null;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  status: MaintenanceEventStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Planned work for one task. The machine and part come from the task. */
export interface CreatePlannedMaintenanceEventRequest {
  maintenanceScheduleId: number;
  /** Defaults to the task's due date. */
  scheduledFor?: string;
  notes?: string;
}

/** One-off work, not linked to any task. */
export interface CreateOneOffMaintenanceEventRequest {
  machineId: number;
  machinePartId?: number;
  /** Defaults to now. */
  scheduledFor?: string;
  notes?: string;
}

/** Exactly one of the two shapes: the API refuses a task id sent together with a machine or part. */
export type CreateMaintenanceEventRequest = CreatePlannedMaintenanceEventRequest | CreateOneOffMaintenanceEventRequest;

export interface UpdateMaintenanceEventRequest {
  scheduledFor?: string;
  notes?: string | null;
}

export interface StartMaintenanceEventRequest {
  notes?: string;
  /**
   * Opens a log that moves the part (for part work) or the machine to UNDER_MAINTENANCE through
   * the usual workflow. Defaults to true.
   */
  putUnderMaintenance?: boolean;
}

export interface CompleteMaintenanceEventRequest {
  /** Actual completion time; the next cycle starts from here, not from the scheduled date. */
  completedAt?: string;
  notes?: string;
  /** Closes the log opened at start, returning the part or machine to ACTIVE. Defaults to true. */
  releaseOnComplete?: boolean;
}

export interface CancelMaintenanceEventRequest {
  reason?: string;
}

export const MAINTENANCE_EVENT_SORT_FIELDS = ['scheduledFor', 'startedAt', 'completedAt', 'createdAt'] as const;
export type MaintenanceEventSortField = (typeof MAINTENANCE_EVENT_SORT_FIELDS)[number];

export interface ListMaintenanceEventsParams extends PageParams, SortParams<MaintenanceEventSortField> {
  machineId?: number;
  machinePartId?: number;
  maintenanceScheduleId?: number;
  status?: MaintenanceEventStatus;
  performedById?: number;
  from?: string;
  to?: string;
}

/** Filters of the upcoming / due / overdue listings. */
export interface MaintenanceScheduleListParams extends PageParams {
  machineId?: number;
  machinePartId?: number;
  scope?: MaintenanceScheduleScope;
}

/** Filters of a machine's task list (`GET /machines/:id/maintenance-schedules`, not paginated). */
export interface ListMachineSchedulesParams {
  machinePartId?: number;
  scope?: MaintenanceScheduleScope;
  isActive?: boolean;
}
