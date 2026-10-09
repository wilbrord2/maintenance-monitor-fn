import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { machinePartsApi } from '@/lib/api/machine-parts';
import { maintenanceApi } from '@/lib/api/maintenance';
import { makeMachineTask, makePart, makeSchedule, page } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { ScheduleFormDialog } from './schedule-form-dialog';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/maintenance');
vi.mock('@/lib/api/machine-parts');

const PARTS = [makePart({ id: 21, name: 'Cutting head', partCode: 'CH-01' }), makePart({ id: 22, name: 'Nozzle', partCode: 'NZ-01' })];

function renderForm(props: Partial<Parameters<typeof ScheduleFormDialog>[0]> = {}) {
  return renderWithProviders(
    <ScheduleFormDialog open onOpenChange={vi.fn()} machineId={5} machineName="Laser 1" {...props} />,
  );
}

async function dialog() {
  return screen.findByRole('dialog', { name: /maintenance task/ });
}

describe('Maintenance task form', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/5');
    signInAs(Role.ADMIN);
    vi.mocked(machinePartsApi.list).mockResolvedValue(page(PARTS));
    vi.mocked(maintenanceApi.createSchedule).mockImplementation(async (_machineId, body) => ({
      data: makeSchedule({ taskName: body.taskName ?? 'Cutting head', intervalDays: body.intervalDays }),
      message: 'Created',
    }));
  });

  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  describe('whole machine', () => {
    it('requires a task name and creates the task without a part', async () => {
      const { user } = renderForm();
      const form = await dialog();

      expect(within(form).getByRole('radio', { name: 'Whole machine' })).toBeChecked();
      expect(within(form).queryByRole('combobox', { name: 'Part' })).not.toBeInTheDocument();

      await user.click(within(form).getByRole('button', { name: 'Add task' }));
      expect(await within(form).findByText('Enter a name for this machine-wide task')).toBeInTheDocument();
      expect(maintenanceApi.createSchedule).not.toHaveBeenCalled();

      await user.type(within(form).getByLabelText('Task name'), 'External cleaning');
      await user.selectOptions(within(form).getByLabelText('Frequency'), 'daily');
      await user.click(within(form).getByRole('button', { name: 'Add task' }));

      await waitFor(() =>
        expect(maintenanceApi.createSchedule).toHaveBeenCalledWith(5, { taskName: 'External cleaning', intervalDays: 1 }),
      );
    });

    it('takes a custom interval and keeps the reminder inside it', async () => {
      const { user } = renderForm();
      const form = await dialog();

      await user.type(within(form).getByLabelText('Task name'), 'Lubrication');
      await user.selectOptions(within(form).getByLabelText('Frequency'), 'custom');
      await user.type(within(form).getByLabelText('Every (days)'), '14');
      await user.type(within(form).getByLabelText('Remind this many days before'), '20');
      await user.click(within(form).getByRole('button', { name: 'Add task' }));
      expect(await within(form).findByText(/reminder can't start earlier/)).toBeInTheDocument();

      await user.clear(within(form).getByLabelText('Remind this many days before'));
      await user.type(within(form).getByLabelText('Remind this many days before'), '2');
      await user.click(within(form).getByRole('button', { name: 'Add task' }));
      await waitFor(() =>
        expect(maintenanceApi.createSchedule).toHaveBeenCalledWith(5, { taskName: 'Lubrication', intervalDays: 14, reminderDaysBefore: 2 }),
      );
    });

    it('shows a duplicate name on the task name field', async () => {
      vi.mocked(maintenanceApi.createSchedule).mockRejectedValue(
        new ApiError({ status: 409, code: 'MAINTENANCE_SCHEDULE_EXISTS', message: 'Task exists' }),
      );
      const { user } = renderForm();
      const form = await dialog();

      await user.type(within(form).getByLabelText('Task name'), 'External cleaning');
      await user.click(within(form).getByRole('button', { name: 'Add task' }));

      expect(await within(form).findByText(/A task with this name already exists/)).toBeInTheDocument();
      expect(within(form).getByLabelText('Task name')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('part', () => {
    it('lists the active parts and names the task after the chosen part', async () => {
      const { user } = renderForm();
      const form = await dialog();

      await user.click(within(form).getByRole('radio', { name: 'Part' }));
      const part = within(form).getByLabelText('Part');
      await waitFor(() => expect(within(part).getByRole('option', { name: 'Cutting head · CH-01' })).toBeInTheDocument());
      expect(machinePartsApi.list).toHaveBeenCalledWith(5, expect.objectContaining({ isActive: true }), expect.anything());

      await user.selectOptions(part, '21');
      expect(within(form).getByLabelText('Task name')).toHaveValue('Cutting head');
      // An untouched name follows the part.
      await user.selectOptions(part, '22');
      expect(within(form).getByLabelText('Task name')).toHaveValue('Nozzle');

      await user.click(within(form).getByRole('button', { name: 'Add task' }));
      await waitFor(() =>
        expect(maintenanceApi.createSchedule).toHaveBeenCalledWith(5, { machinePartId: 22, taskName: 'Nozzle', intervalDays: 7 }),
      );
    });

    it('requires a part and leaves the name optional', async () => {
      const { user } = renderForm();
      const form = await dialog();

      await user.click(within(form).getByRole('radio', { name: 'Part' }));
      await user.click(within(form).getByRole('button', { name: 'Add task' }));
      expect(await within(form).findByText('Choose the part this task inspects')).toBeInTheDocument();
      expect(within(form).queryByText('Enter a name for this machine-wide task')).not.toBeInTheDocument();
    });

    it('starts on the part it was opened for', async () => {
      renderForm({ defaultPartId: 21 });
      const form = await dialog();
      expect(within(form).getByRole('radio', { name: 'Part' })).toBeChecked();
      await waitFor(() => expect(within(form).getByLabelText('Task name')).toHaveValue('Cutting head'));
      expect(within(form).getByLabelText('Part')).toHaveValue('21');
    });
  });

  describe('editing', () => {
    it('keeps the part fixed and patches the task by its id with the changes only', async () => {
      const task = makeSchedule({ id: 3, intervalDays: 7, machinePart: { id: 21, name: 'Cutting head', partCode: 'CH-01' } });
      vi.mocked(maintenanceApi.updateSchedule).mockResolvedValue({ data: { ...task, intervalDays: 30 }, message: 'Updated' });
      const { user } = renderForm({ schedule: task });
      const form = await dialog();

      expect(within(form).queryByRole('radio', { name: 'Part' })).not.toBeInTheDocument();
      expect(within(form).queryByRole('combobox', { name: 'Part' })).not.toBeInTheDocument();
      expect(within(form).getByText(/can't be changed/)).toBeInTheDocument();
      expect(machinePartsApi.list).not.toHaveBeenCalled();

      await user.selectOptions(within(form).getByLabelText('Frequency'), 'monthly');
      await user.click(within(form).getByRole('button', { name: 'Save task' }));

      await waitFor(() => expect(maintenanceApi.updateSchedule).toHaveBeenCalledWith(3, { intervalDays: 30 }));
    });

    it('edits a machine-wide task and can deactivate it', async () => {
      const task = makeMachineTask({ id: 4 });
      vi.mocked(maintenanceApi.updateSchedule).mockResolvedValue({ data: { ...task, isActive: false }, message: 'Updated' });
      const { user } = renderForm({ schedule: task });
      const form = await dialog();

      expect(within(form).getByText('Whole machine')).toBeInTheDocument();
      expect(within(form).getByLabelText('Frequency')).toHaveValue('daily');
      await user.click(within(form).getByRole('checkbox', { name: /Task active/ }));
      await user.click(within(form).getByRole('button', { name: 'Save task' }));

      await waitFor(() => expect(maintenanceApi.updateSchedule).toHaveBeenCalledWith(4, { isActive: false }));
    });
  });
});
