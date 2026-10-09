'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { PartStatusBadge } from '@/components/status/part-status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ErrorCode } from '@/constants/error-codes';
import { MACHINE_PART_STATUS_OPTIONS, OPERATIONAL_IMPACT_OPTIONS } from '@/constants/machine-part';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import {
  MACHINE_PART_FORM_FIELDS,
  type MachinePartFormInput,
  type MachinePartFormValues,
  machinePartFormSchema,
  machinePartToFormInput,
  toCreateMachinePartRequest,
  toUpdateMachinePartRequest,
} from '@/lib/validation/machine-part';
import { MachineState } from '@/types/machine';
import { type MachinePart } from '@/types/machine-part';
import { useCreateMachinePart, useUpdateMachinePart } from '../api/mutations';

function PartForm({
  machineId,
  machineName,
  part,
  onDone,
}: {
  machineId: number;
  machineName: string;
  part?: MachinePart;
  onDone(): void;
}) {
  const isEdit = Boolean(part);
  const create = useCreateMachinePart(machineId);
  const update = useUpdateMachinePart(machineId);
  const mutation = isEdit ? update : create;

  const form = useForm<MachinePartFormInput, unknown, MachinePartFormValues>({
    resolver: zodResolver(machinePartFormSchema),
    defaultValues: machinePartToFormInput(part),
    mode: 'onTouched',
  });

  const startingStatus = useWatch({ control: form.control, name: 'status' });
  const startsWithDefect = !isEdit && startingStatus !== MachineState.ACTIVE;

  const handleError = (error: unknown) => {
    if (isApiError(error) && error.hasCode(ErrorCode.MACHINE_PART_CODE_EXISTS)) {
      form.setError('partCode', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    applyServerFieldErrors(error, form.setError, MACHINE_PART_FORM_FIELDS);
  };

  const onSubmit = (values: MachinePartFormValues) => {
    if (part) {
      const body = toUpdateMachinePartRequest(values, part);
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      update.mutate(
        { partId: part.id, body },
        {
          onSuccess: ({ data }) => {
            notify.success('Part updated', `${data.name} has been saved.`);
            onDone();
          },
          onError: handleError,
        },
      );
    } else {
      create.mutate(toCreateMachinePartRequest(values), {
        onSuccess: ({ data }) => {
          notify.success('Part added', `${data.name} is now monitored on ${machineName}.`);
          onDone();
        },
        onError: handleError,
      });
    }
  };

  const showGeneralError =
    mutation.error && !(isApiError(mutation.error) && mutation.error.hasCode(ErrorCode.MACHINE_PART_CODE_EXISTS));

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {showGeneralError ? <Alert tone="critical">{getErrorMessage(mutation.error)}</Alert> : null}

        {isEdit && part ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
            <span>Current condition</span>
            <PartStatusBadge status={part.status} size="sm" />
            <span>— changes only by recording a condition.</span>
          </div>
        ) : null}

        <FormInput
          control={form.control}
          name="name"
          label="Part name"
          placeholder="e.g. Hydraulic pump"
          autoFocus
          required
          maxLength={120}
        />
        <FormInput
          control={form.control}
          name="partCode"
          label="Part code"
          placeholder="e.g. PMP-01"
          hint="Unique within this machine. Letters, digits, “.”, “_”, “/” and “-”. Saved in upper case."
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
          placeholder="What this part does, or where it sits on the machine"
          maxLength={2000}
          rows={3}
        />

        <FormCheckbox
          control={form.control}
          name="isCritical"
          label="Critical part"
          description="Failure of a critical part normally stops the machine. This sets the default impact of future conditions; the API decides the machine's status."
        />

        {isEdit ? null : (
          <>
            <FormSelect
              control={form.control}
              name="status"
              label="Starting condition"
              options={MACHINE_PART_STATUS_OPTIONS}
              hint="Most new parts start Active. Choose another condition only if the part already needs attention."
            />
            {startsWithDefect ? (
              <FormSelect
                control={form.control}
                name="operationalImpact"
                label="Does this condition stop the machine?"
                options={OPERATIONAL_IMPACT_OPTIONS}
                placeholder="Use the part's criticality"
                hint="The machine's status is then recalculated by the server."
              />
            ) : null}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={isEdit && !form.formState.isDirty}>
          {isEdit ? 'Save changes' : 'Add part'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface PartFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  machineId: number;
  machineName: string;
  /** Edit this part; omit to add a new one. */
  part?: MachinePart;
}

export function PartFormDialog({ open, onOpenChange, machineId, machineName, part }: PartFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={part ? 'Edit part' : 'Add part'}
        description={
          part
            ? `Update the details of ${part.name}.`
            : `Add a component of ${machineName} so its condition can be monitored separately.`
        }
      >
        <PartForm machineId={machineId} machineName={machineName} part={part} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
