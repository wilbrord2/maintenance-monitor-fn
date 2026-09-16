import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, makeLog } from '@/test/factories';
import { toDateTimeLocalValue } from '@/lib/utils/date';
import { MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import {
  createLogFormDefaults,
  createMachineLogFormSchema,
  logToFormInput,
  type MachineLogFormInput,
  type MachineLogValidationContext,
  toCreateMachineLogRequest,
  toUpdateMachineLogRequest,
} from './machine-log';

const NOW = new Date('2026-09-15T12:00:00Z');
const at = (iso: string) => toDateTimeLocalValue(new Date(iso));

function validInput(overrides: Partial<MachineLogFormInput> = {}): MachineLogFormInput {
  return {
    ...createLogFormDefaults({ machineId: 5, now: new Date('2026-09-15T10:00:00Z') }),
    faultDescription: 'Hydraulic pressure drop',
    entryStatus: MachineState.ACTIVE,
    resultingState: MachineState.UNDER_MAINTENANCE,
    ...overrides,
  };
}

function errorsFor(input: MachineLogFormInput, context: Partial<MachineLogValidationContext> = {}): Record<string, string> {
  const schema = createMachineLogFormSchema({ mode: 'create', rules: DEFAULT_RULES, isLatestLog: true, now: () => NOW, ...context });
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('machine log form validation', () => {
  it('accepts a complete open log', () => {
    expect(errorsFor(validInput())).toEqual({});
  });

  it('requires a machine, a fault and a resulting state', () => {
    const errors = errorsFor(validInput({ machineId: '', faultDescription: '  ', resultingState: '' }));
    expect(errors.machineId).toBe('Choose a machine');
    expect(errors.faultDescription).toBeDefined();
    expect(errors.resultingState).toBeDefined();
  });

  it('rejects a transition the policy does not allow', () => {
    const rules = { ...DEFAULT_RULES, transitions: { ...DEFAULT_RULES.transitions, [MachineState.ACTIVE]: [MachineState.UNDER_TEST] } };
    const errors = errorsFor(validInput({ resultingState: MachineState.DOWNTIME }), { rules });
    expect(errors.resultingState).toBe("A machine can't go from Active to Downtime");
  });

  it('requires an end time to close a log and forbids one on open work', () => {
    expect(errorsFor(validInput({ resultingState: MachineState.ACTIVE, logStatus: LogStatus.CLOSED })).endedAt).toBe(
      'Enter when the work ended to close the log',
    );
    expect(errorsFor(validInput({ endedAt: at('2026-09-15T11:00:00Z') })).endedAt).toMatch(/Open work has no end time/);
  });

  it('keeps the latest log open while the machine is under maintenance or down', () => {
    const input = validInput({ logStatus: LogStatus.CLOSED, endedAt: at('2026-09-15T11:00:00Z') });
    expect(errorsFor(input).logStatus).toBe('Keep the log open while the machine is under maintenance');
    expect(errorsFor(input, { isLatestLog: false }).logStatus).toBeUndefined();
  });

  it('checks that the end is not before the start and nothing is in the future', () => {
    const reversed = validInput({
      resultingState: MachineState.ACTIVE,
      logStatus: LogStatus.CLOSED,
      endedAt: at('2026-09-15T09:00:00Z'),
    });
    expect(errorsFor(reversed).endedAt).toBe('The end time must be on or after the start time');
    expect(errorsFor(validInput({ startedAt: at('2026-09-15T12:30:00Z') })).startedAt).toBe("The start time can't be in the future");
  });

  it('validates downtime format and bounds', () => {
    expect(errorsFor(validInput({ downtimeHours: 'two' })).downtimeHours).toMatch(/number/);
    const closed = validInput({
      resultingState: MachineState.ACTIVE,
      logStatus: LogStatus.CLOSED,
      endedAt: at('2026-09-15T11:00:00Z'),
      downtimeHours: '1.5',
    });
    expect(errorsFor(closed).downtimeHours).toBe("Downtime can't exceed the 1 h between start and end");
    expect(errorsFor({ ...closed, downtimeHours: '0.75' })).toEqual({});
  });
});

describe('machine log requests', () => {
  it('builds a create request without blank optional fields', () => {
    const request = toCreateMachineLogRequest(validInput({ causeDescription: '', downtimeHours: '2.5' }));
    expect(request).toEqual({
      machineId: 5,
      faultDescription: 'Hydraulic pressure drop',
      entryStatus: MachineState.ACTIVE,
      resultingState: MachineState.UNDER_MAINTENANCE,
      logStatus: LogStatus.OPEN,
      startedAt: '2026-09-15T10:00:00.000Z',
      downtimeHours: 2.5,
    });
  });

  it('sends only changed fields with the version, clearing text to null', () => {
    const log = makeLog({ version: 3 });
    const initial = logToFormInput(log);
    const request = toUpdateMachineLogRequest(
      { ...initial, causeDescription: '', resultingState: MachineState.UNDER_TEST, remedyAction: initial.remedyAction },
      initial,
      log.version,
    );
    expect(request).toEqual({ version: 3, causeDescription: null, resultingState: MachineState.UNDER_TEST });
  });
});
