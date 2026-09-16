'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/forms/form-input';
import { FormTextarea } from '@/components/forms/form-textarea';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ErrorCode } from '@/constants/error-codes';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import {
  type MachineFormInput,
  type MachineFormValues,
  machineFormSchema,
  machineToFormInput,
  toCreateMachineRequest,
  toUpdateMachineRequest,
} from '@/lib/validation/machine';
import { MachineState, type Machine } from '@/types/machine';
import { useCreateMachine, useUpdateMachine } from '../api/mutations';

const FORM_FIELDS = ['name', 'serialNumber', 'description'] as const;

function MachineForm({ machine, onDone }: { machine?: Machine; onDone(): void }) {
  const router = useRouter();
  const isEdit = Boolean(machine);
  const create = useCreateMachine();
  const update = useUpdateMachine();
  const mutation = isEdit ? update : create;

  const form = useForm<MachineFormInput, unknown, MachineFormValues>({
    resolver: zodResolver(machineFormSchema),
    defaultValues: machineToFormInput(machine),
    mode: 'onTouched',
  });

  const handleError = (error: unknown) => {
    if (isApiError(error) && error.hasCode(ErrorCode.MACHINE_SERIAL_EXISTS)) {
      form.setError('serialNumber', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    applyServerFieldErrors(error, form.setError, FORM_FIELDS);
  };

  const onSubmit = (values: MachineFormValues) => {
    if (machine) {
      const body = toUpdateMachineRequest(values, machine);
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      update.mutate(
        { id: machine.id, body },
        {
          onSuccess: ({ data }) => {
            notify.success('Machine updated', `${data.name} has been saved.`);
            onDone();
          },
          onError: handleError,
        },
      );
    } else {
      create.mutate(toCreateMachineRequest(values), {
        onSuccess: ({ data }) => {
          notify.success('Machine added', `${data.name} is now on the status board as Active.`);
          onDone();
          router.push(ROUTES.machine(data.id));
        },
        onError: handleError,
      });
    }
  };

  const showGeneralError = mutation.error && !(isApiError(mutation.error) && mutation.error.hasCode(ErrorCode.MACHINE_SERIAL_EXISTS));

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {showGeneralError ? <Alert tone="critical">{getErrorMessage(mutation.error)}</Alert> : null}
        {machine ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
            <span>Current status</span>
            <MachineStateBadge state={machine.status} size="sm" />
            <span>— changes only through maintenance logs.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
            <span>New machines start as</span>
            <MachineStateBadge state={MachineState.ACTIVE} size="sm" />
            <span>Status then changes through maintenance logs.</span>
          </div>
        )}
        <FormInput control={form.control} name="name" label="Machine name" placeholder="e.g. Laser 1" autoFocus required maxLength={120} />
        <FormInput
          control={form.control}
          name="serialNumber"
          label="Serial number"
          placeholder="e.g. LSR-2024-0001"
          hint="Letters, digits, “.”, “_”, “/” and “-”. Saved in upper case."
          required
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          className="[&_input]:font-mono"
        />
        <FormTextarea
          control={form.control}
          name="description"
          label="Description"
          placeholder="Location, model, or anything technicians should know"
          maxLength={2000}
          rows={3}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={isEdit && !form.formState.isDirty}>
          {isEdit ? 'Save changes' : 'Add machine'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface MachineFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Edit this machine; omit to create a new one. */
  machine?: Machine;
}

export function MachineFormDialog({ open, onOpenChange, machine }: MachineFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={machine ? 'Edit machine' : 'Add machine'}
        description={machine ? `Update the details of ${machine.name}.` : 'Register a machine so it appears on the status board.'}
      >
        <MachineForm machine={machine} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
