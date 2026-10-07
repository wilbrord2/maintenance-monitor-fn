import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceApi } from '@/lib/api/maintenance';
import { makeMachineDetail, makeMachineTask, makeMaintenanceEvent, makePart, makeSchedule, page } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { MaintenanceEventStatus, MaintenanceScheduleState } from '@/types/maintenance';
import { MaintenancePlanSection } from './maintenance-plan-section';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/maintenance');
vi.mock('@/lib/api/machine-parts');

const CUTTING_HEAD = { id: 21, name: 'Cutting head', partCode: 'CH-01' };
const NOZZLE = { id: 22, name: 'Nozzle', partCode: 'NZ-01' };

const TASKS = [
  makeMachineTask({ id: 1, taskName: 'External cleaning', intervalDays: 1, state: MaintenanceScheduleState.DUE, daysUntilDue: 0 }),
  makeMachineTask({
    id: 2,
    taskName: 'Internal cleaning',
    intervalDays: 7,
    nextMaintenanceAt: '2026-10-20T09:00:00.000Z',
    state: MaintenanceScheduleState.UPCOMING,
    daysUntilDue: 9,
  }),
  makeSchedule({
    id: 3,
    machinePartId: CUTTING_HEAD.id,
    machinePart: CUTTING_HEAD,
    taskName: 'Cutting head',
    intervalDays: 7,
    state: MaintenanceScheduleState.OVERDUE,
    daysUntilDue: -2,
  }),
  makeSchedule({
    id: 4,
    machinePartId: NOZZLE.id,
    machinePart: NOZZLE,
    taskName: 'Nozzle',
    intervalDays: 30,
    state: MaintenanceScheduleState.UPCOMING,
    daysUntilDue: 12,
  }),
  makeSchedule({
    id: 5,
    machinePartId: NOZZLE.id,
    machinePart: NOZZLE,
    taskName: 'Nozzle alignment',
    intervalDays: 14,
    isActive: false,
  }),
];

const machine = makeMachineDetail({
  name: 'Laser 1',
  maintenanceSchedules: TASKS,
  partDetails: [makePart({ id: CUTTING_HEAD.id, name: CUTTING_HEAD.name }), makePart({ id: NOZZLE.id, name: NOZZLE.name })],
});

function table(): HTMLElement {
  return screen.getByRole('table', { name: 'Maintenance tasks of Laser 1' });
}

function rowFor(taskName: string): HTMLElement {
  return within(table()).getByText(taskName, { selector: 'span' }).closest('tr') as HTMLElement;
}

