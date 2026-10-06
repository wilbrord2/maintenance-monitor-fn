import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/constants/query-keys';
import { makeMachine, makeOperationalStatusEvent, makeOverview, makeStatusEvent, page } from '@/test/factories';
import { type AnalyticsOverview } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import { type Machine, MachineOperationalStatus, MachineState } from '@/types/machine';
import { LogScope } from '@/types/machine-log';
import { applyMachineStatusEvent, applyOperationalStatusEvent, createActivityRefresher } from './cache-sync';

const unfilteredKey = queryKeys.machines.list({ page: 1, limit: 20 });
const filteredKey = queryKeys.machines.list({ page: 1, limit: 20, status: MachineState.ACTIVE });
const overviewKey = queryKeys.analytics.overview({ days: 30 });

function seed(queryClient: QueryClient) {
  const machine = makeMachine({ id: 5, status: MachineState.ACTIVE, updatedAt: '2026-09-15T08:00:00.000Z' });
  queryClient.setQueryData(queryKeys.machines.detail(5), machine);
  queryClient.setQueryData(unfilteredKey, page([machine, makeMachine({ id: 6, name: 'Press 2' })]));
  queryClient.setQueryData(filteredKey, page([machine]));
  queryClient.setQueryData(overviewKey, makeOverview());
}

describe('applyMachineStatusEvent', () => {
  it('patches the machine everywhere it is cached and adjusts fleet counts', () => {
    const queryClient = new QueryClient();
    seed(queryClient);

    applyMachineStatusEvent(queryClient, makeStatusEvent());

    expect(queryClient.getQueryData<Machine>(queryKeys.machines.detail(5))?.status).toBe(MachineState.UNDER_MAINTENANCE);
    const list = queryClient.getQueryData<PaginatedResponse<Machine>>(unfilteredKey);
    expect(list?.items.map((machine) => machine.status)).toEqual([MachineState.UNDER_MAINTENANCE, MachineState.ACTIVE]);
    expect(list?.items[0]?.activity.lastActivityAt).toBe('2026-09-15T09:00:00.000Z');
    const overview = queryClient.getQueryData<AnalyticsOverview>(overviewKey);
    expect(overview?.machines).toMatchObject({ active: 5, underMaintenance: 3 });
  });

  it('refetches lists filtered by status instead of patching them', () => {
    const queryClient = new QueryClient();
    seed(queryClient);
    applyMachineStatusEvent(queryClient, makeStatusEvent());
    expect(queryClient.getQueryState(filteredKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unfilteredKey)?.isInvalidated).toBe(false);
  });

  it('ignores events older than the cached data', () => {
    const queryClient = new QueryClient();
    seed(queryClient);
    applyMachineStatusEvent(queryClient, makeStatusEvent({ timestamp: '2026-09-15T07:00:00.000Z' }));
    expect(queryClient.getQueryData<Machine>(queryKeys.machines.detail(5))?.status).toBe(MachineState.ACTIVE);
  });

  it('applies both status events of one log, in either order, so the badges never contradict each other', () => {
    // One part log: the machine goes from ACTIVE/OPERATING to DOWNTIME/NOT_OPERATING. The two events
    // carry timestamps a few milliseconds apart and may arrive in either order.
    const statusEvent = makeStatusEvent({
      newStatus: MachineState.DOWNTIME,
      trigger: { type: 'MACHINE_PART', partId: 11, logId: 90, scope: LogScope.PART },
      logId: 90,
      timestamp: '2026-09-15T09:00:00.004Z',
    });
    const operationalEvent = makeOperationalStatusEvent({
      newStatus: MachineOperationalStatus.NOT_OPERATING,
      trigger: { type: 'MACHINE_PART', partId: 11, logId: 90, scope: LogScope.PART },
      timestamp: '2026-09-15T09:00:00.001Z',
    });

    const applyStatus = (queryClient: QueryClient) => applyMachineStatusEvent(queryClient, statusEvent);
    const applyOperational = (queryClient: QueryClient) => applyOperationalStatusEvent(queryClient, operationalEvent);

    for (const order of [
      [applyStatus, applyOperational],
      [applyOperational, applyStatus],
    ]) {
      const queryClient = new QueryClient();
      seed(queryClient);
      for (const apply of order) apply(queryClient);
      const machine = queryClient.getQueryData<Machine>(queryKeys.machines.detail(5));
      expect(machine).toMatchObject({ status: MachineState.DOWNTIME, operationalStatus: MachineOperationalStatus.NOT_OPERATING });
      const listed = queryClient.getQueryData<PaginatedResponse<Machine>>(unfilteredKey)?.items[0];
      expect(listed).toMatchObject({ status: MachineState.DOWNTIME, operationalStatus: MachineOperationalStatus.NOT_OPERATING });
    }
  });

  it('is idempotent and leaves the server timestamp alone', () => {
    const queryClient = new QueryClient();
    seed(queryClient);
    applyMachineStatusEvent(queryClient, makeStatusEvent());
    const once = queryClient.getQueryData<Machine>(queryKeys.machines.detail(5));
    applyMachineStatusEvent(queryClient, makeStatusEvent());
    const twice = queryClient.getQueryData<Machine>(queryKeys.machines.detail(5));
    expect(twice).toBe(once);
    expect(twice?.updatedAt).toBe('2026-09-15T08:00:00.000Z');
  });

  it('does not double count when the overview was computed after the change', () => {
    const queryClient = new QueryClient();
    seed(queryClient);
    queryClient.setQueryData(overviewKey, makeOverview({ range: { from: '2026-08-16T00:00:00.000Z', to: '2026-09-15T10:00:00.000Z', days: 30 } }));
    applyMachineStatusEvent(queryClient, makeStatusEvent());
    expect(queryClient.getQueryData<AnalyticsOverview>(overviewKey)?.machines.active).toBe(6);
  });
});

