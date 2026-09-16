'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { notify } from '@/lib/notify';
import { type Machine } from '@/types/machine';
import { useDeleteMachine, useSetMachineActive } from '../api/mutations';
import { MachineFormDialog } from './machine-form-dialog';

export type MachineDialog = 'edit' | 'deactivate' | 'activate' | 'delete' | null;

export interface MachineManageDialogsProps {
  machine: Machine;
  dialog: MachineDialog;
  onClose(): void;
  onDeleted?(): void;
}

/** Administrator dialogs for one machine: edit, deactivate/reactivate and delete. */
export function MachineManageDialogs({ machine, dialog, onClose, onDeleted }: MachineManageDialogsProps) {
  const setActive = useSetMachineActive();
  const remove = useDeleteMachine();

  const closeIfIdle = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <MachineFormDialog open={dialog === 'edit'} onOpenChange={closeIfIdle} machine={machine} />

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={closeIfIdle}
        title={`Deactivate ${machine.name}?`}
        description="The machine stays in the fleet history but can't receive new maintenance logs until it is reactivated."
        confirmLabel="Deactivate machine"
        tone="danger"
        loading={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { id: machine.id, active: false },
            {
              onSuccess: () => {
                notify.success('Machine deactivated', `${machine.name} can no longer receive new logs.`);
                onClose();
              },
              onError: (error) => notify.error(error, "Couldn't deactivate the machine"),
            },
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={closeIfIdle}
        title={`Reactivate ${machine.name}?`}
        description="Technicians will be able to record maintenance logs for this machine again."
        confirmLabel="Reactivate machine"
        loading={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { id: machine.id, active: true },
            {
              onSuccess: () => {
                notify.success('Machine reactivated', `${machine.name} can receive logs again.`);
                onClose();
              },
              onError: (error) => notify.error(error, "Couldn't reactivate the machine"),
            },
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={closeIfIdle}
        title={`Delete ${machine.name}?`}
        description="The machine is removed from the fleet and the status board. Its maintenance history is kept for reporting. Machines with open logs can't be deleted."
        confirmLabel="Delete machine"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(machine.id, {
            onSuccess: () => {
              notify.success('Machine deleted', `${machine.name} has been removed from the fleet.`);
              onClose();
              onDeleted?.();
            },
            onError: (error) => notify.error(error, "Couldn't delete the machine"),
          })
        }
      />
    </>
  );
}
