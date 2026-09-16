import { type AuditLog, type ListAuditLogsParams } from '@/types/audit';
import { getData, getPage, type RequestOptions } from './client';

/** ADMIN only. */
export const auditApi = {
  list: (params: ListAuditLogsParams, options?: RequestOptions) => getPage<AuditLog>('/audit-logs', params, options),

  get: (id: number, options?: RequestOptions) => getData<AuditLog>(`/audit-logs/${id}`, undefined, options),
};
