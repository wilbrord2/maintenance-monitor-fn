import { type AnalyticsOverview } from '@/types/analytics';
import { type PaginatedResponse } from '@/types/api';
import { type AuthSession, Role } from '@/types/auth';
import {
  type Machine,
  type MachineDetail,
  MachineOperationalStatus,
  MachineState,
  type StateTransitionRules,
} from '@/types/machine';
import { LogScope, LogStatus, type MachineLog } from '@/types/machine-log';
import { type MachinePart, OperationalImpact } from '@/types/machine-part';
import {
  type MaintenanceEvent,
  MaintenanceEventStatus,
  type MaintenanceSchedule,
  MaintenanceScheduleState,
} from '@/types/maintenance';
import {
  type MachineOperationalStatusUpdatedEvent,
  type MachinePartUpdatedEvent,
  type MachineStatusUpdatedEvent,
  type MaintenanceCompletedEvent,
  type MaintenanceReminderEvent,
} from '@/types/realtime';
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

/** Without parts, the system status is the effective status unless a test says otherwise. */
export function makeMachine(overrides: Partial<Machine> = {}): Machine {
  const status = overrides.status ?? MachineState.ACTIVE;
  return {
    id: 5,
    name: 'Press 1',
    serialNumber: 'PRS-001',
    systemStatus: status,
    operationalStatus: status === MachineState.ACTIVE ? MachineOperationalStatus.OPERATING : MachineOperationalStatus.NOT_OPERATING,
    description: null,
    isActive: true,
    activity: { totalLogs: 3, openLogs: 1, lastActivityAt: '2026-09-15T07:00:00.000Z' },
    parts: { total: 0, active: 0, underMaintenance: 0, downtime: 0, underTest: 0, blocking: 0, critical: 0 },
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    ...overrides,
    status,
  };
}

export function makeMachineDetail(overrides: Partial<MachineDetail> = {}): MachineDetail {
  const { partDetails, maintenance, ...machine } = overrides;
  return {
    ...makeMachine(machine),
    partDetails: partDetails ?? [],
    maintenance: maintenance ?? null,
  };
}

export function makePart(overrides: Partial<MachinePart> = {}): MachinePart {
  const status = overrides.status ?? MachineState.ACTIVE;
  const impact = overrides.operationalImpact ?? OperationalImpact.NON_BLOCKING;
  const isActive = overrides.isActive ?? true;
  return {
    id: 11,
    machineId: 5,
    name: 'Hydraulic pump',
    partCode: 'PMP-01',
    description: null,
    isCritical: false,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    ...overrides,
    status,
    operationalImpact: impact,
    isActive,
    hasDefect: overrides.hasDefect ?? status !== MachineState.ACTIVE,
    isBlockingMachine:
      overrides.isBlockingMachine ??
      (status !== MachineState.ACTIVE && isActive && impact === OperationalImpact.BLOCKING),
  };
}

export function makeSchedule(overrides: Partial<MaintenanceSchedule> = {}): MaintenanceSchedule {
  return {
    id: 3,
    machineId: 5,
    machine: { id: 5, name: 'Press 1', serialNumber: 'PRS-001' },
    intervalDays: 20,
    reminderDaysBefore: 5,
    lastMaintenanceAt: '2026-09-25T09:00:00.000Z',
    nextMaintenanceAt: '2026-10-15T09:00:00.000Z',
    isActive: true,
    state: MaintenanceScheduleState.UPCOMING,
    daysUntilDue: 4,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-25T09:00:00.000Z',
    ...overrides,
  };
}

