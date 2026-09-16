'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { getValidAccessToken, refreshSession } from '@/lib/auth/session-manager';
import { sessionStore } from '@/lib/auth/session-store';
import { applyMachineStatusEvent, createActivityRefresher } from '@/lib/realtime/cache-sync';
import { connectStatusBoard } from '@/lib/realtime/status-board';
import { useRealtimeStore } from '@/stores/realtime-store';

/** Keeps the live status board connected for the lifetime of the signed-in shell. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const realtime = useRealtimeStore.getState();
    const refresher = createActivityRefresher(queryClient);

    const connection = connectStatusBoard({
      getAccessToken: getValidAccessToken,
      refreshAccessToken: async () => {
        try {
          return (await refreshSession())?.tokens.accessToken ?? null;
        } catch {
          return null;
        }
      },
      onStatusUpdated: (event) => {
        applyMachineStatusEvent(queryClient, event);
        refresher.machineChanged(event.machineId);
        realtime.recordStatusChange(event, event.updatedBy.id === sessionStore.getState().user?.id);
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
