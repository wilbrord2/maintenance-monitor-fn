'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { type Machine } from '@/types/machine';
import { type MachineLog, type UpdateMachineLogRequest } from '@/types/machine-log';

/** A log change can alter the machine's status, its history, activity feeds and analytics. */
function syncAfterLogChange(queryClient: QueryClient, machineId: number) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.lists() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/** The committed log states the machine's new status, so the cached machine can reflect it immediately. */
function applyResultingState(queryClient: QueryClient, log: MachineLog) {
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(log.machine.id), (machine) =>
    machine ? { ...machine, status: log.resultingState, updatedAt: log.updatedAt } : machine,
  );
}

export function useCreateMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: machineLogsApi.create,
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineLogs.detail(data.id), data);
      applyResultingState(queryClient, data);
      syncAfterLogChange(queryClient, data.machine.id);
    },
  });
}

export function useUpdateMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMachineLogRequest }) => machineLogsApi.update(id, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineLogs.detail(data.id), data);
      applyResultingState(queryClient, data);
      syncAfterLogChange(queryClient, data.machine.id);
    },
  });
}

export function useDeleteMachineLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (log: MachineLog) => machineLogsApi.remove(log.id),
    onSuccess: (_result, log) => {
      queryClient.removeQueries({ queryKey: queryKeys.machineLogs.detail(log.id) });
      syncAfterLogChange(queryClient, log.machine.id);
    },
  });
}
