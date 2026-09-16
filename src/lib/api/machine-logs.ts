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

  /** Records an event and synchronises the machine status in one transaction. */
  create: (body: CreateMachineLogRequest) => postData<MachineLog>('/machine-logs', body),

  /** Requires the version last read; a stale version is rejected with 409 STALE_VERSION. */
  update: (id: number, body: UpdateMachineLogRequest) => patchData<MachineLog>(`/machine-logs/${id}`, body),

  /** ADMIN only. Deleting a machine's most recent log reverts the machine to that log's entry state. */
  remove: (id: number) => deleteData(`/machine-logs/${id}`),
};
