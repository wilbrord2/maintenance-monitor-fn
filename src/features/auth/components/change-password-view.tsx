'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthHeader } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { signOut } from '@/lib/auth/session-manager';
import { useSession } from '@/lib/auth/session-store';
import { notify } from '@/lib/notify';
import { ChangePasswordForm } from './change-password-form';

export function ChangePasswordView() {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const mustChangePassword = useSession((state) => state.mustChangePassword);
  // Keep the onboarding wording stable while the request completes.
  const [forced] = useState(mustChangePassword);
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <>
      <AuthHeader
        title={forced ? 'Set your password' : 'Change password'}
        description={forced ? undefined : 'Changing your password signs you out on your other devices.'}
      />
      {forced ? (
        <Alert tone="info" title={firstName ? `Welcome, ${firstName}` : 'Welcome'} className="mb-5">
          For security, replace the temporary password from your welcome email before you continue.
        </Alert>
      ) : null}
      <ChangePasswordForm
        forced={forced}
        onSuccess={() => router.replace(ROUTES.dashboard)}
        onCancel={forced ? undefined : () => router.push(ROUTES.dashboard)}
      />
      {forced ? (
        <Button
          variant="ghost"
          icon={LogOut}
          className="mt-3 w-full"
          onClick={() => {
            void signOut().then(() => notify.info('Signed out'));
          }}
        >
          Sign out
        </Button>
      ) : null}
    </>
  );
}
