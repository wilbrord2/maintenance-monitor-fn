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

export interface MaintenanceSchedule {
  id: number;
  machineId: number;
  /** Present on fleet-wide listings; null when the schedule was loaded through its machine. */
  machine: MachineRef | null;
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
  intervalDays: number;
  reminderDaysBefore: number;
  /** When the machine was last maintained, if known; the first due date is derived from it. */
  lastMaintenanceAt?: string;
  /** Explicit first due date, overriding the derived one. */
  nextMaintenanceAt?: string;
}

export interface UpdateMaintenanceScheduleRequest {
  intervalDays?: number;
  reminderDaysBefore?: number;
  lastMaintenanceAt?: string | null;
  nextMaintenanceAt?: string;
  isActive?: boolean;
}

export interface MaintenanceEvent {
  id: number;
  maintenanceScheduleId: number | null;
  machine: MachineRef | null;
  performedBy: LogTechnician | null;
  /** The machine log opened at start, when the machine was taken out of service. */
  machineLogId: number | null;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  status: MaintenanceEventStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceEventRequest {
  machineId: number;
  /** Defaults to the schedule's due date, or now when the machine has no schedule. */
  scheduledFor?: string;
  notes?: string;
}

export interface UpdateMaintenanceEventRequest {
  scheduledFor?: string;
  notes?: string | null;
}

export interface StartMaintenanceEventRequest {
  notes?: string;
  /** Opens a machine log that moves the machine to UNDER_MAINTENANCE through the usual workflow. */
  putMachineUnderMaintenance: boolean;
}

export interface CompleteMaintenanceEventRequest {
  /** Actual completion time; the next cycle starts from here, not from the scheduled date. */
  completedAt?: string;
  notes?: string;
  /** Closes the machine log opened at start, returning the machine to ACTIVE. */
  releaseMachine: boolean;
}

export interface CancelMaintenanceEventRequest {
  reason?: string;
}

export const MAINTENANCE_EVENT_SORT_FIELDS = ['scheduledFor', 'startedAt', 'completedAt', 'createdAt'] as const;
export type MaintenanceEventSortField = (typeof MAINTENANCE_EVENT_SORT_FIELDS)[number];

export interface ListMaintenanceEventsParams extends PageParams, SortParams<MaintenanceEventSortField> {
  machineId?: number;
  maintenanceScheduleId?: number;
  status?: MaintenanceEventStatus;
  performedById?: number;
  from?: string;
  to?: string;
}

/** The upcoming / due / overdue listings accept pagination only. */
export type MaintenanceScheduleListParams = PageParams;
