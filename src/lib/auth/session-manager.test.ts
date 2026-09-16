import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { makeSession } from '@/test/factories';
import { getValidAccessToken, refreshSession, restoreSession, signIn, signOut } from './session-manager';
import { hasSessionHint, writeSessionHint } from './session-hint';
import { sessionStore } from './session-store';

vi.mock('@/lib/api/auth', () => ({
  authApi: { refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() },
}));
vi.mock('./auth-channel', () => ({ broadcastAuthMessage: vi.fn(), subscribeToAuthMessages: vi.fn(() => () => undefined) }));

const refresh = vi.mocked(authApi.refresh);
const logout = vi.mocked(authApi.logout);
const login = vi.mocked(authApi.login);

function resetSession() {
  document.cookie = 'mm_session=; Path=/; Max-Age=0';
  sessionStore.setState({
    status: 'loading',
    user: null,
    mustChangePassword: false,
    accessToken: null,
    accessTokenExpiresAt: null,
    endReason: null,
  });
}

describe('session manager', () => {
  beforeEach(() => {
    resetSession();
    vi.clearAllMocks();
  });
  afterEach(resetSession);

  it('treats a visitor without a session hint as signed out, without calling the API', async () => {
    await restoreSession();
    expect(sessionStore.getState().status).toBe('unauthenticated');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('restores a session from the refresh cookie and keeps the access token in memory only', async () => {
    const session = makeSession();
    writeSessionHint(session.tokens.refreshTokenExpiresAt);
    refresh.mockResolvedValue({ data: session, message: 'Token refreshed' });

    await restoreSession();

    const state = sessionStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user?.email).toBe(session.user.email);
    expect(state.accessToken).toBe(session.tokens.accessToken);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).not.toContain(session.tokens.refreshToken);
  });

  it('marks the session expired and clears the hint when refresh is rejected', async () => {
    writeSessionHint(new Date(Date.now() + 60_000).toISOString());
    refresh.mockRejectedValue(new ApiError({ status: 401, code: 'TOKEN_REVOKED', message: 'Revoked' }));

    await restoreSession();

    expect(sessionStore.getState()).toMatchObject({ status: 'unauthenticated', endReason: 'expired' });
    expect(hasSessionHint()).toBe(false);
  });

  it('reports a connection problem instead of signing out when the API is unreachable', async () => {
    writeSessionHint(new Date(Date.now() + 60_000).toISOString());
    refresh.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }));

    await restoreSession();

    expect(sessionStore.getState().status).toBe('error');
    expect(hasSessionHint()).toBe(true);
  });

  it('shares one refresh request between concurrent callers', async () => {
    let resolve: (value: Awaited<ReturnType<typeof authApi.refresh>>) => void = () => undefined;
    refresh.mockImplementation(() => new Promise((done) => (resolve = done)));

    const first = refreshSession();
    const second = refreshSession();
    resolve({ data: makeSession(), message: 'ok' });

    await Promise.all([first, second]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes before sending an access token that is about to expire', async () => {
    sessionStore.getState().startSession(makeSession({ expiresInMs: 10_000 }));
    const renewed = makeSession();
    refresh.mockResolvedValue({ data: renewed, message: 'ok' });

    await expect(getValidAccessToken()).resolves.toBe(renewed.tokens.accessToken);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signs in and signs out, clearing local state even if logout fails', async () => {
    const session = makeSession({ mustChangePassword: true });
    login.mockResolvedValue({ data: session, message: 'ok' });
    await signIn({ email: session.user.email, password: 'Secret12345!' });
    expect(sessionStore.getState()).toMatchObject({ status: 'authenticated', mustChangePassword: true });
    expect(hasSessionHint()).toBe(true);

    logout.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }));
    await signOut();
    expect(sessionStore.getState()).toMatchObject({ status: 'unauthenticated', endReason: 'signed-out', accessToken: null, user: null });
    expect(hasSessionHint()).toBe(false);
  });
});
