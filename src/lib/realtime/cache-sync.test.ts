import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/constants/query-keys';
import { makeMachine, makeOverview, makeStatusEvent, page } from '@/test/factories';
import { type AnalyticsOverview } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import { type Machine, MachineState } from '@/types/machine';
import { applyMachineStatusEvent, createActivityRefresher } from './cache-sync';

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
