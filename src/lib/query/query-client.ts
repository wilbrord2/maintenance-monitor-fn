import { QueryClient } from '@tanstack/react-query';
import { ClientErrorCode } from '@/constants/error-codes';
import { toApiError } from '@/lib/api/errors';

const MAX_RETRIES = 2;

/** Retry transient failures only; 4xx responses will not succeed on a second attempt. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const apiError = toApiError(error);
  if (apiError.code === ClientErrorCode.CANCELLED) return false;
  if (apiError.status >= 400 && apiError.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
