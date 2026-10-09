import { describe, expect, it } from 'vitest';
import { makeMachineTask, makeMaintenanceEvent, makeSchedule } from '@/test/factories';
import {
  completeMaintenanceDefaults,
  createCompleteMaintenanceSchema,
  createMaintenanceScheduleFormSchema,
  hasScheduleChanges,
  type MaintenanceScheduleFormInput,
  maintenanceScheduleToFormInput,
  scheduleServerFieldMap,
  toCompleteEventRequest,
  toCreateEventRequest,
  toCreateScheduleRequest,
  toStartEventRequest,
  toUpdateScheduleRequest,
} from './maintenance';

const NOW = new Date('2026-10-06T10:00:00.000Z');
const schema = createMaintenanceScheduleFormSchema({ now: () => NOW });
const editSchema = createMaintenanceScheduleFormSchema({ now: () => NOW, isEdit: true });

/** A machine-wide weekly task by default. */
function form(overrides: Partial<MaintenanceScheduleFormInput> = {}): MaintenanceScheduleFormInput {
  return {
    ...maintenanceScheduleToFormInput(),
    taskName: 'External cleaning',
    ...overrides,
  };
}

const errorsFor = (input: MaintenanceScheduleFormInput, using = schema): Record<string, string> => {
  const result = using.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
};

describe('maintenance task form', () => {
  it('starts as a weekly machine-wide task, leaving the reminder to the server', () => {
    expect(maintenanceScheduleToFormInput()).toMatchObject({
      appliesTo: 'machine',
      machinePartId: '',
      frequency: 'weekly',
      reminderDaysBefore: '',
    });
  });

  it('starts as a task of the given part, named after it', () => {
    expect(maintenanceScheduleToFormInput(null, { machinePartId: 11, partName: 'Cutting head' })).toMatchObject({
      appliesTo: 'part',
      machinePartId: '11',
      taskName: 'Cutting head',
    });
  });

  it('requires a name for a machine-wide task only', () => {
    expect(errorsFor(form({ taskName: '' })).taskName).toMatch(/name/);
    expect(errorsFor(form({ appliesTo: 'part', machinePartId: '11', taskName: '' }))).toEqual({});
  });

  it('requires a part for a new part task, but not when editing one', () => {
    expect(errorsFor(form({ appliesTo: 'part', machinePartId: '' })).machinePartId).toMatch(/part/);
    expect(errorsFor(form({ appliesTo: 'part', machinePartId: '' }), editSchema)).toEqual({});
  });

  it('checks a custom interval and ignores it for the preset frequencies', () => {
    expect(errorsFor(form({ frequency: 'custom', intervalDays: '0' })).intervalDays).toMatch(/at least 1 day/);
    expect(errorsFor(form({ frequency: 'custom', intervalDays: '2.5' })).intervalDays).toMatch(/whole number/);
    expect(errorsFor(form({ frequency: 'custom', intervalDays: '4000' })).intervalDays).toMatch(/at most 3650/);
    expect(errorsFor(form({ frequency: 'custom', intervalDays: '14' }))).toEqual({});
    expect(errorsFor(form({ frequency: 'monthly', intervalDays: 'junk' }))).toEqual({});
  });

  it('keeps an optional reminder inside one interval, whatever the frequency', () => {
    expect(errorsFor(form({ frequency: 'weekly', reminderDaysBefore: '' }))).toEqual({});
    expect(errorsFor(form({ frequency: 'weekly', reminderDaysBefore: '7' }))).toEqual({});
    expect(errorsFor(form({ frequency: 'weekly', reminderDaysBefore: '8' })).reminderDaysBefore).toMatch(/earlier than/);
    expect(errorsFor(form({ frequency: 'daily', reminderDaysBefore: '2' })).reminderDaysBefore).toMatch(/1 days/);
    expect(errorsFor(form({ frequency: 'custom', intervalDays: '14', reminderDaysBefore: '10' }))).toEqual({});
  });

  it('rejects a last maintenance in the future', () => {
    expect(errorsFor(form({ lastMaintenanceAt: '2026-11-01T09:00' })).lastMaintenanceAt).toMatch(/future/);
  });

  it('reads the frequency back from a task, falling back to a custom interval', () => {
    expect(maintenanceScheduleToFormInput(makeSchedule({ intervalDays: 30 }))).toMatchObject({ frequency: 'monthly', intervalDays: '' });
    expect(maintenanceScheduleToFormInput(makeSchedule({ intervalDays: 20 }))).toMatchObject({ frequency: 'custom', intervalDays: '20' });
    expect(maintenanceScheduleToFormInput(makeMachineTask())).toMatchObject({ appliesTo: 'machine', frequency: 'daily' });
  });

  it('routes an interval error from the API to the control that holds it', () => {
    expect(scheduleServerFieldMap('weekly')).toEqual({ intervalDays: 'frequency' });
    expect(scheduleServerFieldMap('custom')).toEqual({ intervalDays: 'intervalDays' });
  });
});

