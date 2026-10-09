import { z } from 'zod';
import { frequencyForInterval, MAINTENANCE_FREQUENCY_DAYS, type MaintenanceFrequency } from '@/constants/maintenance';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/utils/date';
import {
  type CompleteMaintenanceEventRequest,
  type CreateMaintenanceEventRequest,
  type CreateMaintenanceScheduleRequest,
  type MaintenanceEvent,
  type MaintenanceSchedule,
  type StartMaintenanceEventRequest,
  type UpdateMaintenanceScheduleRequest,
} from '@/types/maintenance';
import { emptyToUndefined, optionalText } from './primitives';

export const MAX_INTERVAL_DAYS = 3650;
export const MAX_TASK_NAME_LENGTH = 160;
/** The API rejects timestamps more than five minutes in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const WHOLE_NUMBER_PATTERN = /^\d{1,4}$/;

/** What a task applies to: the whole machine, or one of its parts. */
export type MaintenanceTaskTarget = 'machine' | 'part';
/** The three plant frequencies, or a custom number of days. */
export type MaintenanceFrequencyChoice = MaintenanceFrequency | 'custom';

/**
 * One maintenance task. Due dates are not part of the form beyond the optional first one: the API
 * derives every later due date from the actual completion time.
 */
const maintenanceScheduleFormObject = z.object({
  appliesTo: z.enum(['machine', 'part']),
  /** Selected part id as a string; empty for a machine-wide task. */
  machinePartId: z.string(),
  taskName: optionalText({ label: 'Task name', max: MAX_TASK_NAME_LENGTH }),
  description: optionalText({ label: 'Description', max: 2000, multiline: true }),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  /** Only read when `frequency` is custom. */
  intervalDays: z.string().trim(),
  /** Empty means "use the server default" on create, and "keep it" on edit. */
  reminderDaysBefore: z.string().trim(),
  lastMaintenanceAt: z.string(),
  nextMaintenanceAt: z.string(),
  isActive: z.boolean(),
});

export type MaintenanceScheduleFormInput = z.input<typeof maintenanceScheduleFormObject>;
export type MaintenanceScheduleFormValues = z.output<typeof maintenanceScheduleFormObject>;
export type MaintenanceScheduleFormField = keyof MaintenanceScheduleFormInput;

export const MAINTENANCE_SCHEDULE_FORM_FIELDS: readonly MaintenanceScheduleFormField[] = Object.keys(
  maintenanceScheduleFormObject.shape,
) as MaintenanceScheduleFormField[];

