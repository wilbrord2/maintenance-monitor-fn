import { type QueryClient, type QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { type AnalyticsOverview } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import { type ListMachinesParams, type Machine, MachineState } from '@/types/machine';
import { type MachineStatusUpdatedEvent } from '@/types/realtime';

const OVERVIEW_COUNT_KEYS: Readonly<Record<MachineState, keyof AnalyticsOverview['machines']>> = {
  [MachineState.ACTIVE]: 'active',
  [MachineState.UNDER_MAINTENANCE]: 'underMaintenance',
  [MachineState.DOWNTIME]: 'downtime',
  [MachineState.UNDER_TEST]: 'underTest',
};

const toTime = (value: string | null) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);
const later = (current: string | null, candidate: string) => (toTime(candidate) > toTime(current) ? candidate : current);

/** Applies an event to one machine. Data already newer than the event is left untouched. */
export function applyEventToMachine(machine: Machine, event: MachineStatusUpdatedEvent): Machine {
  if (machine.id !== event.machineId) return machine;
  if (toTime(machine.updatedAt) > toTime(event.timestamp)) return machine;
  return {
    ...machine,
    status: event.newStatus,
    updatedAt: later(machine.updatedAt, event.timestamp) ?? event.timestamp,
    activity: { ...machine.activity, lastActivityAt: later(machine.activity.lastActivityAt, event.timestamp) },
  };
}

/** Moves one machine between status counts, unless the overview was computed after the change. */
export function applyEventToOverview(overview: AnalyticsOverview, event: MachineStatusUpdatedEvent): AnalyticsOverview {
  if (event.previousStatus === event.newStatus) return overview;
  if (toTime(overview.range.to) >= toTime(event.timestamp)) return overview;
  const from = OVERVIEW_COUNT_KEYS[event.previousStatus];
  const to = OVERVIEW_COUNT_KEYS[event.newStatus];
  return {
    ...overview,
    machines: {
      ...overview.machines,
      [from]: Math.max(0, overview.machines[from] - 1),
      [to]: overview.machines[to] + 1,
    },
  };
}

function listParams(queryKey: QueryKey): ListMachinesParams | undefined {
  const params = queryKey[2];
  return typeof params === 'object' && params !== null ? (params as ListMachinesParams) : undefined;
}

/**
 * Targeted cache update for `machine.status.updated`: patches the machine wherever it is cached
 * instead of refetching. Lists filtered by status may gain or lose the machine, so only those are
 * refetched.
 */
export function applyMachineStatusEvent(queryClient: QueryClient, event: MachineStatusUpdatedEvent): void {
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(event.machineId), (machine) =>
    machine ? applyEventToMachine(machine, event) : machine,
  );

  for (const [queryKey, page] of queryClient.getQueriesData<PaginatedResponse<Machine>>({
    queryKey: queryKeys.machines.lists(),
  })) {
    if (!page) continue;
    if (listParams(queryKey)?.status) {
      void queryClient.invalidateQueries({ queryKey, exact: true });
      continue;
    }
    if (!page.items.some((machine) => machine.id === event.machineId)) continue;
    queryClient.setQueryData<PaginatedResponse<Machine>>(queryKey, {
      ...page,
      items: page.items.map((machine) => applyEventToMachine(machine, event)),
    });
  }

  queryClient.setQueriesData<AnalyticsOverview>({ queryKey: queryKeys.analytics.overviews() }, (overview) =>
    overview ? applyEventToOverview(overview, event) : overview,
  );
}

export interface ActivityRefresher {
  /** A machine's logs changed: refresh activity feeds, history and analytics shortly. */
  machineChanged(machineId: number): void;
  /** Events may have been missed (reconnect): refresh all fleet data shortly. */
  resyncAll(): void;
  cancel(): void;
}

/**
 * Batches the refetches that events imply (new log rows, history, analytics) so a burst of
 * events causes one round of requests rather than one per event.
 */
export function createActivityRefresher(queryClient: QueryClient, delayMs = 1_200): ActivityRefresher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const machineIds = new Set<number>();
  let fullResync = false;

  const flush = () => {
    timer = null;
    void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    if (fullResync) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
    } else {
      for (const machineId of machineIds) {
        void queryClient.invalidateQueries({ queryKey: [...queryKeys.machines.detail(machineId), 'history'] });
      }
    }
    machineIds.clear();
    fullResync = false;
  };

  const schedule = () => {
    timer ??= setTimeout(flush, delayMs);
  };

  return {
    machineChanged(machineId) {
      machineIds.add(machineId);
      schedule();
    },
    resyncAll() {
      fullResync = true;
      schedule();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      machineIds.clear();
      fullResync = false;
    },
  };
}
