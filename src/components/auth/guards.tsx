'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { ForbiddenState } from '@/components/feedback/forbidden-state';
import { type Permission } from '@/lib/permissions/permissions';
import { canAccessRoute } from '@/lib/permissions/route-access';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { type Role } from '@/types/auth';

interface GuardProps {
  children: ReactNode;
  /** Rendered instead of children when access is denied; nothing by default. */
  fallback?: ReactNode;
}

/** Shows children only when the user holds the permission (or any of `anyOf`). UX only — the API enforces access. */
export function PermissionGuard({
  permission,
  anyOf,
  children,
  fallback = null,
}: GuardProps & { permission?: Permission; anyOf?: readonly Permission[] }) {
  const { can, canAny } = usePermissions();
  const allowed = (permission ? can(permission) : true) && (anyOf ? canAny(anyOf) : true);
  return allowed ? children : fallback;
}

export function RoleGuard({ roles, children, fallback = null }: GuardProps & { roles: readonly Role[] }) {
  const { role } = usePermissions();
  return role && roles.includes(role) ? children : fallback;
}

/** Blocks pages the current role may not open, based on the central route permission map. */
export function RouteAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  return canAccessRoute(role, pathname) ? children : <ForbiddenState />;
}
