export const ROUTES = {
  home: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  changePassword: '/change-password',
  dashboard: '/dashboard',
  machines: '/dashboard/machines',
  machine: (id: number) => `/dashboard/machines/${id}`,
  machinePart: (machineId: number, partId: number) => `/dashboard/machines/${machineId}/parts/${partId}`,
  logs: '/dashboard/logs',
  createLog: '/dashboard/logs/create',
  log: (id: number) => `/dashboard/logs/${id}`,
  editLog: (id: number) => `/dashboard/logs/${id}/edit`,
  maintenance: '/dashboard/maintenance',
  maintenanceEvent: (id: number) => `/dashboard/maintenance/events/${id}`,
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

/** Links to a machine's parts section. */
export function buildMachinePartsUrl(machineId: number): string {
  return `${ROUTES.machine(machineId)}#parts`;
}

/** Builds a log-creation link, optionally preselecting a machine and one of its parts. */
export function buildCreateLogUrl(machineId?: number, partId?: number): string {
  if (!machineId) return ROUTES.createLog;
  const params = new URLSearchParams({ machineId: String(machineId) });
  if (partId) params.set('partId', String(partId));
  return `${ROUTES.createLog}?${params.toString()}`;
}
