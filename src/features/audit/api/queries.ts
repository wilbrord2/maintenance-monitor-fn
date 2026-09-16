'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { auditApi } from '@/lib/api/audit';
import { type ListAuditLogsParams } from '@/types/audit';

/** ADMIN only. */
export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: ({ signal }) => auditApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
}
