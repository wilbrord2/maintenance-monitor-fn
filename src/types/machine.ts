import { type PageParams, type SortParams } from './api';

export enum MachineState {
  ACTIVE = 'ACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  DOWNTIME = 'DOWNTIME',
  UNDER_TEST = 'UNDER_TEST',
}

/** Display order used by filters, legends and charts. */
export const MACHINE_STATES: readonly MachineState[] = [
  MachineState.ACTIVE,
  MachineState.UNDER_MAINTENANCE,
  MachineState.DOWNTIME,
  MachineState.UNDER_TEST,
];

export interface MachineActivity {
  totalLogs: number;
  openLogs: number;
  lastActivityAt: string | null;
}

export interface Machine {
  id: number;
  name: string;
  serialNumber: string;
  status: MachineState;
  description: string | null;
  isActive: boolean;
  activity: MachineActivity;
  createdAt: string;
  updatedAt: string;
}

/** Compact machine reference embedded in logs and analytics. */
export interface MachineRef {
  id: number;
  name: string;
  serialNumber: string;
}

/** Status is intentionally absent: new machines start ACTIVE and change only through logs. */
export interface CreateMachineRequest {
  name: string;
  serialNumber: string;
  description?: string;
}

export interface UpdateMachineRequest {
  name?: string;
  serialNumber?: string;
  description?: string | null;
}

export const MACHINE_SORT_FIELDS = ['name', 'serialNumber', 'status', 'createdAt', 'updatedAt'] as const;
export type MachineSortField = (typeof MACHINE_SORT_FIELDS)[number];

export interface ListMachinesParams extends PageParams, SortParams<MachineSortField> {
  status?: MachineState;
  isActive?: boolean;
  search?: string;
}

/** Transition policy published by `GET /machines/state-transitions`. */
export interface StateTransitionRules {
  allowSameStateEntries: boolean;
  transitions: Record<MachineState, MachineState[]>;
  statesRequiringOpenLog: MachineState[];
}
