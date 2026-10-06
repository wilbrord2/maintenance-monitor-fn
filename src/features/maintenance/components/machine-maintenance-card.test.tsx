import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { maintenanceApi } from '@/lib/api/maintenance';
import { makeMachineDetail, makeMaintenanceEvent, makeSchedule, page } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { MaintenanceEventStatus, MaintenanceScheduleState } from '@/types/maintenance';
import { MachineMaintenanceCard } from './machine-maintenance-card';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/maintenance');

describe('Machine maintenance card', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/5');
    vi.mocked(maintenanceApi.listEvents).mockResolvedValue(page([]));
  });

  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  it.each([
    [MaintenanceScheduleState.UPCOMING, 4, 'Upcoming', 'In 4 days'],
    [MaintenanceScheduleState.DUE, 0, 'Due', 'Today'],
    [MaintenanceScheduleState.OVERDUE, -3, 'Overdue', '3 days late'],
  ])('shows a %s schedule with the API\'s own day count', async (state, daysUntilDue, label, timing) => {
    signInAs(Role.TECHNICIAN);
    const machine = makeMachineDetail({ maintenance: makeSchedule({ state, daysUntilDue }) });
    renderWithProviders(<MachineMaintenanceCard machine={machine} />);

    const card = (await screen.findByText('Preventive maintenance')).closest('section') as HTMLElement;
    expect(within(card).getByText(label)).toBeInTheDocument();
    expect(within(card).getByText(timing)).toBeInTheDocument();
  });

  it('shows the dates the API calculated, including a late completion shifting the cycle', async () => {
    signInAs(Role.TECHNICIAN);
    const machine = makeMachineDetail({
      maintenance: makeSchedule({
        intervalDays: 20,
        lastMaintenanceAt: '2026-10-18T11:00:00.000Z',
        nextMaintenanceAt: '2026-11-07T11:00:00.000Z',
      }),
    });
    renderWithProviders(<MachineMaintenanceCard machine={machine} />);

    const card = (await screen.findByText('Preventive maintenance')).closest('section') as HTMLElement;
    expect(within(card).getByText('Every 20 days')).toBeInTheDocument();
    expect(within(card).getByText('18 Oct 2026')).toBeInTheDocument();
    expect(within(card).getByText('7 Nov 2026')).toBeInTheDocument();
  });

  it('offers set-up to administrators only when no schedule exists', async () => {
    signInAs(Role.ADMIN);
    const machine = makeMachineDetail({ maintenance: null });
    const { unmount } = renderWithProviders(<MachineMaintenanceCard machine={machine} />);
    expect(await screen.findByText('No preventive maintenance schedule')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up schedule' })).toBeInTheDocument();
    unmount();

    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MachineMaintenanceCard machine={machine} />);
    expect(await screen.findByText('No preventive maintenance schedule')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set up schedule' })).not.toBeInTheDocument();
  });

  it('hides schedule editing from technicians', async () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MachineMaintenanceCard machine={makeMachineDetail({ maintenance: makeSchedule() })} />);
    await screen.findByText('Preventive maintenance');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('offers the next step for a maintenance that is already under way', async () => {
    signInAs(Role.TECHNICIAN);
    vi.mocked(maintenanceApi.listEvents).mockResolvedValue(
      page([makeMaintenanceEvent({ status: MaintenanceEventStatus.IN_PROGRESS, startedAt: '2026-10-15T09:00:00.000Z' })]),
    );
    renderWithProviders(<MachineMaintenanceCard machine={makeMachineDetail({ maintenance: makeSchedule() })} />);

    expect(await screen.findByText('Maintenance in progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete maintenance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start maintenance' })).not.toBeInTheDocument();
  });

  it('still shows the schedule when the maintenance history cannot be loaded', async () => {
    signInAs(Role.TECHNICIAN);
    vi.mocked(maintenanceApi.listEvents).mockRejectedValue(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' }));
    renderWithProviders(<MachineMaintenanceCard machine={makeMachineDetail({ maintenance: makeSchedule() })} />);

    expect(await screen.findByText('Every 20 days')).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(maintenanceApi.listEvents)).toHaveBeenCalled());
  });
});
