import { type Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import { makeStatusEvent } from '@/test/factories';
import { connectStatusBoard, isMachineStatusUpdatedEvent, type SocketFactory, type StatusBoardOptions } from './status-board';

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  readonly handlers = new Map<string, Handler[]>();
  active = false;
  connected = false;
  connect = vi.fn(() => {
    this.active = true;
  });
  disconnect = vi.fn();
  removeAllListeners = vi.fn();

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

function setup(overrides: Partial<StatusBoardOptions> = {}) {
  const socket = new FakeSocket();
  let factoryOptions: Parameters<SocketFactory>[1] | undefined;
  const createSocket: SocketFactory = (_url, options) => {
    factoryOptions = options;
    return socket as unknown as Socket;
  };
  const options = {
    getAccessToken: vi.fn(async () => 'access-token'),
    refreshAccessToken: vi.fn(async (): Promise<string | null> => 'fresh-token'),
    onStatusUpdated: vi.fn(),
    onConnectionStatusChange: vi.fn(),
    onResync: vi.fn(),
    createSocket,
    ...overrides,
  };
  const connection = connectStatusBoard(options);
  return { socket, options, connection, factoryOptions: () => factoryOptions };
}

describe('status board connection', () => {
  it('validates event payloads', () => {
    expect(isMachineStatusUpdatedEvent(makeStatusEvent())).toBe(true);
    expect(isMachineStatusUpdatedEvent({ ...makeStatusEvent(), newStatus: 'EXPLODED' })).toBe(false);
    expect(isMachineStatusUpdatedEvent({ machineId: '5' })).toBe(false);
    expect(isMachineStatusUpdatedEvent(null)).toBe(false);
  });

  it('authenticates with the current access token on every connection', async () => {
    const { factoryOptions } = setup();
    const auth = factoryOptions()?.auth;
    expect(typeof auth).toBe('function');
    const received = await new Promise<object>((resolve) => {
      if (typeof auth === 'function') auth(resolve);
    });
    expect(received).toEqual({ token: 'access-token' });
  });

  it('forwards only valid status events', () => {
    const { socket, options } = setup();
    socket.emit('machine.status.updated', makeStatusEvent());
    socket.emit('machine.status.updated', { bogus: true });
    expect(options.onStatusUpdated).toHaveBeenCalledTimes(1);
  });

  it('reconnects with a refreshed token when the server reports an expired token', async () => {
    const { socket, options } = setup();
    socket.active = false;
    socket.emit('connect_error', new Error('TOKEN_EXPIRED'));
    await vi.waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(2));
    expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('stops when authentication is refused for another reason', () => {
    const { socket, options } = setup();
    socket.active = false;
    socket.emit('connect_error', new Error('PASSWORD_CHANGE_REQUIRED'));
    expect(options.refreshAccessToken).not.toHaveBeenCalled();
    expect(options.onConnectionStatusChange).toHaveBeenLastCalledWith('offline');
  });

  it('asks for a resync after reconnecting', () => {
    const { socket, options } = setup();
    socket.emit('connect');
    expect(options.onResync).not.toHaveBeenCalled();
    socket.emit('disconnect', 'transport close');
    expect(options.onConnectionStatusChange).toHaveBeenLastCalledWith('reconnecting');
    socket.emit('connect');
    expect(options.onResync).toHaveBeenCalledTimes(1);
  });

  it('cleans up on disconnect', () => {
    const { socket, options, connection } = setup();
    connection.disconnect();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(options.onConnectionStatusChange).toHaveBeenLastCalledWith('idle');
  });
});
