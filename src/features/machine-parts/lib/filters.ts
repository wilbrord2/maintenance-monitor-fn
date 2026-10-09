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
import { LOG_STATUSES, type LogStatus, MACHINE_LOG_SORT_FIELDS, type MachineLogSortField } from '@/types/machine-log';
import { type MachinePartHistoryParams, OPERATIONAL_IMPACTS, type OperationalImpact } from '@/types/machine-part';

export interface PartHistoryFilters extends SortState<MachineLogSortField> {
  search: string;
  resultingState: MachineState | undefined;
  operationalImpact: OperationalImpact | undefined;
  logStatus: LogStatus | undefined;
  userId: number | undefined;
  from: string | undefined;
  to: string | undefined;
  /** `to` is before `from`; the end date is ignored until corrected. */
  invalidRange: boolean;
  page: number;
  limit: number;
}

export const DEFAULT_PART_HISTORY_SORT: SortState<MachineLogSortField> = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const PART_HISTORY_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Recently recorded' },
  { value: 'startedAt:desc', label: 'Start time (newest)' },
  { value: 'startedAt:asc', label: 'Start time (oldest)' },
  { value: 'downtimeHours:desc', label: 'Most downtime' },
] as const;

/** URL parameters owned by a part history view (cleared by "Clear filters"). */
export const PART_HISTORY_FILTER_PARAMS = [
  'search',
  'resultingState',
  'impact',
  'logStatus',
  'userId',
  'from',
  'to',
  'page',
] as const;

export function parsePartHistoryFilters(params: Pick<URLSearchParams, 'get'>): PartHistoryFilters {
  const from = parseDateParam(params.get('from'));
  const to = parseDateParam(params.get('to'));
  return {
    search: parseSearchParam(params.get('search')),
    resultingState: parseEnumParam(params.get('resultingState'), MACHINE_STATES),
    operationalImpact: parseEnumParam(params.get('impact'), OPERATIONAL_IMPACTS),
    logStatus: parseEnumParam(params.get('logStatus'), LOG_STATUSES),
    userId: parseIdParam(params.get('userId')),
    from,
    to,
    invalidRange: Boolean(from && to && from > to),
    ...parseSortParam(params.get('sort'), MACHINE_LOG_SORT_FIELDS, DEFAULT_PART_HISTORY_SORT),
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

/** The part is addressed by the URL path, so it is not repeated in the query. */
export function toPartHistoryParams(filters: PartHistoryFilters): MachinePartHistoryParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search || undefined,
    resultingState: filters.resultingState,
    operationalImpact: filters.operationalImpact,
    logStatus: filters.logStatus,
    userId: filters.userId,
    from: filters.from,
    to: filters.invalidRange ? undefined : filters.to,
  };
}

export function hasPartHistoryFilters(filters: PartHistoryFilters): boolean {
  return Boolean(
    filters.search ||
      filters.resultingState ||
      filters.operationalImpact ||
      filters.logStatus ||
      filters.userId ||
      filters.from ||
      filters.to,
  );
}
