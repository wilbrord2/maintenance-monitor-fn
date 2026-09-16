import { type Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner className="mx-auto size-5" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