/** The interval the form describes, or null while the custom value is not a whole number. */
export function resolveIntervalDays(values: Pick<MaintenanceScheduleFormInput, 'frequency' | 'intervalDays'>): number | null {
  if (values.frequency !== 'custom') return MAINTENANCE_FREQUENCY_DAYS[values.frequency];
  const trimmed = values.intervalDays.trim();
  return WHOLE_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

/** Maps API field names onto the form: the interval belongs to the frequency picker unless it is custom. */
export function scheduleServerFieldMap(
  frequency: MaintenanceFrequencyChoice,
): Readonly<Record<string, MaintenanceScheduleFormField>> {
  return { intervalDays: frequency === 'custom' ? 'intervalDays' : 'frequency' };
}

export function createMaintenanceScheduleFormSchema(context: { now?: () => Date; isEdit?: boolean } = {}) {
  return maintenanceScheduleFormObject.superRefine((values, ctx) => {
    const issue = (path: MaintenanceScheduleFormField, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const now = (context.now?.() ?? new Date()).getTime();

    // The part of an existing task cannot change, so it is only checked when creating.
    if (!context.isEdit && values.appliesTo === 'part' && !values.machinePartId) {
      issue('machinePartId', 'Choose the part this task inspects');
    }
    if (values.appliesTo === 'machine' && !values.taskName) {
      issue('taskName', 'Enter a name for this machine-wide task');
    }

    let interval: number | null = null;
    if (values.frequency === 'custom') {
      if (!WHOLE_NUMBER_PATTERN.test(values.intervalDays)) {
        issue('intervalDays', 'Enter the interval as a whole number of days');
      } else {
        interval = Number(values.intervalDays);
        if (interval < 1) issue('intervalDays', 'The interval must be at least 1 day');
        else if (interval > MAX_INTERVAL_DAYS) issue('intervalDays', `The interval must be at most ${MAX_INTERVAL_DAYS} days`);
      }
    } else {
      interval = MAINTENANCE_FREQUENCY_DAYS[values.frequency];
    }

    if (values.reminderDaysBefore) {
      if (!WHOLE_NUMBER_PATTERN.test(values.reminderDaysBefore)) {
        issue('reminderDaysBefore', 'Enter the reminder as a whole number of days');
      } else if (interval !== null && Number(values.reminderDaysBefore) > interval) {
        issue('reminderDaysBefore', `The reminder can't start earlier than one full interval (${interval} days) before`);
      }
    }

    if (values.lastMaintenanceAt) {
      const iso = fromDateTimeLocalValue(values.lastMaintenanceAt);
      if (!iso) issue('lastMaintenanceAt', 'Enter a valid date and time');
      else if (Date.parse(iso) > now + FUTURE_TOLERANCE_MS) {
        issue('lastMaintenanceAt', "The last time it was done can't be in the future");
      }
    }

    if (values.nextMaintenanceAt && !fromDateTimeLocalValue(values.nextMaintenanceAt)) {
      issue('nextMaintenanceAt', 'Enter a valid date and time');
    }
  });
}

/**
 * Form values for a task. A new task starts weekly with the server's reminder default; pass
 * `machinePartId` (and the part's name) to start a part task for that part.
 */
export function maintenanceScheduleToFormInput(
  schedule?: MaintenanceSchedule | null,
  defaults: { machinePartId?: number; partName?: string } = {},
): MaintenanceScheduleFormInput {
  if (!schedule) {
    const forPart = defaults.machinePartId !== undefined;
    return {
      appliesTo: forPart ? 'part' : 'machine',
      machinePartId: forPart ? String(defaults.machinePartId) : '',
      taskName: forPart ? (defaults.partName ?? '') : '',
      description: '',
      frequency: 'weekly',
      intervalDays: '',
      reminderDaysBefore: '',
      lastMaintenanceAt: '',
      nextMaintenanceAt: '',
      isActive: true,
    };
  }
  const frequency = frequencyForInterval(schedule.intervalDays);
  return {
    appliesTo: schedule.machinePartId === null ? 'machine' : 'part',
    machinePartId: schedule.machinePartId === null ? '' : String(schedule.machinePartId),
    taskName: schedule.taskName,
    description: schedule.description ?? '',
    frequency: frequency ?? 'custom',
    intervalDays: frequency ? '' : String(schedule.intervalDays),
    reminderDaysBefore: String(schedule.reminderDaysBefore),
    lastMaintenanceAt: schedule.lastMaintenanceAt ? toDateTimeLocalValue(schedule.lastMaintenanceAt) : '',
    // Editing an existing task leaves the due date to the API unless it is deliberately set.
    nextMaintenanceAt: '',
    isActive: schedule.isActive,
  };
}

function toIso(value: string): string {
  const iso = fromDateTimeLocalValue(value);
  if (!iso) throw new Error(`Invalid date-time: ${value}`);
  return iso;
}

function requireInterval(values: MaintenanceScheduleFormValues): number {
  const interval = resolveIntervalDays(values);
  if (interval === null) throw new Error(`Invalid interval: ${values.intervalDays}`);
  return interval;
}

/**
 * A part task sends its part and, only when given, a name (the API defaults it to the part's name).
 * A machine-wide task sends no part. An empty reminder is left to the API's default.
 */
export function toCreateScheduleRequest(values: MaintenanceScheduleFormValues): CreateMaintenanceScheduleRequest {
  const forPart = values.appliesTo === 'part';
  return {
    ...(forPart ? { machinePartId: Number(values.machinePartId) } : {}),
    ...(values.taskName ? { taskName: values.taskName } : {}),
    ...(values.description ? { description: values.description } : {}),
    intervalDays: requireInterval(values),
    ...(values.reminderDaysBefore ? { reminderDaysBefore: Number(values.reminderDaysBefore) } : {}),
    ...(values.lastMaintenanceAt ? { lastMaintenanceAt: toIso(values.lastMaintenanceAt) } : {}),
    ...(values.nextMaintenanceAt ? { nextMaintenanceAt: toIso(values.nextMaintenanceAt) } : {}),
  };
}

/**
 * Only changed fields are sent, so the API never recalculates a due date without reason. The part
 * is never sent: the API does not accept it on update.
 */
export function toUpdateScheduleRequest(
  values: MaintenanceScheduleFormValues,
  initial: MaintenanceScheduleFormInput,
): UpdateMaintenanceScheduleRequest {
  const request: UpdateMaintenanceScheduleRequest = {};
  // An emptied part-task name keeps the current one: the API only defaults it on create.
  if (values.taskName && values.taskName !== initial.taskName.trim()) request.taskName = values.taskName;
  if (values.description !== initial.description.trim()) request.description = values.description || null;
  const interval = requireInterval(values);
  if (interval !== resolveIntervalDays(initial)) request.intervalDays = interval;
  if (values.reminderDaysBefore && values.reminderDaysBefore !== initial.reminderDaysBefore) {
    request.reminderDaysBefore = Number(values.reminderDaysBefore);
  }
  if (values.lastMaintenanceAt !== initial.lastMaintenanceAt) {
    request.lastMaintenanceAt = values.lastMaintenanceAt ? toIso(values.lastMaintenanceAt) : null;
  }
  if (values.nextMaintenanceAt) request.nextMaintenanceAt = toIso(values.nextMaintenanceAt);
  if (values.isActive !== initial.isActive) request.isActive = values.isActive;
  return request;
}

export function hasScheduleChanges(request: UpdateMaintenanceScheduleRequest): boolean {
  return Object.keys(request).length > 0;
}

/** Planning a maintenance: the API defaults the date to the task's due date, or now for one-off work. */
export const maintenanceEventFormSchema = z.object({
  scheduledFor: z.string(),
  /** One-off work only: the part worked on, or empty for the whole machine. */
  machinePartId: z.string(),
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
});

export type MaintenanceEventFormInput = z.input<typeof maintenanceEventFormSchema>;
export type MaintenanceEventFormValues = z.output<typeof maintenanceEventFormSchema>;

export function maintenanceEventFormDefaults(
  schedule?: MaintenanceSchedule | null,
  defaults: { machinePartId?: number } = {},
): MaintenanceEventFormInput {
  return {
    scheduledFor: schedule ? toDateTimeLocalValue(schedule.nextMaintenanceAt) : '',
    machinePartId: defaults.machinePartId ? String(defaults.machinePartId) : '',
    notes: '',
  };
}

/** What a new maintenance event is for: one task (planned work), or a machine or part (one-off work). */
export type MaintenanceEventTarget =
  | { kind: 'task'; maintenanceScheduleId: number }
  | { kind: 'one-off'; machineId: number };

/**
 * Planned work sends only the task: the API takes the machine and part from it, and refuses a task
 * sent together with a machine or part. One-off work sends the machine and, optionally, the part.
 */
export function toCreateEventRequest(
  values: Partial<MaintenanceEventFormValues>,
  target: MaintenanceEventTarget,
): CreateMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes ?? '');
  const optional = {
    ...(values.scheduledFor ? { scheduledFor: toIso(values.scheduledFor) } : {}),
    ...(notes ? { notes } : {}),
  };
  if (target.kind === 'task') return { maintenanceScheduleId: target.maintenanceScheduleId, ...optional };
  return {
    machineId: target.machineId,
    ...(values.machinePartId ? { machinePartId: Number(values.machinePartId) } : {}),
    ...optional,
  };
}

