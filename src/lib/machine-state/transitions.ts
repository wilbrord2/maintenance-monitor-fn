import { MACHINE_STATES, type MachineState, type StateTransitionRules } from '@/types/machine';

/**
 * Client view of the API's transition policy (`GET /machines/state-transitions`). Used only to
 * avoid offering invalid choices; the API validates every transition again.
 */
export function getAllowedResultingStates(rules: StateTransitionRules, from: MachineState): MachineState[] {
  const targets = new Set<MachineState>(rules.transitions[from]);
  if (rules.allowSameStateEntries) targets.add(from);
  return MACHINE_STATES.filter((state) => targets.has(state));
}

export function isTransitionAllowed(rules: StateTransitionRules, from: MachineState, to: MachineState): boolean {
  return getAllowedResultingStates(rules, from).includes(to);
}

/** While a machine's most recent log leaves it in one of these states, that log must stay open. */
export function requiresOpenLog(rules: StateTransitionRules, state: MachineState): boolean {
  return rules.statesRequiringOpenLog.includes(state);
}
