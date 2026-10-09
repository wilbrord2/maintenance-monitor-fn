import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { machinesApi } from '@/lib/api/machines';
import { maintenanceApi } from '@/lib/api/maintenance';
import { machineLogsApi } from '@/lib/api/machine-logs';
import { makeMachineDetail, makePart, makeSchedule, page } from '@/test/factories';
import { renderWithProviders } from '@/test/render';
import { setNavigation } from '@/test/navigation';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { MachineOperationalStatus, MachineState } from '@/types/machine';
import { OperationalImpact } from '@/types/machine-part';
import { MaintenanceScheduleState } from '@/types/maintenance';
import { MachineDetailView } from './machine-detail-view';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/api/machines');
vi.mock('@/lib/api/maintenance');
vi.mock('@/lib/api/machine-logs');

function arrange(machine = makeMachineDetail()) {
  vi.mocked(machinesApi.get).mockResolvedValue(machine);
  vi.mocked(machinesApi.history).mockResolvedValue(page([]));
  vi.mocked(maintenanceApi.listEvents).mockResolvedValue(page([]));
  vi.mocked(machineLogsApi.list).mockResolvedValue(page([]));
  return machine;
}

describe('Machine detail', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/5');
    signInAs(Role.ADMIN);
  });

  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  it('shows the operational status the API returned, never one derived from the parts', async () => {
    // A part is in DOWNTIME and blocking, which on its own would suggest NOT_OPERATING.
    // The API says OPERATING_WITH_DEFECTS, and that is what has to be displayed.
    arrange(
      makeMachineDetail({
        operationalStatus: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
        status: MachineState.DOWNTIME,
        systemStatus: MachineState.ACTIVE,
        parts: { total: 2, active: 1, underMaintenance: 0, downtime: 1, underTest: 0, blocking: 0, critical: 1 },
        partDetails: [
          makePart({
            id: 11,
            partCode: 'PMP-01',
            status: MachineState.DOWNTIME,
            operationalImpact: OperationalImpact.BLOCKING,
            isCritical: true,
          }),
          makePart({ id: 12, partCode: 'MTR-01', name: 'Main motor' }),
        ],
      }),
    );

    renderWithProviders(<MachineDetailView machineId={5} />);

    const status = await screen.findByText('Machine status');
    const card = status.closest('section') as HTMLElement;
    expect(within(card).getByText('Operating with defects')).toBeInTheDocument();
    expect(within(card).queryByText('Not operating')).not.toBeInTheDocument();

    // The part's own condition is still reported accurately (table and card layouts both render).
    expect((await screen.findAllByText('PMP-01')).length).toBeGreaterThan(0);
  });

  it.each([
    [MachineOperationalStatus.OPERATING, 'Operating'],
    [MachineOperationalStatus.OPERATING_WITH_DEFECTS, 'Operating with defects'],
    [MachineOperationalStatus.NOT_OPERATING, 'Not operating'],
  ])('displays %s as "%s"', async (operationalStatus, label) => {
    arrange(makeMachineDetail({ operationalStatus }));
    renderWithProviders(<MachineDetailView machineId={5} />);
    const status = await screen.findByText('Machine status');
    expect(within(status.closest('section') as HTMLElement).getByText(label)).toBeInTheDocument();
  });

  it('keeps the maintenance state apart from the machine status', async () => {
    arrange(
      makeMachineDetail({
        operationalStatus: MachineOperationalStatus.OPERATING,
        maintenanceSchedules: [makeSchedule({ state: MaintenanceScheduleState.OVERDUE, daysUntilDue: -3 })],
      }),
    );

    renderWithProviders(<MachineDetailView machineId={5} />);

    const status = await screen.findByText('Machine status');
    const card = status.closest('section') as HTMLElement;
    // Overdue maintenance does not make the machine "not operating".
    expect(within(card).getByText('Operating')).toBeInTheDocument();
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
    expect((await screen.findAllByText('3 days late')).length).toBeGreaterThan(0);
  });

  it('shows the effective status first, with the system status only when parts pull it down', async () => {
    arrange(
      makeMachineDetail({
        status: MachineState.UNDER_MAINTENANCE,
        systemStatus: MachineState.ACTIVE,
        operationalStatus: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
      }),
    );
    renderWithProviders(<MachineDetailView machineId={5} />);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Press 1' });
    // The title row holds the status badges.
    const header = heading.parentElement as HTMLElement;
    expect(within(header).getByText('Under maintenance')).toBeInTheDocument();
    expect(within(header).getByText('Operating with defects')).toBeInTheDocument();

    const card = screen.getByText('Machine status').closest('section') as HTMLElement;
    const system = within(card).getByText('System status').parentElement as HTMLElement;
    expect(within(system).getByText('Active')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Why the system status differs' })).toBeInTheDocument();
  });

  it('hides the system status when it matches the effective status', async () => {
    arrange(makeMachineDetail({ status: MachineState.DOWNTIME, systemStatus: MachineState.DOWNTIME }));
    renderWithProviders(<MachineDetailView machineId={5} />);
    await screen.findByText('Machine status');
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
  });

  it('offers an empty state when the machine has no parts yet', async () => {
    arrange(makeMachineDetail({ partDetails: [] }));
    renderWithProviders(<MachineDetailView machineId={5} />);
    expect(await screen.findByText('No parts configured')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add part' }).length).toBeGreaterThan(0);
  });
});
