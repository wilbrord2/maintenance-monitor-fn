'use client';

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { type ListMachineLogsParams } from '@/types/machine-log';

export const machineLogQueries = {
  list: (params: ListMachineLogsParams) =>
    queryOptions({
      queryKey: queryKeys.machineLogs.list(params),
      queryFn: ({ signal }) => machineLogsApi.list(params, { signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: queryKeys.machineLogs.detail(id),
      queryFn: ({ signal }) => machineLogsApi.get(id, { signal }),
    }),
};

export function useMachineLogs(params: ListMachineLogsParams, options: { enabled?: boolean } = {}) {
  return useQuery({ ...machineLogQueries.list(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });
}

export function useMachineLog(id: number) {
  return useQuery({ ...machineLogQueries.detail(id), enabled: id > 0 });
}
