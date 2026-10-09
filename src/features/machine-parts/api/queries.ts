'use client';

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machinePartsApi } from '@/lib/api/machine-parts';
import { type ListMachinePartsParams, type MachinePartHistoryParams } from '@/types/machine-part';

export const machinePartQueries = {
  list: (machineId: number, params: ListMachinePartsParams) =>
    queryOptions({
      queryKey: queryKeys.machineParts.list(machineId, params),
      queryFn: ({ signal }) => machinePartsApi.list(machineId, params, { signal }),
    }),
  detail: (machineId: number, partId: number) =>
    queryOptions({
      queryKey: queryKeys.machineParts.detail(machineId, partId),
      queryFn: ({ signal }) => machinePartsApi.get(machineId, partId, { signal }),
    }),
  history: (partId: number, params: MachinePartHistoryParams) =>
    queryOptions({
      queryKey: queryKeys.machineParts.history(partId, params),
      queryFn: ({ signal }) => machinePartsApi.history(partId, params, { signal }),
    }),
};

/** A page of a machine's parts. The machine detail already carries them; this adds paging and filters. */
export function useMachineParts(machineId: number, params: ListMachinePartsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...machinePartQueries.list(machineId, params),
    placeholderData: keepPreviousData,
    enabled: (options.enabled ?? true) && machineId > 0,
  });
}

export function useMachinePart(machineId: number, partId: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...machinePartQueries.detail(machineId, partId),
    enabled: (options.enabled ?? true) && machineId > 0 && partId > 0,
  });
}

/** One part's events (machine logs with `scope: PART`), filtered and paged by the API. */
export function useMachinePartHistory(partId: number, params: MachinePartHistoryParams) {
  return useQuery({
    ...machinePartQueries.history(partId, params),
    placeholderData: keepPreviousData,
    enabled: partId > 0,
  });
}
