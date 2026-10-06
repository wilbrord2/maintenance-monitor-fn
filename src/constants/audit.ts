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
  [AuditAction.MACHINE_SYSTEM_STATUS_CHANGED]: { label: 'Machine system status changed', tone: 'info' },
  [AuditAction.MACHINE_LOG_CREATED]: { label: 'Log created', tone: 'neutral' },
  [AuditAction.MACHINE_LOG_UPDATED]: { label: 'Log updated', tone: 'neutral' },
  [AuditAction.MACHINE_LOG_DELETED]: { label: 'Log deleted', tone: 'critical' },
  [AuditAction.MACHINE_OPERATIONAL_STATUS_CHANGED]: { label: 'Machine operational status changed', tone: 'info' },
  [AuditAction.MACHINE_PART_CREATED]: { label: 'Part added', tone: 'positive' },
  [AuditAction.MACHINE_PART_UPDATED]: { label: 'Part updated', tone: 'neutral' },
  [AuditAction.MACHINE_PART_DELETED]: { label: 'Part removed', tone: 'critical' },
  [AuditAction.MACHINE_PART_STATUS_CHANGED]: { label: 'Part status changed', tone: 'info' },
  [AuditAction.MAINTENANCE_SCHEDULE_CREATED]: { label: 'Maintenance schedule created', tone: 'positive' },
  [AuditAction.MAINTENANCE_SCHEDULE_UPDATED]: { label: 'Maintenance schedule updated', tone: 'neutral' },
  [AuditAction.MAINTENANCE_EVENT_CREATED]: { label: 'Maintenance planned', tone: 'neutral' },
  [AuditAction.MAINTENANCE_EVENT_UPDATED]: { label: 'Maintenance updated', tone: 'neutral' },
  [AuditAction.MAINTENANCE_STARTED]: { label: 'Maintenance started', tone: 'info' },
  [AuditAction.MAINTENANCE_COMPLETED]: { label: 'Maintenance completed', tone: 'positive' },
  [AuditAction.MAINTENANCE_CANCELLED]: { label: 'Maintenance cancelled', tone: 'warning' },
  [AuditAction.MAINTENANCE_MISSED]: { label: 'Maintenance missed', tone: 'critical' },
  [AuditAction.MAINTENANCE_REMINDER_SENT]: { label: 'Maintenance reminder sent', tone: 'neutral' },
};

export const AUDIT_ENTITY_LABELS: Readonly<Record<AuditEntity, string>> = {
  [AuditEntity.AUTH]: 'Authentication',
  [AuditEntity.USER]: 'User',
  [AuditEntity.MACHINE]: 'Machine',
  [AuditEntity.MACHINE_LOG]: 'Machine log',
  [AuditEntity.MACHINE_PART]: 'Machine part',
  [AuditEntity.MAINTENANCE_SCHEDULE]: 'Maintenance schedule',
  [AuditEntity.MAINTENANCE_EVENT]: 'Maintenance',
};

/** Turns an unknown code such as `MACHINE_FOO_CHANGED` into "Machine foo changed". */
function humanize(code: string): string {
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Display config for an action. Old entries and actions added to the API after this build are not
 * in the table; they are shown by name instead of breaking the page.
 */
export function getAuditActionConfig(action: string): { label: string; tone: Tone } {
  return isAuditAction(action) ? AUDIT_ACTION_CONFIG[action] : { label: humanize(action), tone: 'neutral' };
}

export function getAuditEntityLabel(entity: string): string {
  return isAuditEntity(entity) ? AUDIT_ENTITY_LABELS[entity] : humanize(entity);
}

export const AUDIT_ACTION_OPTIONS = Object.values(AuditAction).map((action) => ({
  value: action,
  label: AUDIT_ACTION_CONFIG[action].label,
}));

export const AUDIT_ENTITY_OPTIONS = Object.values(AuditEntity).map((entity) => ({
  value: entity,
  label: AUDIT_ENTITY_LABELS[entity],
}));

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && Object.hasOwn(AUDIT_ACTION_CONFIG, value);
}

export function isAuditEntity(value: unknown): value is AuditEntity {
  return typeof value === 'string' && Object.hasOwn(AUDIT_ENTITY_LABELS, value);
}

/** Link to the audited record, when the application has a page for it. */
export function getAuditEntityHref(entity: AuditEntity, entityId: string | null): string | null {
  const id = entityId !== null && /^\d+$/.test(entityId) ? Number(entityId) : null;
  if (id === null) return null;
  if (entity === AuditEntity.MACHINE) return ROUTES.machine(id);
  if (entity === AuditEntity.MACHINE_LOG) return ROUTES.log(id);
  if (entity === AuditEntity.USER) return ROUTES.technician(id);
  if (entity === AuditEntity.MAINTENANCE_EVENT) return ROUTES.maintenanceEvent(id);
  return null;
}
