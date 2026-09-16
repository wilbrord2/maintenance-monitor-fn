import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/test/factories';
import { MachineState } from '@/types/machine';
import { getAllowedResultingStates, isTransitionAllowed, requiresOpenLog } from './transitions';

describe('machine state transitions', () => {
  it('offers every target plus a same-state entry under the default policy', () => {
    expect(getAllowedResultingStates(DEFAULT_RULES, MachineState.ACTIVE)).toEqual([
      MachineState.ACTIVE,
      MachineState.UNDER_MAINTENANCE,
      MachineState.DOWNTIME,
      MachineState.UNDER_TEST,
    ]);
  });

  it('omits the same state when same-state entries are disabled', () => {
    const rules = { ...DEFAULT_RULES, allowSameStateEntries: false };
    expect(getAllowedResultingStates(rules, MachineState.DOWNTIME)).not.toContain(MachineState.DOWNTIME);
  });

  it('never offers a transition missing from the policy', () => {
    const rules = {
      ...DEFAULT_RULES,
      allowSameStateEntries: false,
      transitions: { ...DEFAULT_RULES.transitions, [MachineState.DOWNTIME]: [MachineState.UNDER_MAINTENANCE] },
    };
    expect(getAllowedResultingStates(rules, MachineState.DOWNTIME)).toEqual([MachineState.UNDER_MAINTENANCE]);
    expect(isTransitionAllowed(rules, MachineState.DOWNTIME, MachineState.ACTIVE)).toBe(false);
  });

  it('knows which resulting states keep a log open', () => {
    expect(requiresOpenLog(DEFAULT_RULES, MachineState.DOWNTIME)).toBe(true);
    expect(requiresOpenLog(DEFAULT_RULES, MachineState.ACTIVE)).toBe(false);
  });
});
