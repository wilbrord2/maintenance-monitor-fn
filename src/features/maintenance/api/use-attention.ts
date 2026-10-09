'use client';

import { useMaintenanceBoard } from './queries';
import { indexByMachine, sortByUrgency } from '../lib/attention';

/**
 * The maintenance tasks that need attention, from the three API listings (approaching, due today
 * and overdue), most urgent first. The API decides which task belongs in which list.
 *
 * `byMachineId` keeps each machine's most urgent task. Machines whose tasks are all still far away
 * appear in none of the lists, which is why callers show "not due soon" rather than inventing a date.
 */
export function useMaintenanceAttention(options: { enabled?: boolean; limit?: number } = {}) {
  const params = { limit: options.limit ?? 50 };
  const enabled = options.enabled ?? true;
  const overdue = useMaintenanceBoard('overdue', params, { enabled });
  const due = useMaintenanceBoard('due', params, { enabled });
  const upcoming = useMaintenanceBoard('upcoming', params, { enabled });
  const queries = [overdue, due, upcoming];

  const schedules = sortByUrgency([
    ...(overdue.data?.items ?? []),
    ...(due.data?.items ?? []),
    ...(upcoming.data?.items ?? []),
  ]);

  return {
    schedules,
    byMachineId: indexByMachine(schedules),
    counts: {
      overdue: overdue.data?.meta.totalItems ?? 0,
      due: due.data?.meta.totalItems ?? 0,
      upcoming: upcoming.data?.meta.totalItems ?? 0,
    },
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: () => {
      for (const query of queries) void query.refetch();
    },
  };
}
