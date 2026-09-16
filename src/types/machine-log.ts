import { type DateRangeParams, type PageParams, type SortParams } from './api';
import { type MachineRef, type MachineState } from './machine';

export enum LogStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export const LOG_STATUSES: readonly LogStatus[] = [LogStatus.OPEN, LogStatus.CLOSED];

export interface LogTechnician {
  id: number;
  fullName: string;
  position: string | null;
}

export interface MachineLog {
  id: number;
  machine: MachineRef;
  technician: LogTechnician;
  faultDescription: string;
  causeDescription: string | null;
  entryStatus: MachineState;
  remedyAction: string | null;
  resultingState: MachineState;
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
  faultDescription: string;
  causeDescription?: string;
  /** Must equal the machine's current status, otherwise the API answers 409 MACHINE_STATE_CONFLICT. */
  entryStatus: MachineState;
  remedyAction?: string;
  resultingState: MachineState;
  downtimeHours?: number;
  logStatus: LogStatus;
  nextMaintenancePlan?: string;
  startedAt?: string;
  endedAt?: string;
}

/** machineId, entryStatus and the author are immutable history and cannot be sent. */
export interface UpdateMachineLogRequest {
  version: number;
  faultDescription?: string;
  causeDescription?: string | null;
  remedyAction?: string | null;
  resultingState?: MachineState;
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
  entryStatus?: MachineState;
  resultingState?: MachineState;
  logStatus?: LogStatus;
  search?: string;
}

export interface ListMachineLogsParams extends MachineHistoryParams {
  machineId?: number;
}
