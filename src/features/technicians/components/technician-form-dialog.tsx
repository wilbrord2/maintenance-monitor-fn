'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/forms/form-input';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { RoleBadge } from '@/components/status/user-badges';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ErrorCode } from '@/constants/error-codes';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import {
  type TechnicianFormInput,
  type TechnicianFormValues,
  technicianFormSchema,
  toCreateTechnicianRequest,
  toUpdateUserRequest,
  userToTechnicianFormInput,
} from '@/lib/validation/user';
import { Role } from '@/types/auth';
import { type User } from '@/types/user';
import { useCreateTechnician, useUpdateUser } from '../api/mutations';

const FIELD_ERROR_CODES: Readonly<Record<string, 'email' | 'phone'>> = {
  [ErrorCode.USER_EMAIL_EXISTS]: 'email',
  [ErrorCode.USER_PHONE_EXISTS]: 'phone',
};

const MESSAGE_OVERRIDES = {
  [ErrorCode.SERVICE_UNAVAILABLE]:
    "The account wasn't created because the welcome email couldn't be sent. Nothing was saved — try again shortly.",
};

function TechnicianForm({ user, onDone }: { user?: User; onDone(): void }) {
  const create = useCreateTechnician();
  const update = useUpdateUser();
  const mutation = user ? update : create;

  const form = useForm<TechnicianFormInput, unknown, TechnicianFormValues>({
    resolver: zodResolver(technicianFormSchema),
    defaultValues: userToTechnicianFormInput(user),
    mode: 'onTouched',
  });

  const handleError = (error: unknown) => {
    const field = isApiError(error) ? FIELD_ERROR_CODES[error.code] : undefined;
    if (field) {
      form.setError(field, { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    applyServerFieldErrors(error, form.setError, ['fullName', 'email', 'phone', 'position']);
  };

  const onSubmit = (values: TechnicianFormValues) => {
    if (user) {
      const body = toUpdateUserRequest(values, user);
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      update.mutate(
        { id: user.id, body },
        {
          onSuccess: ({ data }) => {
            notify.success('Account updated', `${data.fullName}'s details have been saved.`);
            onDone();
          },
          onError: handleError,
        },
      );
      return;
    }
    create.mutate(toCreateTechnicianRequest(values), {
      onSuccess: () => {
        notify.success(
          'Technician account created successfully.',
          "A temporary login credential has been sent to the technician's company email.",
        );
        onDone();
      },
      onError: handleError,
    });
  };

  const showGeneralError = mutation.error && !(isApiError(mutation.error) && FIELD_ERROR_CODES[mutation.error.code]);

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {showGeneralError ? <Alert tone="critical">{getErrorMessage(mutation.error, MESSAGE_OVERRIDES)}</Alert> : null}
        {user ? null : (
          <Alert tone="info">
            A temporary password is emailed to this address. The technician must replace it the first time they sign in. The
            password is never shown here.
          </Alert>
        )}
        <FormInput control={form.control} name="fullName" label="Full name" autoComplete="off" required autoFocus maxLength={120} />
        <FormInput
          control={form.control}
          name="email"
          label="Company email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput control={form.control} name="phone" label="Phone" type="tel" inputMode="tel" placeholder="0780000000" required maxLength={16} />
          <FormInput control={form.control} name="position" label="Position" placeholder="e.g. Maintenance Technician" maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-ink-secondary">Role</p>
          <div className="flex h-9 items-center rounded-md border border-line bg-sunken px-3">
            <RoleBadge role={user?.role ?? Role.TECHNICIAN} />
          </div>
          <p className="text-xs text-muted">{user ? "Roles can't be changed." : 'New accounts are created as technicians.'}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={Boolean(user) && !form.formState.isDirty}>
          {user ? 'Save changes' : 'Create account'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TechnicianFormDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange(open: boolean): void; user?: User }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={user ? 'Edit account' : 'Add technician'}
        description={user ? `Update ${user.fullName}'s contact details.` : 'Create an account and send sign-in instructions by email.'}
      >
        <TechnicianForm user={user} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
