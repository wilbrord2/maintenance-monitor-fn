'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { PageLoader } from '@/components/feedback/page-loader';
import { Button } from '@/components/ui/button';
import { buildLoginUrl, ROUTES } from '@/constants/routes';
import { restoreSession } from '@/lib/auth/session-manager';
import { useSession } from '@/lib/auth/session-store';

export interface RequireSessionProps {
  children: ReactNode;
  /** Render even when the user still has to replace a temporary password (the change-password screen). */
  allowPendingPasswordChange?: boolean;
}

/**
 * Renders children only for a confirmed session. Signed-out users go to the login page
 * (returning here afterwards); users with a temporary password go to change-password first.
 */
export function RequireSession({ children, allowPendingPasswordChange = false }: RequireSessionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useSession((state) => state.status);
  const endReason = useSession((state) => state.endReason);
  const mustChangePassword = useSession((state) => state.mustChangePassword);
  const blockedByPasswordChange = mustChangePassword && !allowPendingPasswordChange;

  useEffect(() => {
    if (status === 'unauthenticated') {
      const query = searchParams.toString();
      const returnTo = endReason === 'signed-out' ? null : `${pathname}${query ? `?${query}` : ''}`;
      router.replace(buildLoginUrl({ next: returnTo, reason: endReason }));
    } else if (status === 'authenticated' && blockedByPasswordChange) {
      router.replace(ROUTES.changePassword);
    }
  }, [status, endReason, blockedByPasswordChange, pathname, searchParams, router]);

  if (status === 'error') {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 inline-flex size-11 items-center justify-center rounded-lg border border-line bg-panel text-muted">
          <WifiOff className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-ink">Can&apos;t reach the server</h1>
        <p className="mt-1 max-w-sm text-[13px] text-muted">
          Your session could not be restored because the service is unavailable. Check your connection and try again.
        </p>
        <Button icon={RefreshCw} className="mt-5" onClick={() => void restoreSession()}>
          Try again
        </Button>
      </div>
    );
  }

  if (status !== 'authenticated' || blockedByPasswordChange) {
    return <PageLoader label={status === 'unauthenticated' ? 'Redirecting to sign in' : 'Restoring your session'} />;
  }

  return children;
}
