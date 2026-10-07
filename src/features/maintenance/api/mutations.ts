'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { maintenanceApi } from '@/lib/api/maintenance';
import {
  type CancelMaintenanceEventRequest,
  type CompleteMaintenanceEventRequest,
  type CreateMaintenanceEventRequest,
  type CreateMaintenanceScheduleRequest,
  type MaintenanceEvent,
  type StartMaintenanceEventRequest,
  type UpdateMaintenanceEventRequest,
  type UpdateMaintenanceScheduleRequest,
} from '@/types/maintenance';

/**
 * Due dates, counts and the dashboard boards are all derived by the API, so they are refetched.
 * The machine detail carries its tasks, and its parts carry their next maintenance; the task
 * lists and parts are nested under it, so one invalidation covers them all.
 */
function syncSchedules(queryClient: QueryClient, machineId: number | null) {
  if (machineId !== null) void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.schedules() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.boards() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * Starting or completing a maintenance moves the part (or the machine) through the log workflow,
 * and the API then re-derives the machine's statuses from its parts. Nothing is patched locally:
 * the machine, its parts, its tasks, its logs and the status board lists are all reloaded.
 */
function syncAfterEventChange(queryClient: QueryClient, event: MaintenanceEvent) {
  queryClient.setQueryData(queryKeys.maintenance.event(event.id), event);
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.events() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
  if (event.machinePartId !== null) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.histories(event.machinePartId) });
  }
  syncSchedules(queryClient, event.machine?.id ?? null);
}

export function useCreateMaintenanceSchedule(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMaintenanceScheduleRequest) => maintenanceApi.createSchedule(machineId, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.maintenance.schedule(data.id), data);
      syncSchedules(queryClient, machineId);
    },
  });
}

/** Edits, deactivates or reactivates a task, addressed by its own id. */
export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMaintenanceScheduleRequest }) =>
      maintenanceApi.updateSchedule(id, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.maintenance.schedule(data.id), data);
      syncSchedules(queryClient, data.machineId);
    },
  });
}

export function useCreateMaintenanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMaintenanceEventRequest) => maintenanceApi.createEvent(body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}

export function useUpdateMaintenanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMaintenanceEventRequest }) =>
      maintenanceApi.updateEvent(id, body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}

export function useStartMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: StartMaintenanceEventRequest }) =>
      maintenanceApi.startEvent(id, body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}

export function useCompleteMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CompleteMaintenanceEventRequest }) =>
      maintenanceApi.completeEvent(id, body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}

/**
 * Starts a task's maintenance in one step: plans an event for the task (sending only its id), then
 * starts it. If starting fails, the planned event stays and is listed as open maintenance.
 */
export function useStartTaskMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ maintenanceScheduleId, body }: { maintenanceScheduleId: number; body: StartMaintenanceEventRequest }) => {
      const created = await maintenanceApi.createEvent({ maintenanceScheduleId });
      syncAfterEventChange(queryClient, created.data);
      return maintenanceApi.startEvent(created.data.id, body);
    },
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}

export function useCancelMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CancelMaintenanceEventRequest }) =>
      maintenanceApi.cancelEvent(id, body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}
