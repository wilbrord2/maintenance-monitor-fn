import { type AnalyticsFaultsParams, type AnalyticsRangeParams, type AnalyticsTopParams } from '@/types/analytics';
import { type ListAuditLogsParams } from '@/types/audit';
import { type ListMachinesParams } from '@/types/machine';
import { type ListMachineLogsParams, type MachineHistoryParams } from '@/types/machine-log';
import { type ListMachinePartsParams, type MachinePartHistoryParams } from '@/types/machine-part';
import { type ListMaintenanceEventsParams, type MaintenanceScheduleListParams } from '@/types/maintenance';
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
  machineParts: {
    all: ['machine-parts'] as const,
    /** Parts of one machine; nested under the machine so a detail refresh covers them. */
    lists: (machineId: number) => ['machines', 'detail', machineId, 'parts'] as const,
    list: (machineId: number, params: ListMachinePartsParams) =>
      ['machines', 'detail', machineId, 'parts', params] as const,
    detail: (machineId: number, partId: number) =>
      ['machines', 'detail', machineId, 'parts', 'detail', partId] as const,
    histories: (partId: number) => ['machine-parts', partId, 'history'] as const,
    history: (partId: number, params: MachinePartHistoryParams) =>
      ['machine-parts', partId, 'history', params] as const,
  },
  maintenance: {
    all: ['maintenance'] as const,
    schedules: () => ['maintenance', 'schedule'] as const,
    schedule: (machineId: number) => ['maintenance', 'schedule', machineId] as const,
    boards: () => ['maintenance', 'board'] as const,
    board: (state: 'upcoming' | 'due' | 'overdue', params: MaintenanceScheduleListParams) =>
      ['maintenance', 'board', state, params] as const,
    events: () => ['maintenance', 'events'] as const,
    eventList: (params: ListMaintenanceEventsParams) => ['maintenance', 'events', 'list', params] as const,
    event: (id: number) => ['maintenance', 'events', 'detail', id] as const,
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
    parts: (params: AnalyticsTopParams) => ['analytics', 'parts', params] as const,
    maintenance: (params: AnalyticsRangeParams) => ['analytics', 'maintenance', params] as const,
  },
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (params: ListAuditLogsParams) => ['audit-logs', 'list', params] as const,
    detail: (id: number) => ['audit-logs', 'detail', id] as const,
  },
} as const;
