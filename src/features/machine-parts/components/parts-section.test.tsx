import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMachineDetail, makePart } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { signInAs, signOutForTest } from '@/test/session';
import { Role } from '@/types/auth';
import { MachineState } from '@/types/machine';
import { OperationalImpact } from '@/types/machine-part';
import { MaintenanceScheduleState } from '@/types/maintenance';
import { PartsSection } from './parts-section';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);

const PARTS = [
  makePart({ id: 1, name: 'Motor', partCode: 'MTR-01', status: MachineState.ACTIVE, isCritical: true }),
  makePart({
    id: 2,
    name: 'Pump',
    partCode: 'PMP-01',
    status: MachineState.UNDER_MAINTENANCE,
    operationalImpact: OperationalImpact.NON_BLOCKING,
  }),
  makePart({ id: 3, name: 'Sensor', partCode: 'SNS-01', status: MachineState.UNDER_TEST }),
  makePart({
    id: 4,
    name: 'Valve',
    partCode: 'VLV-01',
    status: MachineState.DOWNTIME,
    operationalImpact: OperationalImpact.BLOCKING,
    isCritical: true,
  }),
];

const machine = makeMachineDetail({ partDetails: PARTS });

function rowFor(name: string): HTMLElement {
  const table = screen.getByRole('table', { name: /Parts of/ });
  return within(table).getByRole('link', { name }).closest('tr') as HTMLElement;
}

describe('Machine parts section', () => {
  beforeEach(() => setNavigation('/dashboard/machines/5'));
  afterEach(() => {
    signOutForTest();
    vi.clearAllMocks();
  });

  it.each([
    ['Motor', 'Active'],
    ['Pump', 'Under maintenance'],
    ['Sensor', 'Under test'],
    ['Valve', 'Downtime'],
  ])('shows %s as %s', (part, label) => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<PartsSection machine={machine} />);
    expect(within(rowFor(part)).getByText(label)).toBeInTheDocument();
  });

  it('separates a part condition from its effect on the machine', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<PartsSection machine={machine} />);

    // Same kind of problem, different consequence for the machine.
    expect(within(rowFor('Pump')).getByText('Non-blocking')).toBeInTheDocument();
    expect(within(rowFor('Valve')).getByText('Blocking')).toBeInTheDocument();

    // A healthy part has no impact at all.
    expect(within(rowFor('Motor')).getByText('None')).toBeInTheDocument();
  });

  it('marks critical parts without implying their current condition', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<PartsSection machine={machine} />);
    expect(within(rowFor('Motor')).getByText('Critical')).toBeInTheDocument();
    expect(within(rowFor('Pump')).getByText('Standard')).toBeInTheDocument();
  });

  it('lets administrators add parts and hides that from technicians', () => {
    signInAs(Role.ADMIN);
    const { unmount } = renderWithProviders(<PartsSection machine={machine} />);
    expect(screen.getByRole('button', { name: 'Add part' })).toBeInTheDocument();
    unmount();

    signInAs(Role.TECHNICIAN);
    renderWithProviders(<PartsSection machine={machine} />);
    expect(screen.queryByRole('button', { name: 'Add part' })).not.toBeInTheDocument();
  });

  it('explains an empty parts list instead of inventing parts', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<PartsSection machine={makeMachineDetail({ partDetails: [] })} />);
    expect(screen.getByText('No parts configured')).toBeInTheDocument();
    expect(screen.getByText(/An administrator can add them/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("shows each part's next maintenance as the API resolved it", () => {
    signInAs(Role.TECHNICIAN);
    const withTask = makeMachineDetail({
      partDetails: [
        makePart({
          id: 1,
          name: 'Cutting head',
          partCode: 'CH-01',
          nextMaintenance: {
            scheduleId: 3,
            taskName: 'Lens inspection',
            intervalDays: 7,
            nextMaintenanceAt: '2026-10-05T09:00:00.000Z',
            state: MaintenanceScheduleState.OVERDUE,
            daysUntilDue: -2,
          },
        }),
        makePart({ id: 2, name: 'Nozzle', partCode: 'NZ-01' }),
      ],
    });
    renderWithProviders(<PartsSection machine={withTask} />);

    expect(within(rowFor('Cutting head')).getByText('Overdue')).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).getByText('Lens inspection · 2 days late')).toBeInTheDocument();
    expect(within(rowFor('Cutting head')).getByText('5 Oct 2026')).toBeInTheDocument();
    expect(within(rowFor('Nozzle')).getByText('No tasks')).toBeInTheDocument();
  });
});
