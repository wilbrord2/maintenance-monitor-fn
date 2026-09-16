'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/forms/form-input';
import { AuthHeader } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/error-messages';
import {
  type ForgotPasswordFormInput,
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from '@/lib/validation/auth';

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordFormInput, unknown, ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const request = useMutation({ mutationFn: authApi.forgotPassword });

  if (request.isSuccess) {
    return (
      <div role="status">
        <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-positive-line bg-positive-soft text-positive-ink">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <AuthHeader
          title="Check your email"
          description={
            <>
              If an active account exists for <span className="font-semibold text-ink">{request.variables.email}</span>,
              we&apos;ve sent a link to reset the password. The link expires soon and can be used once.
            </>
          }
        />
        <Link href={ROUTES.login} className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full' })}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        title="Reset your password"
        description="Enter your company email and we'll send you a link to choose a new password."
      />
      {request.error ? (
        <Alert tone="critical" className="mb-5">
          {getErrorMessage(request.error)}
        </Alert>
      ) : null}
      <form noValidate onSubmit={form.handleSubmit((values) => request.mutate(values))} className="flex flex-col gap-4">
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
        />
        <Button type="submit" size="lg" loading={request.isPending} className="mt-2 w-full">
          Send reset link
        </Button>
        <Link href={ROUTES.login} className={buttonVariants({ variant: 'ghost', className: 'w-full' })}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </form>
    </>
  );
}