export const startMaintenanceFormSchema = z.object({
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
  putUnderMaintenance: z.boolean(),
});

export type StartMaintenanceFormValues = z.output<typeof startMaintenanceFormSchema>;

export function toStartEventRequest(values: StartMaintenanceFormValues): StartMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes);
  return { putUnderMaintenance: values.putUnderMaintenance, ...(notes ? { notes } : {}) };
}

/** Completion starts the next cycle, so the time recorded here matters. */
export const completeMaintenanceFormSchema = z.object({
  completedAt: z.string(),
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
  releaseOnComplete: z.boolean(),
});

export type CompleteMaintenanceFormInput = z.input<typeof completeMaintenanceFormSchema>;
export type CompleteMaintenanceFormValues = z.output<typeof completeMaintenanceFormSchema>;

export function createCompleteMaintenanceSchema(context: { event: MaintenanceEvent; now?: () => Date }) {
  return completeMaintenanceFormSchema.superRefine((values, ctx) => {
    const issue = (path: keyof CompleteMaintenanceFormInput, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!values.completedAt) {
      issue('completedAt', 'Enter when the maintenance was completed');
      return;
    }
    const iso = fromDateTimeLocalValue(values.completedAt);
    if (!iso) {
      issue('completedAt', 'Enter a valid date and time');
      return;
    }
    const now = (context.now?.() ?? new Date()).getTime();
    if (Date.parse(iso) > now + FUTURE_TOLERANCE_MS) issue('completedAt', "The completion time can't be in the future");
    if (context.event.startedAt && Date.parse(iso) < Date.parse(context.event.startedAt)) {
      issue('completedAt', 'The completion time must be on or after the start time');
    }
  });
}

const MS_PER_MINUTE = 60_000;

/**
 * Defaults the completion to now, but never before the maintenance started: the control only
 * holds whole minutes, so a start a few seconds ago is rounded up to the next one. The API
 * rejects a completion earlier than the start.
 */
export function completeMaintenanceDefaults(now: Date, event?: MaintenanceEvent): CompleteMaintenanceFormInput {
  const startedAt = event?.startedAt ? Date.parse(event.startedAt) : null;
  const earliest = startedAt === null ? null : Math.ceil(startedAt / MS_PER_MINUTE) * MS_PER_MINUTE;
  const completedAt = earliest !== null && earliest > now.getTime() ? new Date(earliest) : now;
  return { completedAt: toDateTimeLocalValue(completedAt), notes: '', releaseOnComplete: true };
}

export function toCompleteEventRequest(
  values: CompleteMaintenanceFormValues,
): CompleteMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes);
  return {
    releaseOnComplete: values.releaseOnComplete,
    ...(values.completedAt ? { completedAt: toIso(values.completedAt) } : {}),
    ...(notes ? { notes } : {}),
  };
}

export const cancelMaintenanceFormSchema = z.object({
  reason: optionalText({ label: 'Reason', max: 2000, multiline: true }),
});

export type CancelMaintenanceFormValues = z.output<typeof cancelMaintenanceFormSchema>;
