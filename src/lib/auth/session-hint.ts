import { SESSION_HINT_COOKIE } from '@/constants/session';

/**
 * The session hint is a plain flag ("1") with the refresh session's expiry. It lets the proxy
 * redirect signed-out visitors before any JavaScript runs. It carries no credential: forging it
 * only reveals the app shell, and every API call still requires a real session.
 */
export function writeSessionHint(expiresAt: string): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(expiresAt);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${secure}`;
}

export function clearSessionHint(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((entry) => entry.startsWith(`${SESSION_HINT_COOKIE}=1`));
}
