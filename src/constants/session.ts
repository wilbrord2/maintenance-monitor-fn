/**
 * Name of a non-sensitive cookie meaning "a refresh session probably exists".
 * It never contains a token; the proxy uses it only for optimistic redirects, and the real
 * session is always established by calling the API's refresh endpoint.
 */
export const SESSION_HINT_COOKIE = 'mm_session';

/** Refresh the in-memory access token when it expires within this window. */
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;

/** BroadcastChannel used to keep sign-in state consistent across browser tabs. */
export const AUTH_BROADCAST_CHANNEL = 'maintenance-monitor-auth';

/**
 * Web Lock that serialises refresh calls across tabs. The API rotates refresh tokens and treats a
 * replayed token as theft, so two tabs must never refresh with the same cookie concurrently.
 */
export const AUTH_REFRESH_LOCK = 'maintenance-monitor-auth-refresh';
