'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { FormInput } from '@/components/forms/form-input';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ErrorCode } from '@/constants/error-codes';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { useUpdateProfile } from '@/features/technicians/api/mutations';
import { useMyProfile } from '@/features/technicians/api/queries';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { signOut } from '@/lib/auth/session-manager';
import { notify } from '@/lib/notify';
import { ROLE_LABELS } from '@/lib/permissions/permissions';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/date';
import { type ProfileFormInput, type ProfileFormValues, profileFormSchema, toUpdateProfileRequest } from '@/lib/validation/user';
import { type User } from '@/types/user';

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-ink-secondary">{label}</p>
      <Input value={value} readOnly aria-label={label} className="bg-sunken text-ink-secondary" tabIndex={-1} />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: user.fullName, phone: user.phone },
    mode: 'onTouched',
  });

  const onSubmit = (values: ProfileFormValues) => {
    const body = toUpdateProfileRequest(values, user);
    if (Object.keys(body).length === 0) return;
    update.mutate(body, {
      onSuccess: ({ data }) => {
        form.reset({ fullName: data.fullName, phone: data.phone });
        notify.success('Profile updated');
      },
      onError: (error) => {
        if (isApiError(error) && error.hasCode(ErrorCode.USER_PHONE_EXISTS)) {
          form.setError('phone', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
          return;
        }
        applyServerFieldErrors(error, form.setError, ['fullName', 'phone']);
      },
    });
  };

  const fieldError = isApiError(update.error) && update.error.hasCode(ErrorCode.USER_PHONE_EXISTS, ErrorCode.VALIDATION_ERROR);

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <CardContent className="flex flex-col gap-4">
        {update.error && !fieldError ? <Alert tone="critical">{getErrorMessage(update.error)}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput control={form.control} name="fullName" label="Full name" autoComplete="name" required maxLength={120} />
          <FormInput control={form.control} name="phone" label="Phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={16} />
          <ReadOnlyField label="Email" value={user.email} hint="Managed by an administrator." />
          <ReadOnlyField label="Position" value={user.position ?? 'Not set'} hint="Managed by an administrator." />
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="secondary" onClick={() => form.reset()} disabled={!form.formState.isDirty || update.isPending}>
          Discard
        </Button>
        <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
          Save changes
        </Button>
      </CardFooter>
    </form>
  );
}

export function ProfileView() {
  const profile = useMyProfile();
  const [signingOut, setSigningOut] = useState(false);

  const header = <PageHeader title="Profile" description="Your account details and security settings." />;

  if (profile.isPending) {
    return (
      <>
        {header}
        <LoadingRegion label="Loading profile" className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-56" />
        </LoadingRegion>
      </>
    );
  }
  if (profile.isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} isRetrying={profile.isFetching} />
        </Card>
      </>
    );
  }

  const user = profile.data;
  return (
    <>
      {header}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Personal information" description="You can update your name and phone number." />
            <ProfileForm key={user.updatedAt} user={user} />
          </Card>
          <Card>
            <CardHeader title="Change password" description="Use at least 12 characters with upper- and lower-case letters and a number." />
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Account" />
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Role', value: <Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{ROLE_LABELS[user.role]}</Badge> },
                  { label: 'Email', value: user.email },
                  {
                    label: 'Last sign-in',
                    value: user.lastLoginAt ? `${formatRelativeTime(user.lastLoginAt)} (${formatDateTime(user.lastLoginAt)})` : 'Never',
                  },
                  { label: 'Member since', value: formatDateTime(user.createdAt) },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Session" description="Sign out of Maintenance Monitor on this device." />
            <CardContent>
              <Button
                variant="secondary"
                icon={LogOut}
                loading={signingOut}
                className="w-full"
                onClick={() => {
                  setSigningOut(true);
                  void signOut().then(() => notify.info('Signed out'));
                }}
              >
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
