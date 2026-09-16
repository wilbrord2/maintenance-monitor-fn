import { z } from 'zod';
import { isLogStatus, LOG_STATUS_CONFIG } from '@/constants/log-status';
import { isMachineState, MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { isTransitionAllowed, requiresOpenLog } from '@/lib/machine-state/transitions';
import { fromDateTimeLocalValue, hoursBetween, toDateTimeLocalValue } from '@/lib/utils/date';
import { formatHours } from '@/lib/utils/format';
import { parseIdParam } from '@/lib/utils/url-params';
import { type MachineState, type StateTransitionRules } from '@/types/machine';
import {
  type CreateMachineLogRequest,
  type LogStatus,
  type MachineLog,
  type UpdateMachineLogRequest,
} from '@/types/machine-log';
import { emptyToUndefined, optionalText, requiredText } from './primitives';

/** The API rejects timestamps more than five minutes in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const DOWNTIME_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/** Form values are kept as strings (as inputs produce them) and converted when building requests. */
const machineLogFormObject = z.object({
  machineId: z.string(),
  faultDescription: requiredText({
    label: 'Fault description',
    max: 2000,
    multiline: true,
    requiredMessage: 'Describe the fault or the activity performed',
  }),
  causeDescription: optionalText({ label: 'Cause', max: 2000, multiline: true }),
  entryStatus: z.string(),
  remedyAction: optionalText({ label: 'Action taken', max: 2000, multiline: true }),
  resultingState: z.string(),
  downtimeHours: z.string().trim(),
  logStatus: z.string(),
  nextMaintenancePlan: optionalText({ label: 'Next maintenance plan', max: 1000, multiline: true }),
  startedAt: z.string(),
  endedAt: z.string(),
});

export type MachineLogFormInput = z.input<typeof machineLogFormObject>;
export type MachineLogFormValues = z.output<typeof machineLogFormObject>;
export type MachineLogFormField = keyof MachineLogFormInput;

export const MACHINE_LOG_FORM_FIELDS: readonly MachineLogFormField[] = Object.keys(machineLogFormObject.shape) as MachineLogFormField[];

export interface MachineLogValidationContext {
  mode: 'create' | 'edit';
  rules: StateTransitionRules;
  /** Whether the log is (or will become) the machine's most recent log. */
  isLatestLog: boolean;
  now?: () => Date;
}

const stateLabel = (state: MachineState) => MACHINE_STATE_CONFIG[state].label;

/** Builds the schema with the transition policy and log rules the API will apply. */
export function createMachineLogFormSchema(context: MachineLogValidationContext) {
  return machineLogFormObject.superRefine((values, ctx) => {
    const issue = (path: MachineLogFormField, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const now = (context.now?.() ?? new Date()).getTime();

    const hasMachine = context.mode === 'edit' || parseIdParam(values.machineId) !== undefined;
    if (!hasMachine) issue('machineId', 'Choose a machine');

    const entry = isMachineState(values.entryStatus) ? values.entryStatus : null;
    const result = isMachineState(values.resultingState) ? values.resultingState : null;
    if (hasMachine && !entry) issue('entryStatus', "Waiting for the machine's current state");
    if (!result) issue('resultingState', 'Choose the state the machine is in after this event');
    if (entry && result && !isTransitionAllowed(context.rules, entry, result)) {
      issue('resultingState', `A machine can't go from ${stateLabel(entry)} to ${stateLabel(result)}`);
    }

    const status = isLogStatus(values.logStatus) ? values.logStatus : null;
    if (!status) issue('logStatus', 'Choose whether the work is open or closed');

    const startedIso = values.startedAt ? fromDateTimeLocalValue(values.startedAt) : null;
    if (!values.startedAt) issue('startedAt', 'Enter when the work started');
    else if (!startedIso) issue('startedAt', 'Enter a valid date and time');

    const endedIso = values.endedAt ? fromDateTimeLocalValue(values.endedAt) : null;
    if (values.endedAt && !endedIso) issue('endedAt', 'Enter a valid date and time');

    if (startedIso && Date.parse(startedIso) > now + FUTURE_TOLERANCE_MS) issue('startedAt', "The start time can't be in the future");
    if (endedIso && Date.parse(endedIso) > now + FUTURE_TOLERANCE_MS) issue('endedAt', "The end time can't be in the future");
    if (startedIso && endedIso && Date.parse(endedIso) < Date.parse(startedIso)) {
      issue('endedAt', 'The end time must be on or after the start time');
    }

    if (status && isLogStatus(status)) {
      if (status === 'OPEN' && values.endedAt) issue('endedAt', "Open work has no end time. Clear it, or close the log.");
      if (status === 'CLOSED' && !values.endedAt) issue('endedAt', 'Enter when the work ended to close the log');
      if (status === 'CLOSED' && result && context.isLatestLog && requiresOpenLog(context.rules, result)) {
        issue('logStatus', `Keep the log open while the machine is ${stateLabel(result).toLowerCase()}`);
      }
    }

    if (values.downtimeHours !== '') {
      if (!DOWNTIME_PATTERN.test(values.downtimeHours)) {
        issue('downtimeHours', 'Enter hours as a number with up to 2 decimals, e.g. 2.5');
      } else if (startedIso && endedIso) {
        const maximum = hoursBetween(startedIso, endedIso) ?? 0;
        if (Number(values.downtimeHours) > maximum + 0.005) {
          issue('downtimeHours', `Downtime can't exceed the ${formatHours(maximum)} between start and end`);
        }
      }
    }
  });
}

function toMachineState(value: string): MachineState {
  if (!isMachineState(value)) throw new Error(`Invalid machine state: ${value}`);
  return value;
}

function toLogStatus(value: string): LogStatus {
  if (!isLogStatus(value)) throw new Error(`Invalid log status: ${value}`);
  return value;
}

function toIso(value: string): string {
  const iso = fromDateTimeLocalValue(value);
  if (!iso) throw new Error(`Invalid date-time: ${value}`);
  return iso;
}

export function createLogFormDefaults(options: { machineId?: number; now: Date }): MachineLogFormInput {
  return {
    machineId: options.machineId ? String(options.machineId) : '',
    faultDescription: '',
    causeDescription: '',
    entryStatus: '',
    remedyAction: '',
    resultingState: '',
    downtimeHours: '',
    logStatus: LOG_STATUS_CONFIG.OPEN.value,
    nextMaintenancePlan: '',
    startedAt: toDateTimeLocalValue(options.now),
    endedAt: '',
  };
}

export function logToFormInput(log: MachineLog): MachineLogFormInput {
  return {
    machineId: String(log.machine.id),
    faultDescription: log.faultDescription,
    causeDescription: log.causeDescription ?? '',
    entryStatus: log.entryStatus,
    remedyAction: log.remedyAction ?? '',
    resultingState: log.resultingState,
    downtimeHours: String(log.downtimeHours),
    logStatus: log.logStatus,
    nextMaintenancePlan: log.nextMaintenancePlan ?? '',
    startedAt: toDateTimeLocalValue(log.startedAt),
    endedAt: toDateTimeLocalValue(log.endedAt),
  };
}

/** Call only with values that passed {@link createMachineLogFormSchema}. */
export function toCreateMachineLogRequest(values: MachineLogFormValues): CreateMachineLogRequest {
  const causeDescription = emptyToUndefined(values.causeDescription);
  const remedyAction = emptyToUndefined(values.remedyAction);
  const nextMaintenancePlan = emptyToUndefined(values.nextMaintenancePlan);
  return {
    machineId: Number(values.machineId),
    faultDescription: values.faultDescription,
    entryStatus: toMachineState(values.entryStatus),
    resultingState: toMachineState(values.resultingState),
    logStatus: toLogStatus(values.logStatus),
    startedAt: toIso(values.startedAt),
    ...(causeDescription ? { causeDescription } : {}),
    ...(remedyAction ? { remedyAction } : {}),
    ...(nextMaintenancePlan ? { nextMaintenancePlan } : {}),
    ...(values.endedAt ? { endedAt: toIso(values.endedAt) } : {}),
    ...(values.downtimeHours !== '' ? { downtimeHours: Number(values.downtimeHours) } : {}),
  };
}

/**
 * Sends only fields that changed from `initial`, plus the version that was read.
 * Cleared optional text becomes null; a cleared downtime is left for the API to recalculate.
 */
export function toUpdateMachineLogRequest(
  values: MachineLogFormValues,
  initial: MachineLogFormInput,
  version: number,
): UpdateMachineLogRequest {
  const request: UpdateMachineLogRequest = { version };
  if (values.faultDescription !== initial.faultDescription.trim()) request.faultDescription = values.faultDescription;
  if (values.causeDescription !== initial.causeDescription.trim()) request.causeDescription = values.causeDescription || null;
  if (values.remedyAction !== initial.remedyAction.trim()) request.remedyAction = values.remedyAction || null;
  if (values.nextMaintenancePlan !== initial.nextMaintenancePlan.trim()) {
    request.nextMaintenancePlan = values.nextMaintenancePlan || null;
  }
  if (values.resultingState !== initial.resultingState) request.resultingState = toMachineState(values.resultingState);
  if (values.logStatus !== initial.logStatus) request.logStatus = toLogStatus(values.logStatus);
  if (values.startedAt !== initial.startedAt) request.startedAt = toIso(values.startedAt);
  if (values.endedAt !== initial.endedAt) request.endedAt = values.endedAt ? toIso(values.endedAt) : null;
  if (values.downtimeHours !== '' && values.downtimeHours !== initial.downtimeHours) {
    request.downtimeHours = Number(values.downtimeHours);
  }
  return request;
}

export function hasLogChanges(request: UpdateMachineLogRequest): boolean {
  return Object.keys(request).some((key) => key !== 'version');
}
