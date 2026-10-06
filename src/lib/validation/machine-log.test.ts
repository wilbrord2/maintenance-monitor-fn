import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, makeLog, makePartLog } from '@/test/factories';
import { toDateTimeLocalValue } from '@/lib/utils/date';
import { MachineState } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { OperationalImpact } from '@/types/machine-part';
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

  it('words the rules for the part when the log is about a part', () => {
    const rules = { ...DEFAULT_RULES, transitions: { ...DEFAULT_RULES.transitions, [MachineState.ACTIVE]: [MachineState.UNDER_TEST] } };
    const part = validInput({ machinePartId: '11', resultingState: MachineState.DOWNTIME });
    expect(errorsFor(part, { rules }).resultingState).toBe("A part can't go from Active to Downtime");
    const closed = validInput({ machinePartId: '11', logStatus: LogStatus.CLOSED, endedAt: at('2026-09-15T11:00:00Z') });
    expect(errorsFor(closed).logStatus).toBe('Keep the log open while the part is under maintenance');
  });

  it('refuses a blocking impact for a part back in service', () => {
    const input = validInput({
      machinePartId: '11',
      entryStatus: MachineState.DOWNTIME,
      resultingState: MachineState.ACTIVE,
      operationalImpact: OperationalImpact.BLOCKING,
    });
    expect(errorsFor(input).operationalImpact).toBe('A part back in service is always non-blocking');
    // Whole-machine logs carry no impact, so a leftover value is not an error.
    expect(errorsFor({ ...input, machinePartId: '' }).operationalImpact).toBeUndefined();
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

  it('never sends an operational impact or part for a whole-machine log', () => {
    const request = toCreateMachineLogRequest(validInput({ operationalImpact: OperationalImpact.BLOCKING }));
    expect(request).not.toHaveProperty('operationalImpact');
    expect(request).not.toHaveProperty('machinePartId');
  });

  it('sends the part, its displayed state and the impact for a part log', () => {
    const request = toCreateMachineLogRequest(
      validInput({ machinePartId: '11', entryStatus: MachineState.ACTIVE, operationalImpact: OperationalImpact.BLOCKING }),
    );
    expect(request).toMatchObject({
      machineId: 5,
      machinePartId: 11,
      entryStatus: MachineState.ACTIVE,
      resultingState: MachineState.UNDER_MAINTENANCE,
      operationalImpact: OperationalImpact.BLOCKING,
    });
  });

  it('always sends a part back in service as non-blocking', () => {
    const request = toCreateMachineLogRequest(
      validInput({
        machinePartId: '11',
        entryStatus: MachineState.DOWNTIME,
        resultingState: MachineState.ACTIVE,
        operationalImpact: OperationalImpact.BLOCKING,
      }),
    );
    expect(request.operationalImpact).toBe(OperationalImpact.NON_BLOCKING);
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

  it('sends a changed impact for a part log but never machine, part or entry state', () => {
    const log = makePartLog({ version: 2, operationalImpact: OperationalImpact.NON_BLOCKING });
    const initial = logToFormInput(log);
    expect(initial.machinePartId).toBe('11');
    const request = toUpdateMachineLogRequest({ ...initial, operationalImpact: OperationalImpact.BLOCKING }, initial, log.version);
    expect(request).toEqual({ version: 2, operationalImpact: OperationalImpact.BLOCKING });
  });

  it('never sends an impact when editing a whole-machine log', () => {
    const log = makeLog({ version: 4 });
    const initial = logToFormInput(log);
    expect(initial.operationalImpact).toBe('');
    const request = toUpdateMachineLogRequest({ ...initial, operationalImpact: OperationalImpact.BLOCKING }, initial, log.version);
    expect(request).toEqual({ version: 4 });
  });
});
