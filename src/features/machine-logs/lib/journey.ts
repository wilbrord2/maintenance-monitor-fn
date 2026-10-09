import { type MachineState } from '@/types/machine';
import { type MachineLog } from '@/types/machine-log';

export interface JourneyStep {
  state: MachineState;
  /** The log that put the subject in this state; null for the state before `log`. */
  log: MachineLog | null;
  isCurrentLog: boolean;
}

export interface StateJourney {
  steps: JourneyStep[];
  /** Later events exist that are not included (shown as a link to the full history). */
  hasMore: boolean;
}

const MAX_STEPS = 6;

/**
 * The subject's path through states starting at `log`: the state before it, the state it set,
 * then each later log's resulting state in order. The subject is the part for a part log, or the
 * machine system for a whole-machine log. Log ids are strictly ordered.
 *
 * `history` must be the same subject's newest logs (newest first); `pageComplete` says whether it
 * reaches back to `log`, i.e. whether every later log is included.
 */
export function buildStateJourney(log: MachineLog, history: readonly MachineLog[], pageComplete: boolean): StateJourney {
  const later = history.filter((entry) => entry.id > log.id).sort((a, b) => a.id - b.id);
  const reachesLog = pageComplete || history.some((entry) => entry.id <= log.id);
  const steps: JourneyStep[] = [
    { state: log.entryStatus, log: null, isCurrentLog: false },
    { state: log.resultingState, log, isCurrentLog: true },
  ];
  if (reachesLog) {
    for (const entry of later) steps.push({ state: entry.resultingState, log: entry, isCurrentLog: false });
  }
  return {
    steps: steps.slice(0, MAX_STEPS),
    hasMore: !reachesLog ? later.length > 0 || !pageComplete : steps.length > MAX_STEPS,
  };
}
