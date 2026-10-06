import { sessionStore } from '@/lib/auth/session-store';
import { Role } from '@/types/auth';
import { makeSession } from './factories';

/** Signs a role in for component tests that depend on permissions. */
export function signInAs(role: Role): void {
  sessionStore.getState().startSession(makeSession({ user: { role } }));
}

export function signOutForTest(): void {
  sessionStore.getState().endSession(null);
}

export { Role };
