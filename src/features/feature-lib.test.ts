import { describe, expect, it } from 'vitest';
import { makeLog } from '@/test/factories';
import { MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { parseTimeframe, validateCustomRange } from './analytics/lib/timeframe';
import { computeAuditChanges, formatAuditValue, humanizeField } from './audit/lib/changes';
import { countAdvancedLogFilters, parseLogFilters, toListMachineLogsParams } from './machine-logs/lib/filters';
import { buildStateJourney } from './machine-logs/lib/journey';
import { parseMachineFilters, toListMachinesParams } from './machines/lib/filters';

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
    const filters = parseMachineFilters(params('status=DOWNTIME&search=%20press%20&sort=updatedAt:desc&page=2&limit=999&active=maybe'));
    expect(toListMachinesParams(filters)).toEqual({
      page: 2,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      search: 'press',
      status: MachineState.DOWNTIME,
      isActive: undefined,
    });
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
