import {
  ChartColumn,
  ClipboardList,
  Factory,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  UserRound,
  Users,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { hasPermission, Permission } from '@/lib/permissions/permissions';
import { matchesPath } from '@/lib/utils/path';
import { type Role } from '@/types/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Only highlight on the exact path (used for the dashboard root). */
  exact?: boolean;
}

export interface NavSection {
  id: string;
  label: string | null;
  items: readonly NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    id: 'operations',
    label: null,
    items: [
      { label: 'Dashboard', href: ROUTES.dashboard, icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD, exact: true },
      { label: 'Machines', href: ROUTES.machines, icon: Factory, permission: Permission.VIEW_MACHINES },
      { label: 'Machine Logs', href: ROUTES.logs, icon: ClipboardList, permission: Permission.VIEW_LOGS },
      { label: 'Analytics', href: ROUTES.analytics, icon: ChartColumn, permission: Permission.VIEW_ANALYTICS },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { label: 'Technicians', href: ROUTES.technicians, icon: Users, permission: Permission.VIEW_USERS },
      { label: 'Audit Logs', href: ROUTES.auditLogs, icon: ScrollText, permission: Permission.VIEW_AUDIT_LOGS },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [{ label: 'Profile', href: ROUTES.profile, icon: UserRound, permission: Permission.MANAGE_OWN_PROFILE }],
  },
];

/** Navigation visible to a role; sections without visible items are dropped. */
export function getNavigationForRole(role: Role | null | undefined): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(role, item.permission)),
  })).filter((section) => section.items.length > 0);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return matchesPath(pathname, item.href, { exact: item.exact });
}

/** The nav item for the current page (most specific match), used for page titles and breadcrumbs. */
export function findActiveNavItem(pathname: string): NavItem | null {
  const items = NAVIGATION.flatMap((section) => section.items).filter((item) => isNavItemActive(item, pathname));
  return items.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
