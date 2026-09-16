'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { FormPasswordInput } from '@/components/forms/form-password-input';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorCode } from '@/constants/error-codes';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { changePassword } from '@/lib/auth/session-manager';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils/cn';
import {
  type ChangePasswordFormInput,
  type ChangePasswordFormValues,
  changePasswordSchema,
} from '@/lib/validation/auth';
import { PasswordRequirements } from './password-requirements';

const MESSAGE_OVERRIDES = {
  [ErrorCode.INVALID_CREDENTIALS]: 'Your current password is incorrect.',
};

export interface ChangePasswordFormProps {
  /** First sign-in with a temporary password. */
  forced?: boolean;
  onSuccess?(): void;
  onCancel?(): void;
  className?: string;
}

export function ChangePasswordForm({ forced = false, onSuccess, onCancel, className }: ChangePasswordFormProps) {
  const form = useForm<ChangePasswordFormInput, unknown, ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      form.reset();
      notify.success('Password changed', forced ? undefined : 'You have been signed out on your other devices.');
      onSuccess?.();
    },
    onError: (error) => {
      if (!isApiError(error)) return;
      if (error.hasCode(ErrorCode.INVALID_CREDENTIALS)) {
        form.setError('currentPassword', { type: 'server', message: MESSAGE_OVERRIDES[ErrorCode.INVALID_CREDENTIALS] }, { shouldFocus: true });
      } else if (error.hasCode(ErrorCode.PASSWORD_REUSE)) {
        form.setError('newPassword', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      } else {
        applyServerFieldErrors(error, form.setError, ['currentPassword', 'newPassword']);
      }
    },
  });

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className={cn('flex flex-col gap-4', className)}>
      {mutation.error ? <Alert tone="critical">{getErrorMessage(mutation.error, MESSAGE_OVERRIDES)}</Alert> : null}
      <FormPasswordInput
        control={form.control}
        name="currentPassword"
        label={forced ? 'Temporary password' : 'Current password'}
        hint={forced ? 'The temporary password from your welcome email.' : undefined}
        autoComplete="current-password"
        autoFocus={forced}
        required
      />
      <FormPasswordInput control={form.control} name="newPassword" label="New password" autoComplete="new-password" required />
      <PasswordRequirements password={newPassword} />
      <FormPasswordInput control={form.control} name="confirmPassword" label="Confirm new password" autoComplete="new-password" required />
      <div className={cn('mt-2 flex flex-col-reverse gap-2 sm:flex-row', forced ? null : 'sm:justify-end')}>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size={forced ? 'lg' : 'md'} loading={mutation.isPending} className={forced ? 'w-full' : undefined}>
          {forced ? 'Set password and continue' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