describe('createActivityRefresher', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches a burst of events into one round of targeted refetches', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const refresher = createActivityRefresher(queryClient, 1000);

    refresher.machineChanged(5);
    refresher.machineChanged(5);
    refresher.machineChanged(6);
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toEqual([
      JSON.stringify(queryKeys.machineLogs.all),
      JSON.stringify(queryKeys.analytics.all),
      JSON.stringify([...queryKeys.machines.detail(5), 'history']),
      JSON.stringify([...queryKeys.machines.detail(6), 'history']),
    ]);
  });

  it('refreshes all fleet data after a reconnect', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const refresher = createActivityRefresher(queryClient, 500);
    refresher.resyncAll();
    vi.advanceTimersByTime(500);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(queryKeys.machines.all);
  });
});

describe('applyOperationalStatusEvent', () => {
  const operationalKey = queryKeys.machines.list({
    page: 1,
    limit: 20,
    operationalStatus: MachineOperationalStatus.OPERATING,
  });

  function seedOperational(queryClient: QueryClient) {
    const machine = makeMachine({
      id: 5,
      operationalStatus: MachineOperationalStatus.OPERATING,
      updatedAt: '2026-09-15T08:00:00.000Z',
    });
    queryClient.setQueryData(queryKeys.machines.detail(5), machine);
    queryClient.setQueryData(unfilteredKey, page([machine, makeMachine({ id: 6, name: 'Press 2' })]));
    queryClient.setQueryData(operationalKey, page([machine]));
    queryClient.setQueryData(overviewKey, makeOverview());
  }

  it('stores the status the API resolved, without touching the parts it came from', () => {
    const queryClient = new QueryClient();
    seedOperational(queryClient);

    applyOperationalStatusEvent(queryClient, makeOperationalStatusEvent());

    const machine = queryClient.getQueryData<Machine>(queryKeys.machines.detail(5));
    expect(machine?.operationalStatus).toBe(MachineOperationalStatus.OPERATING_WITH_DEFECTS);
    // Part counts are not recalculated here; the refetched machine carries them.
    expect(machine?.parts).toEqual(makeMachine().parts);

    const overview = queryClient.getQueryData<AnalyticsOverview>(overviewKey);
    expect(overview?.machineOperational).toMatchObject({ operating: 5, operatingWithDefects: 4 });
  });

  it('refetches lists filtered by operational status instead of patching them', () => {
    const queryClient = new QueryClient();
    seedOperational(queryClient);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    applyOperationalStatusEvent(queryClient, makeOperationalStatusEvent());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: operationalKey, exact: true });
    expect(
      queryClient.getQueryData<PaginatedResponse<Machine>>(unfilteredKey)?.items[0]?.operationalStatus,
    ).toBe(MachineOperationalStatus.OPERATING_WITH_DEFECTS);
  });

  it('ignores an event that is older than the data already cached', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      queryKeys.machines.detail(5),
      makeMachine({ id: 5, operationalStatus: MachineOperationalStatus.NOT_OPERATING, updatedAt: '2026-09-15T12:00:00.000Z' }),
    );

    applyOperationalStatusEvent(queryClient, makeOperationalStatusEvent({ timestamp: '2026-09-15T09:00:00.000Z' }));

    expect(queryClient.getQueryData<Machine>(queryKeys.machines.detail(5))?.operationalStatus).toBe(
      MachineOperationalStatus.NOT_OPERATING,
    );
  });
});

describe('activity refresher for parts and maintenance', () => {
  it('reloads the machine once for a burst of part changes', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const refresher = createActivityRefresher(queryClient, 100);

    refresher.partsChanged(5, 11);
    refresher.partsChanged(5, 12);
    refresher.partsChanged(5, null);
    vi.advanceTimersByTime(100);

    const detailCalls = invalidate.mock.calls.filter(
      ([options]) => JSON.stringify(options?.queryKey) === JSON.stringify(queryKeys.machines.detail(5)),
    );
    expect(detailCalls).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.machineParts.histories(11) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.machineParts.histories(12) });
    vi.useRealTimers();
  });

  it('reloads every maintenance query when a schedule moves', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const refresher = createActivityRefresher(queryClient, 100);

    refresher.maintenanceChanged(5);
    vi.advanceTimersByTime(100);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.maintenance.all });
    vi.useRealTimers();
  });
});
