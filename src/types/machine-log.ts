import { type DateRangeParams, type PageParams, type SortParams } from './api';
import { type MachineOperationalStatus, type MachineState, type MachineStatusRef } from './machine';
import { type MachinePartRef, type OperationalImpact } from './machine-part';

export enum LogStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export const LOG_STATUSES: readonly LogStatus[] = [LogStatus.OPEN, LogStatus.CLOSED];

/** What a log is about: the machine as a whole system, or one of its parts. */
export enum LogScope {
  MACHINE = 'MACHINE',
  PART = 'PART',
}

export const LOG_SCOPES: readonly LogScope[] = [LogScope.MACHINE, LogScope.PART];

export interface LogTechnician {
  id: number;
  fullName: string;
  position: string | null;
}

/**
 * One event about a machine or one of its parts. Machine and part events share this resource;
 * `scope` says which, and `machinePart` is set for part events.
 */
export interface MachineLog {
  id: number;
  /** The machine's current statuses (not as of this log). */
  machine: MachineStatusRef;
  scope: LogScope;
  machinePart: MachinePartRef | null;
  technician: LogTechnician;
  faultDescription: string;
  causeDescription: string | null;
  /** State of the subject (machine system or part) before this event. */
  entryStatus: MachineState;
  remedyAction: string | null;
  /** State of the subject (machine system or part) after this event. */
  resultingState: MachineState;
  /** Only for part events; null for whole-machine events. */
  operationalImpact: OperationalImpact | null;
  /** The machine's effective status around this event. */
  machineStatusBefore: MachineState;
  machineStatusAfter: MachineState;
  operationalStatusBefore: MachineOperationalStatus;
  operationalStatusAfter: MachineOperationalStatus;
  downtimeHours: number;
  logStatus: LogStatus;
  nextMaintenancePlan: string | null;
  startedAt: string;
  endedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMachineLogRequest {
  machineId: number;
  /** Omitted for a whole-machine event. */
  machinePartId?: number;
  faultDescription: string;
  causeDescription?: string;
  /**
   * The subject's state as last read (part status, or the machine's system status). The API fills
   * it when omitted; when sent and stale, it answers 409 MACHINE_STATE_CONFLICT or
   * MACHINE_PART_STATE_CONFLICT.
   */
  entryStatus?: MachineState;
  remedyAction?: string;
  resultingState: MachineState;
  /** Only with `machinePartId`; the API rejects it on whole-machine events. */
  operationalImpact?: OperationalImpact;
  downtimeHours?: number;
  logStatus?: LogStatus;
  nextMaintenancePlan?: string;
  startedAt?: string;
  endedAt?: string;
}

/** machineId, machinePartId, entryStatus and the author are immutable history and cannot be sent. */
export interface UpdateMachineLogRequest {
  version: number;
  faultDescription?: string;
  causeDescription?: string | null;
  remedyAction?: string | null;
  /** Accepted only on the most recent log of the same subject (409 RESULTING_STATE_IMMUTABLE otherwise). */
  resultingState?: MachineState;
  /** Part events only. */
  operationalImpact?: OperationalImpact;
  downtimeHours?: number;
  logStatus?: LogStatus;
  nextMaintenancePlan?: string | null;
  startedAt?: string;
  endedAt?: string | null;
}

export const MACHINE_LOG_SORT_FIELDS = ['createdAt', 'startedAt', 'updatedAt', 'downtimeHours'] as const;
export type MachineLogSortField = (typeof MACHINE_LOG_SORT_FIELDS)[number];

export interface MachineHistoryParams extends PageParams, SortParams<MachineLogSortField>, DateRangeParams {
  userId?: number;
  scope?: LogScope;
  machinePartId?: number;
  operationalImpact?: OperationalImpact;
  entryStatus?: MachineState;
  resultingState?: MachineState;
  logStatus?: LogStatus;
  search?: string;
}

export interface ListMachineLogsParams extends MachineHistoryParams {
  machineId?: number;
}
