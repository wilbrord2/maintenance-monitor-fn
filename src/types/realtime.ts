import { type MachineOperationalStatus, type MachineState } from './machine';
import { type LogScope, type LogStatus } from './machine-log';
import { type OperationalImpact } from './machine-part';
import { type MaintenanceScheduleState } from './maintenance';

export const MACHINE_STATUS_UPDATED_EVENT = 'machine.status.updated';
export const MACHINE_OPERATIONAL_STATUS_UPDATED_EVENT = 'machine.operational-status.updated';
export const MACHINE_PART_UPDATED_EVENT = 'machine.part.updated';
export const MAINTENANCE_REMINDER_EVENT = 'maintenance.reminder';
export const MAINTENANCE_COMPLETED_EVENT = 'maintenance.completed';
export const SESSION_EXPIRED_EVENT = 'session.expired';

/** What caused the API to recalculate a machine's statuses. */
export interface MachineStatusTrigger {
  type: 'MACHINE_PART' | 'MACHINE_LOG' | 'MAINTENANCE_EVENT';
  partId?: number;
  logId?: number;
  scope?: LogScope;
  maintenanceEventId?: number;
}

/**
 * Payload of `machine.status.updated`: the machine's effective status (`Machine.status`) changed.
 * One log can emit this and `machine.operational-status.updated` together.
 */
export interface MachineStatusUpdatedEvent {
  machineId: number;
  machineName: string;
  serialNumber: string;
  previousStatus: MachineState;
  newStatus: MachineState;
  /** The API's explanation, e.g. which part pulls the effective status down. */
  reason: string;
  trigger: MachineStatusTrigger;
  updatedBy: { id: number; name: string };
  /** The log that caused the change, when a log did. */
  logId: number | null;
  timestamp: string;
}

/** Payload of `machine.operational-status.updated`: whether the machine can run. */
export interface MachineOperationalStatusUpdatedEvent {
  machineId: number;
  machineName: string;
  serialNumber: string;
  previousStatus: MachineOperationalStatus;
  newStatus: MachineOperationalStatus;
  /** The API's explanation, e.g. which part stops the machine. */
  reason: string;
  trigger: MachineStatusTrigger;
  updatedBy: { id: number; name: string };
  timestamp: string;
}

/** Payload of `machine.part.updated`: one part's condition changed. */
export interface MachinePartUpdatedEvent {
  machineId: number;
  partId: number;
  partCode: string;
  partName: string;
  previousStatus: MachineState;
  newStatus: MachineState;
  operationalImpact: OperationalImpact;
  isCritical: boolean;
  logId: number;
  logStatus: LogStatus;
  updatedBy: { id: number; name: string };
  timestamp: string;
}

/** Payload of `maintenance.reminder`: one task is approaching, due or overdue. */
export interface MaintenanceReminderEvent {
  scheduleId: number;
  machineId: number;
  machineName: string;
  serialNumber: string;
  /** Null for a machine-wide task. */
  machinePartId: number | null;
  partName: string | null;
  taskName: string;
  state: MaintenanceScheduleState;
  nextMaintenanceAt: string;
  daysUntilDue: number;
  timestamp: string;
}

/** Payload of `maintenance.completed`: the next cycle starts from the completion time. */
export interface MaintenanceCompletedEvent {
  scheduleId: number | null;
  eventId: number;
  machineId: number;
  machineName: string;
  machinePartId: number | null;
  partName: string | null;
  /** Null for one-off work. */
  taskName: string | null;
  completedAt: string;
  nextMaintenanceAt: string | null;
  performedBy: { id: number; name: string } | null;
  timestamp: string;
}

export interface StatusBoardServerEvents {
  [MACHINE_STATUS_UPDATED_EVENT]: (event: MachineStatusUpdatedEvent) => void;
  [MACHINE_OPERATIONAL_STATUS_UPDATED_EVENT]: (event: MachineOperationalStatusUpdatedEvent) => void;
  [MACHINE_PART_UPDATED_EVENT]: (event: MachinePartUpdatedEvent) => void;
  [MAINTENANCE_REMINDER_EVENT]: (event: MaintenanceReminderEvent) => void;
  [MAINTENANCE_COMPLETED_EVENT]: (event: MaintenanceCompletedEvent) => void;
  [SESSION_EXPIRED_EVENT]: (payload: { reason: 'ACCESS_TOKEN_EXPIRED' }) => void;
}

export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
