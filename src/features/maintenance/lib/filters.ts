import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import {
  parseDateParam,
  parseEnumParam,
  parseIdParam,
  parsePageParam,
  parsePageSizeParam,
  parseSortParam,
  type SortState,
} from '@/lib/utils/url-params';
import {
  type ListMaintenanceEventsParams,
  MAINTENANCE_EVENT_SORT_FIELDS,
  MAINTENANCE_EVENT_STATUSES,
  MAINTENANCE_SCHEDULE_SCOPES,
  MAINTENANCE_SCHEDULE_STATES,
  type MaintenanceEventSortField,
  type MaintenanceEventStatus,
  type MaintenanceScheduleListParams,
  type MaintenanceScheduleScope,
  MaintenanceScheduleState,
} from '@/types/maintenance';

export type MaintenanceTab = 'schedules' | 'events';

export const MAINTENANCE_TABS: readonly MaintenanceTab[] = ['schedules', 'events'];

export interface MaintenanceEventFilters extends SortState<MaintenanceEventSortField> {
  machineId: number | undefined;
  /** URL `partId`; only meaningful together with `machineId`. */
  machinePartId: number | undefined;
  status: MaintenanceEventStatus | undefined;
  performedById: number | undefined;
  from: string | undefined;
  to: string | undefined;
  /** `to` is before `from`; the end date is ignored until corrected. */
  invalidRange: boolean;
  page: number;
  limit: number;
}

export interface MaintenanceViewFilters extends MaintenanceEventFilters {
  tab: MaintenanceTab;
  /** Which of the three API listings the schedules tab shows; each is paginated by the API. */
  state: MaintenanceScheduleState;
  /** Machine-wide tasks or part inspections; ignored once a part is chosen. */
  scope: MaintenanceScheduleScope | undefined;
}

export const DEFAULT_EVENT_SORT: SortState<MaintenanceEventSortField> = {
  sortBy: 'scheduledFor',
  sortOrder: 'desc',
};

export const MAINTENANCE_EVENT_SORT_OPTIONS = [
  { value: 'scheduledFor:desc', label: 'Scheduled (newest)' },
  { value: 'scheduledFor:asc', label: 'Scheduled (oldest)' },
  { value: 'completedAt:desc', label: 'Recently completed' },
  { value: 'startedAt:desc', label: 'Recently started' },
  { value: 'createdAt:desc', label: 'Recently planned' },
] as const;

/** URL parameters owned by the maintenance view (cleared by "Clear filters"). */
export const MAINTENANCE_FILTER_PARAMS = [
  'machineId',
  'partId',
  'scope',
  'status',
  'performedById',
  'from',
  'to',
  'page',
] as const;

export function parseMaintenanceFilters(params: Pick<URLSearchParams, 'get'>): MaintenanceViewFilters {
  const from = parseDateParam(params.get('from'));
  const to = parseDateParam(params.get('to'));
  const machineId = parseIdParam(params.get('machineId'));
  return {
    tab: parseEnumParam(params.get('tab'), MAINTENANCE_TABS) ?? 'schedules',
    state: parseEnumParam(params.get('state'), MAINTENANCE_SCHEDULE_STATES) ?? MaintenanceScheduleState.OVERDUE,
    machineId,
    machinePartId: machineId ? parseIdParam(params.get('partId')) : undefined,
    scope: parseEnumParam(params.get('scope'), MAINTENANCE_SCHEDULE_SCOPES),
    status: parseEnumParam(params.get('status'), MAINTENANCE_EVENT_STATUSES),
    performedById: parseIdParam(params.get('performedById')),
    from,
    to,
    invalidRange: Boolean(from && to && from > to),
    ...parseSortParam(params.get('sort'), MAINTENANCE_EVENT_SORT_FIELDS, DEFAULT_EVENT_SORT),
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

export function toListEventsParams(filters: MaintenanceEventFilters): ListMaintenanceEventsParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    machineId: filters.machineId,
    machinePartId: filters.machinePartId,
    status: filters.status,
    performedById: filters.performedById,
    from: filters.from,
    to: filters.invalidRange ? undefined : filters.to,
  };
}

export function hasEventFilters(filters: MaintenanceEventFilters): boolean {
  return Boolean(filters.machineId || filters.status || filters.performedById || filters.from || filters.to);
}

/** Filters of the upcoming / due / overdue listings, without paging. A part implies part scope. */
export function toBoardFilterParams(filters: MaintenanceViewFilters): Omit<MaintenanceScheduleListParams, 'page' | 'limit'> {
  return {
    machineId: filters.machineId,
    machinePartId: filters.machinePartId,
    scope: filters.machinePartId ? undefined : filters.scope,
  };
}

export function hasBoardFilters(filters: MaintenanceViewFilters): boolean {
  return Boolean(filters.machineId || filters.scope);
}
