import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import {
  parseEnumParam,
  parsePageParam,
  parsePageSizeParam,
  parseSearchParam,
  parseSortParam,
  type SortState,
} from '@/lib/utils/url-params';
import { Role } from '@/types/auth';
import { type ListUsersParams, USER_SORT_FIELDS, type UserSortField } from '@/types/user';

export interface UserFilters extends SortState<UserSortField> {
  search: string;
  role: Role | undefined;
  active: 'true' | 'false' | undefined;
  page: number;
  limit: number;
}

export const DEFAULT_USER_SORT: SortState<UserSortField> = { sortBy: 'createdAt', sortOrder: 'desc' };

export const USER_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'fullName:asc', label: 'Name (A–Z)' },
  { value: 'email:asc', label: 'Email (A–Z)' },
  { value: 'lastLoginAt:desc', label: 'Recently signed in' },
] as const;

export const USER_FILTER_PARAMS = ['search', 'role', 'active', 'page'] as const;

const ROLES = Object.values(Role);

export function parseUserFilters(params: Pick<URLSearchParams, 'get'>): UserFilters {
  return {
    search: parseSearchParam(params.get('search')),
    role: parseEnumParam(params.get('role'), ROLES),
    active: parseEnumParam(params.get('active'), ['true', 'false'] as const),
    ...parseSortParam(params.get('sort'), USER_SORT_FIELDS, DEFAULT_USER_SORT),
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

export function toListUsersParams(filters: UserFilters): ListUsersParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search || undefined,
    role: filters.role,
    isActive: filters.active === undefined ? undefined : filters.active === 'true',
  };
}

export function hasUserFilters(filters: UserFilters): boolean {
  return Boolean(filters.search || filters.role || filters.active);
}
