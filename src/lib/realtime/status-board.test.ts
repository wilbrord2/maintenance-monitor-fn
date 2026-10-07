import { type Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import {
  makeMaintenanceCompletedEvent,
  makeOperationalStatusEvent,
  makePartEvent,
  makeReminderEvent,
  makeStatusEvent,
} from '@/test/factories';
import { LogScope } from '@/types/machine-log';
import { MACHINE_PART_UPDATED_EVENT } from '@/types/realtime';
import {
  connectStatusBoard,
  isMachinePartUpdatedEvent,
  isMachineStatusUpdatedEvent,
  isMaintenanceCompletedEvent,
  isMaintenanceReminderEvent,
  isOperationalStatusEvent,
  type SocketFactory,
  type StatusBoardOptions,
} from './status-board';

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
    onOperationalStatusUpdated: vi.fn(),
    onPartUpdated: vi.fn(),
    onMaintenanceReminder: vi.fn(),
    onMaintenanceCompleted: vi.fn(),
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

  it('accepts the status payload with its trigger, and a null log id', () => {
    expect(isMachineStatusUpdatedEvent(makeStatusEvent({ logId: null, trigger: { type: 'MAINTENANCE_EVENT', maintenanceEventId: 60 } }))).toBe(true);
    expect(
      isMachineStatusUpdatedEvent(makeStatusEvent({ trigger: { type: 'MACHINE_PART', partId: 11, logId: 90, scope: LogScope.PART } })),
    ).toBe(true);
  });

  it('rejects the old status payload and malformed triggers', () => {
    const { trigger: _trigger, reason: _reason, ...legacy } = makeStatusEvent();
    // The removed `source` field is no substitute for `trigger` and `reason`.
    expect(isMachineStatusUpdatedEvent({ ...legacy, source: 'MACHINE_LOG_CREATED' })).toBe(false);
    expect(isMachineStatusUpdatedEvent(makeStatusEvent({ logId: undefined }))).toBe(false);
    expect(isMachineStatusUpdatedEvent({ ...makeStatusEvent(), trigger: { type: 'SOMETHING_ELSE' } })).toBe(false);
    expect(isMachineStatusUpdatedEvent({ ...makeStatusEvent(), trigger: { type: 'MACHINE_LOG', scope: 'SYSTEM' } })).toBe(false);
    expect(isMachineStatusUpdatedEvent({ ...makeStatusEvent(), trigger: { type: 'MACHINE_PART', partId: '11' } })).toBe(false);
    expect(isOperationalStatusEvent({ ...makeOperationalStatusEvent(), trigger: null })).toBe(false);
  });

  it('validates the part, operational-status and maintenance payloads', () => {
    expect(isOperationalStatusEvent(makeOperationalStatusEvent())).toBe(true);
    // A machine state is not an operational status; the two enums must not be mixed up.
    expect(isOperationalStatusEvent({ ...makeOperationalStatusEvent(), newStatus: 'UNDER_MAINTENANCE' })).toBe(false);

    expect(isMachinePartUpdatedEvent(makePartEvent())).toBe(true);
    expect(isMachinePartUpdatedEvent({ ...makePartEvent(), newStatus: 'OPERATING' })).toBe(false);
    expect(isMachinePartUpdatedEvent({ ...makePartEvent(), operationalImpact: 'MAYBE' })).toBe(false);

    expect(isMaintenanceReminderEvent(makeReminderEvent())).toBe(true);
    expect(isMaintenanceReminderEvent({ ...makeReminderEvent(), state: 'LATE' })).toBe(false);
    // Machine-wide tasks have no part; every reminder names its task.
    expect(isMaintenanceReminderEvent(makeReminderEvent({ machinePartId: null, partName: null, taskName: 'External cleaning' }))).toBe(true);
    const { taskName: _taskName, ...withoutTask } = makeReminderEvent();
    expect(isMaintenanceReminderEvent(withoutTask)).toBe(false);

    expect(isMaintenanceCompletedEvent(makeMaintenanceCompletedEvent())).toBe(true);
    expect(isMaintenanceCompletedEvent({ ...makeMaintenanceCompletedEvent(), nextMaintenanceAt: null })).toBe(true);
    expect(isMaintenanceCompletedEvent({ ...makeMaintenanceCompletedEvent(), completedAt: 5 })).toBe(false);
    // One-off work has neither task nor schedule.
    expect(
      isMaintenanceCompletedEvent(makeMaintenanceCompletedEvent({ scheduleId: null, taskName: null, machinePartId: null, partName: null })),
    ).toBe(true);
    expect(isMaintenanceCompletedEvent({ ...makeMaintenanceCompletedEvent(), partName: 7 })).toBe(false);
  });

  it('delivers only valid payloads to the application', () => {
    const { socket, options } = setup();
    socket.emit(MACHINE_PART_UPDATED_EVENT, makePartEvent());
    socket.emit(MACHINE_PART_UPDATED_EVENT, { machineId: 'five' });
    expect(options.onPartUpdated).toHaveBeenCalledTimes(1);
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
