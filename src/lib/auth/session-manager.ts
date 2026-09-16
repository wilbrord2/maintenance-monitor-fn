import { ErrorCode } from '@/constants/error-codes';
import { type LoginReason } from '@/constants/routes';
import { ACCESS_TOKEN_REFRESH_MARGIN_MS, AUTH_REFRESH_LOCK } from '@/constants/session';
import { authApi } from '@/lib/api/auth';
import { registerAuthHandlers } from '@/lib/api/client';
import { type ApiError, toApiError } from '@/lib/api/errors';
import { type AuthSession, type ChangePasswordRequest, type LoginRequest } from '@/types/auth';
import { broadcastAuthMessage } from './auth-channel';
import { clearSessionHint, hasSessionHint, writeSessionHint } from './session-hint';
import { sessionStore } from './session-store';

/**
 * Session lifecycle: the access token lives in memory, the refresh token only in the API's
 * httpOnly cookie. A page load restores the session by calling refresh; refreshes are
 * de-duplicated within a tab and serialised across tabs.
 */

function applySession(session: AuthSession): void {
  sessionStore.getState().startSession(session);
  writeSessionHint(session.tokens.refreshTokenExpiresAt);
}

/** Clears local session state. Idempotent. */
export function endLocalSession(reason: LoginReason | null): void {
  clearSessionHint();
  sessionStore.getState().endSession(reason);
}

async function performRefresh(): Promise<AuthSession | null> {
  try {
    const { data } = await authApi.refresh();
    applySession(data);
    return data;
  } catch (error: unknown) {
    const apiError = toApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      endLocalSession(apiError.code === ErrorCode.USER_INACTIVE ? 'inactive' : 'expired');
      return null;
    }
    // Network or server failure: the session may still be valid, so keep it.
    throw apiError;
  }
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

/** Renews the session. Resolves null when it can no longer be renewed; rejects on network errors. */
export function refreshSession(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const pending = locks ? locks.request(AUTH_REFRESH_LOCK, performRefresh) : performRefresh();
    refreshInFlight = pending.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function getValidAccessToken(): Promise<string | null> {
  const { status, accessToken, accessTokenExpiresAt } = sessionStore.getState();
  if (status !== 'authenticated' || !accessToken) return null;
  if (accessTokenExpiresAt !== null && accessTokenExpiresAt - Date.now() < ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    try {
      return (await refreshSession())?.tokens.accessToken ?? null;
    } catch {
      // Offline: send the current token and let the API decide.
      return accessToken;
    }
  }
  return accessToken;
}

/** Restores the session on page load when a refresh session probably exists. */
export async function restoreSession(): Promise<void> {
  if (!hasSessionHint()) {
    sessionStore.getState().endSession(null);
    return;
  }
  sessionStore.getState().setStatus('loading');
  try {
    await refreshSession();
  } catch {
    sessionStore.getState().setStatus('error');
  }
}

export async function signIn(credentials: LoginRequest): Promise<AuthSession> {
  const { data } = await authApi.login(credentials);
  applySession(data);
  broadcastAuthMessage({ type: 'signed-in' });
  return data;
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // The local session is cleared regardless; the server session expires on its own.
  } finally {
    endLocalSession('signed-out');
    broadcastAuthMessage({ type: 'signed-out' });
  }
}

/** Changes the password; the API revokes every session and returns a fresh one. */
export async function changePassword(request: ChangePasswordRequest): Promise<AuthSession> {
  const { data } = await authApi.changePassword(request);
  applySession(data);
  return data;
}

function handleSessionInvalid(error: ApiError): void {
  if (sessionStore.getState().status !== 'authenticated') return;
  endLocalSession(error.code === ErrorCode.USER_INACTIVE ? 'inactive' : 'expired');
}

/** Connects the HTTP client to the session. Returns a cleanup function. */
export function connectAuthToHttpClient(): () => void {
  return registerAuthHandlers({
    getAccessToken: getValidAccessToken,
    refreshAccessToken: async () => {
      try {
        return (await refreshSession())?.tokens.accessToken ?? null;
      } catch {
        return null;
      }
    },
    onSessionInvalid: handleSessionInvalid,
    onPasswordChangeRequired: () => sessionStore.getState().requirePasswordChange(),
  });
}
