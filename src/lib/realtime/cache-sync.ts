import { type QueryClient, type QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { type AnalyticsOverview, type MachineOperationalCounts } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import {
  type ListMachinesParams,
  type Machine,
  MachineOperationalStatus,
  MachineState,
} from '@/types/machine';
import {
  type MachineOperationalStatusUpdatedEvent,
  type MachinePartUpdatedEvent,
  type MachineStatusUpdatedEvent,
  type MaintenanceCompletedEvent,
  type MaintenanceReminderEvent,
} from '@/types/realtime';

const OVERVIEW_COUNT_KEYS: Readonly<Record<MachineState, keyof AnalyticsOverview['machines']>> = {
  [MachineState.ACTIVE]: 'active',
  [MachineState.UNDER_MAINTENANCE]: 'underMaintenance',
  [MachineState.DOWNTIME]: 'downtime',
  [MachineState.UNDER_TEST]: 'underTest',
};

const OPERATIONAL_COUNT_KEYS: Readonly<Record<MachineOperationalStatus, keyof MachineOperationalCounts>> = {
  [MachineOperationalStatus.OPERATING]: 'operating',
  [MachineOperationalStatus.OPERATING_WITH_DEFECTS]: 'operatingWithDefects',
  [MachineOperationalStatus.NOT_OPERATING]: 'notOperating',
};

const toTime = (value: string | null) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);
const later = (current: string | null, candidate: string) => (toTime(candidate) > toTime(current) ? candidate : current);

/*
 * One log can emit both `machine.status.updated` and `machine.operational-status.updated`, in either
 * order and with timestamps a few milliseconds apart. Each event therefore sets only its own field
 * and leaves `updatedAt` alone: it is compared only with data the server returned, so the second
 * event is never mistaken for a stale one. Applying the same event twice is harmless.
 */

/** Applies an effective status event to one machine. Data the server returned after the event is left alone. */
export function applyEventToMachine(machine: Machine, event: MachineStatusUpdatedEvent): Machine {
  if (machine.id !== event.machineId) return machine;
  if (toTime(machine.updatedAt) > toTime(event.timestamp)) return machine;
  const lastActivityAt = later(machine.activity.lastActivityAt, event.timestamp);
  if (machine.status === event.newStatus && machine.activity.lastActivityAt === lastActivityAt) return machine;
  return { ...machine, status: event.newStatus, activity: { ...machine.activity, lastActivityAt } };
}

/**
 * Applies an operational status to one machine. The value comes straight from the API, which is the
 * only place that status is worked out.
 */
export function applyOperationalEventToMachine(
  machine: Machine,
  event: MachineOperationalStatusUpdatedEvent,
): Machine {
  if (machine.id !== event.machineId) return machine;
  if (toTime(machine.updatedAt) > toTime(event.timestamp)) return machine;
  if (machine.operationalStatus === event.newStatus) return machine;
  return { ...machine, operationalStatus: event.newStatus };
}

/** Moves one machine between effective status counts, unless the overview is already newer. */
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

/** Moves one machine between operational status counts, unless the overview is already newer. */
export function applyEventToOperationalCounts(
  overview: AnalyticsOverview,
  event: MachineOperationalStatusUpdatedEvent,
): AnalyticsOverview {
  if (event.previousStatus === event.newStatus) return overview;
  if (toTime(overview.range.to) >= toTime(event.timestamp)) return overview;
  const from = OPERATIONAL_COUNT_KEYS[event.previousStatus];
  const to = OPERATIONAL_COUNT_KEYS[event.newStatus];
  return {
    ...overview,
    machineOperational: {
      ...overview.machineOperational,
      [from]: Math.max(0, overview.machineOperational[from] - 1),
      [to]: overview.machineOperational[to] + 1,
    },
  };
}

function listParams(queryKey: QueryKey): ListMachinesParams | undefined {
  const params = queryKey[2];
  return typeof params === 'object' && params !== null ? (params as ListMachinesParams) : undefined;
}

/**
 * Patches every cached machine list. A list filtered by the status that changed may gain or lose
 * the machine, so it is refetched instead of patched.
 */
function patchMachineLists(
  queryClient: QueryClient,
  machineId: number,
  patch: (machine: Machine) => Machine,
  isFilteredByChangedStatus: (params: ListMachinesParams | undefined) => boolean,
): void {
  for (const [queryKey, page] of queryClient.getQueriesData<PaginatedResponse<Machine>>({
    queryKey: queryKeys.machines.lists(),
  })) {
    if (!page) continue;
    if (isFilteredByChangedStatus(listParams(queryKey))) {
      void queryClient.invalidateQueries({ queryKey, exact: true });
      continue;
    }
    if (!page.items.some((machine) => machine.id === machineId)) continue;
    queryClient.setQueryData<PaginatedResponse<Machine>>(queryKey, { ...page, items: page.items.map(patch) });
  }
}