export function makeMaintenanceEvent(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 60,
    maintenanceScheduleId: 3,
    machine: { id: 5, name: 'Press 1', serialNumber: 'PRS-001' },
    performedBy: { id: 7, fullName: 'John Mugisha', position: 'Mechanic' },
    machineLogId: null,
    scheduledFor: '2026-10-15T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    status: MaintenanceEventStatus.SCHEDULED,
    notes: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

/** A whole-machine log by default; pass `machinePart` (and `scope: PART`) for a part log. */
export function makeLog(overrides: Partial<MachineLog> = {}): MachineLog {
  return {
    id: 42,
    machine: {
      id: 5,
      name: 'Press 1',
      serialNumber: 'PRS-001',
      status: MachineState.UNDER_MAINTENANCE,
      systemStatus: MachineState.UNDER_MAINTENANCE,
      operationalStatus: MachineOperationalStatus.NOT_OPERATING,
    },
    scope: LogScope.MACHINE,
    machinePart: null,
    technician: { id: 7, fullName: 'John Mugisha', position: 'Mechanic' },
    faultDescription: 'Hydraulic pressure drop on main cylinder',
    causeDescription: 'Worn seal',
    entryStatus: MachineState.ACTIVE,
    remedyAction: 'Isolated the cylinder',
    resultingState: MachineState.UNDER_MAINTENANCE,
    operationalImpact: null,
    machineStatusBefore: MachineState.ACTIVE,
    machineStatusAfter: MachineState.UNDER_MAINTENANCE,
    operationalStatusBefore: MachineOperationalStatus.OPERATING,
    operationalStatusAfter: MachineOperationalStatus.NOT_OPERATING,
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

/** A log about part 11 of machine 5. */
export function makePartLog(overrides: Partial<MachineLog> = {}): MachineLog {
  return makeLog({
    id: 90,
    scope: LogScope.PART,
    machinePart: { id: 11, partCode: 'PMP-01', name: 'Hydraulic pump', isCritical: false },
    faultDescription: 'Bearing noise at high speed',
    causeDescription: null,
    remedyAction: null,
    operationalImpact: OperationalImpact.NON_BLOCKING,
    machine: {
      id: 5,
      name: 'Press 1',
      serialNumber: 'PRS-001',
      status: MachineState.UNDER_MAINTENANCE,
      systemStatus: MachineState.ACTIVE,
      operationalStatus: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
    },
    machineStatusBefore: MachineState.ACTIVE,
    machineStatusAfter: MachineState.UNDER_MAINTENANCE,
    operationalStatusBefore: MachineOperationalStatus.OPERATING,
    operationalStatusAfter: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
    ...overrides,
  });
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
    reason: 'Whole-machine log #42',
    trigger: { type: 'MACHINE_LOG', logId: 42, scope: LogScope.MACHINE },
    updatedBy: { id: 7, name: 'John Mugisha' },
    logId: 42,
    timestamp: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

export function makeOperationalStatusEvent(
  overrides: Partial<MachineOperationalStatusUpdatedEvent> = {},
): MachineOperationalStatusUpdatedEvent {
  return {
    machineId: 5,
    machineName: 'Press 1',
    serialNumber: 'PRS-001',
    previousStatus: MachineOperationalStatus.OPERATING,
    newStatus: MachineOperationalStatus.OPERATING_WITH_DEFECTS,
    reason: '1 part(s) with defects that do not stop the machine: PMP-01',
    trigger: { type: 'MACHINE_PART', partId: 11 },
    updatedBy: { id: 7, name: 'John Mugisha' },
    timestamp: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

export function makePartEvent(overrides: Partial<MachinePartUpdatedEvent> = {}): MachinePartUpdatedEvent {
  return {
    machineId: 5,
    partId: 11,
    partCode: 'PMP-01',
    partName: 'Hydraulic pump',
    previousStatus: MachineState.ACTIVE,
    newStatus: MachineState.UNDER_MAINTENANCE,
    operationalImpact: OperationalImpact.NON_BLOCKING,
    isCritical: false,
    logId: 90,
    logStatus: LogStatus.OPEN,
    updatedBy: { id: 7, name: 'John Mugisha' },
    timestamp: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

export function makeReminderEvent(overrides: Partial<MaintenanceReminderEvent> = {}): MaintenanceReminderEvent {
  return {
    scheduleId: 3,
    machineId: 5,
    machineName: 'Press 1',
    serialNumber: 'PRS-001',
    state: MaintenanceScheduleState.DUE,
    nextMaintenanceAt: '2026-10-15T09:00:00.000Z',
    daysUntilDue: 0,
    timestamp: '2026-10-15T06:00:00.000Z',
    ...overrides,
  };
}

export function makeMaintenanceCompletedEvent(
  overrides: Partial<MaintenanceCompletedEvent> = {},
): MaintenanceCompletedEvent {
  return {
    scheduleId: 3,
    eventId: 60,
    machineId: 5,
    machineName: 'Press 1',
    completedAt: '2026-10-18T11:00:00.000Z',
    nextMaintenanceAt: '2026-11-07T11:00:00.000Z',
    performedBy: { id: 7, name: 'John Mugisha' },
    timestamp: '2026-10-18T11:00:00.000Z',
    ...overrides,
  };
}

export function makeOverview(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    range: { from: '2026-08-16T08:30:00.000Z', to: '2026-09-15T08:30:00.000Z', days: 30 },
    machines: { total: 10, active: 6, underMaintenance: 2, downtime: 1, underTest: 1, inactive: 0 },
    machineOperational: { operating: 6, operatingWithDefects: 3, notOperating: 1 },
    parts: { total: 18, active: 14, underMaintenance: 2, downtime: 1, underTest: 1, blocking: 1, critical: 6 },
    maintenance: { total: 8, active: 8, upcoming: 5, due: 2, overdue: 1 },
    logs: { total: 25, open: 4, closed: 21, currentlyOpen: 5 },
    totalDowntimeHours: 36.5,
    ...overrides,
  };
}

export function page<T>(items: T[], overrides: Partial<PaginatedResponse<T>['meta']> = {}): PaginatedResponse<T> {
  return { items, meta: { page: 1, limit: 20, totalItems: items.length, totalPages: items.length > 0 ? 1 : 0, ...overrides } };
}
