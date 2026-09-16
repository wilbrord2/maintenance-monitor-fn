import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { signIn } from '@/lib/auth/session-manager';
import { sessionStore } from '@/lib/auth/session-store';
import { makeSession } from '@/test/factories';
import { navigation, setNavigation } from '@/test/navigation';
import { renderWithProviders } from '@/test/render';
import { LoginForm } from './login-form';

vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
vi.mock('@/lib/auth/session-manager', () => ({ signIn: vi.fn() }));

const signInMock = vi.mocked(signIn);

async function fillAndSubmit(user: ReturnType<typeof renderWithProviders>['user']) {
  await user.type(screen.getByLabelText(/Email/), 'jean@example.com');
  await user.type(screen.getByLabelText(/^Password/), 'TemporaryPass123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    setNavigation('/login');
    signInMock.mockReset();
    sessionStore.setState({ status: 'unauthenticated', user: null, endReason: null });
  });

  it('shows field errors instead of submitting an empty form', async () => {
    const { user } = renderWithProviders(<LoginForm />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter an email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('sends a first-time technician to change their temporary password', async () => {
    signInMock.mockResolvedValue(makeSession({ mustChangePassword: true }));
    const { user } = renderWithProviders(<LoginForm />);
    await fillAndSubmit(user);
    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/change-password'));
    expect(signInMock.mock.calls[0]?.[0]).toEqual({ email: 'jean@example.com', password: 'TemporaryPass123' });
  });

  it('returns to the requested page, refusing external redirects', async () => {
    signInMock.mockResolvedValue(makeSession());
    setNavigation('/login', 'next=%2Fdashboard%2Flogs%3FlogStatus%3DOPEN');
    const first = renderWithProviders(<LoginForm />);
    await fillAndSubmit(first.user);
    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/dashboard/logs?logStatus=OPEN'));
    first.unmount();

    setNavigation('/login', 'next=%2F%2Fevil.example');
    const second = renderWithProviders(<LoginForm />);
    await fillAndSubmit(second.user);
    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('explains failed sign-ins without revealing which field was wrong', async () => {
    signInMock.mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }));
    const { user } = renderWithProviders(<LoginForm />);
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('tells users why they were signed out', () => {
    setNavigation('/login', 'reason=expired');
    renderWithProviders(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired. Sign in again to continue.');
  });
});