describe('Machine maintenance plan', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/5');
    vi.mocked(maintenanceApi.listEvents).mockResolvedValue(page([]));
  });

  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  it('groups machine-wide tasks first, then part inspections by part', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MaintenancePlanSection machine={machine} />);

    const groups = within(table())
      .getAllByRole('columnheader')
      .filter((cell) => cell.getAttribute('scope') === 'colgroup')
      .map((cell) => cell.textContent);
    expect(groups).toEqual(['Machine-wide tasks', 'Part inspections · Cutting head CH-01', 'Part inspections · Nozzle NZ-01']);
  });

  it('shows each task with its frequency and the state the API derived', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MaintenancePlanSection machine={machine} />);

    expect(within(rowFor('External cleaning')).getByText('Daily')).toBeInTheDocument();
    expect(within(rowFor('External cleaning')).getByText('Due')).toBeInTheDocument();
    expect(within(rowFor('Internal cleaning')).getByText('Weekly')).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).getByText('Overdue')).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).getByText('2 days late')).toBeInTheDocument();
    expect(within(rowFor('Nozzle')).getByText('Monthly')).toBeInTheDocument();
  });

  it('hides inactive tasks until asked, then greys them out', async () => {
    signInAs(Role.TECHNICIAN);
    const { user } = renderWithProviders(<MaintenancePlanSection machine={machine} />);

    expect(within(table()).queryByText('Nozzle alignment')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'All (1 inactive)' }));
    expect(rowFor('Nozzle alignment')).toHaveClass('opacity-60');
    expect(within(rowFor('Nozzle alignment')).getByText('Every 14 days')).toBeInTheDocument();
  });

  it('filters by maintenance state', async () => {
    signInAs(Role.TECHNICIAN);
    const { user } = renderWithProviders(<MaintenancePlanSection machine={machine} />);

    await user.click(screen.getByRole('radio', { name: /Overdue/ }));
    expect(within(table()).getByText('Cutting head', { selector: 'span' })).toBeInTheDocument();
    expect(within(table()).queryByText('External cleaning')).not.toBeInTheDocument();
  });

  it('lets technicians start tasks but not edit or switch them off', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MaintenancePlanSection machine={machine} />);

    expect(within(rowFor('Cutting head')).getByRole('button', { name: 'Start maintenance: Cutting head' })).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
  });

  it('lets administrators add, edit and deactivate tasks', async () => {
    signInAs(Role.ADMIN);
    vi.mocked(maintenanceApi.updateSchedule).mockResolvedValue({ data: { ...TASKS[0]!, isActive: false }, message: 'Updated' });
    const { user } = renderWithProviders(<MaintenancePlanSection machine={machine} />);

    expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
    await user.click(within(rowFor('External cleaning')).getByRole('checkbox', { name: 'External cleaning active' }));
    await waitFor(() => expect(maintenanceApi.updateSchedule).toHaveBeenCalledWith(1, { isActive: false }));

    await user.click(within(rowFor('Cutting head')).getByRole('button', { name: 'More actions for Cutting head' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit task' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Deactivate task' })).toBeInTheDocument();
  });

  it('starts a task by planning it with only its id, then starting it on the part', async () => {
    signInAs(Role.TECHNICIAN);
    const planned = makeMaintenanceEvent({ id: 70, maintenanceScheduleId: 3, taskName: 'Cutting head', machinePartId: 21, machinePart: CUTTING_HEAD });
    vi.mocked(maintenanceApi.createEvent).mockResolvedValue({ data: planned, message: 'Planned' });
    vi.mocked(maintenanceApi.startEvent).mockResolvedValue({
      data: { ...planned, status: MaintenanceEventStatus.IN_PROGRESS, startedAt: '2026-10-07T09:00:00.000Z' },
      message: 'Started',
    });
    const { user } = renderWithProviders(<MaintenancePlanSection machine={machine} />);

    await user.click(within(rowFor('Cutting head')).getByRole('button', { name: 'Start maintenance: Cutting head' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start maintenance' });
    const putUnder = within(dialog).getByRole('checkbox', { name: /Put part under maintenance/ });
    expect(putUnder).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Start maintenance' }));

    await waitFor(() => expect(maintenanceApi.startEvent).toHaveBeenCalledWith(70, { putUnderMaintenance: true }));
    expect(maintenanceApi.createEvent).toHaveBeenCalledWith({ maintenanceScheduleId: 3 });
  });

  it('offers to complete a task that is already in progress', async () => {
    signInAs(Role.TECHNICIAN);
    const running = makeMaintenanceEvent({
      id: 71,
      maintenanceScheduleId: 3,
      status: MaintenanceEventStatus.IN_PROGRESS,
      startedAt: '2026-10-07T08:00:00.000Z',
    });
    vi.mocked(maintenanceApi.listEvents).mockImplementation(async (params) =>
      page(params.status === MaintenanceEventStatus.IN_PROGRESS ? [running] : []),
    );
    renderWithProviders(<MaintenancePlanSection machine={machine} />);

    expect(await within(rowFor('Cutting head')).findByRole('button', { name: 'Complete maintenance: Cutting head' })).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).getByText('In progress')).toBeInTheDocument();
    expect(within(rowFor('Nozzle')).getByRole('button', { name: 'Start maintenance: Nozzle' })).toBeInTheDocument();
    // The machine's open maintenance is listed above the plan.
    expect(screen.getByText('Maintenance under way')).toBeInTheDocument();
  });

  it('explains an empty plan, with set-up for administrators only', () => {
    signInAs(Role.ADMIN);
    const empty = makeMachineDetail({ maintenanceSchedules: [] });
    const { unmount } = renderWithProviders(<MaintenancePlanSection machine={empty} />);
    expect(screen.getByText('No maintenance tasks')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add task' }).length).toBeGreaterThan(0);
    unmount();

    signInAs(Role.TECHNICIAN);
    renderWithProviders(<MaintenancePlanSection machine={empty} />);
    expect(screen.getByText('No maintenance tasks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
  });
});
