'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { queryKeys } from '@/constants/query-keys';
import { subscribeToAuthMessages } from '@/lib/auth/auth-channel';
import { connectAuthToHttpClient, endLocalSession, restoreSession } from '@/lib/auth/session-manager';
import { sessionStore } from '@/lib/auth/session-store';

/**
 * Restores the session on load, keeps tabs in sync, and clears cached server data whenever a
 * session ends so one user's data is never shown to the next.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const disconnectHttp = connectAuthToHttpClient();
    void restoreSession();

    const unsubscribeChannel = subscribeToAuthMessages((message) => {
      const { status } = sessionStore.getState();
      if (message.type === 'signed-out' && status === 'authenticated') endLocalSession('signed-out-elsewhere');
      if (message.type === 'signed-in' && status !== 'authenticated') void restoreSession();
    });

    const unsubscribeStore = sessionStore.subscribe((state, previous) => {
      if (previous.status === 'authenticated' && state.status !== 'authenticated') queryClient.clear();
      if (state.user && state.user !== previous.user) queryClient.setQueryData(queryKeys.users.me(), state.user);
    });

    return () => {
      disconnectHttp();
      unsubscribeChannel();
      unsubscribeStore();
    };
  }, [queryClient]);

  return children;
}
