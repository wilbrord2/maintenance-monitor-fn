import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/constants/query-keys';
import { machinesApi } from '@/lib/api/machines';
import { makeMachine, makeMachineDetail, makePart, makeSchedule } from '@/test/factories';
import { createTestQueryClient } from '@/test/render';
import { type MachineDetail } from '@/types/machine';
import { useCreateMachine, useUpdateMachine } from './mutations';

vi.mock('@/lib/api/machines');

afterEach(() => vi.clearAllMocks());

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('machine mutations', () => {
  it('keeps the parts and maintenance plan the update response does not carry', async () => {
    const { queryClient, wrapper } = setup();
    const detail = makeMachineDetail({ id: 5, partDetails: [makePart()], maintenance: makeSchedule() });
    queryClient.setQueryData(queryKeys.machines.detail(5), detail);
    vi.mocked(machinesApi.update).mockResolvedValue({ data: makeMachine({ id: 5, name: 'Press One' }), message: 'Saved' });

    const { result } = renderHook(() => useUpdateMachine(), { wrapper });
    result.current.mutate({ id: 5, body: { name: 'Press One' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<MachineDetail>(queryKeys.machines.detail(5));
    expect(cached?.name).toBe('Press One');
    expect(cached?.partDetails).toHaveLength(1);
    expect(cached?.maintenance).not.toBeNull();
  });

  it('does not cache a partial machine as if it were the full detail', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(machinesApi.create).mockResolvedValue({ data: makeMachine({ id: 9 }), message: 'Created' });

    const { result } = renderHook(() => useCreateMachine(), { wrapper });
    result.current.mutate({ name: 'Laser 9', serialNumber: 'LSR-9' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Nothing is written, so the detail page loads the machine with its parts instead of crashing.
    expect(queryClient.getQueryData(queryKeys.machines.detail(9))).toBeUndefined();
  });
});
