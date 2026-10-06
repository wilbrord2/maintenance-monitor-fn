'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api/error-messages';
import { notify } from '@/lib/notify';
import {
  createMaintenanceScheduleFormSchema,
  hasScheduleChanges,
  MAINTENANCE_SCHEDULE_FORM_FIELDS,
  type MaintenanceScheduleFormInput,
  type MaintenanceScheduleFormValues,
  maintenanceScheduleToFormInput,
  toCreateScheduleRequest,
  toUpdateScheduleRequest,
} from '@/lib/validation/maintenance';
import { formatDate } from '@/lib/utils/date';
import { type MaintenanceSchedule } from '@/types/maintenance';
import { useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule } from '../api/mutations';

function ScheduleForm({
  machineId,
  machineName,
  schedule,
  onDone,
}: {
  machineId: number;
  machineName: string;
  schedule?: MaintenanceSchedule | null;
  onDone(): void;
}) {
  const isEdit = Boolean(schedule);
  const create = useCreateMaintenanceSchedule(machineId);
  const update = useUpdateMaintenanceSchedule(machineId);
  const mutation = isEdit ? update : create;
  const initial = maintenanceScheduleToFormInput(schedule);

  const form = useForm<MaintenanceScheduleFormInput, unknown, MaintenanceScheduleFormValues>({
    resolver: zodResolver(createMaintenanceScheduleFormSchema()),
    defaultValues: initial,
    mode: 'onTouched',
  });

  const handleError = (error: unknown) =>
    applyServerFieldErrors(error, form.setError, MAINTENANCE_SCHEDULE_FORM_FIELDS);

  const onSubmit = (values: MaintenanceScheduleFormValues) => {
    if (schedule) {
      const body = toUpdateScheduleRequest(values, initial);
      if (!hasScheduleChanges(body)) {
        onDone();
        return;
      }
      update.mutate(body, {
        onSuccess: ({ data }) => {
          notify.success('Schedule updated', `Next maintenance for ${machineName}: ${formatDate(data.nextMaintenanceAt)}.`);
          onDone();
        },
        onError: handleError,
      });
    } else {
      create.mutate(toCreateScheduleRequest(values), {
        onSuccess: ({ data }) => {
          notify.success(
            'Preventive maintenance scheduled',
            `${machineName} is next due on ${formatDate(data.nextMaintenanceAt)}.`,
          );
          onDone();
        },
        onError: handleError,
      });
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {mutation.error ? <Alert tone="critical">{getErrorMessage(mutation.error)}</Alert> : null}

        <div className="rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
          Due dates are calculated by the server. After each completed maintenance the next one is scheduled from the
          actual completion time, not from the date it was planned for.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            control={form.control}
            name="intervalDays"
            label="Maintenance interval (days)"
            placeholder="e.g. 20"
            inputMode="numeric"
            autoFocus
            required
          />
          <FormInput
            control={form.control}
            name="reminderDaysBefore"
            label="Remind this many days before"
            placeholder="e.g. 5"
            inputMode="numeric"
            required
          />
        </div>

        <FormDatePicker
          control={form.control}
          name="lastMaintenanceAt"
          label="Last maintenance"
          hint="If known, the first due date is calculated from this date plus the interval."
        />
        <FormDatePicker
          control={form.control}
          name="nextMaintenanceAt"
          label="First due date"
          hint={
            isEdit
              ? 'Leave empty to keep the due date the server has calculated.'
              : 'Optional. Overrides the date calculated from the last maintenance.'
          }
        />

        {isEdit ? (
          <FormCheckbox
            control={form.control}
            name="isActive"
            label="Schedule active"
            description="An inactive schedule stops producing reminders but keeps its history."
          />
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={isEdit && !form.formState.isDirty}>
          {isEdit ? 'Save schedule' : 'Create schedule'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  machineId: number;
  machineName: string;
  /** Edit this schedule; omit to create the machine's first one. */
  schedule?: MaintenanceSchedule | null;
}

export function ScheduleFormDialog({ open, onOpenChange, machineId, machineName, schedule }: ScheduleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={schedule ? 'Edit maintenance schedule' : 'Set up preventive maintenance'}
        description={
          schedule
            ? `Change how often ${machineName} is maintained.`
            : `Maintain ${machineName} on a recurring cycle and get reminders before each one is due.`
        }
      >
        {open ? (
          <ScheduleForm
            machineId={machineId}
            machineName={machineName}
            schedule={schedule}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
