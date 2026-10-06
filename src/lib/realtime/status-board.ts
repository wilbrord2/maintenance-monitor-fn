import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { env } from '@/config/env';
import { ErrorCode } from '@/constants/error-codes';
import { isMachineState } from '@/constants/machine-state';
import { isMachineOperationalStatus } from '@/constants/machine-operational-status';
import { isOperationalImpact } from '@/constants/machine-part';
import { isMaintenanceScheduleState } from '@/constants/maintenance';
import { isLogStatus } from '@/constants/log-status';
import {
  MACHINE_OPERATIONAL_STATUS_UPDATED_EVENT,
  MACHINE_PART_UPDATED_EVENT,
  MACHINE_STATUS_UPDATED_EVENT,
  MAINTENANCE_COMPLETED_EVENT,
  MAINTENANCE_REMINDER_EVENT,
  type MachineOperationalStatusUpdatedEvent,
  type MachinePartUpdatedEvent,
  type MachineStatusTrigger,
  type MachineStatusUpdatedEvent,
  type MaintenanceCompletedEvent,
  type MaintenanceReminderEvent,
  type RealtimeConnectionStatus,
  SESSION_EXPIRED_EVENT,
  type StatusBoardServerEvents,
} from '@/types/realtime';

export const STATUS_BOARD_NAMESPACE = '/status-board';
export const SOCKET_PATH = '/socket.io';

/** Avoids a refresh loop if the server keeps rejecting fresh tokens. */
const TOKEN_REFRESH_COOLDOWN_MS = 10_000;

const TRIGGER_TYPES: ReadonlySet<string> = new Set(['MACHINE_PART', 'MACHINE_LOG', 'MAINTENANCE_EVENT']);
const LOG_SCOPES: ReadonlySet<string> = new Set(['MACHINE', 'PART']);

function isActor(value: unknown): value is { id: number; name: string } {
  if (typeof value !== 'object' || value === null) return false;
  const actor = value as Record<string, unknown>;
  return typeof actor.id === 'number' && typeof actor.name === 'string';
}

const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const isNumber = (value: unknown) => typeof value === 'number';

/** What caused a status recalculation; optional ids must be numbers when present. */
function isStatusTrigger(value: unknown): value is MachineStatusTrigger {
  if (typeof value !== 'object' || value === null) return false;
  const trigger = value as Record<string, unknown>;
  return (
    typeof trigger.type === 'string' &&
    TRIGGER_TYPES.has(trigger.type) &&
    isOptional(trigger.partId, isNumber) &&
    isOptional(trigger.logId, isNumber) &&
    isOptional(trigger.maintenanceEventId, isNumber) &&
    isOptional(trigger.scope, (scope) => typeof scope === 'string' && LOG_SCOPES.has(scope))
  );
}

/** Validates an incoming `machine.status.updated` payload before it touches the cache. */
export function isMachineStatusUpdatedEvent(value: unknown): value is MachineStatusUpdatedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.machineId === 'number' &&
    typeof event.machineName === 'string' &&
    typeof event.serialNumber === 'string' &&
    isMachineState(event.previousStatus) &&
    isMachineState(event.newStatus) &&
    typeof event.reason === 'string' &&
    isStatusTrigger(event.trigger) &&
    (event.logId === null || typeof event.logId === 'number') &&
    typeof event.timestamp === 'string' &&
    isActor(event.updatedBy)
  );
}

/** Validates an incoming `machine.operational-status.updated` payload before it touches the cache. */
export function isOperationalStatusEvent(value: unknown): value is MachineOperationalStatusUpdatedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.machineId === 'number' &&
    typeof event.machineName === 'string' &&
    typeof event.serialNumber === 'string' &&
    isMachineOperationalStatus(event.previousStatus) &&
    isMachineOperationalStatus(event.newStatus) &&
    typeof event.reason === 'string' &&
    typeof event.timestamp === 'string' &&
    isStatusTrigger(event.trigger) &&
    isActor(event.updatedBy)
  );
}

/** Validates an incoming `machine.part.updated` payload before it touches the cache. */
export function isMachinePartUpdatedEvent(value: unknown): value is MachinePartUpdatedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.machineId === 'number' &&
    typeof event.partId === 'number' &&
    typeof event.partCode === 'string' &&
    typeof event.partName === 'string' &&
    isMachineState(event.previousStatus) &&
    isMachineState(event.newStatus) &&
    isOperationalImpact(event.operationalImpact) &&
    typeof event.isCritical === 'boolean' &&
    typeof event.logId === 'number' &&
    isLogStatus(event.logStatus) &&
    typeof event.timestamp === 'string' &&
    isActor(event.updatedBy)
  );
}

/** Validates an incoming `maintenance.reminder` payload. */
export function isMaintenanceReminderEvent(value: unknown): value is MaintenanceReminderEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.scheduleId === 'number' &&
    typeof event.machineId === 'number' &&
    typeof event.machineName === 'string' &&
    typeof event.serialNumber === 'string' &&
    isMaintenanceScheduleState(event.state) &&
    typeof event.nextMaintenanceAt === 'string' &&
    typeof event.daysUntilDue === 'number' &&
    typeof event.timestamp === 'string'
  );
}

