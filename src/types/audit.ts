import { type DateRangeParams, type PageParams, type SortOrder } from './api';

export enum AuditAction {
  LOGIN_SUCCEEDED = 'LOGIN_SUCCEEDED',
  LOGIN_FAILED = 'LOGIN_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LOGOUT = 'LOGOUT',
  TOKEN_REUSE_DETECTED = 'TOKEN_REUSE_DETECTED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  TECHNICIAN_CREATED = 'TECHNICIAN_CREATED',
  TEMPORARY_CREDENTIAL_REISSUED = 'TEMPORARY_CREDENTIAL_REISSUED',
  USER_UPDATED = 'USER_UPDATED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DELETED = 'USER_DELETED',
  MACHINE_CREATED = 'MACHINE_CREATED',
  MACHINE_UPDATED = 'MACHINE_UPDATED',
  MACHINE_DEACTIVATED = 'MACHINE_DEACTIVATED',
  MACHINE_ACTIVATED = 'MACHINE_ACTIVATED',
  MACHINE_DELETED = 'MACHINE_DELETED',
  MACHINE_STATUS_CHANGED = 'MACHINE_STATUS_CHANGED',
  MACHINE_LOG_CREATED = 'MACHINE_LOG_CREATED',
  MACHINE_LOG_UPDATED = 'MACHINE_LOG_UPDATED',
  MACHINE_LOG_DELETED = 'MACHINE_LOG_DELETED',
}

export enum AuditEntity {
  AUTH = 'AUTH',
  USER = 'USER',
  MACHINE = 'MACHINE',
  MACHINE_LOG = 'MACHINE_LOG',
}

export interface AuditLog {
  id: number;
  user: { id: number; fullName: string; email: string } | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  /** Already sanitised by the API: never contains passwords, tokens or hashes. */
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface ListAuditLogsParams extends PageParams, DateRangeParams {
  sortOrder?: SortOrder;
  userId?: number;
  action?: AuditAction;
  entity?: AuditEntity;
  entityId?: string;
}
