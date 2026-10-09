import { type MachineLog } from '@/types/machine-log';
import {
  type CreateMachinePartRequest,
  type ListMachinePartsParams,
  type MachinePart,
  type MachinePartHistoryParams,
  type UpdateMachinePartRequest,
} from '@/types/machine-part';
import { deleteData, getData, getPage, patchData, postData, type RequestOptions } from './client';

/**
 * Parts hang off their machine. A part's status and operational impact change only through machine
 * logs about the part (`POST /machine-logs` with `machinePartId`), never through `update`.
 */
export const machinePartsApi = {
  list: (machineId: number, params: ListMachinePartsParams, options?: RequestOptions) =>
    getPage<MachinePart>(`/machines/${machineId}/parts`, params, options),

  get: (machineId: number, partId: number, options?: RequestOptions) =>
    getData<MachinePart>(`/machines/${machineId}/parts/${partId}`, undefined, options),

  /** ADMIN only. */
  create: (machineId: number, body: CreateMachinePartRequest) =>
    postData<MachinePart>(`/machines/${machineId}/parts`, body),

  /** ADMIN only. Status and impact are rejected here by design. */
  update: (machineId: number, partId: number, body: UpdateMachinePartRequest) =>
    patchData<MachinePart>(`/machines/${machineId}/parts/${partId}`, body),

  /** ADMIN only. Soft delete; refused while the part has an open log. */
  remove: (machineId: number, partId: number) => deleteData(`/machines/${machineId}/parts/${partId}`),

  /** Read-only history of one part: the machine logs with `scope: PART` for it. */
  history: (partId: number, params: MachinePartHistoryParams, options?: RequestOptions) =>
    getPage<MachineLog>(`/machine-parts/${partId}/logs`, params, options),
};
