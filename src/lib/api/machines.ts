import { isMachineState } from '@/constants/machine-state';
import {
  type CreateMachineRequest,
  type ListMachinesParams,
  type Machine,
  MACHINE_STATES,
  type MachineState,
  type StateTransitionRules,
  type UpdateMachineRequest,
} from '@/types/machine';
import { type MachineHistoryParams, type MachineLog } from '@/types/machine-log';
import { deleteData, getData, getPage, patchData, postData, type RequestOptions } from './client';

interface StateTransitionsResponse {
  allowSameStateEntries: boolean;
  transitions: Record<string, string[]>;
  statesRequiringOpenLog: string[];
}

/** Narrows the loosely typed transition table and fills in states the API omitted. */
function normalizeTransitionRules(response: StateTransitionsResponse): StateTransitionRules {
  const transitions = Object.fromEntries(
    MACHINE_STATES.map((state) => [state, (response.transitions[state] ?? []).filter(isMachineState)]),
  ) as Record<MachineState, MachineState[]>;
  return {
    allowSameStateEntries: response.allowSameStateEntries,
    transitions,
    statesRequiringOpenLog: response.statesRequiringOpenLog.filter(isMachineState),
  };
}

export const machinesApi = {
  list: (params: ListMachinesParams, options?: RequestOptions) => getPage<Machine>('/machines', params, options),

  get: (id: number, options?: RequestOptions) => getData<Machine>(`/machines/${id}`, undefined, options),

  /** ADMIN only. Status is not accepted: machines always start ACTIVE. */
  create: (body: CreateMachineRequest) => postData<Machine>('/machines', body),

  /** ADMIN only. Status is not accepted: it changes only through machine logs. */
  update: (id: number, body: UpdateMachineRequest) => patchData<Machine>(`/machines/${id}`, body),

  deactivate: (id: number) => postData<Machine>(`/machines/${id}/deactivate`),

  activate: (id: number) => postData<Machine>(`/machines/${id}/activate`),

  remove: (id: number) => deleteData(`/machines/${id}`),

  history: (id: number, params: MachineHistoryParams, options?: RequestOptions) =>
    getPage<MachineLog>(`/machines/${id}/logs`, params, options),

  getStateTransitions: async (options?: RequestOptions) =>
    normalizeTransitionRules(
      await getData<StateTransitionsResponse>('/machines/state-transitions', undefined, options),
    ),
};
