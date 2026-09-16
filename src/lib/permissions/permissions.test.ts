import { describe, expect, it } from 'vitest';
import { getNavigationForRole, isNavItemActive, NAVIGATION, type NavItem } from '@/config/navigation';
import { Role } from '@/types/auth';
import { hasAnyPermission, hasPermission, Permission } from './permissions';
import { canAccessRoute, getRoutePermission } from './route-access';

const navItem = (label: string): NavItem => {
  const item = NAVIGATION.flatMap((section) => section.items).find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Missing nav item ${label}`);
  return item;
};

describe('role permissions', () => {
  it('grants administrators every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(hasPermission(Role.ADMIN, permission)).toBe(true);
    }
  });

  it('lets technicians record and update logs but not manage the platform', () => {
    expect(hasPermission(Role.TECHNICIAN, Permission.CREATE_LOGS)).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, Permission.UPDATE_LOGS)).toBe(true);
    expect(hasPermission(Role.TECHNICIAN, Permission.DELETE_LOGS)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.MANAGE_MACHINES)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.VIEW_USERS)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.MANAGE_USERS)).toBe(false);
    expect(hasPermission(Role.TECHNICIAN, Permission.VIEW_AUDIT_LOGS)).toBe(false);
  });

  it('denies everything without a role', () => {
    expect(hasPermission(null, Permission.VIEW_DASHBOARD)).toBe(false);
    expect(hasAnyPermission(undefined, [Permission.VIEW_MACHINES])).toBe(false);
  });
});

describe('role-aware navigation', () => {
  const labels = (role: Role) => getNavigationForRole(role).flatMap((section) => section.items.map((item) => item.label));

  it('shows the full navigation to administrators', () => {
    expect(labels(Role.ADMIN)).toEqual(['Dashboard', 'Machines', 'Machine Logs', 'Analytics', 'Technicians', 'Audit Logs', 'Profile']);
  });

  it('hides administration from technicians and drops the empty section', () => {
    expect(labels(Role.TECHNICIAN)).toEqual(['Dashboard', 'Machines', 'Machine Logs', 'Analytics', 'Profile']);
    expect(getNavigationForRole(Role.TECHNICIAN).map((section) => section.id)).toEqual(['operations', 'account']);
  });

  it('highlights nested routes by path segment, not by string prefix', () => {
    expect(isNavItemActive(navItem('Machines'), '/dashboard/machines/12')).toBe(true);
    expect(isNavItemActive(navItem('Dashboard'), '/dashboard/machines')).toBe(false);
    expect(isNavItemActive(navItem('Dashboard'), '/dashboard')).toBe(true);
    expect(isNavItemActive(navItem('Machine Logs'), '/dashboard/logs-archive')).toBe(false);
  });
});

describe('route access', () => {
  it.each([
    ['/dashboard', true],
    ['/dashboard/machines/3', true],
    ['/dashboard/logs/create', true],
    ['/dashboard/logs/5/edit', true],
    ['/dashboard/analytics', true],
    ['/dashboard/profile', true],
    ['/dashboard/technicians', false],
    ['/dashboard/technicians/4', false],
    ['/dashboard/audit-logs', false],
  ])('technician access to %s is %s', (pathname, allowed) => {
    expect(canAccessRoute(Role.TECHNICIAN, pathname)).toBe(allowed);
  });

  it('uses the most specific matching rule', () => {
    expect(getRoutePermission('/dashboard/logs/create')).toBe(Permission.CREATE_LOGS);
    expect(getRoutePermission('/dashboard/logs/9/edit')).toBe(Permission.UPDATE_LOGS);
    expect(getRoutePermission('/dashboard/logs/9')).toBe(Permission.VIEW_LOGS);
  });

  it('allows administrators everywhere', () => {
    expect(canAccessRoute(Role.ADMIN, '/dashboard/audit-logs')).toBe(true);
  });
});
