'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { machinesApi } from '@/lib/api/machines';
import { type Machine, type UpdateMachineRequest } from '@/types/machine';

function storeMachine(queryClient: QueryClient, machine: Machine) {
  queryClient.setQueryData(queryKeys.machines.detail(machine.id), machine);
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: machinesApi.create,
    onSuccess: ({ data }) => {
      storeMachine(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useUpdateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMachineRequest }) => machinesApi.update(id, body),
    onSuccess: ({ data }) => {
      storeMachine(queryClient, data);
      // Logs and analytics embed the machine name and serial number.
      void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useSetMachineActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? machinesApi.activate(id) : machinesApi.deactivate(id),
    onSuccess: ({ data }) => {
      storeMachine(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useDeleteMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => machinesApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.machines.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
