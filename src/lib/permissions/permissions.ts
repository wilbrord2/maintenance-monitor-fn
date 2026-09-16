import { Role } from '@/types/auth';

/**
 * Every capability the UI can offer. The mapping mirrors the API's authorization matrix so
 * users are never shown actions the API would refuse. The API remains the security boundary.
 */
export enum Permission {
  VIEW_DASHBOARD = 'dashboard:view',
  VIEW_MACHINES = 'machines:view',
  MANAGE_MACHINES = 'machines:manage',
  VIEW_LOGS = 'logs:view',
  CREATE_LOGS = 'logs:create',
  UPDATE_LOGS = 'logs:update',
  DELETE_LOGS = 'logs:delete',
  VIEW_ANALYTICS = 'analytics:view',
  VIEW_USERS = 'users:view',
  MANAGE_USERS = 'users:manage',
  VIEW_AUDIT_LOGS = 'audit:view',
  MANAGE_OWN_PROFILE = 'profile:manage',
}

const TECHNICIAN_PERMISSIONS: readonly Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_MACHINES,
  Permission.VIEW_LOGS,
  Permission.CREATE_LOGS,
  Permission.UPDATE_LOGS,
  Permission.VIEW_ANALYTICS,
  Permission.MANAGE_OWN_PROFILE,
];

const ADMIN_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  [Role.ADMIN]: new Set(ADMIN_PERMISSIONS),
  [Role.TECHNICIAN]: new Set(TECHNICIAN_PERMISSIONS),
};

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [Role.ADMIN]: 'Administrator',
  [Role.TECHNICIAN]: 'Technician',
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].has(permission) : false;
}

export function hasAnyPermission(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
