import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { type LoginReason } from '@/constants/routes';
import { type AuthSession } from '@/types/auth';
import { type User } from '@/types/user';

/**
 * - `loading`: restoring a session from the refresh cookie
 * - `error`: the API could not be reached while restoring (not the same as signed out)
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  mustChangePassword: boolean;
  /** Kept in memory only — never persisted to storage. */
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  /** Why the last session ended, so the login page can explain it. */
  endReason: LoginReason | null;
}

interface SessionActions {
  startSession(session: AuthSession): void;
  setUser(user: User): void;
  requirePasswordChange(): void;
  endSession(reason: LoginReason | null): void;
  setStatus(status: SessionStatus): void;
}

export type SessionStore = SessionState & SessionActions;

const signedOut = {
  user: null,
  mustChangePassword: false,
  accessToken: null,
  accessTokenExpiresAt: null,
} satisfies Partial<SessionState>;

export const sessionStore = createStore<SessionStore>()((set) => ({
  status: 'loading',
  endReason: null,
  ...signedOut,

  startSession: (session) =>
    set({
      status: 'authenticated',
      user: session.user,
      mustChangePassword: session.mustChangePassword,
      accessToken: session.tokens.accessToken,
      accessTokenExpiresAt: Date.parse(session.tokens.accessTokenExpiresAt),
      endReason: null,
    }),

  setUser: (user) => set({ user, mustChangePassword: user.mustChangePassword }),

  requirePasswordChange: () => set({ mustChangePassword: true }),

  endSession: (reason) => set({ status: 'unauthenticated', endReason: reason, ...signedOut }),

  setStatus: (status) => set({ status }),
}));

export function useSession<T>(selector: (state: SessionStore) => T): T {
  return useStore(sessionStore, selector);
}
