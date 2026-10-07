import { type PageParams, type SortParams } from './api';
import { type MachinePart } from './machine-part';
import { type MaintenanceSchedule } from './maintenance';

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

/**
 * Whether the machine as a whole can run. Resolved by the API from the machine's system status and
 * its parts; the frontend displays it and never derives it.
 */
export enum MachineOperationalStatus {
  OPERATING = 'OPERATING',
  OPERATING_WITH_DEFECTS = 'OPERATING_WITH_DEFECTS',
  NOT_OPERATING = 'NOT_OPERATING',
}

/** Display order used by filters, legends and charts. */
export const MACHINE_OPERATIONAL_STATUSES: readonly MachineOperationalStatus[] = [
  MachineOperationalStatus.OPERATING,
  MachineOperationalStatus.OPERATING_WITH_DEFECTS,
  MachineOperationalStatus.NOT_OPERATING,
];

export interface MachineActivity {
  totalLogs: number;
  openLogs: number;
  lastActivityAt: string | null;
}

/** Counts of the machine's parts by condition, as returned with every machine. */
export interface MachinePartCounts {
  total: number;
  active: number;
  underMaintenance: number;
  downtime: number;
  underTest: number;
  /** Parts whose current condition stops the machine. */
  blocking: number;
  /** Parts flagged as critical, whatever their current condition. */
  critical: number;
}

export interface Machine {
  id: number;
  name: string;
  serialNumber: string;
  /**
   * Effective status: the most severe of `systemStatus` and each active part's status. Derived by the
   * API and read-only; this is the machine's main status badge.
   */
  status: MachineState;
  /** State of the machine as a whole system, set by whole-machine logs (`scope: MACHINE`). */
  systemStatus: MachineState;
  /** Whether the machine can run. Derived by the API; `ACTIVE` status always means `OPERATING`. */
  operationalStatus: MachineOperationalStatus;
  description: string | null;
  isActive: boolean;
  activity: MachineActivity;
  parts: MachinePartCounts;
  createdAt: string;
  updatedAt: string;
}

/** `GET /machines/:id` additionally returns the part conditions and the maintenance plan. */
export interface MachineDetail extends Machine {
  partDetails: MachinePart[];
  /** Every maintenance task of the machine: machine-wide tasks and part inspections. */
  maintenanceSchedules: MaintenanceSchedule[];
}

/** Compact machine reference embedded in logs and analytics. */
export interface MachineRef {
  id: number;
  name: string;
  serialNumber: string;
}

/** The machine as embedded in a log: its current statuses, synchronised by the API. */
export interface MachineStatusRef extends MachineRef {
  status: MachineState;
  systemStatus: MachineState;
  operationalStatus: MachineOperationalStatus;
}

/** Statuses are intentionally absent: new machines start ACTIVE and change only through logs. */
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
  /** Effective status. */
  status?: MachineState;
  operationalStatus?: MachineOperationalStatus;
  isActive?: boolean;
  search?: string;
}

/** Transition policy published by `GET /machines/state-transitions`. */
export interface StateTransitionRules {
  allowSameStateEntries: boolean;
  transitions: Record<MachineState, MachineState[]>;
  statesRequiringOpenLog: MachineState[];
}
