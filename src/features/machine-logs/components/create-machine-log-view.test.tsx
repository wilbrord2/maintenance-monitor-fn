import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { machinePartsApi } from '@/lib/api/machine-parts';
import { machinesApi } from '@/lib/api/machines';
import { notify } from '@/lib/notify';
import { DEFAULT_RULES, makeLog, makeMachineDetail, makePart, makePartLog, page } from '@/test/factories';
import { navigation, setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { MachineOperationalStatus, MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { OperationalImpact } from '@/types/machine-part';
import { CreateMachineLogView } from './create-machine-log-view';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/machines', () => ({
  machinesApi: { get: vi.fn(), list: vi.fn(), getStateTransitions: vi.fn(), history: vi.fn() },
}));
vi.mock('@/lib/api/machine-parts', () => ({ machinePartsApi: { list: vi.fn() } }));
vi.mock('@/lib/api/machine-logs', () => ({ machineLogsApi: { create: vi.fn() } }));

// The machine itself is fine (system ACTIVE) but its pump is down, so the derived status is DOWNTIME.
const machine = makeMachineDetail({
  id: 5,
  name: 'Press 1',
  status: MachineState.DOWNTIME,
  systemStatus: MachineState.ACTIVE,
  operationalStatus: MachineOperationalStatus.NOT_OPERATING,
});
const pump = makePart({ id: 11, partCode: 'PMP-01', name: 'Hydraulic pump', status: MachineState.DOWNTIME, isCritical: true });
const fan = makePart({ id: 12, partCode: 'FAN-01', name: 'Cooling fan', status: MachineState.ACTIVE, isCritical: false });
const retired = makePart({ id: 13, partCode: 'OLD-01', name: 'Old valve', isActive: false });

const rules = {
  ...DEFAULT_RULES,
  allowSameStateEntries: false,
  transitions: {
    ...DEFAULT_RULES.transitions,
    [MachineState.ACTIVE]: [MachineState.UNDER_MAINTENANCE, MachineState.DOWNTIME],
    [MachineState.DOWNTIME]: [MachineState.ACTIVE, MachineState.UNDER_MAINTENANCE],
  },
};

const currentState = () => within(screen.getByText('Current state').parentElement as HTMLElement);
const stateOptions = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .filter((option) => option.getAttribute('value'))
    .map((option) => option.textContent);
const lastRequest = () => vi.mocked(machineLogsApi.create).mock.calls.at(-1)?.[0];

async function renderForm(query = 'machineId=5') {
  setNavigation('/dashboard/logs/create', query);
  const result = renderWithProviders(<CreateMachineLogView />);
  await screen.findByText('Machine status');
  await vi.waitFor(() => expect(screen.getByLabelText(/New state/)).toBeEnabled());
  return result;
}

