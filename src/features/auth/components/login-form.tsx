'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/forms/form-input';
import { FormPasswordInput } from '@/components/forms/form-password-input';
import { AuthHeader } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorCode } from '@/constants/error-codes';
import { type LoginReason, parseLoginReason, ROUTES } from '@/constants/routes';
import { type Tone } from '@/constants/tones';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { signIn } from '@/lib/auth/session-manager';
import { useSession } from '@/lib/auth/session-store';
import { notify } from '@/lib/notify';
import { sanitizeRedirectPath } from '@/lib/utils/path';
import { type LoginFormInput, type LoginFormValues, loginSchema } from '@/lib/validation/auth';

const REASON_NOTICES: Partial<Record<LoginReason, { tone: Tone; message: string }>> = {
  expired: { tone: 'warning', message: 'Your session expired. Sign in again to continue.' },
  'signed-out-elsewhere': { tone: 'info', message: 'You signed out in another tab.' },
  inactive: { tone: 'critical', message: 'This account is deactivated. Contact an administrator.' },
  'password-reset': { tone: 'positive', message: 'Your password has been reset. Sign in with your new password.' },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeRedirectPath(searchParams.get('next'), ROUTES.dashboard);
  const notice = REASON_NOTICES[parseLoginReason(searchParams.get('reason')) ?? 'signed-out'];

  const status = useSession((state) => state.status);
  const mustChangePassword = useSession((state) => state.mustChangePassword);

  const form = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const login = useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      const firstName = session.user.fullName.split(' ')[0] ?? session.user.fullName;
      notify.success(`Welcome, ${firstName}`);
      router.replace(session.mustChangePassword ? ROUTES.changePassword : next);
    },
    onError: (error) => {
      if (isApiError(error) && error.hasCode(ErrorCode.INVALID_CREDENTIALS)) {
        form.setFocus('password');
      }
    },
  });

  // Already signed in (for example in another tab): leave the login page.
  useEffect(() => {
    if (status === 'authenticated' && login.isIdle) {
      router.replace(mustChangePassword ? ROUTES.changePassword : next);
    }
  }, [status, mustChangePassword, login.isIdle, next, router]);

  return (
    <>
      <AuthHeader title="Sign in" description="Use your company email and password." />

      {notice && !login.error ? (
        <Alert tone={notice.tone} className="mb-5">
          {notice.message}
        </Alert>
      ) : null}
      {login.error ? (
        <Alert tone="critical" className="mb-5">
          {getErrorMessage(login.error)}
        </Alert>
      ) : null}

      <form noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))} className="flex flex-col gap-4">
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
        />
        <FormPasswordInput
          control={form.control}
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          labelAside={
            <Link href={ROUTES.forgotPassword} className="text-xs font-medium text-info-ink hover:underline">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" icon={LogIn} loading={login.isPending} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </>
  );
}
