'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { usersApi } from '@/lib/api/users';
import { type ListUsersParams } from '@/types/user';

/** ADMIN only. */
export function useUsers(params: ListUsersParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: ({ signal }) => usersApi.list(params, { signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** ADMIN only. */
export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: ({ signal }) => usersApi.get(id, { signal }),
    enabled: id > 0,
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: ({ signal }) => usersApi.getMe({ signal }),
  });
}
