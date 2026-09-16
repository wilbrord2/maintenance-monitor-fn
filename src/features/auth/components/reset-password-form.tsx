'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { FormPasswordInput } from '@/components/forms/form-password-input';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { AuthHeader } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorCode } from '@/constants/error-codes';
import { buildLoginUrl, ROUTES } from '@/constants/routes';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { endLocalSession } from '@/lib/auth/session-manager';
import { notify } from '@/lib/notify';
import {
  type ResetPasswordFormInput,
  type ResetPasswordFormValues,
  resetPasswordSchema,
  resetTokenSchema,
} from '@/lib/validation/auth';
import { PasswordRequirements } from './password-requirements';

function InvalidLinkNotice() {
  return (
    <>
      <AuthHeader title="Reset link not valid" />
      <Alert tone="critical" className="mb-5">
        This password reset link is invalid or has expired. Reset links can only be used once.
      </Alert>
      <Link href={ROUTES.forgotPassword} className={buttonVariants({ size: 'lg', className: 'w-full' })}>
        Request a new link
      </Link>
    </>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const tokenResult = resetTokenSchema.safeParse(useSearchParams().get('token') ?? '');

  const form = useForm<ResetPasswordFormInput, unknown, ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });

  const reset = useMutation({
    mutationFn: (values: ResetPasswordFormValues) =>
      authApi.resetPassword({ token: tokenResult.data ?? '', newPassword: values.newPassword }),
    onSuccess: () => {
      // Every session was revoked by the reset, including one in this browser.
      endLocalSession(null);
      notify.success('Password reset', 'Sign in with your new password.');
      router.replace(buildLoginUrl({ reason: 'password-reset' }));
    },
    onError: (error) => {
      applyServerFieldErrors(error, form.setError, ['newPassword']);
    },
  });

  if (!tokenResult.success) return <InvalidLinkNotice />;
  if (isApiError(reset.error) && reset.error.hasCode(ErrorCode.INVALID_RESET_TOKEN)) return <InvalidLinkNotice />;

  return (
    <>
      <AuthHeader title="Choose a new password" description="After resetting, you'll be signed out everywhere and can sign in again." />
      {reset.error ? (
        <Alert tone="critical" className="mb-5">
          {getErrorMessage(reset.error)}
        </Alert>
      ) : null}
      <form noValidate onSubmit={form.handleSubmit((values) => reset.mutate(values))} className="flex flex-col gap-4">
        <FormPasswordInput control={form.control} name="newPassword" label="New password" autoComplete="new-password" autoFocus required />
        <PasswordRequirements password={newPassword} />
        <FormPasswordInput control={form.control} name="confirmPassword" label="Confirm new password" autoComplete="new-password" required />
        <Button type="submit" size="lg" loading={reset.isPending} className="mt-2 w-full">
          Reset password
        </Button>
      </form>
    </>
  );
}
