'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import { usersApi } from '@/lib/api/users';
import { sessionStore } from '@/lib/auth/session-store';
import { type UpdateProfileRequest, type UpdateUserRequest, type User } from '@/types/user';

function storeUser(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(queryKeys.users.detail(user.id), user);
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
}

export function useCreateTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createTechnician,
    onSuccess: ({ data }) => storeUser(queryClient, data.user),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateUserRequest }) => usersApi.update(id, body),
    onSuccess: ({ data }) => {
      storeUser(queryClient, data);
      // Logs and analytics embed technician names.
      void queryClient.invalidateQueries({ queryKey: queryKeys.machineLogs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => (active ? usersApi.activate(id) : usersApi.deactivate(id)),
    onSuccess: ({ data }) => storeUser(queryClient, data),
  });
}

export function useReissueTemporaryPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.reissueTemporaryPassword(id),
    onSuccess: ({ data }) => storeUser(queryClient, data),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

/** Updates the signed-in user's own profile and the session copy of it. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => usersApi.updateMe(body),
    onSuccess: ({ data }) => {
      sessionStore.getState().setUser(data);
      queryClient.setQueryData(queryKeys.users.me(), data);
      queryClient.setQueryData(queryKeys.users.detail(data.id), data);
    },
  });
}
