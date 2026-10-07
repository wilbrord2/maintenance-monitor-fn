'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machinePartsApi } from '@/lib/api/machine-parts';
import { type CreateMachinePartRequest, type UpdateMachinePartRequest } from '@/types/machine-part';

/**
 * Any part change can move the machine's statuses, so the machine itself is refetched rather than
 * patched: the API derives them and is the only source for them. A part's condition changes only
 * through machine logs (see the machine-logs mutations). Removing or taking a part out of use also
 * deactivates its maintenance tasks, which drops them from the maintenance boards.
 */
function syncAfterPartChange(queryClient: QueryClient, machineId: number) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.schedules() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.boards() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

export function useCreateMachinePart(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMachinePartRequest) => machinePartsApi.create(machineId, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineParts.detail(machineId, data.id), data);
      syncAfterPartChange(queryClient, machineId);
    },
  });
}

export function useUpdateMachinePart(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, body }: { partId: number; body: UpdateMachinePartRequest }) =>
      machinePartsApi.update(machineId, partId, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.machineParts.detail(machineId, data.id), data);
      syncAfterPartChange(queryClient, machineId);
    },
  });
}

export function useDeleteMachinePart(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (partId: number) => machinePartsApi.remove(machineId, partId),
    onSuccess: (_result, partId) => {
      queryClient.removeQueries({ queryKey: queryKeys.machineParts.detail(machineId, partId) });
      syncAfterPartChange(queryClient, machineId);
    },
  });
}
