import { create } from 'zustand';
import {
  type MachineOperationalStatusUpdatedEvent,
  type MachinePartUpdatedEvent,
  type MachineStatusUpdatedEvent,
  type MaintenanceCompletedEvent,
  type MaintenanceReminderEvent,
  type RealtimeConnectionStatus,
} from '@/types/realtime';

interface NotificationBase {
  id: string;
  receivedAt: number;
  /** Caused by the signed-in user (not counted as unread). */
  ownChange: boolean;
  machineId: number;
  machineName: string;
  /** When the API emitted the event. */
  timestamp: string;
}

/**
 * One entry in the live feed. Each kind keeps its original payload so the menu can show exactly
 * what the API reported, without the client restating it.
 */
export type RealtimeNotification =
  | (NotificationBase & { kind: 'machine-status'; event: MachineStatusUpdatedEvent })
  | (NotificationBase & { kind: 'operational-status'; event: MachineOperationalStatusUpdatedEvent })
  | (NotificationBase & { kind: 'part'; event: MachinePartUpdatedEvent })
  | (NotificationBase & { kind: 'maintenance-reminder'; event: MaintenanceReminderEvent })
  | (NotificationBase & { kind: 'maintenance-completed'; event: MaintenanceCompletedEvent });

const MAX_NOTIFICATIONS = 40;

interface RealtimeState {
  connectionStatus: RealtimeConnectionStatus;
  notifications: RealtimeNotification[];
  unreadCount: number;
  /** machineId → time the change arrived; drives the brief row highlight. */
  highlightedMachines: Record<number, number>;
  setConnectionStatus(status: RealtimeConnectionStatus): void;
  recordStatusChange(event: MachineStatusUpdatedEvent, ownChange: boolean): void;
  recordOperationalChange(event: MachineOperationalStatusUpdatedEvent, ownChange: boolean): void;
  recordPartChange(event: MachinePartUpdatedEvent, ownChange: boolean): void;
  recordMaintenanceReminder(event: MaintenanceReminderEvent): void;
  recordMaintenanceCompleted(event: MaintenanceCompletedEvent, ownChange: boolean): void;
  markAllRead(): void;
  clearHighlight(machineId: number): void;
  reset(): void;
}

const initialState = {
  connectionStatus: 'idle' as RealtimeConnectionStatus,
  notifications: [] as RealtimeNotification[],
  unreadCount: 0,
  highlightedMachines: {} as Record<number, number>,
};

/** Live-connection state and the recent changes shown in the header. */
export const useRealtimeStore = create<RealtimeState>()((set) => {
  const add = (notification: RealtimeNotification, highlight = true) =>
    set((state) => {
      if (state.notifications.some((existing) => existing.id === notification.id)) return state;
      return {
        notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
        unreadCount: notification.ownChange ? state.unreadCount : state.unreadCount + 1,
        highlightedMachines: highlight
          ? { ...state.highlightedMachines, [notification.machineId]: Date.now() }
          : state.highlightedMachines,
      };
    });

  return {
    ...initialState,

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

    recordStatusChange: (event, ownChange) =>
      add({
        kind: 'machine-status',
        // `logId` is null when no log caused the change (e.g. a maintenance event).
        id: `status:${event.machineId}:${event.logId ?? 'none'}:${event.timestamp}`,
        receivedAt: Date.now(),
        ownChange,
        machineId: event.machineId,
        machineName: event.machineName,
        timestamp: event.timestamp,
        event,
      }),

    recordOperationalChange: (event, ownChange) =>
      add({
        kind: 'operational-status',
        id: `operational:${event.machineId}:${event.timestamp}`,
        receivedAt: Date.now(),
        ownChange,
        machineId: event.machineId,
        machineName: event.machineName,
        timestamp: event.timestamp,
        event,
      }),

    recordPartChange: (event, ownChange) =>
      add({
        kind: 'part',
        id: `part:${event.logId}:${event.timestamp}`,
        receivedAt: Date.now(),
        ownChange,
        machineId: event.machineId,
        machineName: event.partName,
        timestamp: event.timestamp,
        event,
      }),

    recordMaintenanceReminder: (event) =>
      add(
        {
          kind: 'maintenance-reminder',
          id: `reminder:${event.scheduleId}:${event.state}:${event.nextMaintenanceAt}`,
          receivedAt: Date.now(),
          ownChange: false,
          machineId: event.machineId,
          machineName: event.machineName,
          timestamp: event.timestamp,
          event,
        },
        // A reminder is not a change to the machine, so the row is not flashed.
        false,
      ),

    recordMaintenanceCompleted: (event, ownChange) =>
      add({
        kind: 'maintenance-completed',
        id: `maintenance:${event.eventId}:${event.completedAt}`,
        receivedAt: Date.now(),
        ownChange,
        machineId: event.machineId,
        machineName: event.machineName,
        timestamp: event.timestamp,
        event,
      }),

    markAllRead: () => set({ unreadCount: 0 }),

    clearHighlight: (machineId) =>
      set((state) => {
        if (!(machineId in state.highlightedMachines)) return state;
        const { [machineId]: _removed, ...rest } = state.highlightedMachines;
        return { highlightedMachines: rest };
      }),

    reset: () => set(initialState),
  };
});

/** Whether a machine changed recently and should be briefly highlighted. */
export function useMachineHighlight(machineId: number): { highlighted: boolean; clear(): void } {
  const highlighted = useRealtimeStore((state) => machineId in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);
  return { highlighted, clear: () => clearHighlight(machineId) };
}
