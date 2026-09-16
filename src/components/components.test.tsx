import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteAccessGuard, PermissionGuard } from '@/components/auth/guards';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getPageItems, Pagination } from '@/components/ui/pagination';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { sessionStore } from '@/lib/auth/session-store';
import { Permission } from '@/lib/permissions/permissions';
import { makeUser } from '@/test/factories';
import { setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types/auth';
import { MACHINE_STATES, MachineState } from '@/types/machine';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);

function signInAs(role: Role) {
  act(() => {
    sessionStore.setState({ status: 'authenticated', user: makeUser({ role }), accessToken: 'token', accessTokenExpiresAt: Date.now() + 60_000 });
  });
}

describe('Pagination', () => {
  it('describes the visible range and moves between pages', async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(<Pagination meta={{ page: 2, limit: 20, totalItems: 145, totalPages: 8 }} onPageChange={onPageChange} />);

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21–40 of 145 results');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('disables previous on the first page', () => {
    renderWithProviders(<Pagination meta={{ page: 1, limit: 20, totalItems: 5, totalPages: 1 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('collapses long page lists around the current page', () => {
    expect(getPageItems(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('MachineStateBadge', () => {
  it.each(MACHINE_STATES)('shows a text label for %s, never colour alone', (state) => {
    renderWithProviders(<MachineStateBadge state={state} />);
    const label = MACHINE_STATE_CONFIG[state].label;
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(label).closest('[title]')).toHaveAttribute('title', MACHINE_STATE_CONFIG[state].description);
  });
});

describe('role-aware UI', () => {
  beforeEach(() => {
    setNavigation('/dashboard/machines/7');
  });

  it('shows administration links only to administrators and marks the active section', () => {
    signInAs(Role.TECHNICIAN);
    const { unmount } = renderWithProviders(<SidebarNav />);
    expect(screen.queryByRole('link', { name: 'Technicians' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Machines' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    unmount();

    signInAs(Role.ADMIN);
    renderWithProviders(<SidebarNav />);
    expect(screen.getByRole('link', { name: 'Technicians' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeInTheDocument();
  });

  it('blocks pages the role may not open', () => {
    setNavigation('/dashboard/audit-logs');
    signInAs(Role.TECHNICIAN);
    renderWithProviders(<RouteAccessGuard>Audit trail</RouteAccessGuard>);
    expect(screen.queryByText('Audit trail')).not.toBeInTheDocument();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('hides unauthorised actions', () => {
    signInAs(Role.TECHNICIAN);
    renderWithProviders(
      <>
        <PermissionGuard permission={Permission.DELETE_LOGS}>Delete log</PermissionGuard>
        <PermissionGuard permission={Permission.UPDATE_LOGS}>Edit log</PermissionGuard>
      </>,
    );
    expect(screen.queryByText('Delete log')).not.toBeInTheDocument();
    expect(screen.getByText('Edit log')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('starts on Cancel so a stray key press never confirms', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete maintenance log?"
        description="This action may affect the machine's historical activity."
        confirmLabel="Delete log"
        tone="danger"
        onConfirm={onConfirm}
      />,
    );

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete maintenance log?' });
    expect(dialog).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete log' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('status display', () => {
  it('renders the same state consistently', () => {
    renderWithProviders(<MachineStateBadge state={MachineState.DOWNTIME} size="sm" />);
    expect(screen.getByText('Downtime')).toBeInTheDocument();
  });
});