describe('maintenance task requests', () => {
  it('creates a machine-wide task without a part', () => {
    const request = toCreateScheduleRequest(schema.parse(form({ frequency: 'daily' })));
    expect(request).toEqual({ taskName: 'External cleaning', intervalDays: 1 });
  });

  it('creates a part task, letting the API name it after the part when no name is given', () => {
    const request = toCreateScheduleRequest(
      schema.parse(form({ appliesTo: 'part', machinePartId: '11', taskName: '', frequency: 'weekly', reminderDaysBefore: '2' })),
    );
    expect(request).toEqual({ machinePartId: 11, intervalDays: 7, reminderDaysBefore: 2 });
  });

  it('passes a known last maintenance to the API instead of computing the next date', () => {
    const request = toCreateScheduleRequest(schema.parse(form({ frequency: 'custom', intervalDays: '20', lastMaintenanceAt: '2026-09-25T09:00' })));
    expect(request.intervalDays).toBe(20);
    expect(request.lastMaintenanceAt).toBeDefined();
    expect(request.nextMaintenanceAt).toBeUndefined();
  });

  it('sends only what changed, never the part, so the API keeps its own due date', () => {
    const initial = maintenanceScheduleToFormInput(makeSchedule({ intervalDays: 7, reminderDaysBefore: 3 }));
    const unchanged = toUpdateScheduleRequest(editSchema.parse(initial), initial);
    expect(hasScheduleChanges(unchanged)).toBe(false);

    const changed = toUpdateScheduleRequest(editSchema.parse({ ...initial, frequency: 'monthly', taskName: 'Cutting head check' }), initial);
    expect(changed).toEqual({ intervalDays: 30, taskName: 'Cutting head check' });
    expect(changed).not.toHaveProperty('machinePartId');
    expect(changed).not.toHaveProperty('nextMaintenanceAt');
  });

  it('clears the instructions with null and deactivates with isActive', () => {
    const initial = maintenanceScheduleToFormInput(makeSchedule({ intervalDays: 7, description: 'Check the lens' }));
    expect(toUpdateScheduleRequest(editSchema.parse({ ...initial, description: '', isActive: false }), initial)).toEqual({
      description: null,
      isActive: false,
    });
  });
});

describe('maintenance event requests', () => {
  it('plans a task with its id only', () => {
    expect(toCreateEventRequest({ scheduledFor: '', machinePartId: '11', notes: '' }, { kind: 'task', maintenanceScheduleId: 3 })).toEqual({
      maintenanceScheduleId: 3,
    });
  });

  it('plans one-off work for the machine or one of its parts', () => {
    expect(toCreateEventRequest({ scheduledFor: '', machinePartId: '', notes: '' }, { kind: 'one-off', machineId: 5 })).toEqual({ machineId: 5 });
    expect(toCreateEventRequest({ scheduledFor: '', machinePartId: '11', notes: 'Noise' }, { kind: 'one-off', machineId: 5 })).toEqual({
      machineId: 5,
      machinePartId: 11,
      notes: 'Noise',
    });
  });

  it('uses the renamed start and complete flags', () => {
    expect(toStartEventRequest({ notes: '', putUnderMaintenance: false })).toEqual({ putUnderMaintenance: false });
    expect(toCompleteEventRequest({ completedAt: '', notes: '', releaseOnComplete: true })).toEqual({ releaseOnComplete: true });
  });
});

describe('completing a maintenance', () => {
  const event = makeMaintenanceEvent({ startedAt: '2026-10-06T08:00:00.000Z' });
  const completeSchema = createCompleteMaintenanceSchema({ event, now: () => NOW });

  it('defaults to now and accepts it', () => {
    const defaults = completeMaintenanceDefaults(NOW, event);
    expect(defaults.releaseOnComplete).toBe(true);
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
    const future = completeSchema.safeParse({ completedAt: '2026-10-07T10:00', notes: '', releaseOnComplete: true });
    expect(future.success).toBe(false);

    const beforeStart = completeSchema.safeParse({ completedAt: '2026-10-06T07:00', notes: '', releaseOnComplete: true });
    expect(beforeStart.success).toBe(false);
  });
});
