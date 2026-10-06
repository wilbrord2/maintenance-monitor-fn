'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormTextarea } from '@/components/forms/form-textarea';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api/error-messages';
import { notify } from '@/lib/notify';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import {
  type CancelMaintenanceFormValues,
  cancelMaintenanceFormSchema,
  type CompleteMaintenanceFormInput,
  type CompleteMaintenanceFormValues,
  completeMaintenanceDefaults,
  createCompleteMaintenanceSchema,
  type MaintenanceEventFormInput,
  type MaintenanceEventFormValues,
  maintenanceEventFormDefaults,
  maintenanceEventFormSchema,
  type StartMaintenanceFormValues,
  startMaintenanceFormSchema,
  toCompleteEventRequest,
  toCreateEventRequest,
  toStartEventRequest,
} from '@/lib/validation/maintenance';
import { type MaintenanceEvent, type MaintenanceSchedule } from '@/types/maintenance';
import {
  useCancelMaintenance,
  useCompleteMaintenance,
  useCreateMaintenanceEvent,
  useStartMaintenance,
} from '../api/mutations';

export interface PlanMaintenanceDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  machineId: number;
  machineName: string;
  schedule?: MaintenanceSchedule | null;
}

function PlanMaintenanceForm({
  onDone,
  machineId,
  machineName,
  schedule,
}: Omit<PlanMaintenanceDialogProps, 'open' | 'onOpenChange'> & { onDone(): void }) {
  const create = useCreateMaintenanceEvent();
  const form = useForm<MaintenanceEventFormInput, unknown, MaintenanceEventFormValues>({
    resolver: zodResolver(maintenanceEventFormSchema),
    defaultValues: maintenanceEventFormDefaults(schedule),
    mode: 'onTouched',
  });

  const onSubmit = (values: MaintenanceEventFormValues) =>
    create.mutate(toCreateEventRequest(values, machineId), {
      onSuccess: ({ data }) => {
        notify.success('Maintenance planned', `${machineName} is scheduled for ${formatDate(data.scheduledFor)}.`);
        onDone();
      },
      onError: (error) => applyServerFieldErrors(error, form.setError, ['scheduledFor', 'notes']),
    });

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {create.error ? <Alert tone="critical">{getErrorMessage(create.error)}</Alert> : null}
        <FormDatePicker
          control={form.control}
          name="scheduledFor"
          label="Scheduled for"
          hint={
            schedule
              ? `Defaults to the due date of the recurring schedule (${formatDate(schedule.nextMaintenanceAt)}).`
              : 'Leave empty to plan it for now.'
          }
        />
        <FormTextarea control={form.control} name="notes" label="Notes" maxLength={2000} rows={3} />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Plan maintenance
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Plans a maintenance. Without a date the API uses the schedule's due date, or now. */
export function PlanMaintenanceDialog({ open, onOpenChange, machineId, machineName, schedule }: PlanMaintenanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Plan maintenance" description={`Create a maintenance for ${machineName}.`}>
        {/* Mounted only while open so the form always starts from the maintenance as it is now. */}
        {open ? (
          <PlanMaintenanceForm
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

export interface EventActionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  event: MaintenanceEvent;
}

function StartMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const start = useStartMaintenance();
  const machineName = event.machine?.name ?? 'the machine';
  const form = useForm<StartMaintenanceFormValues>({
    resolver: zodResolver(startMaintenanceFormSchema),
    defaultValues: { notes: '', putMachineUnderMaintenance: true },
    mode: 'onTouched',
  });

  const onSubmit = (values: StartMaintenanceFormValues) =>
    start.mutate(
      { id: event.id, body: toStartEventRequest(values) },
      {
        onSuccess: () => {
          notify.success('Maintenance started', `Work on ${machineName} is now in progress.`);
          onDone();
        },
        onError: (error) => applyServerFieldErrors(error, form.setError, ['notes']),
      },
    );

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {start.error ? <Alert tone="critical">{getErrorMessage(start.error)}</Alert> : null}
        <FormCheckbox
          control={form.control}
          name="putMachineUnderMaintenance"
          label="Take the machine out of service"
          description="Opens a maintenance log that moves the machine to Under maintenance, the same way technicians do it by hand."
        />
        <FormTextarea control={form.control} name="notes" label="Notes" maxLength={2000} rows={3} />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={start.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={start.isPending}>
          Start maintenance
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Starts a maintenance and, unless told otherwise, takes the machine out of service through a log. */
export function StartMaintenanceDialog({ open, onOpenChange, event }: EventActionDialogProps) {
  const machineName = event.machine?.name ?? 'the machine';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Start maintenance" description={`Begin the planned maintenance of ${machineName}.`}>
        {open ? <StartMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CompleteMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const complete = useCompleteMaintenance();
  const machineName = event.machine?.name ?? 'the machine';
  const form = useForm<CompleteMaintenanceFormInput, unknown, CompleteMaintenanceFormValues>({
    resolver: zodResolver(createCompleteMaintenanceSchema({ event })),
    defaultValues: completeMaintenanceDefaults(new Date(), event),
    mode: 'onTouched',
  });

  const onSubmit = (values: CompleteMaintenanceFormValues) =>
    complete.mutate(
      { id: event.id, body: toCompleteEventRequest(values) },
      {
        onSuccess: ({ data }) => {
          notify.success(
            'Maintenance completed',
            `${machineName} was completed on ${formatDateTime(data.completedAt)}. The next due date has been recalculated.`,
          );
          onDone();
        },
        onError: (error) => applyServerFieldErrors(error, form.setError, ['completedAt', 'notes']),
      },
    );

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {complete.error ? <Alert tone="critical">{getErrorMessage(complete.error)}</Alert> : null}
        <FormDatePicker control={form.control} name="completedAt" label="Completed at" required />
        <FormCheckbox
          control={form.control}
          name="releaseMachine"
          label="Put the machine back in service"
          description="Closes the maintenance log opened at the start and returns the machine to Active."
        />
        <FormTextarea control={form.control} name="notes" label="Notes" maxLength={2000} rows={3} />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={complete.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={complete.isPending}>
          Complete maintenance
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Completing a maintenance starts the next cycle from the time entered here. The form is mounted
 * only while the dialog is open, so the default completion time is never earlier than a start that
 * happened after this card was first rendered.
 */
export function CompleteMaintenanceDialog({ open, onOpenChange, event }: EventActionDialogProps) {
  const machineName = event.machine?.name ?? 'the machine';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Complete maintenance"
        description={`Record the work done on ${machineName}. The next maintenance is scheduled from this moment.`}
      >
        {open ? <CompleteMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const cancel = useCancelMaintenance();
  const machineName = event.machine?.name ?? 'the machine';
  const form = useForm<CancelMaintenanceFormValues>({
    resolver: zodResolver(cancelMaintenanceFormSchema),
    defaultValues: { reason: '' },
    mode: 'onTouched',
  });

  const onSubmit = (values: CancelMaintenanceFormValues) =>
    cancel.mutate(
      { id: event.id, body: values.reason ? { reason: values.reason } : {} },
      {
        onSuccess: () => {
          notify.success('Maintenance cancelled', `The planned maintenance of ${machineName} was called off.`);
          onDone();
        },
        onError: (error) => applyServerFieldErrors(error, form.setError, ['reason']),
      },
    );

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {cancel.error ? <Alert tone="critical">{getErrorMessage(cancel.error)}</Alert> : null}
        <FormTextarea
          control={form.control}
          name="reason"
          label="Reason"
          placeholder="Why is this maintenance not going ahead?"
          maxLength={2000}
          rows={3}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={cancel.isPending}>
          Keep it planned
        </Button>
        <Button type="submit" variant="danger" loading={cancel.isPending}>
          Cancel maintenance
        </Button>
      </DialogFooter>
    </form>
  );
}

/** ADMIN only. Calls off a maintenance that has not been completed. */
export function CancelMaintenanceDialog({ open, onOpenChange, event }: EventActionDialogProps) {
  const machineName = event.machine?.name ?? 'the machine';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cancel maintenance" description={`Call off the planned maintenance of ${machineName}.`}>
        {open ? <CancelMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
