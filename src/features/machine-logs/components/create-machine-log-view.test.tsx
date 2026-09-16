import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { machinesApi } from '@/lib/api/machines';
import { DEFAULT_RULES, makeLog, makeMachine, page } from '@/test/factories';
import { navigation, setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { CreateMachineLogView } from './create-machine-log-view';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/machines', () => ({
  machinesApi: { get: vi.fn(), list: vi.fn(), getStateTransitions: vi.fn(), history: vi.fn() },
}));
vi.mock('@/lib/api/machine-logs', () => ({ machineLogsApi: { create: vi.fn() } }));

const machine = makeMachine({ id: 5, name: 'Press 1', status: MachineState.DOWNTIME });
const rules = {
  ...DEFAULT_RULES,
  allowSameStateEntries: false,
  transitions: { ...DEFAULT_RULES.transitions, [MachineState.DOWNTIME]: [MachineState.ACTIVE, MachineState.UNDER_MAINTENANCE] },
};

describe('Record maintenance activity', () => {
  beforeEach(() => {
    setNavigation('/dashboard/logs/create', 'machineId=5');
    vi.mocked(machinesApi.get).mockResolvedValue(machine);
    vi.mocked(machinesApi.list).mockResolvedValue(page([machine]));
    vi.mocked(machinesApi.getStateTransitions).mockResolvedValue(rules);
    vi.mocked(machineLogsApi.create).mockReset();
  });

  it("shows the machine's current state and uses it as the entry state", async () => {
    renderWithProviders(<CreateMachineLogView />);
    const current = await screen.findByText('Current machine state');
    expect(within(current.parentElement as HTMLElement).getByText('Downtime')).toBeInTheDocument();
  });

  it('offers only resulting states the policy allows, and keeps maintenance logs open', async () => {
    const { user } = renderWithProviders(<CreateMachineLogView />);
    await screen.findByText('Current machine state');

    const resulting = screen.getByLabelText(/Resulting state/);
    await vi.waitFor(() => expect(resulting).toBeEnabled());
    const options = within(resulting).getAllByRole('option').filter((option) => option.getAttribute('value'));
    expect(options.map((option) => option.textContent)).toEqual(['Active', 'Under maintenance']);

    await user.selectOptions(resulting, MachineState.UNDER_MAINTENANCE);
    const closed = within(screen.getByLabelText(/Log status/)).getByRole('option', { name: /Closed/ });
    expect(closed).toBeDisabled();
  });

  it('submits the log with the current state as the entry state', async () => {
    vi.mocked(machineLogsApi.create).mockResolvedValue({ data: makeLog({ id: 77 }), message: 'Created' });
    const { user } = renderWithProviders(<CreateMachineLogView />);
    await screen.findByText('Current machine state');

    await user.type(screen.getByLabelText(/Fault description/), 'Seal replacement');
    await user.selectOptions(screen.getByLabelText(/Resulting state/), MachineState.UNDER_MAINTENANCE);
    await user.click(screen.getByRole('button', { name: 'Save log' }));

    await vi.waitFor(() => expect(machineLogsApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(machineLogsApi.create).mock.calls[0]?.[0]).toMatchObject({
      machineId: 5,
      faultDescription: 'Seal replacement',
      entryStatus: MachineState.DOWNTIME,
      resultingState: MachineState.UNDER_MAINTENANCE,
      logStatus: LogStatus.OPEN,
    });
    await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/logs/77'));
  });

  it('explains a conflict when another technician changed the machine first', async () => {
    vi.mocked(machineLogsApi.create).mockRejectedValue(
      new ApiError({ status: 409, code: 'MACHINE_STATE_CONFLICT', message: 'Machine status changed' }),
    );
    const { user } = renderWithProviders(<CreateMachineLogView />);
    await screen.findByText('Current machine state');

    await user.type(screen.getByLabelText(/Fault description/), 'Seal replacement');
    await user.selectOptions(screen.getByLabelText(/Resulting state/), MachineState.ACTIVE);
    await user.click(screen.getByRole('button', { name: 'Save log' }));

    expect(await screen.findByText('Machine updated by another user')).toBeInTheDocument();
    expect(screen.getByText('This machine was updated by another user. Refresh the machine and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
