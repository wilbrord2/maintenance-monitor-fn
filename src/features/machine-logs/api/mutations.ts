'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { type PaginatedResponse } from '@/types/api';
import { type Machine, type MachineStatusRef } from '@/types/machine';
import { type MachineLog, type UpdateMachineLogRequest } from '@/types/machine-log';

/**
 * A log change can alter the machine's statuses, a part's condition, both histories, activity feeds
 * and analytics. The machine detail key also covers its parts, part details and machine history.
 */
function syncAfterLogChange(queryClient: QueryClient, log: Pick<MachineLog, 'machine' | 'machinePart'>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.lists() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(log.machine.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
  if (log.machinePart) void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.histories(log.machinePart.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * The committed log carries the machine's statuses as the API derived them, so cached copies of the
 * machine show them immediately (before the refetch lands). The values are copied, never computed.
 */
export function applyMachineStatuses(queryClient: QueryClient, statuses: MachineStatusRef, updatedAt: string) {
  const patch = <T extends Machine>(machine: T): T =>
    machine.id === statuses.id
      ? {
          ...machine,
          status: statuses.status,
          systemStatus: statuses.systemStatus,
          operationalStatus: statuses.operationalStatus,
          updatedAt,
        }
      : machine;
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(statuses.id), (machine) => (machine ? patch(machine) : machine));
  queryClient.setQueriesData<PaginatedResponse<Machine>>({ queryKey: queryKeys.machines.lists() }, (page) =>
    page?.items.some((machine) => machine.id === statuses.id) ? { ...page, items: page.items.map(patch) } : page,
  );
}

export function useCreateMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: machineLogsApi.create,
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineLogs.detail(data.id), data);
      applyMachineStatuses(queryClient, data.machine, data.updatedAt);
      syncAfterLogChange(queryClient, data);
    },
  });
}

export function useUpdateMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMachineLogRequest }) => machineLogsApi.update(id, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineLogs.detail(data.id), data);
      applyMachineStatuses(queryClient, data.machine, data.updatedAt);
      syncAfterLogChange(queryClient, data);
    },
  });
}

export function useDeleteMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (log: MachineLog) => machineLogsApi.remove(log.id),
    onSuccess: (_result, log) => {
      queryClient.removeQueries({ queryKey: queryKeys.machineLogs.detail(log.id) });
      syncAfterLogChange(queryClient, log);
    },
  });
}
