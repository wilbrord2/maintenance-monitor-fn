'use client';

import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machinesApi } from '@/lib/api/machines';
import { type ListMachinesParams } from '@/types/machine';
import { type MachineHistoryParams } from '@/types/machine-log';

/** A machine's activity history, newest first, loaded page by page. */
export function useMachineHistory(machineId: number, params: Omit<MachineHistoryParams, 'page'>) {
  return useInfiniteQuery({
    queryKey: queryKeys.machines.history(machineId, params),
    queryFn: ({ pageParam, signal }) => machinesApi.history(machineId, { ...params, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined),
    enabled: machineId > 0,
  });
}

/** One page of history, for single facts such as the last completed maintenance. */
export function useMachineHistoryPage(machineId: number, params: MachineHistoryParams) {
  return useQuery({
    queryKey: queryKeys.machines.history(machineId, params),
    queryFn: ({ signal }) => machinesApi.history(machineId, params, { signal }),
    enabled: machineId > 0,
  });
}

export const machineQueries = {
  list: (params: ListMachinesParams) =>
    queryOptions({
      queryKey: queryKeys.machines.list(params),
      queryFn: ({ signal }) => machinesApi.list(params, { signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: queryKeys.machines.detail(id),
      queryFn: ({ signal }) => machinesApi.get(id, { signal }),
    }),
  stateTransitions: () =>
    queryOptions({
      queryKey: queryKeys.machines.stateTransitions(),
      queryFn: ({ signal }) => machinesApi.getStateTransitions({ signal }),
      // Policy configuration: changes only with a backend deployment.
      staleTime: 30 * 60_000,
    }),
};

/** A page of machines; keeps the previous page on screen while the next one loads. */
export function useMachines(params: ListMachinesParams, options: { enabled?: boolean } = {}) {
  return useQuery({ ...machineQueries.list(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });
}

export function useMachine(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({ ...machineQueries.detail(id), enabled: (options.enabled ?? true) && id > 0 });
}

export function useStateTransitionRules() {
  return useQuery(machineQueries.stateTransitions());
}
