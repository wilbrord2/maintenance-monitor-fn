import { type PageParams, type SortParams } from './api';
import { type MachineState } from './machine';
import { type MachineHistoryParams } from './machine-log';

/**
 * Parts reuse the four workflow statuses of the machine log system; the API shares a single
 * `machine_state` enum for both. The alias exists so call sites that talk about parts read
 * clearly, without introducing a second set of values.
 */
export type MachinePartStatus = MachineState;

export { MACHINE_STATES as MACHINE_PART_STATUSES } from './machine';

/** Whether a part's current condition stops the machine. Owned by the API, never inferred here. */
export enum OperationalImpact {
  BLOCKING = 'BLOCKING',
  NON_BLOCKING = 'NON_BLOCKING',
}

export const OPERATIONAL_IMPACTS: readonly OperationalImpact[] = [
  OperationalImpact.BLOCKING,
  OperationalImpact.NON_BLOCKING,
];

export interface MachinePart {
  id: number;
  machineId: number;
  name: string;
  partCode: string;
  description: string | null;
  status: MachinePartStatus;
  operationalImpact: OperationalImpact;
  /** Whether failure of this part normally stops the machine; the default impact of new conditions. */
  isCritical: boolean;
  isActive: boolean;
  /** True when the part is not ACTIVE. */
  hasDefect: boolean;
  /** True when this part's current condition is what stops the machine. */
  isBlockingMachine: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Compact part reference embedded in part logs (`scope: PART`). */
export interface MachinePartRef {
  id: number;
  partCode: string;
  name: string;
  isCritical: boolean;
}

export interface CreateMachinePartRequest {
  name: string;
  partCode: string;
  description?: string;
  isCritical: boolean;
  /** Starting condition; the API defaults to ACTIVE. */
  status: MachinePartStatus;
  /** Only meaningful for a non-ACTIVE starting status; otherwise derived from isCritical. */
  operationalImpact?: OperationalImpact;
}

/** Status and impact are absent on purpose: they change only through machine logs about the part. */
export interface UpdateMachinePartRequest {
  name?: string;
  partCode?: string;
  description?: string | null;
  isCritical?: boolean;
  isActive?: boolean;
}

export const MACHINE_PART_SORT_FIELDS = ['partCode', 'name', 'status', 'createdAt', 'updatedAt'] as const;
export type MachinePartSortField = (typeof MACHINE_PART_SORT_FIELDS)[number];

export interface ListMachinePartsParams extends PageParams, SortParams<MachinePartSortField> {
  status?: MachinePartStatus;
  isCritical?: boolean;
  isActive?: boolean;
  search?: string;
}

/** History of one part (`GET /machine-parts/:partId/logs`); the part is addressed by the path. */
export type MachinePartHistoryParams = Omit<MachineHistoryParams, 'scope' | 'machinePartId'>;
