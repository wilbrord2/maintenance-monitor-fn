import {
  type CreateMachineLogRequest,
  type ListMachineLogsParams,
  type MachineLog,
  type UpdateMachineLogRequest,
} from '@/types/machine-log';
import { deleteData, getData, getPage, patchData, postData, type RequestOptions } from './client';

export const machineLogsApi = {
  list: (params: ListMachineLogsParams, options?: RequestOptions) =>
    getPage<MachineLog>('/machine-logs', params, options),

  get: (id: number, options?: RequestOptions) => getData<MachineLog>(`/machine-logs/${id}`, undefined, options),

  /**
   * Records a whole-machine event, or a part event when `machinePartId` is set, and re-derives the
   * machine's statuses in one transaction. The returned log's `machine` carries the new statuses.
   */
  create: (body: CreateMachineLogRequest) => postData<MachineLog>('/machine-logs', body),

  /** Requires the version last read; a stale version is rejected with 409 STALE_VERSION. */
  update: (id: number, body: UpdateMachineLogRequest) => patchData<MachineLog>(`/machine-logs/${id}`, body),

  /** ADMIN only. Deleting a subject's most recent log reverts the subject to that log's entry state. */
  remove: (id: number) => deleteData(`/machine-logs/${id}`),
};
