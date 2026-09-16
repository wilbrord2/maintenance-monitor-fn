import { type MachineRef } from './machine';
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

export interface AnalyticsOverview {
  range: AnalyticsRange;
  /** Current fleet state (not limited to the range). */
  machines: {
    total: number;
    active: number;
    underMaintenance: number;
    downtime: number;
    underTest: number;
    inactive: number;
  };
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
