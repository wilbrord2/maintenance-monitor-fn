import { type MachinePartCounts, type MachineRef } from './machine';
import { type LogTechnician } from './machine-log';

/** Either a rolling window ending now, or an inclusive calendar range (YYYY-MM-DD, UTC). */
export type AnalyticsRangeParams = { days: number } | { from: string; to: string };

export type AnalyticsTopParams = AnalyticsRangeParams & { limit?: number };

export type AnalyticsFaultsParams = AnalyticsTopParams & { minOccurrences?: number };

export interface AnalyticsRange {
  from: string;
  to: string;
  days: number;
}

export interface LogCounts {
  total: number;
  open: number;
  closed: number;
}

/** Current counts of recurring schedules by derived state. */
export interface ScheduleCounts {
  total: number;
  active: number;
  upcoming: number;
  due: number;
  overdue: number;
}

export interface MachineOperationalCounts {
  operating: number;
  operatingWithDefects: number;
  notOperating: number;
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  /** Current fleet workflow state (not limited to the range). */
  machines: {
    total: number;
    active: number;
    underMaintenance: number;
    downtime: number;
    underTest: number;
    inactive: number;
  };
  /** Current fleet operational status, as resolved by the API. */
  machineOperational: MachineOperationalCounts;
  parts: MachinePartCounts;
  maintenance: ScheduleCounts;
  /** Logs started within the range, plus every log that is open right now. */
  logs: LogCounts & { currentlyOpen: number };
  totalDowntimeHours: number;
}

export interface AnalyticsDowntime {
  range: AnalyticsRange;
  totalDowntimeHours: number;
  byMachine: Array<{ machine: MachineRef; downtimeHours: number; events: number }>;
}

export interface AnalyticsMaintenanceEvents {
  range: AnalyticsRange;
  totals: LogCounts;
  byMachine: Array<{ machine: MachineRef; totalEvents: number; openEvents: number; closedEvents: number }>;
}

export interface AnalyticsTechnicians {
  range: AnalyticsRange;
  byTechnician: Array<{
    technician: LogTechnician;
    totalLogs: number;
    openLogs: number;
    closedLogs: number;
    downtimeHours: number;
  }>;
}

export interface AnalyticsFaults {
  range: AnalyticsRange;
  commonFaults: Array<{ fault: string; occurrences: number; machinesAffected: number; lastSeenAt: string }>;
  recurringIssues: Array<{
    machine: MachineRef;
    fault: string;
    occurrences: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
}

export interface AnalyticsParts {
  range: AnalyticsRange;
  byStatus: MachinePartCounts;
  impact: {
    machinesWithPartIssues: number;
    machinesStoppedByParts: number;
  };
  totalPartDowntimeHours: number;
  mostProblematic: Array<{
    machine: MachineRef;
    part: { id: number; partCode: string; name: string; isCritical: boolean };
    events: number;
    downtimeHours: number;
    lastEventAt: string | null;
  }>;
}

export interface AnalyticsMaintenance {
  range: AnalyticsRange;
  schedules: ScheduleCounts;
  compliance: {
    completed: number;
    missed: number;
    cancelled: number;
    inProgress: number;
    scheduled: number;
    completedOnTime: number;
    /** Share of completed maintenances finished on or before the scheduled date, or null when none. */
    onTimeRate: number | null;
  };
  byMachine: Array<{
    machine: MachineRef;
    completed: number;
    missed: number;
    lastCompletedAt: string | null;
  }>;
}