/**
 * Targeted cache update for `machine.status.updated`: patches the machine's effective status wherever
 * it is cached instead of refetching. The system status is not in the event; the refetch the
 * activity refresher schedules brings it.
 */
export function applyMachineStatusEvent(queryClient: QueryClient, event: MachineStatusUpdatedEvent): void {
  const patch = (machine: Machine) => applyEventToMachine(machine, event);
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(event.machineId), (machine) =>
    machine ? patch(machine) : machine,
  );
  patchMachineLists(queryClient, event.machineId, patch, (params) => Boolean(params?.status));
  queryClient.setQueriesData<AnalyticsOverview>({ queryKey: queryKeys.analytics.overviews() }, (overview) =>
    overview ? applyEventToOverview(overview, event) : overview,
  );
}

/**
 * Targeted cache update for `machine.operational-status.updated`. The machine detail also carries
 * the parts the API resolved the status from, so the activity refresher refetches it as well.
 */
export function applyOperationalStatusEvent(
  queryClient: QueryClient,
  event: MachineOperationalStatusUpdatedEvent,
): void {
  const patch = (machine: Machine) => applyOperationalEventToMachine(machine, event);
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(event.machineId), (machine) =>
    machine ? patch(machine) : machine,
  );
  patchMachineLists(queryClient, event.machineId, patch, (params) => Boolean(params?.operationalStatus));
  queryClient.setQueriesData<AnalyticsOverview>({ queryKey: queryKeys.analytics.overviews() }, (overview) =>
    overview ? applyEventToOperationalCounts(overview, event) : overview,
  );
}

export interface ActivityRefresher {
  /** A machine's logs changed: refresh activity feeds, history and analytics shortly. */
  machineChanged(machineId: number): void;
  /**
   * A machine's statuses or parts changed: also refresh the machine detail (system status, parts) and,
   * when known, the part history.
   */
  partsChanged(machineId: number, partId: number | null): void;
  /** Preventive maintenance changed for a machine (or the whole fleet when unknown). */
  maintenanceChanged(machineId: number | null): void;
  /** Events may have been missed (reconnect): refresh all fleet data shortly. */
  resyncAll(): void;
  cancel(): void;
}

/**
 * Batches the refetches that events imply (new rows, history, analytics) so a burst of events
 * causes one round of requests rather than one per event.
 */
export function createActivityRefresher(queryClient: QueryClient, delayMs = 1_200): ActivityRefresher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const machineIds = new Set<number>();
  const partIds = new Set<number>();
  const detailMachineIds = new Set<number>();
  let maintenanceChanged = false;
  let fullResync = false;

  const flush = () => {
    timer = null;
    void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    if (fullResync) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
    } else {
      for (const machineId of machineIds) {
        void queryClient.invalidateQueries({ queryKey: [...queryKeys.machines.detail(machineId), 'history'] });
      }
      for (const machineId of detailMachineIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
      }
      for (const partId of partIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.histories(partId) });
      }
      if (maintenanceChanged) void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
    }
    machineIds.clear();
    partIds.clear();
    detailMachineIds.clear();
    maintenanceChanged = false;
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
    partsChanged(machineId, partId) {
      detailMachineIds.add(machineId);
      if (partId !== null) partIds.add(partId);
      schedule();
    },
    maintenanceChanged(machineId) {
      maintenanceChanged = true;
      if (machineId !== null) detailMachineIds.add(machineId);
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
      partIds.clear();
      detailMachineIds.clear();
      maintenanceChanged = false;
      fullResync = false;
    },
  };
}

/** A maintenance reminder changes no record, but the dashboard boards and counts move. */
export function applyMaintenanceReminderEvent(queryClient: QueryClient, _event: MaintenanceReminderEvent): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.boards() });
}

/** A completed maintenance moves the schedule forward and may have released the machine. */
export function applyMaintenanceCompletedEvent(
  queryClient: QueryClient,
  event: MaintenanceCompletedEvent,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(event.machineId) });
}

/** A part's condition changed; the API re-derived the machine's statuses in the same transaction. */
export function applyPartUpdatedEvent(queryClient: QueryClient, event: MachinePartUpdatedEvent): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.detail(event.machineId, event.partId) });
}
