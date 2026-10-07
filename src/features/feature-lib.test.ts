import { describe, expect, it } from 'vitest';
import { describeInterval, describeMaintenanceReminder, describeMaintenanceTarget } from '@/constants/maintenance';
import { makeLog, makeMachineTask, makeSchedule } from '@/test/factories';
import { MaintenanceScheduleState } from '@/types/maintenance';
import { MachineOperationalStatus, MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { parseTimeframe, validateCustomRange } from './analytics/lib/timeframe';
import { computeAuditChanges, formatAuditValue, humanizeField } from './audit/lib/changes';
import { countAdvancedLogFilters, parseLogFilters, toListMachineLogsParams } from './machine-logs/lib/filters';
import { buildStateJourney } from './machine-logs/lib/journey';
import { parseMachineFilters, toListMachinesParams } from './machines/lib/filters';
import { groupSchedules, indexByMachine, sortByUrgency, summarizeSchedules } from './maintenance/lib/attention';
import { parseMaintenanceFilters, toBoardFilterParams, toListEventsParams } from './maintenance/lib/filters';

const params = (query: string) => new URLSearchParams(query);
const TODAY = '2026-09-15';

describe('analytics timeframe', () => {
  it('defaults to the last 30 days', () => {
    expect(parseTimeframe(params(''), TODAY)).toEqual({ preset: '30', range: { days: 30 } });
    expect(parseTimeframe(params('range=7'), TODAY).range).toEqual({ days: 7 });
    expect(parseTimeframe(params('range=365'), TODAY).range).toEqual({ days: 30 });
  });

  it('uses valid custom ranges and refuses invalid ones', () => {
    expect(parseTimeframe(params('range=custom&from=2026-09-01&to=2026-09-10'), TODAY)).toMatchObject({
      range: { from: '2026-09-01', to: '2026-09-10' },
    });
    expect(parseTimeframe(params('range=custom&from=2026-09-10&to=2026-09-01'), TODAY).error).toMatch(/on or after/);
    expect(validateCustomRange('2025-01-01', '2026-09-01', TODAY)).toMatch(/366 days/);
    expect(validateCustomRange('2026-09-20', '2026-09-21', TODAY)).toMatch(/future/);
    expect(validateCustomRange(undefined, '2026-09-21', TODAY)).toMatch(/both/);
  });
});

describe('list filters from the URL', () => {
  it('parses machine filters and ignores tampered values', () => {
    const filters = parseMachineFilters(
      params('status=NOT_OPERATING&workflow=DOWNTIME&search=%20press%20&sort=updatedAt:desc&page=2&limit=999&active=maybe'),
    );
    expect(toListMachinesParams(filters)).toEqual({
      page: 2,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      search: 'press',
      operationalStatus: MachineOperationalStatus.NOT_OPERATING,
      status: MachineState.DOWNTIME,
      isActive: undefined,
    });
  });

  it('ignores a machine status that is not an operational status', () => {
    const filters = parseMachineFilters(params('status=DOWNTIME&workflow=OPERATING'));
    expect(filters.operationalStatus).toBeUndefined();
    expect(filters.status).toBeUndefined();
  });

  it('maps "only my logs" to the signed-in user and ignores an inverted date range', () => {
    const filters = parseLogFilters(params('mine=1&from=2026-09-10&to=2026-09-01&logStatus=OPEN&entryStatus=ACTIVE'));
    expect(filters.invalidRange).toBe(true);
    expect(toListMachineLogsParams(filters, 7)).toMatchObject({ userId: 7, from: '2026-09-10', to: undefined, logStatus: LogStatus.OPEN });
    expect(countAdvancedLogFilters(filters)).toBe(4);
  });
});

describe('state journey', () => {
  const log = makeLog({ id: 10, entryStatus: MachineState.ACTIVE, resultingState: MachineState.DOWNTIME });
  const later = [
    makeLog({ id: 12, entryStatus: MachineState.UNDER_MAINTENANCE, resultingState: MachineState.UNDER_TEST }),
    makeLog({ id: 11, entryStatus: MachineState.DOWNTIME, resultingState: MachineState.UNDER_MAINTENANCE }),
  ];

  it('follows the machine from this log through later logs in order', () => {
    const journey = buildStateJourney(log, [...later, log, makeLog({ id: 3 })], false);
    expect(journey.steps.map((step) => step.state)).toEqual([
      MachineState.ACTIVE,
      MachineState.DOWNTIME,
      MachineState.UNDER_MAINTENANCE,
      MachineState.UNDER_TEST,
    ]);
    expect(journey.steps[1]?.isCurrentLog).toBe(true);
    expect(journey.hasMore).toBe(false);
  });

  it('shows only this log when the history page does not reach it', () => {
    const journey = buildStateJourney(log, later, false);
    expect(journey.steps).toHaveLength(2);
    expect(journey.hasMore).toBe(true);
  });
});

describe('audit changes', () => {
  it('compares old and new values field by field', () => {
    expect(computeAuditChanges({ status: 'ACTIVE', name: 'Press' }, { status: 'DOWNTIME', name: 'Press' })).toEqual([
      { field: 'status', before: 'ACTIVE', after: 'DOWNTIME', changed: true },
      { field: 'name', before: 'Press', after: 'Press', changed: false },
    ]);
    expect(computeAuditChanges(null, { isActive: false })).toEqual([{ field: 'isActive', before: undefined, after: false, changed: true }]);
  });

  it('formats values and field names for display', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue(false)).toBe('false');
    expect(formatAuditValue({ a: 1 })).toContain('"a": 1');
    expect(humanizeField('resultingState')).toBe('Resulting state');
  });
});

