import { type Metadata } from 'next';
import { Suspense } from 'react';
import { PageLoader } from '@/components/feedback/page-loader';
import { AuthShell } from '@/components/layout/auth-shell';
import { ChangePasswordView } from '@/features/auth/components/change-password-view';
import { RequireSession } from '@/features/auth/components/require-session';

export const metadata: Metadata = { title: 'Change password' };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireSession allowPendingPasswordChange>
        <AuthShell>
          <ChangePasswordView />
        </AuthShell>
      </RequireSession>
    </Suspense>
  );
}