describe('Record maintenance activity', () => {
  beforeEach(() => {
    vi.mocked(machinesApi.get).mockResolvedValue(machine);
    vi.mocked(machinesApi.list).mockResolvedValue(page([machine]));
    vi.mocked(machinesApi.getStateTransitions).mockResolvedValue(rules);
    vi.mocked(machinePartsApi.list).mockResolvedValue(page([pump, fan, retired]));
    vi.mocked(machineLogsApi.create).mockReset();
  });

  describe('whole-machine events', () => {
    it("starts from the machine's system state, not its derived status", async () => {
      await renderForm();
      expect(currentState().getByText('Active')).toBeInTheDocument();
      expect(stateOptions(screen.getByLabelText(/New state/))).toEqual(['Under maintenance', 'Downtime']);
    });

    it('lists only active parts, behind an explicit whole-machine choice', async () => {
      await renderForm();
      const part = screen.getByLabelText('Part');
      expect(within(part).getByRole('option', { name: 'Whole machine' })).toBeInTheDocument();
      expect(within(part).getByRole('option', { name: /PMP-01 – Hydraulic pump/ })).toBeInTheDocument();
      expect(within(part).queryByRole('option', { name: /OLD-01/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Operational impact')).not.toBeInTheDocument();
    });

    it('hides the part choice for a machine without parts', async () => {
      vi.mocked(machinePartsApi.list).mockResolvedValue(page([]));
      await renderForm();
      expect(screen.queryByLabelText('Part')).not.toBeInTheDocument();
    });

    it('keeps the log open for states that require it', async () => {
      const { user } = await renderForm();
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.UNDER_MAINTENANCE);
      expect(within(screen.getByLabelText(/Log status/)).getByRole('option', { name: /Closed/ })).toBeDisabled();
    });

    it('submits without a part or an operational impact', async () => {
      vi.mocked(machineLogsApi.create).mockResolvedValue({ data: makeLog({ id: 77 }), message: 'Created' });
      const { user } = await renderForm();

      await user.type(screen.getByLabelText(/Fault description/), 'Planned annual service');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.UNDER_MAINTENANCE);
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      await vi.waitFor(() => expect(machineLogsApi.create).toHaveBeenCalledTimes(1));
      expect(lastRequest()).toMatchObject({
        machineId: 5,
        faultDescription: 'Planned annual service',
        entryStatus: MachineState.ACTIVE,
        resultingState: MachineState.UNDER_MAINTENANCE,
        logStatus: LogStatus.OPEN,
      });
      expect(lastRequest()).not.toHaveProperty('machinePartId');
      expect(lastRequest()).not.toHaveProperty('operationalImpact');
      await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/logs/77'));
    });

    it('explains a conflict when another technician changed the machine first', async () => {
      vi.mocked(machineLogsApi.create).mockRejectedValue(
        new ApiError({ status: 409, code: 'MACHINE_STATE_CONFLICT', message: 'Machine status changed' }),
      );
      const { user } = await renderForm();

      await user.type(screen.getByLabelText(/Fault description/), 'Seal replacement');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.DOWNTIME);
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      expect(await screen.findByText('Machine updated by another user')).toBeInTheDocument();
      expect(screen.getByText('This machine was updated by another user. Refresh the machine and try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    });
  });

  describe('part events', () => {
    it("switches the current state and the allowed states to the chosen part's", async () => {
      const { user } = await renderForm();
      await user.selectOptions(screen.getByLabelText('Part'), '11');

      // The badge animates between states, so wait for the new one.
      expect(await currentState().findByText('Downtime')).toBeInTheDocument();
      expect(stateOptions(screen.getByLabelText(/New state/))).toEqual(['Active', 'Under maintenance']);
    });

    it('defaults the impact from the part being critical or not', async () => {
      const { user } = await renderForm();
      await user.selectOptions(screen.getByLabelText('Part'), '11');
      expect(screen.getByLabelText('Operational impact')).toHaveValue(OperationalImpact.BLOCKING);

      await user.selectOptions(screen.getByLabelText('Part'), '12');
      expect(screen.getByLabelText('Operational impact')).toHaveValue(OperationalImpact.NON_BLOCKING);

      await user.selectOptions(screen.getByLabelText('Part'), '');
      expect(screen.queryByLabelText('Operational impact')).not.toBeInTheDocument();
    });

    it('preselects the part from the link and submits it with its state and impact', async () => {
      vi.mocked(machineLogsApi.create).mockResolvedValue({ data: makePartLog({ id: 91 }), message: 'Created' });
      const success = vi.spyOn(notify, 'success');
      const { user } = await renderForm('machineId=5&partId=11');
      expect(screen.getByLabelText('Part')).toHaveValue('11');

      await user.type(screen.getByLabelText(/Fault description/), 'Pump seized');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.UNDER_MAINTENANCE);
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      await vi.waitFor(() => expect(machineLogsApi.create).toHaveBeenCalledTimes(1));
      expect(lastRequest()).toMatchObject({
        machineId: 5,
        machinePartId: 11,
        entryStatus: MachineState.DOWNTIME,
        resultingState: MachineState.UNDER_MAINTENANCE,
        operationalImpact: OperationalImpact.BLOCKING,
      });
      // The response's machine statuses are reported, as the server derived them.
      expect(success).toHaveBeenCalledWith('Activity recorded', expect.stringContaining('Machine status: Active → Under maintenance'));
      await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/logs/91'));
    });

    it('always sends a part back in service as non-blocking', async () => {
      vi.mocked(machineLogsApi.create).mockResolvedValue({ data: makePartLog({ id: 92 }), message: 'Created' });
      const { user } = await renderForm('machineId=5&partId=11');

      await user.type(screen.getByLabelText(/Fault description/), 'Pump repaired');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.ACTIVE);
      expect(screen.queryByLabelText('Operational impact')).not.toBeInTheDocument();
      expect(screen.getByText('A part back in service is always')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      await vi.waitFor(() => expect(machineLogsApi.create).toHaveBeenCalledTimes(1));
      expect(lastRequest()).toMatchObject({ machinePartId: 11, operationalImpact: OperationalImpact.NON_BLOCKING });
    });

    it('reloads the parts when the part changed meanwhile', async () => {
      vi.mocked(machineLogsApi.create).mockRejectedValue(
        new ApiError({ status: 409, code: 'MACHINE_PART_STATE_CONFLICT', message: 'Part status changed' }),
      );
      const { user } = await renderForm('machineId=5&partId=11');
      const loads = vi.mocked(machinePartsApi.list).mock.calls.length;

      await user.type(screen.getByLabelText(/Fault description/), 'Pump seized');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.UNDER_MAINTENANCE);
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      expect(await screen.findByText('Part updated by another user')).toBeInTheDocument();
      await vi.waitFor(() => expect(vi.mocked(machinePartsApi.list).mock.calls.length).toBeGreaterThan(loads));
    });

    it('drops a part that was taken out of use', async () => {
      vi.mocked(machineLogsApi.create).mockRejectedValue(
        new ApiError({ status: 422, code: 'MACHINE_PART_INACTIVE', message: 'Part is inactive' }),
      );
      const { user } = await renderForm('machineId=5&partId=11');
      vi.mocked(machinePartsApi.list).mockResolvedValue(page([fan, { ...pump, isActive: false }]));

      await user.type(screen.getByLabelText(/Fault description/), 'Pump seized');
      await user.selectOptions(screen.getByLabelText(/New state/), MachineState.UNDER_MAINTENANCE);
      await user.click(screen.getByRole('button', { name: 'Save log' }));

      await vi.waitFor(() => expect(screen.getByLabelText('Part')).toHaveValue(''));
      expect(within(screen.getByLabelText('Part')).queryByRole('option', { name: /PMP-01/ })).not.toBeInTheDocument();
    });
  });
});