/** Validates an incoming `maintenance.completed` payload. */
export function isMaintenanceCompletedEvent(value: unknown): value is MaintenanceCompletedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  const performedBy = event.performedBy;
  return (
    typeof event.eventId === 'number' &&
    typeof event.machineId === 'number' &&
    typeof event.machineName === 'string' &&
    typeof event.completedAt === 'string' &&
    typeof event.timestamp === 'string' &&
    (event.scheduleId === null || typeof event.scheduleId === 'number') &&
    (event.nextMaintenanceAt === null || typeof event.nextMaintenanceAt === 'string') &&
    (performedBy === null || isActor(performedBy))
  );
}

export type SocketFactory = (url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket;

export interface StatusBoardOptions {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  onStatusUpdated(event: MachineStatusUpdatedEvent): void;
  onOperationalStatusUpdated(event: MachineOperationalStatusUpdatedEvent): void;
  onPartUpdated(event: MachinePartUpdatedEvent): void;
  onMaintenanceReminder(event: MaintenanceReminderEvent): void;
  onMaintenanceCompleted(event: MaintenanceCompletedEvent): void;
  onConnectionStatusChange(status: RealtimeConnectionStatus): void;
  /** Called after a reconnection, when events may have been missed. */
  onResync(): void;
  createSocket?: SocketFactory;
}

export interface StatusBoardConnection {
  disconnect(): void;
}

/**
 * Connects to the live status board. The access token is read on every (re)connection, and the
 * connection is renewed with a refreshed token when the server reports that the token expired.
 */
export function connectStatusBoard(options: StatusBoardOptions): StatusBoardConnection {
  const createSocket: SocketFactory = options.createSocket ?? io;
  const socket = createSocket(`${env.wsUrl}${STATUS_BOARD_NAMESPACE}`, {
    path: SOCKET_PATH,
    autoConnect: false,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 15_000,
    auth: (callback) => {
      void options.getAccessToken().then((token) => callback({ token: token ?? '' }));
    },
  }) as Socket<StatusBoardServerEvents>;

  let closed = false;
  let hasConnected = false;
  let lastRefreshAt = 0;

  const reconnectWithFreshToken = async () => {
    if (closed) return;
    if (Date.now() - lastRefreshAt < TOKEN_REFRESH_COOLDOWN_MS) {
      options.onConnectionStatusChange('offline');
      return;
    }
    lastRefreshAt = Date.now();
    options.onConnectionStatusChange('reconnecting');
    const token = await options.refreshAccessToken();
    if (closed) return;
    if (token) socket.connect();
    else options.onConnectionStatusChange('offline');
  };

  socket.on('connect', () => {
    options.onConnectionStatusChange('connected');
    if (hasConnected) options.onResync();
    hasConnected = true;
  });

  socket.on('disconnect', (reason) => {
    if (closed) return;
    // The server disconnects when the access token expires (after `session.expired`).
    if (reason === 'io server disconnect') void reconnectWithFreshToken();
    else options.onConnectionStatusChange('reconnecting');
  });

  socket.on('connect_error', (error) => {
    if (closed) return;
    // Transport problems are retried automatically by Socket.IO.
    if (socket.active) {
      options.onConnectionStatusChange('reconnecting');
      return;
    }
    if (error.message === ErrorCode.TOKEN_EXPIRED) {
      void reconnectWithFreshToken();
      return;
    }
    // Authentication was refused; the HTTP layer handles the session itself.
    options.onConnectionStatusChange('offline');
  });

  socket.on(SESSION_EXPIRED_EVENT, () => {
    options.onConnectionStatusChange('reconnecting');
  });

  socket.on(MACHINE_STATUS_UPDATED_EVENT, (payload: unknown) => {
    if (isMachineStatusUpdatedEvent(payload)) options.onStatusUpdated(payload);
  });

  socket.on(MACHINE_OPERATIONAL_STATUS_UPDATED_EVENT, (payload: unknown) => {
    if (isOperationalStatusEvent(payload)) options.onOperationalStatusUpdated(payload);
  });

  socket.on(MACHINE_PART_UPDATED_EVENT, (payload: unknown) => {
    if (isMachinePartUpdatedEvent(payload)) options.onPartUpdated(payload);
  });

  socket.on(MAINTENANCE_REMINDER_EVENT, (payload: unknown) => {
    if (isMaintenanceReminderEvent(payload)) options.onMaintenanceReminder(payload);
  });

  socket.on(MAINTENANCE_COMPLETED_EVENT, (payload: unknown) => {
    if (isMaintenanceCompletedEvent(payload)) options.onMaintenanceCompleted(payload);
  });

  const handleOnline = () => {
    if (!closed && !socket.connected && !socket.active) socket.connect();
  };
  if (typeof window !== 'undefined') window.addEventListener('online', handleOnline);

  options.onConnectionStatusChange('connecting');
  socket.connect();

  return {
    disconnect() {
      closed = true;
      if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline);
      socket.removeAllListeners();
      socket.disconnect();
      options.onConnectionStatusChange('idle');
    },
  };
}
