import { describe, expect, it } from 'vitest';
import { makeMaintenanceEvent, makeSchedule } from '@/test/factories';
import {
  completeMaintenanceDefaults,
  createCompleteMaintenanceSchema,
  createMaintenanceScheduleFormSchema,
  hasScheduleChanges,
  type MaintenanceScheduleFormInput,
  maintenanceScheduleToFormInput,
  toCreateScheduleRequest,
  toUpdateScheduleRequest,
} from './maintenance';

const NOW = new Date('2026-10-06T10:00:00.000Z');
const schema = createMaintenanceScheduleFormSchema({ now: () => NOW });

function form(overrides: Partial<MaintenanceScheduleFormInput> = {}): MaintenanceScheduleFormInput {
  return { intervalDays: '20', reminderDaysBefore: '5', lastMaintenanceAt: '', nextMaintenanceAt: '', isActive: true, ...overrides };
}

const errorsFor = (input: MaintenanceScheduleFormInput): Record<string, string> => {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
};

describe('maintenance schedule form', () => {
  it('requires a positive whole-number interval', () => {
    expect(errorsFor(form({ intervalDays: '0' })).intervalDays).toMatch(/at least 1 day/);
    expect(errorsFor(form({ intervalDays: '2.5' })).intervalDays).toMatch(/whole number/);
    expect(errorsFor(form({ intervalDays: '4000' })).intervalDays).toMatch(/at most 3650/);
    expect(errorsFor(form())).toEqual({});
  });

  it('keeps the reminder inside one interval', () => {
    expect(errorsFor(form({ intervalDays: '7', reminderDaysBefore: '10' })).reminderDaysBefore).toMatch(/earlier than/);
    expect(errorsFor(form({ intervalDays: '7', reminderDaysBefore: '7' }))).toEqual({});
  });

  it('rejects a last maintenance in the future', () => {
    expect(errorsFor(form({ lastMaintenanceAt: '2026-11-01T09:00' })).lastMaintenanceAt).toMatch(/future/);
  });

  it('sends only what changed, so the API keeps its own due date', () => {
    const initial = maintenanceScheduleToFormInput(makeSchedule({ intervalDays: 20, reminderDaysBefore: 5 }));
    const unchanged = toUpdateScheduleRequest(schema.parse(initial), initial);
    expect(hasScheduleChanges(unchanged)).toBe(false);

    const changed = toUpdateScheduleRequest(schema.parse({ ...initial, intervalDays: '30' }), initial);
    expect(changed).toEqual({ intervalDays: 30 });
    expect(changed).not.toHaveProperty('nextMaintenanceAt');
  });

  it('passes a known last maintenance to the API instead of computing the next date', () => {
    const request = toCreateScheduleRequest(schema.parse(form({ lastMaintenanceAt: '2026-09-25T09:00' })));
    expect(request.intervalDays).toBe(20);
    expect(request.lastMaintenanceAt).toBeDefined();
    expect(request.nextMaintenanceAt).toBeUndefined();
  });
});

describe('completing a maintenance', () => {
  const event = makeMaintenanceEvent({ startedAt: '2026-10-06T08:00:00.000Z' });
  const completeSchema = createCompleteMaintenanceSchema({ event, now: () => NOW });

  it('defaults to now and accepts it', () => {
    const defaults = completeMaintenanceDefaults(NOW, event);
    expect(completeSchema.safeParse(defaults).success).toBe(true);
  });

  it('never defaults to a moment before the work started', () => {
    // Started seconds ago: the minute-precision control would otherwise round down past the start.
    const justStarted = makeMaintenanceEvent({ startedAt: '2026-10-06T09:59:40.000Z' });
    const schema = createCompleteMaintenanceSchema({ event: justStarted, now: () => new Date('2026-10-06T09:59:50.000Z') });
    const defaults = completeMaintenanceDefaults(new Date('2026-10-06T09:59:50.000Z'), justStarted);
    expect(schema.safeParse(defaults).success).toBe(true);
  });

  it('refuses a completion in the future or before the work started', () => {
    const future = completeSchema.safeParse({ completedAt: '2026-10-07T10:00', notes: '', releaseMachine: true });
    expect(future.success).toBe(false);

    const beforeStart = completeSchema.safeParse({ completedAt: '2026-10-06T07:00', notes: '', releaseMachine: true });
    expect(beforeStart.success).toBe(false);
  });
});
