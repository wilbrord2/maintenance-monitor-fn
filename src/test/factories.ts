import { type AnalyticsOverview } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import { type AuthSession, Role } from '@/types/auth';
import { type Machine, MachineState, type StateTransitionRules } from '@/types/machine';
import { LogStatus, type MachineLog } from '@/types/machine-log';
import { type MachineStatusUpdatedEvent } from '@/types/realtime';
import { type User } from '@/types/user';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    fullName: 'Amina Uwase',
    email: 'amina@example.com',
    phone: '0780000001',
    position: 'Maintenance Lead',
    role: Role.ADMIN,
    isActive: true,
    mustChangePassword: false,
    isLocked: false,
    lastLoginAt: '2026-09-15T08:00:00.000Z',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    ...overrides,
  };
}

export function makeMachine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 5,
    name: 'Press 1',
    serialNumber: 'PRS-001',
    status: MachineState.ACTIVE,
    description: null,
    isActive: true,
    activity: { totalLogs: 3, openLogs: 1, lastActivityAt: '2026-09-15T07:00:00.000Z' },
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    ...overrides,
  };
}

export function makeLog(overrides: Partial<MachineLog> = {}): MachineLog {
  return {
    id: 42,
    machine: { id: 5, name: 'Press 1', serialNumber: 'PRS-001' },
    technician: { id: 7, fullName: 'John Mugisha', position: 'Mechanic' },
    faultDescription: 'Hydraulic pressure drop on main cylinder',
    causeDescription: 'Worn seal',
    entryStatus: MachineState.ACTIVE,
    remedyAction: 'Isolated the cylinder',
    resultingState: MachineState.UNDER_MAINTENANCE,
    downtimeHours: 0,
    logStatus: LogStatus.OPEN,
    nextMaintenancePlan: null,
    startedAt: '2026-09-15T07:45:00.000Z',
    endedAt: null,
    version: 1,
    createdAt: '2026-09-15T07:46:10.000Z',
    updatedAt: '2026-09-15T07:46:10.000Z',
    ...overrides,
  };
}

/** The API's default policy: every state can move to every other, same-state entries allowed. */
export const DEFAULT_RULES: StateTransitionRules = {
  allowSameStateEntries: true,
  transitions: {
    [MachineState.ACTIVE]: [MachineState.UNDER_MAINTENANCE, MachineState.DOWNTIME, MachineState.UNDER_TEST],
    [MachineState.UNDER_MAINTENANCE]: [MachineState.ACTIVE, MachineState.DOWNTIME, MachineState.UNDER_TEST],
    [MachineState.UNDER_TEST]: [MachineState.ACTIVE, MachineState.UNDER_MAINTENANCE, MachineState.DOWNTIME],
    [MachineState.DOWNTIME]: [MachineState.ACTIVE, MachineState.UNDER_MAINTENANCE, MachineState.UNDER_TEST],
  },
  statesRequiringOpenLog: [MachineState.DOWNTIME, MachineState.UNDER_MAINTENANCE],
};

export function makeSession(overrides: { user?: Partial<User>; mustChangePassword?: boolean; expiresInMs?: number } = {}): AuthSession {
  const user = makeUser(overrides.user);
  const now = Date.now();
  return {
    user,
    mustChangePassword: overrides.mustChangePassword ?? user.mustChangePassword,
    tokens: {
      tokenType: 'Bearer',
      accessToken: `access-${now}`,
      accessTokenExpiresAt: new Date(now + (overrides.expiresInMs ?? 15 * 60_000)).toISOString(),
      refreshToken: 'refresh-token-not-stored',
      refreshTokenExpiresAt: new Date(now + 7 * 86_400_000).toISOString(),
    },
  };
}

export function makeStatusEvent(overrides: Partial<MachineStatusUpdatedEvent> = {}): MachineStatusUpdatedEvent {
  return {
    machineId: 5,
    machineName: 'Press 1',
    serialNumber: 'PRS-001',
    previousStatus: MachineState.ACTIVE,
    newStatus: MachineState.UNDER_MAINTENANCE,
    updatedBy: { id: 7, name: 'John Mugisha' },
    logId: 42,
    source: 'MACHINE_LOG_CREATED',
    timestamp: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

export function makeOverview(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    range: { from: '2026-08-16T08:30:00.000Z', to: '2026-09-15T08:30:00.000Z', days: 30 },
    machines: { total: 10, active: 6, underMaintenance: 2, downtime: 1, underTest: 1, inactive: 0 },
    logs: { total: 25, open: 4, closed: 21, currentlyOpen: 5 },
    totalDowntimeHours: 36.5,
    ...overrides,
  };
}

export function page<T>(items: T[], overrides: Partial<PaginatedResponse<T>['meta']> = {}): PaginatedResponse<T> {
  return { items, meta: { page: 1, limit: 20, totalItems: items.length, totalPages: items.length > 0 ? 1 : 0, ...overrides } };
}
