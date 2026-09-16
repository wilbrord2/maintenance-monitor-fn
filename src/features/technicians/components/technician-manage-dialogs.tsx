'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { notify } from '@/lib/notify';
import { type User } from '@/types/user';
import { useDeleteUser, useReissueTemporaryPassword, useSetUserActive } from '../api/mutations';
import { TechnicianFormDialog } from './technician-form-dialog';

export type TechnicianDialog = 'edit' | 'deactivate' | 'activate' | 'reissue' | 'delete' | null;

export interface TechnicianManageDialogsProps {
  user: User;
  dialog: TechnicianDialog;
  onClose(): void;
  onDeleted?(): void;
}

export function TechnicianManageDialogs({ user, dialog, onClose, onDeleted }: TechnicianManageDialogsProps) {
  const setActive = useSetUserActive();
  const reissue = useReissueTemporaryPassword();
  const remove = useDeleteUser();
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <TechnicianFormDialog open={dialog === 'edit'} onOpenChange={handleOpenChange} user={user} />

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={handleOpenChange}
        title={`Deactivate ${user.fullName}?`}
        description="They are signed out immediately and can't sign in until the account is reactivated. Their maintenance history is kept."
        confirmLabel="Deactivate account"
        tone="danger"
        loading={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { id: user.id, active: false },
            {
              onSuccess: () => {
                notify.success('Account deactivated', `${user.fullName} can no longer sign in.`);
                onClose();
              },
              onError: (error) => notify.error(error, "Couldn't deactivate the account"),
            },
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={handleOpenChange}
        title={`Reactivate ${user.fullName}?`}
        description="They will be able to sign in again with their existing password."
        confirmLabel="Reactivate account"
        loading={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { id: user.id, active: true },
            {
              onSuccess: () => {
                notify.success('Account reactivated', `${user.fullName} can sign in again.`);
                onClose();
              },
              onError: (error) => notify.error(error, "Couldn't reactivate the account"),
            },
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'reissue'}
        onOpenChange={handleOpenChange}
        title="Send a new temporary password?"
        description={`A new temporary password is emailed to ${user.email}. Their current sessions end and they must choose a new password at their next sign-in.`}
        confirmLabel="Send new password"
        loading={reissue.isPending}
        onConfirm={() =>
          reissue.mutate(user.id, {
            onSuccess: () => {
              notify.success('Temporary password sent', `New sign-in instructions were emailed to ${user.email}.`);
              onClose();
            },
            onError: (error) => notify.error(error, "Couldn't send a new temporary password"),
          })
        }
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={handleOpenChange}
        title={`Delete ${user.fullName}'s account?`}
        description="The account is removed and can no longer sign in. Logs they recorded stay in the maintenance history. Consider deactivating instead if they may return."
        confirmLabel="Delete account"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(user.id, {
            onSuccess: () => {
              notify.success('Account deleted', `${user.fullName}'s account has been removed.`);
              onClose();
              onDeleted?.();
            },
            onError: (error) => notify.error(error, "Couldn't delete the account"),
          })
        }
      />
    </>
  );
}