describe('maintenance tasks', () => {
  const cuttingHead = { id: 21, name: 'Cutting head', partCode: 'CH-01' };
  const nozzle = { id: 22, name: 'Nozzle', partCode: 'NZ-01' };
  const tasks = [
    makeSchedule({ id: 1, machinePartId: 22, machinePart: nozzle, taskName: 'Nozzle', nextMaintenanceAt: '2026-10-20T09:00:00.000Z' }),
    makeMachineTask({ id: 2, taskName: 'Internal cleaning', nextMaintenanceAt: '2026-10-12T09:00:00.000Z' }),
    makeSchedule({ id: 3, machinePartId: 21, machinePart: cuttingHead, taskName: 'Cutting head', nextMaintenanceAt: '2026-10-09T09:00:00.000Z' }),
    makeMachineTask({ id: 4, taskName: 'External cleaning', nextMaintenanceAt: '2026-10-08T09:00:00.000Z' }),
    makeSchedule({ id: 5, machinePartId: 22, machinePart: nozzle, taskName: 'Nozzle alignment', nextMaintenanceAt: '2026-10-10T09:00:00.000Z' }),
  ];

  it('names the frequency, falling back to the number of days', () => {
    expect([1, 7, 30, 14].map(describeInterval)).toEqual(['Daily', 'Weekly', 'Monthly', 'Every 14 days']);
  });

  it('groups machine-wide tasks first, then each part, by due date', () => {
    expect(groupSchedules(tasks).map((group) => [group.label, group.schedules.map((task) => task.id)])).toEqual([
      ['Machine-wide tasks', [4, 2]],
      ['Cutting head', [3]],
      ['Nozzle', [5, 1]],
    ]);
  });

  it('counts only active tasks by the state the API gave them', () => {
    const summary = summarizeSchedules([
      makeSchedule({ id: 1, state: MaintenanceScheduleState.OVERDUE, daysUntilDue: -2 }),
      makeSchedule({ id: 2, state: MaintenanceScheduleState.DUE, daysUntilDue: 0 }),
      makeSchedule({ id: 3, state: MaintenanceScheduleState.OVERDUE, daysUntilDue: -9, isActive: false }),
    ]);
    expect(summary).toMatchObject({ active: 2, inactive: 1, overdue: 1, due: 1, upcoming: 0 });
    expect(summary.next?.id).toBe(1);
  });

  it('keeps the most urgent task of each machine', () => {
    const urgent = makeSchedule({ id: 1, state: MaintenanceScheduleState.OVERDUE, daysUntilDue: -3 });
    const later = makeSchedule({ id: 2, state: MaintenanceScheduleState.UPCOMING, daysUntilDue: 2 });
    expect(indexByMachine(sortByUrgency([later, urgent])).get(5)?.id).toBe(1);
  });

  it('names the task, part and machine in reminders', () => {
    const machineName = 'Laser Cutting System 1 - CNC Laser Cutting Machine';
    expect(describeMaintenanceReminder({ taskName: 'Cutting head', partName: 'Cutting head', machineName, daysUntilDue: -2 })).toBe(
      'Cutting head (Laser Cutting System 1 - CNC Laser Cutting Machine) is overdue by 2 days',
    );
    expect(describeMaintenanceReminder({ taskName: 'External cleaning', partName: null, machineName: 'Press 1', daysUntilDue: 0 })).toBe(
      'External cleaning (Press 1) is due today',
    );
    expect(describeMaintenanceTarget({ taskName: 'Lens check', partName: 'Cutting head', machineName: 'Press 1' })).toBe(
      'Lens check – Cutting head (Press 1)',
    );
    expect(describeMaintenanceTarget({ taskName: null, partName: null, machineName: 'Press 1' })).toBe('Press 1');
  });

  it('reads the board and history filters from the URL', () => {
    const filters = parseMaintenanceFilters(params('machineId=5&partId=21&scope=machine&state=DUE&page=2'));
    expect(filters).toMatchObject({ state: 'DUE', machineId: 5, machinePartId: 21, scope: 'machine', page: 2 });
    // A part implies part tasks, so the scope is not sent with it.
    expect(toBoardFilterParams(filters)).toEqual({ machineId: 5, machinePartId: 21, scope: undefined });
    expect(toListEventsParams(filters)).toMatchObject({ machineId: 5, machinePartId: 21 });

    expect(parseMaintenanceFilters(params('')).state).toBe('OVERDUE');
    // A part without its machine is ignored.
    expect(parseMaintenanceFilters(params('partId=21')).machinePartId).toBeUndefined();
  });
});
