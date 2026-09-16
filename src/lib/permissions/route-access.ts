import { ROUTES } from '@/constants/routes';
import { type Role } from '@/types/auth';
import { matchesPath, pathSpecificity } from '@/lib/utils/path';
import { hasPermission, Permission } from './permissions';

interface RouteRule {
  pattern: string;
  permission: Permission;
  exact?: boolean;
}

/** Permission required by each area of the application. The most specific matching rule wins. */
const ROUTE_RULES: readonly RouteRule[] = [
  { pattern: ROUTES.dashboard, permission: Permission.VIEW_DASHBOARD, exact: true },
  { pattern: ROUTES.machines, permission: Permission.VIEW_MACHINES },
  { pattern: ROUTES.logs, permission: Permission.VIEW_LOGS },
  { pattern: ROUTES.createLog, permission: Permission.CREATE_LOGS, exact: true },
  { pattern: `${ROUTES.logs}/:id/edit`, permission: Permission.UPDATE_LOGS, exact: true },
  { pattern: ROUTES.analytics, permission: Permission.VIEW_ANALYTICS },
  { pattern: ROUTES.technicians, permission: Permission.VIEW_USERS },
  { pattern: ROUTES.auditLogs, permission: Permission.VIEW_AUDIT_LOGS },
  { pattern: ROUTES.profile, permission: Permission.MANAGE_OWN_PROFILE },
];

export function getRoutePermission(pathname: string): Permission | null {
  let best: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    if (!matchesPath(pathname, rule.pattern, { exact: rule.exact })) continue;
    if (!best || pathSpecificity(rule.pattern) > pathSpecificity(best.pattern)) best = rule;
  }
  return best?.permission ?? null;
}

/** Routes without a rule are not restricted by role (unknown paths fall through to 404). */
export function canAccessRoute(role: Role | null | undefined, pathname: string): boolean {
  const permission = getRoutePermission(pathname);
  return permission === null || hasPermission(role, permission);
}
