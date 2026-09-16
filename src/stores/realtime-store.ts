import { create } from 'zustand';
import { type MachineStatusUpdatedEvent, type RealtimeConnectionStatus } from '@/types/realtime';

export interface StatusChangeNotification extends MachineStatusUpdatedEvent {
  id: string;
  receivedAt: number;
  /** Made by the signed-in user (not counted as unread). */
  ownChange: boolean;
}

const MAX_NOTIFICATIONS = 30;

interface RealtimeState {
  connectionStatus: RealtimeConnectionStatus;
  notifications: StatusChangeNotification[];
  unreadCount: number;
  /** machineId → time the change arrived; drives the brief row highlight. */
  highlightedMachines: Record<number, number>;
  setConnectionStatus(status: RealtimeConnectionStatus): void;
  recordStatusChange(event: MachineStatusUpdatedEvent, ownChange: boolean): void;
  markAllRead(): void;
  clearHighlight(machineId: number): void;
  reset(): void;
}

const initialState = {
  connectionStatus: 'idle' as RealtimeConnectionStatus,
  notifications: [] as StatusChangeNotification[],
  unreadCount: 0,
  highlightedMachines: {} as Record<number, number>,
};

/** Live-connection state and the recent status changes shown in the header. */
export const useRealtimeStore = create<RealtimeState>()((set) => ({
  ...initialState,

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  recordStatusChange: (event, ownChange) =>
    set((state) => {
      const id = `${event.logId}:${event.timestamp}`;
      if (state.notifications.some((notification) => notification.id === id)) return state;
      return {
        notifications: [{ ...event, id, receivedAt: Date.now(), ownChange }, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
        unreadCount: ownChange ? state.unreadCount : state.unreadCount + 1,
        highlightedMachines: { ...state.highlightedMachines, [event.machineId]: Date.now() },
      };
    }),

  markAllRead: () => set({ unreadCount: 0 }),

  clearHighlight: (machineId) =>
    set((state) => {
      if (!(machineId in state.highlightedMachines)) return state;
      const { [machineId]: _removed, ...rest } = state.highlightedMachines;
      return { highlightedMachines: rest };
    }),

  reset: () => set(initialState),
}));

/** Whether a machine changed recently and should be briefly highlighted. */
export function useMachineHighlight(machineId: number): { highlighted: boolean; clear(): void } {
  const highlighted = useRealtimeStore((state) => machineId in state.highlightedMachines);
  const clearHighlight = useRealtimeStore((state) => state.clearHighlight);
  return { highlighted, clear: () => clearHighlight(machineId) };
}
