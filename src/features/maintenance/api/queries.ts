'use client';

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { maintenanceApi } from '@/lib/api/maintenance';
import {
  type ListMachineSchedulesParams,
  type ListMaintenanceEventsParams,
  MaintenanceEventStatus,
  type MaintenanceScheduleListParams,
} from '@/types/maintenance';

export type MaintenanceBoardState = 'upcoming' | 'due' | 'overdue';

const BOARD_FETCHERS = {
  upcoming: maintenanceApi.upcoming,
  due: maintenanceApi.due,
  overdue: maintenanceApi.overdue,
} as const;

export const maintenanceQueries = {
  machineSchedules: (machineId: number, params: ListMachineSchedulesParams) =>
    queryOptions({
      queryKey: queryKeys.maintenance.machineScheduleList(machineId, params),
      queryFn: ({ signal }) => maintenanceApi.listSchedules(machineId, params, { signal }),
    }),
  schedule: (id: number) =>
    queryOptions({
      queryKey: queryKeys.maintenance.schedule(id),
      queryFn: ({ signal }) => maintenanceApi.getSchedule(id, { signal }),
    }),
  board: (state: MaintenanceBoardState, params: MaintenanceScheduleListParams) =>
    queryOptions({
      queryKey: queryKeys.maintenance.board(state, params),
      queryFn: ({ signal }) => BOARD_FETCHERS[state](params, { signal }),
    }),
  events: (params: ListMaintenanceEventsParams) =>
    queryOptions({
      queryKey: queryKeys.maintenance.eventList(params),
      queryFn: ({ signal }) => maintenanceApi.listEvents(params, { signal }),
    }),
  event: (id: number) =>
    queryOptions({
      queryKey: queryKeys.maintenance.event(id),
      queryFn: ({ signal }) => maintenanceApi.getEvent(id, { signal }),
    }),
};

/**
 * A machine's tasks, filtered by the API (e.g. one part's tasks). The machine detail already
 * carries all of them; use this where the tasks are loaded on their own, such as a part page.
 */
export function useMachineSchedules(
  machineId: number,
  params: ListMachineSchedulesParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    ...maintenanceQueries.machineSchedules(machineId, params),
    enabled: (options.enabled ?? true) && machineId > 0,
  });
}

export function useMaintenanceBoard(
  state: MaintenanceBoardState,
  params: MaintenanceScheduleListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    ...maintenanceQueries.board(state, params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useMaintenanceEvents(params: ListMaintenanceEventsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...maintenanceQueries.events(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useMaintenanceEvent(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({ ...maintenanceQueries.event(id), enabled: (options.enabled ?? true) && id > 0 });
}

/** Events that are still open (planned or in progress); a task can have at most one. */
export const OPEN_EVENT_STATUSES = [MaintenanceEventStatus.IN_PROGRESS, MaintenanceEventStatus.SCHEDULED] as const;

/**
 * The open maintenance events of a machine, in progress first. Used to offer "Complete" instead of
 * "Start" on a task that is already under way.
 */
export function useOpenMaintenanceEvents(
  filter: Pick<ListMaintenanceEventsParams, 'machineId' | 'machinePartId' | 'maintenanceScheduleId'>,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const base = { ...filter, page: 1, limit: 100, sortBy: 'scheduledFor', sortOrder: 'asc' } as const;
  const inProgress = useMaintenanceEvents({ ...base, status: MaintenanceEventStatus.IN_PROGRESS }, { enabled });
  const scheduled = useMaintenanceEvents({ ...base, status: MaintenanceEventStatus.SCHEDULED }, { enabled });
  return {
    events: [...(inProgress.data?.items ?? []), ...(scheduled.data?.items ?? [])],
    isPending: enabled && (inProgress.isPending || scheduled.isPending),
    isError: inProgress.isError || scheduled.isError,
  };
}
