import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import {
  parseDateParam,
  parseEnumParam,
  parseIdParam,
  parsePageParam,
  parsePageSizeParam,
} from '@/lib/utils/url-params';
import { type SortOrder } from '@/types/api';
import { AuditAction, AuditEntity, type ListAuditLogsParams } from '@/types/audit';

export interface AuditFilters {
  action: AuditAction | undefined;
  entity: AuditEntity | undefined;
  userId: number | undefined;
  /** Exact record identifier (the API has no free-text search for audit entries). */
  entityId: string;
  from: string | undefined;
  to: string | undefined;
  invalidRange: boolean;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

export const AUDIT_FILTER_PARAMS = ['action', 'entity', 'userId', 'entityId', 'from', 'to', 'page'] as const;

export function parseAuditFilters(params: Pick<URLSearchParams, 'get'>): AuditFilters {
  const from = parseDateParam(params.get('from'));
  const to = parseDateParam(params.get('to'));
  return {
    action: parseEnumParam(params.get('action'), Object.values(AuditAction)),
    entity: parseEnumParam(params.get('entity'), Object.values(AuditEntity)),
    userId: parseIdParam(params.get('userId')),
    entityId: (params.get('entityId') ?? '').trim().slice(0, 64),
    from,
    to,
    invalidRange: Boolean(from && to && from > to),
    sortOrder: parseEnumParam(params.get('order'), ['asc', 'desc'] as const) ?? 'desc',
    page: parsePageParam(params.get('page')),
    limit: parsePageSizeParam(params.get('limit'), PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
  };
}

export function toListAuditLogsParams(filters: AuditFilters): ListAuditLogsParams {
  return {
    page: filters.page,
    limit: filters.limit,
    sortOrder: filters.sortOrder,
    action: filters.action,
    entity: filters.entity,
    userId: filters.userId,
    entityId: filters.entityId || undefined,
    from: filters.from,
    to: filters.invalidRange ? undefined : filters.to,
  };
}

export function hasAuditFilters(filters: AuditFilters): boolean {
  return Boolean(filters.action || filters.entity || filters.userId || filters.entityId || filters.from || filters.to);
}
