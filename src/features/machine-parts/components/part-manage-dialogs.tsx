'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { notify } from '@/lib/notify';
import { type MachinePart } from '@/types/machine-part';
import { useDeleteMachinePart, useUpdateMachinePart } from '../api/mutations';
import { PartFormDialog } from './part-form-dialog';

export type PartDialog = 'edit' | 'deactivate' | 'activate' | 'delete' | null;

export interface PartManageDialogsProps {
  part: MachinePart;
  machineName: string;
  dialog: PartDialog;
  onClose(): void;
  onDeleted?(): void;
}

/** Every dialog for one part: editing it, and taking it in or out of use. */
export function PartManageDialogs({ part, machineName, dialog, onClose, onDeleted }: PartManageDialogsProps) {
  const update = useUpdateMachinePart(part.machineId);
  const remove = useDeleteMachinePart(part.machineId);

  const closeIfIdle = (open: boolean) => {
    if (!open) onClose();
  };

  const setActive = (isActive: boolean) =>
    update.mutate(
      { partId: part.id, body: { isActive } },
      {
        onSuccess: () => {
          notify.success(
            isActive ? 'Part back in use' : 'Part taken out of use',
            isActive
              ? `${part.name} counts towards the machine status again.`
              : `${part.name} is ignored when the machine status is calculated.`,
          );
          onClose();
        },
        onError: (error) => notify.error(error, isActive ? "Couldn't reactivate the part" : "Couldn't deactivate the part"),
      },
    );

  return (
    <>
      <PartFormDialog
        open={dialog === 'edit'}
        onOpenChange={closeIfIdle}
        machineId={part.machineId}
        machineName={machineName}
        part={part}
      />

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={closeIfIdle}
        title={`Take ${part.name} out of use?`}
        description="Its history is kept, but the part no longer counts towards the machine's status. The server recalculates that status straight away."
        confirmLabel="Take out of use"
        tone="danger"
        loading={update.isPending}
        onConfirm={() => setActive(false)}
      />

      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={closeIfIdle}
        title={`Put ${part.name} back in use?`}
        description="The part counts towards the machine's status again, in its current condition."
        confirmLabel="Put back in use"
        loading={update.isPending}
        onConfirm={() => setActive(true)}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={closeIfIdle}
        title={`Remove ${part.name}?`}
        description="The part is removed from the machine and its history is kept for reporting. A part with an open record can't be removed."
        confirmLabel="Remove part"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(part.id, {
            onSuccess: () => {
              notify.success('Part removed', `${part.name} is no longer part of ${machineName}.`);
              onClose();
              onDeleted?.();
            },
            onError: (error) => notify.error(error, "Couldn't remove the part"),
          })
        }
      />
    </>
  );
}
