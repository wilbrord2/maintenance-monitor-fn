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

/** Due dates, counts and the dashboard boards are all derived by the API, so they are refetched. */
function syncSchedules(queryClient: QueryClient, machineId: number | null) {
  if (machineId !== null) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.schedule(machineId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.boards() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * Starting or completing a maintenance also moves the machine through the log workflow, so the
 * machine, its logs and its resolved status are all reloaded from the API.
 */
function syncAfterEventChange(queryClient: QueryClient, event: MaintenanceEvent) {
  queryClient.setQueryData(queryKeys.maintenance.event(event.id), event);
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.events() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
  syncSchedules(queryClient, event.machine?.id ?? null);
}

export function useCreateMaintenanceSchedule(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMaintenanceScheduleRequest) => maintenanceApi.createSchedule(machineId, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.maintenance.schedule(machineId), data);
      syncSchedules(queryClient, machineId);
    },
  });
}

export function useUpdateMaintenanceSchedule(machineId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMaintenanceScheduleRequest) => maintenanceApi.updateSchedule(machineId, body),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.maintenance.schedule(machineId), data);
      syncSchedules(queryClient, machineId);
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

export function useCancelMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CancelMaintenanceEventRequest }) =>
      maintenanceApi.cancelEvent(id, body),
    onSuccess: ({ data }) => syncAfterEventChange(queryClient, data),
  });
}
