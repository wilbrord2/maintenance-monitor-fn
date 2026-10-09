'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { getValidAccessToken, refreshSession } from '@/lib/auth/session-manager';
import { sessionStore } from '@/lib/auth/session-store';
import {
  applyMachineStatusEvent,
  applyMaintenanceCompletedEvent,
  applyMaintenanceReminderEvent,
  applyOperationalStatusEvent,
  applyPartUpdatedEvent,
  createActivityRefresher,
} from '@/lib/realtime/cache-sync';
import { connectStatusBoard } from '@/lib/realtime/status-board';
import { useRealtimeStore } from '@/stores/realtime-store';

/** Keeps the live status board connected for the lifetime of the signed-in shell. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const realtime = useRealtimeStore.getState();
    const refresher = createActivityRefresher(queryClient);
    const isOwnChange = (userId: number | undefined) =>
      userId !== undefined && userId === sessionStore.getState().user?.id;

    const connection = connectStatusBoard({
      getAccessToken: getValidAccessToken,
      refreshAccessToken: async () => {
        try {
          return (await refreshSession())?.tokens.accessToken ?? null;
        } catch {
          return null;
        }
      },
      // One log can emit both status events; each patch is idempotent and the refetches are batched.
      onStatusUpdated: (event) => {
        applyMachineStatusEvent(queryClient, event);
        refresher.machineChanged(event.machineId);
        // The machine detail carries the system status and parts the effective status came from.
        refresher.partsChanged(event.machineId, event.trigger.partId ?? null);
        realtime.recordStatusChange(event, isOwnChange(event.updatedBy.id));
      },
      onOperationalStatusUpdated: (event) => {
        applyOperationalStatusEvent(queryClient, event);
        refresher.partsChanged(event.machineId, event.trigger.partId ?? null);
        realtime.recordOperationalChange(event, isOwnChange(event.updatedBy.id));
      },
      onPartUpdated: (event) => {
        applyPartUpdatedEvent(queryClient, event);
        refresher.partsChanged(event.machineId, event.partId);
        realtime.recordPartChange(event, isOwnChange(event.updatedBy.id));
      },
      onMaintenanceReminder: (event) => {
        applyMaintenanceReminderEvent(queryClient, event);
        realtime.recordMaintenanceReminder(event);
      },
      onMaintenanceCompleted: (event) => {
        applyMaintenanceCompletedEvent(queryClient, event);
        refresher.maintenanceChanged(event.machineId);
        realtime.recordMaintenanceCompleted(event, isOwnChange(event.performedBy?.id));
      },
      onConnectionStatusChange: realtime.setConnectionStatus,
      onResync: refresher.resyncAll,
    });

    return () => {
      connection.disconnect();
      refresher.cancel();
      useRealtimeStore.getState().reset();
    };
  }, [queryClient]);

  return children;
}
