import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { env } from '@/config/env';
import { ErrorCode } from '@/constants/error-codes';
import { isMachineState } from '@/constants/machine-state';
import {
  MACHINE_STATUS_UPDATED_EVENT,
  type MachineStatusUpdatedEvent,
  type RealtimeConnectionStatus,
  SESSION_EXPIRED_EVENT,
  type StatusBoardServerEvents,
} from '@/types/realtime';

export const STATUS_BOARD_NAMESPACE = '/status-board';
export const SOCKET_PATH = '/socket.io';

/** Avoids a refresh loop if the server keeps rejecting fresh tokens. */
const TOKEN_REFRESH_COOLDOWN_MS = 10_000;

const CHANGE_SOURCES: ReadonlySet<string> = new Set(['MACHINE_LOG_CREATED', 'MACHINE_LOG_UPDATED', 'MACHINE_LOG_DELETED']);

/** Validates an incoming payload before it touches the cache. */
export function isMachineStatusUpdatedEvent(value: unknown): value is MachineStatusUpdatedEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  const updatedBy = event.updatedBy as Record<string, unknown> | null | undefined;
  return (
    typeof event.machineId === 'number' &&
    typeof event.machineName === 'string' &&
    typeof event.serialNumber === 'string' &&
    isMachineState(event.previousStatus) &&
    isMachineState(event.newStatus) &&
    typeof event.logId === 'number' &&
    typeof event.timestamp === 'string' &&
    typeof event.source === 'string' &&
    CHANGE_SOURCES.has(event.source) &&
    typeof updatedBy === 'object' &&
    updatedBy !== null &&
    typeof updatedBy.id === 'number' &&
    typeof updatedBy.name === 'string'
  );
}

export type SocketFactory = (url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket;

export interface StatusBoardOptions {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  onStatusUpdated(event: MachineStatusUpdatedEvent): void;
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
