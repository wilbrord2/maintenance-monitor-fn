'use client';

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { ErrorCode } from '@/constants/error-codes';
import { maintenanceApi } from '@/lib/api/maintenance';
import { toApiError } from '@/lib/api/errors';
import { type ListMaintenanceEventsParams, type MaintenanceScheduleListParams } from '@/types/maintenance';

export type MaintenanceBoardState = 'upcoming' | 'due' | 'overdue';

const BOARD_FETCHERS = {
  upcoming: maintenanceApi.upcoming,
  due: maintenanceApi.due,
  overdue: maintenanceApi.overdue,
} as const;

export const maintenanceQueries = {
  schedule: (machineId: number) =>
    queryOptions({
      queryKey: queryKeys.maintenance.schedule(machineId),
      queryFn: ({ signal }) => maintenanceApi.getSchedule(machineId, { signal }),
      // A machine without a schedule is a normal state, not an error to retry.
      retry: false,
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

/** True when the API reported that the machine simply has no schedule, rather than a failure. */
export function isMissingSchedule(error: unknown): boolean {
  return toApiError(error).hasCode(ErrorCode.MAINTENANCE_SCHEDULE_NOT_FOUND);
}

/**
 * The machine detail already carries its schedule; use this only where the schedule is loaded on
 * its own. A machine without one answers 404 — check it with {@link isMissingSchedule}.
 */
export function useMaintenanceSchedule(machineId: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...maintenanceQueries.schedule(machineId),
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
