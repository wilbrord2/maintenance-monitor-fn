import { AuditAction, AuditEntity } from '@/types/audit';
import { ROUTES } from './routes';
import { type Tone } from './tones';

export const AUDIT_ACTION_CONFIG: Readonly<Record<AuditAction, { label: string; tone: Tone }>> = {
  [AuditAction.LOGIN_SUCCEEDED]: { label: 'Signed in', tone: 'neutral' },
  [AuditAction.LOGIN_FAILED]: { label: 'Failed sign-in', tone: 'warning' },
  [AuditAction.ACCOUNT_LOCKED]: { label: 'Account locked', tone: 'critical' },
  [AuditAction.LOGOUT]: { label: 'Signed out', tone: 'neutral' },
  [AuditAction.TOKEN_REUSE_DETECTED]: { label: 'Token reuse detected', tone: 'critical' },
  [AuditAction.PASSWORD_CHANGED]: { label: 'Password changed', tone: 'info' },
  [AuditAction.PASSWORD_RESET_REQUESTED]: { label: 'Password reset requested', tone: 'neutral' },
  [AuditAction.PASSWORD_RESET_COMPLETED]: { label: 'Password reset', tone: 'info' },
  [AuditAction.TECHNICIAN_CREATED]: { label: 'Technician created', tone: 'positive' },
  [AuditAction.TEMPORARY_CREDENTIAL_REISSUED]: { label: 'Temporary password reissued', tone: 'info' },
  [AuditAction.USER_UPDATED]: { label: 'User updated', tone: 'neutral' },
  [AuditAction.USER_PROFILE_UPDATED]: { label: 'Profile updated', tone: 'neutral' },
  [AuditAction.USER_DEACTIVATED]: { label: 'User deactivated', tone: 'warning' },
  [AuditAction.USER_ACTIVATED]: { label: 'User activated', tone: 'positive' },
  [AuditAction.USER_DELETED]: { label: 'User deleted', tone: 'critical' },
  [AuditAction.MACHINE_CREATED]: { label: 'Machine created', tone: 'positive' },
  [AuditAction.MACHINE_UPDATED]: { label: 'Machine updated', tone: 'neutral' },
  [AuditAction.MACHINE_DEACTIVATED]: { label: 'Machine deactivated', tone: 'warning' },
  [AuditAction.MACHINE_ACTIVATED]: { label: 'Machine activated', tone: 'positive' },
  [AuditAction.MACHINE_DELETED]: { label: 'Machine deleted', tone: 'critical' },
  [AuditAction.MACHINE_STATUS_CHANGED]: { label: 'Machine status changed', tone: 'info' },
  [AuditAction.MACHINE_LOG_CREATED]: { label: 'Log created', tone: 'neutral' },
  [AuditAction.MACHINE_LOG_UPDATED]: { label: 'Log updated', tone: 'neutral' },
  [AuditAction.MACHINE_LOG_DELETED]: { label: 'Log deleted', tone: 'critical' },
};

export const AUDIT_ENTITY_LABELS: Readonly<Record<AuditEntity, string>> = {
  [AuditEntity.AUTH]: 'Authentication',
  [AuditEntity.USER]: 'User',
  [AuditEntity.MACHINE]: 'Machine',
  [AuditEntity.MACHINE_LOG]: 'Machine log',
};

export const AUDIT_ACTION_OPTIONS = Object.values(AuditAction).map((action) => ({
  value: action,
  label: AUDIT_ACTION_CONFIG[action].label,
}));

export const AUDIT_ENTITY_OPTIONS = Object.values(AuditEntity).map((entity) => ({
  value: entity,
  label: AUDIT_ENTITY_LABELS[entity],
}));

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && value in AUDIT_ACTION_CONFIG;
}

export function isAuditEntity(value: unknown): value is AuditEntity {
  return typeof value === 'string' && value in AUDIT_ENTITY_LABELS;
}

/** Link to the audited record, when the application has a page for it. */
export function getAuditEntityHref(entity: AuditEntity, entityId: string | null): string | null {
  const id = entityId !== null && /^\d+$/.test(entityId) ? Number(entityId) : null;
  if (id === null) return null;
  if (entity === AuditEntity.MACHINE) return ROUTES.machine(id);
  if (entity === AuditEntity.MACHINE_LOG) return ROUTES.log(id);
  if (entity === AuditEntity.USER) return ROUTES.technician(id);
  return null;
}
