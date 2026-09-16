'use client';

import { useMemo } from 'react';
import { useSession } from '@/lib/auth/session-store';
import { Role } from '@/types/auth';
import { hasAnyPermission, hasPermission, type Permission } from './permissions';

export interface PermissionsApi {
  role: Role | null;
  isAdmin: boolean;
  can(permission: Permission): boolean;
  canAny(permissions: readonly Permission[]): boolean;
}

/** Permission checks for the signed-in user. */
export function usePermissions(): PermissionsApi {
  const role = useSession((state) => state.user?.role ?? null);
  return useMemo(
    () => ({
      role,
      isAdmin: role === Role.ADMIN,
      can: (permission) => hasPermission(role, permission),
      canAny: (permissions) => hasAnyPermission(role, permissions),
    }),
    [role],
  );
}
