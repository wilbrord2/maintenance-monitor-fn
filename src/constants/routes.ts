export const ROUTES = {
  home: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  changePassword: '/change-password',
  dashboard: '/dashboard',
  machines: '/dashboard/machines',
  machine: (id: number) => `/dashboard/machines/${id}`,
  logs: '/dashboard/logs',
  createLog: '/dashboard/logs/create',
  log: (id: number) => `/dashboard/logs/${id}`,
  editLog: (id: number) => `/dashboard/logs/${id}/edit`,
  analytics: '/dashboard/analytics',
  technicians: '/dashboard/technicians',
  technician: (id: number) => `/dashboard/technicians/${id}`,
  auditLogs: '/dashboard/audit-logs',
  profile: '/dashboard/profile',
} as const;

/** Why the user landed on the login page; shown as a notice there. */
export type LoginReason = 'expired' | 'signed-out' | 'signed-out-elsewhere' | 'inactive' | 'password-reset';

const LOGIN_REASONS: ReadonlySet<string> = new Set<LoginReason>([
  'expired',
  'signed-out',
  'signed-out-elsewhere',
  'inactive',
  'password-reset',
]);

export function parseLoginReason(value: string | null): LoginReason | null {
  return value !== null && LOGIN_REASONS.has(value) ? (value as LoginReason) : null;
}

export function buildLoginUrl(options: { next?: string | null; reason?: LoginReason | null } = {}): string {
  const params = new URLSearchParams();
  if (options.next && options.next !== ROUTES.dashboard) params.set('next', options.next);
  if (options.reason) params.set('reason', options.reason);
  const query = params.toString();
  return query ? `${ROUTES.login}?${query}` : ROUTES.login;
}

/** Builds a log-creation link, optionally preselecting a machine. */
export function buildCreateLogUrl(machineId?: number): string {
  return machineId ? `${ROUTES.createLog}?machineId=${machineId}` : ROUTES.createLog;
}
