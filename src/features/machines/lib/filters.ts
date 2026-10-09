import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import {
  parseEnumParam,
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
  parseSortParam,
  type SortState,
} from '@/lib/utils/url-params';
import {
  type ListMachinesParams,
  MACHINE_OPERATIONAL_STATUSES,
  MACHINE_SORT_FIELDS,
  MACHINE_STATES,
  type MachineOperationalStatus,
  type MachineSortField,
  type MachineState,
} from '@/types/machine';

export type ActiveFilter = 'true' | 'false';

export interface MachineFilters extends SortState<MachineSortField> {
  search: string;
  /** The machine's resolved operational status: the status the board is organised by. */
  operationalStatus: MachineOperationalStatus | undefined;
  /** Effective status (API `status`), derived from the system status and parts. A secondary filter. */
  status: MachineState | undefined;
  active: ActiveFilter | undefined;
  page: number;
  limit: number;
}

export const DEFAULT_MACHINE_SORT: SortState<MachineSortField> = { sortBy: 'name', sortOrder: 'asc' };

/** Default direction when a column is first sorted: text ascending, dates newest first. */
export const MACHINE_SORT_DEFAULT_ORDER: Record<MachineSortField, 'asc' | 'desc'> = {
  name: 'asc',
  serialNumber: 'asc',
  status: 'asc',
  createdAt: 'desc',
  updatedAt: 'desc',
};

export const MACHINE_SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'serialNumber:asc', label: 'Serial number' },
  { value: 'status:asc', label: 'Status' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'createdAt:desc', label: 'Newest first' },
] as const;

export function parseMachineFilters(params: Pick<URLSearchParams, 'get'>): MachineFilters {
  return {
    search: parseSearchParam(params.get('search')),
    operationalStatus: parseEnumParam(params.get('status'), MACHINE_OPERATIONAL_STATUSES),
    status: parseEnumParam(params.get('workflow'), MACHINE_STATES),
    active: parseEnumParam(params.get('active'), ['true', 'false'] as const),
    ...parseSortParam(params.get('sort'), MACHINE_SORT_FIELDS, DEFAULT_MACHINE_SORT),
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

export function toListMachinesParams(filters: MachineFilters): ListMachinesParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search || undefined,
    operationalStatus: filters.operationalStatus,
    status: filters.status,
    isActive: filters.active === undefined ? undefined : filters.active === 'true',
  };
}

/** URL parameters owned by the machines view (cleared by "Clear filters"). */
export const MACHINE_FILTER_PARAMS = ['search', 'status', 'workflow', 'active', 'page'] as const;

export function hasMachineFilters(filters: MachineFilters): boolean {
  return Boolean(filters.search || filters.operationalStatus || filters.status || filters.active);
}
