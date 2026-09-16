import { type AnalyticsFaultsParams, type AnalyticsRangeParams, type AnalyticsTopParams } from '@/types/analytics';
import { type ListAuditLogsParams } from '@/types/audit';
import { type ListMachinesParams } from '@/types/machine';
import { type ListMachineLogsParams, type MachineHistoryParams } from '@/types/machine-log';
import { type ListUsersParams } from '@/types/user';

/**
 * Query key factory. Keys are hierarchical so a prefix invalidates everything beneath it,
 * e.g. `machines.detail(5)` also covers that machine's history.
 */
export const queryKeys = {
  machines: {
    all: ['machines'] as const,
    lists: () => ['machines', 'list'] as const,
    list: (params: ListMachinesParams) => ['machines', 'list', params] as const,
    details: () => ['machines', 'detail'] as const,
    detail: (id: number) => ['machines', 'detail', id] as const,
    history: (id: number, params: MachineHistoryParams) => ['machines', 'detail', id, 'history', params] as const,
    stateTransitions: () => ['machines', 'state-transitions'] as const,
  },
  machineLogs: {
    all: ['machine-logs'] as const,
    lists: () => ['machine-logs', 'list'] as const,
    list: (params: ListMachineLogsParams) => ['machine-logs', 'list', params] as const,
    detail: (id: number) => ['machine-logs', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    me: () => ['users', 'me'] as const,
    lists: () => ['users', 'list'] as const,
    list: (params: ListUsersParams) => ['users', 'list', params] as const,
    detail: (id: number) => ['users', 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overviews: () => ['analytics', 'overview'] as const,
    overview: (range: AnalyticsRangeParams) => ['analytics', 'overview', range] as const,
    downtime: (params: AnalyticsTopParams) => ['analytics', 'downtime', params] as const,
    maintenanceEvents: (params: AnalyticsTopParams) => ['analytics', 'maintenance-events', params] as const,
    technicians: (params: AnalyticsTopParams) => ['analytics', 'technicians', params] as const,
    faults: (params: AnalyticsFaultsParams) => ['analytics', 'faults', params] as const,
  },
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (params: ListAuditLogsParams) => ['audit-logs', 'list', params] as const,
    detail: (id: number) => ['audit-logs', 'detail', id] as const,
  },
} as const;
