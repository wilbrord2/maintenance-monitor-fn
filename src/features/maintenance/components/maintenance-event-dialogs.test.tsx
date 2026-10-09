import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { maintenanceApi } from '@/lib/api/maintenance';
import { makeMaintenanceEvent, makePart, makeSchedule, page } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { MaintenanceEventStatus } from '@/types/maintenance';
import {
  CompleteMaintenanceDialog,
  PlanMaintenanceDialog,
  StartMaintenanceDialog,
  StartTaskMaintenanceDialog,
} from './maintenance-event-dialogs';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/maintenance');

describe('Maintenance event dialogs', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/5');
    signInAs(Role.TECHNICIAN);
    vi.mocked(maintenanceApi.listEvents).mockResolvedValue(page([]));
  });

  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  describe('one-off work', () => {
    const parts = [
      makePart({ id: 21, name: 'Cutting head', partCode: 'CH-01' }),
      makePart({ id: 22, name: 'Old lens', partCode: 'LN-01', isActive: false }),
    ];

    it('is created for the machine, with no task', async () => {
      vi.mocked(maintenanceApi.createEvent).mockResolvedValue({ data: makeMaintenanceEvent({ maintenanceScheduleId: null, taskName: null }), message: 'Planned' });
      const { user } = renderWithProviders(
        <PlanMaintenanceDialog open onOpenChange={vi.fn()} machineId={5} machineName="Laser 1" parts={parts} />,
      );
      const dialog = await screen.findByRole('dialog', { name: 'Plan one-off maintenance' });
      await user.click(within(dialog).getByRole('button', { name: 'Plan maintenance' }));
      await waitFor(() => expect(maintenanceApi.createEvent).toHaveBeenCalledWith({ machineId: 5 }));
    });

    it('can be about one active part', async () => {
      vi.mocked(maintenanceApi.createEvent).mockResolvedValue({ data: makeMaintenanceEvent({ maintenanceScheduleId: null, taskName: null }), message: 'Planned' });
      const { user } = renderWithProviders(
        <PlanMaintenanceDialog open onOpenChange={vi.fn()} machineId={5} machineName="Laser 1" parts={parts} />,
      );
      const dialog = await screen.findByRole('dialog', { name: 'Plan one-off maintenance' });
      const part = within(dialog).getByLabelText('Part');
      // Parts out of use are refused by the API, so they are not offered.
      expect(within(part).queryByRole('option', { name: /Old lens/ })).not.toBeInTheDocument();

      await user.selectOptions(part, '21');
      await user.click(within(dialog).getByRole('button', { name: 'Plan maintenance' }));
      await waitFor(() => expect(maintenanceApi.createEvent).toHaveBeenCalledWith({ machineId: 5, machinePartId: 21 }));
    });
  });

  describe('starting and completing', () => {
    it('speaks of the part for part work and of the machine otherwise', async () => {
      const partEvent = makeMaintenanceEvent();
      const { unmount } = renderWithProviders(<StartMaintenanceDialog open onOpenChange={vi.fn()} event={partEvent} />);
      expect(await screen.findByRole('checkbox', { name: /Put part under maintenance/ })).toBeChecked();
      unmount();

      const machineEvent = makeMaintenanceEvent({ machinePartId: null, machinePart: null, taskName: 'External cleaning' });
      renderWithProviders(<StartMaintenanceDialog open onOpenChange={vi.fn()} event={machineEvent} />);
      expect(await screen.findByRole('checkbox', { name: /Put machine under maintenance/ })).toBeChecked();
    });

    it('can start without taking the part out of service', async () => {
      const event = makeMaintenanceEvent({ id: 60 });
      vi.mocked(maintenanceApi.startEvent).mockResolvedValue({ data: { ...event, status: MaintenanceEventStatus.IN_PROGRESS }, message: 'Started' });
      const { user } = renderWithProviders(<StartMaintenanceDialog open onOpenChange={vi.fn()} event={event} />);
      const dialog = await screen.findByRole('dialog', { name: 'Start maintenance' });

      await user.click(within(dialog).getByRole('checkbox', { name: /Put part under maintenance/ }));
      await user.click(within(dialog).getByRole('button', { name: 'Start maintenance' }));
      await waitFor(() => expect(maintenanceApi.startEvent).toHaveBeenCalledWith(60, { putUnderMaintenance: false }));
    });

    it('returns the part to active on completion unless told otherwise', async () => {
      const event = makeMaintenanceEvent({ id: 61, status: MaintenanceEventStatus.IN_PROGRESS, startedAt: '2026-10-01T08:00:00.000Z' });
      vi.mocked(maintenanceApi.completeEvent).mockResolvedValue({
        data: { ...event, status: MaintenanceEventStatus.COMPLETED, completedAt: '2026-10-01T10:00:00.000Z' },
        message: 'Completed',
      });
      const { user } = renderWithProviders(<CompleteMaintenanceDialog open onOpenChange={vi.fn()} event={event} />);
      const dialog = await screen.findByRole('dialog', { name: 'Complete maintenance' });

      expect(within(dialog).getByRole('checkbox', { name: /Return it to active when completed/ })).toBeChecked();
      await user.click(within(dialog).getByRole('button', { name: 'Complete maintenance' }));
      await waitFor(() =>
        expect(maintenanceApi.completeEvent).toHaveBeenCalledWith(61, expect.objectContaining({ releaseOnComplete: true })),
      );
    });

    it('links to the open maintenance when the task already has one', async () => {
      const open = makeMaintenanceEvent({ id: 88, status: MaintenanceEventStatus.SCHEDULED });
      vi.mocked(maintenanceApi.createEvent).mockRejectedValue(
        new ApiError({ status: 409, code: 'MAINTENANCE_EVENT_ALREADY_OPEN', message: 'Already open' }),
      );
      vi.mocked(maintenanceApi.listEvents).mockImplementation(async (params) =>
        page(params.maintenanceScheduleId === 3 && params.status === MaintenanceEventStatus.SCHEDULED ? [open] : []),
      );
      const { user } = renderWithProviders(
        <StartTaskMaintenanceDialog open onOpenChange={vi.fn()} schedule={makeSchedule({ id: 3 })} machineName="Laser 1" />,
      );
      const dialog = await screen.findByRole('dialog', { name: 'Start maintenance' });
      await user.click(within(dialog).getByRole('button', { name: 'Start maintenance' }));

      expect(await within(dialog).findByText(/already has a maintenance planned or in progress/)).toBeInTheDocument();
      expect(await within(dialog).findByRole('link', { name: 'Open the planned maintenance' })).toHaveAttribute(
        'href',
        '/dashboard/maintenance/events/88',
      );
      expect(maintenanceApi.startEvent).not.toHaveBeenCalled();
    });
  });
});
