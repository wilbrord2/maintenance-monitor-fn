import { z } from 'zod';
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
/** The API rejects timestamps more than five minutes in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const WHOLE_NUMBER_PATTERN = /^\d{1,4}$/;

/**
 * Preventive-maintenance settings. Due dates are not part of the form beyond the optional first
 * one: the API derives every later due date from the actual completion time.
 */
const maintenanceScheduleFormObject = z.object({
  intervalDays: z.string().trim(),
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

export function createMaintenanceScheduleFormSchema(context: { now?: () => Date } = {}) {
  return maintenanceScheduleFormObject.superRefine((values, ctx) => {
    const issue = (path: MaintenanceScheduleFormField, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const now = (context.now?.() ?? new Date()).getTime();

    if (!WHOLE_NUMBER_PATTERN.test(values.intervalDays)) {
      issue('intervalDays', 'Enter the interval as a whole number of days');
    } else {
      const interval = Number(values.intervalDays);
      if (interval < 1) issue('intervalDays', 'The interval must be at least 1 day');
      else if (interval > MAX_INTERVAL_DAYS) issue('intervalDays', `The interval must be at most ${MAX_INTERVAL_DAYS} days`);
    }

    if (!WHOLE_NUMBER_PATTERN.test(values.reminderDaysBefore)) {
      issue('reminderDaysBefore', 'Enter the reminder as a whole number of days');
    } else if (WHOLE_NUMBER_PATTERN.test(values.intervalDays)) {
      const reminder = Number(values.reminderDaysBefore);
      if (reminder > Number(values.intervalDays)) {
        issue('reminderDaysBefore', "The reminder can't start earlier than one full interval before");
      }
    }

    if (values.lastMaintenanceAt) {
      const iso = fromDateTimeLocalValue(values.lastMaintenanceAt);
      if (!iso) issue('lastMaintenanceAt', 'Enter a valid date and time');
      else if (Date.parse(iso) > now + FUTURE_TOLERANCE_MS) {
        issue('lastMaintenanceAt', "The last maintenance can't be in the future");
      }
    }

    if (values.nextMaintenanceAt && !fromDateTimeLocalValue(values.nextMaintenanceAt)) {
      issue('nextMaintenanceAt', 'Enter a valid date and time');
    }
  });
}

export function maintenanceScheduleToFormInput(
  schedule?: MaintenanceSchedule | null,
): MaintenanceScheduleFormInput {
  return {
    intervalDays: schedule ? String(schedule.intervalDays) : '30',
    reminderDaysBefore: schedule ? String(schedule.reminderDaysBefore) : '3',
    lastMaintenanceAt: schedule?.lastMaintenanceAt ? toDateTimeLocalValue(schedule.lastMaintenanceAt) : '',
    // Editing an existing schedule leaves the due date to the API unless it is deliberately set.
    nextMaintenanceAt: '',
    isActive: schedule?.isActive ?? true,
  };
}

function toIso(value: string): string {
  const iso = fromDateTimeLocalValue(value);
  if (!iso) throw new Error(`Invalid date-time: ${value}`);
  return iso;
}

export function toCreateScheduleRequest(
  values: MaintenanceScheduleFormValues,
): CreateMaintenanceScheduleRequest {
  return {
    intervalDays: Number(values.intervalDays),
    reminderDaysBefore: Number(values.reminderDaysBefore),
    ...(values.lastMaintenanceAt ? { lastMaintenanceAt: toIso(values.lastMaintenanceAt) } : {}),
    ...(values.nextMaintenanceAt ? { nextMaintenanceAt: toIso(values.nextMaintenanceAt) } : {}),
  };
}

/** Only changed fields are sent, so the API never recalculates a due date without reason. */
export function toUpdateScheduleRequest(
  values: MaintenanceScheduleFormValues,
  initial: MaintenanceScheduleFormInput,
): UpdateMaintenanceScheduleRequest {
  const request: UpdateMaintenanceScheduleRequest = {};
  if (values.intervalDays !== initial.intervalDays) request.intervalDays = Number(values.intervalDays);
  if (values.reminderDaysBefore !== initial.reminderDaysBefore) {
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

/** Planning a maintenance: the API defaults the date to the schedule's due date. */
export const maintenanceEventFormSchema = z.object({
  scheduledFor: z.string(),
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
});

export type MaintenanceEventFormInput = z.input<typeof maintenanceEventFormSchema>;
export type MaintenanceEventFormValues = z.output<typeof maintenanceEventFormSchema>;

export function maintenanceEventFormDefaults(schedule?: MaintenanceSchedule | null): MaintenanceEventFormInput {
  return { scheduledFor: schedule ? toDateTimeLocalValue(schedule.nextMaintenanceAt) : '', notes: '' };
}

export function toCreateEventRequest(
  values: MaintenanceEventFormValues,
  machineId: number,
): CreateMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes);
  return {
    machineId,
    ...(values.scheduledFor ? { scheduledFor: toIso(values.scheduledFor) } : {}),
    ...(notes ? { notes } : {}),
  };
}

export const startMaintenanceFormSchema = z.object({
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
  putMachineUnderMaintenance: z.boolean(),
});

export type StartMaintenanceFormValues = z.output<typeof startMaintenanceFormSchema>;

export function toStartEventRequest(values: StartMaintenanceFormValues): StartMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes);
  return { putMachineUnderMaintenance: values.putMachineUnderMaintenance, ...(notes ? { notes } : {}) };
}

/** Completion starts the next cycle, so the time recorded here matters. */
export const completeMaintenanceFormSchema = z.object({
  completedAt: z.string(),
  notes: optionalText({ label: 'Notes', max: 2000, multiline: true }),
  releaseMachine: z.boolean(),
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
  return { completedAt: toDateTimeLocalValue(completedAt), notes: '', releaseMachine: true };
}

export function toCompleteEventRequest(
  values: CompleteMaintenanceFormValues,
): CompleteMaintenanceEventRequest {
  const notes = emptyToUndefined(values.notes);
  return {
    releaseMachine: values.releaseMachine,
    ...(values.completedAt ? { completedAt: toIso(values.completedAt) } : {}),
    ...(notes ? { notes } : {}),
  };
}

export const cancelMaintenanceFormSchema = z.object({
  reason: optionalText({ label: 'Reason', max: 2000, multiline: true }),
});

export type CancelMaintenanceFormValues = z.output<typeof cancelMaintenanceFormSchema>;
