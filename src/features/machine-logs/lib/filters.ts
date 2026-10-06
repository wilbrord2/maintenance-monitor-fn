import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import {
  parseDateParam,
  parseEnumParam,
  parseIdParam,
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
  parseSortParam,
  type SortState,
} from '@/lib/utils/url-params';
import { MACHINE_STATES, type MachineState } from '@/types/machine';
import {
  type ListMachineLogsParams,
  LOG_SCOPES,
  LOG_STATUSES,
  LogScope,
  type LogStatus,
  MACHINE_LOG_SORT_FIELDS,
  type MachineLogSortField,
} from '@/types/machine-log';
import { OPERATIONAL_IMPACTS, type OperationalImpact } from '@/types/machine-part';

export interface LogFilters extends SortState<MachineLogSortField> {
  search: string;
  machineId: number | undefined;
  /** Only meaningful with a machine selected; implies part events. */
  machinePartId: number | undefined;
  scope: LogScope | undefined;
  operationalImpact: OperationalImpact | undefined;
  userId: number | undefined;
  /** Technicians: only logs they recorded. */
  mine: boolean;
  entryStatus: MachineState | undefined;
  resultingState: MachineState | undefined;
  logStatus: LogStatus | undefined;
  from: string | undefined;
  to: string | undefined;
  /** `to` is before `from`; the end date is ignored until corrected. */
  invalidRange: boolean;
  page: number;
  limit: number;
}

export const DEFAULT_LOG_SORT: SortState<MachineLogSortField> = { sortBy: 'createdAt', sortOrder: 'desc' };

export const LOG_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Recently recorded' },
  { value: 'startedAt:desc', label: 'Start time (newest)' },
  { value: 'startedAt:asc', label: 'Start time (oldest)' },
  { value: 'downtimeHours:desc', label: 'Most downtime' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
] as const;

/** URL parameters owned by the logs view (cleared by "Clear filters"). */
export const LOG_FILTER_PARAMS = [
  'search',
  'machineId',
  'partId',
  'scope',
  'impact',
  'userId',
  'mine',
  'entryStatus',
  'resultingState',
  'logStatus',
  'from',
  'to',
  'page',
] as const;

export function parseLogFilters(params: Pick<URLSearchParams, 'get'>): LogFilters {
  const from = parseDateParam(params.get('from'));
  const to = parseDateParam(params.get('to'));
  const machineId = parseIdParam(params.get('machineId'));
  const machinePartId = machineId !== undefined ? parseIdParam(params.get('partId')) : undefined;
  return {
    search: parseSearchParam(params.get('search')),
    machineId,
    machinePartId,
    // A chosen part only has part events.
    scope: machinePartId !== undefined ? LogScope.PART : parseEnumParam(params.get('scope'), LOG_SCOPES),
    operationalImpact: parseEnumParam(params.get('impact'), OPERATIONAL_IMPACTS),
    userId: parseIdParam(params.get('userId')),
    mine: params.get('mine') === '1',
    entryStatus: parseEnumParam(params.get('entryStatus'), MACHINE_STATES),
    resultingState: parseEnumParam(params.get('resultingState'), MACHINE_STATES),
    logStatus: parseEnumParam(params.get('logStatus'), LOG_STATUSES),
    from,
    to,
    invalidRange: Boolean(from && to && from > to),
    ...parseSortParam(params.get('sort'), MACHINE_LOG_SORT_FIELDS, DEFAULT_LOG_SORT),
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

export function toListMachineLogsParams(filters: LogFilters, currentUserId: number | undefined): ListMachineLogsParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search || undefined,
    machineId: filters.machineId,
    machinePartId: filters.machinePartId,
    scope: filters.scope,
    operationalImpact: filters.operationalImpact,
    userId: filters.mine ? currentUserId : filters.userId,
    entryStatus: filters.entryStatus,
    resultingState: filters.resultingState,
    logStatus: filters.logStatus,
    from: filters.from,
    to: filters.invalidRange ? undefined : filters.to,
  };
}

/** Filters inside the collapsible panel (search, scope and log status stay visible). */
export function countAdvancedLogFilters(filters: LogFilters): number {
  return [
    filters.machineId,
    filters.machinePartId,
    filters.operationalImpact,
    filters.userId ?? (filters.mine || undefined),
    filters.entryStatus,
    filters.resultingState,
    filters.from,
    filters.to,
  ].filter((value) => value !== undefined).length;
}

export function hasLogFilters(filters: LogFilters): boolean {
  return Boolean(filters.search || filters.logStatus || filters.scope) || countAdvancedLogFilters(filters) > 0;
}
