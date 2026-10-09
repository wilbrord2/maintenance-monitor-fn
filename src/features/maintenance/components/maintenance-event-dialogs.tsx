'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ErrorCode } from '@/constants/error-codes';
import { describeMaintenanceSubject } from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
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
import { type MachinePart } from '@/types/machine-part';
import { type MaintenanceEvent, MaintenanceEventStatus, type MaintenanceSchedule } from '@/types/maintenance';
import {
  useCancelMaintenance,
  useCompleteMaintenance,
  useCreateMaintenanceEvent,
  useStartMaintenance,
  useStartTaskMaintenance,
} from '../api/mutations';
import { useOpenMaintenanceEvents } from '../api/queries';

/** "Cutting head (Laser 1)" for a task or part, or the machine alone for whole-machine one-off work. */
export function describeEventTarget(event: MaintenanceEvent): string {
  const machineName = event.machine?.name ?? 'the machine';
  if (!event.taskName && !event.machinePart) return machineName;
  return `${describeMaintenanceSubject({ taskName: event.taskName, partName: event.machinePart?.name ?? null })} (${machineName})`;
}

function describeScheduleTarget(schedule: MaintenanceSchedule, machineName: string): string {
  return `${describeMaintenanceSubject({ taskName: schedule.taskName, partName: schedule.machinePart?.name ?? null })} (${machineName})`;
}

export interface PlanMaintenanceDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  machineId: number;
  machineName: string;
  /** Parts the work can be about; inactive ones are left out (the API refuses them). */
  parts?: readonly MachinePart[];
  /** Preselects a part, e.g. when planning from the part's page. */
  defaultPartId?: number;
}

function PlanMaintenanceForm({
  onDone,
  machineId,
  machineName,
  parts = [],
  defaultPartId,
}: Omit<PlanMaintenanceDialogProps, 'open' | 'onOpenChange'> & { onDone(): void }) {
  const create = useCreateMaintenanceEvent();
  const form = useForm<MaintenanceEventFormInput, unknown, MaintenanceEventFormValues>({
    resolver: zodResolver(maintenanceEventFormSchema),
    defaultValues: maintenanceEventFormDefaults(null, { machinePartId: defaultPartId }),
    mode: 'onTouched',
  });
  const activeParts = parts.filter((part) => part.isActive);
  const partOptions = activeParts.map((part) => ({ value: String(part.id), label: `${part.partCode} – ${part.name}` }));

  const onSubmit = (values: MaintenanceEventFormValues) =>
    create.mutate(toCreateEventRequest(values, { kind: 'one-off', machineId }), {
      onSuccess: ({ data }) => {
        notify.success('Maintenance planned', `${describeEventTarget(data)} is scheduled for ${formatDate(data.scheduledFor)}.`);
        onDone();
      },
      onError: (error) => applyServerFieldErrors(error, form.setError, ['scheduledFor', 'machinePartId', 'notes']),
    });

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {create.error ? <Alert tone="critical">{getErrorMessage(create.error)}</Alert> : null}
        <div className="rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
          One-off work is not linked to a maintenance task and does not move any due date. To carry out a planned task,
          use Start maintenance on that task in {machineName}&apos;s maintenance plan.
        </div>
        {partOptions.length > 0 ? (
          <FormSelect
            control={form.control}
            name="machinePartId"
            label="Part"
            placeholder="Whole machine"
            placeholderSelectable
            options={partOptions}
            hint="Choose a part to put that part (rather than the whole machine) under maintenance when the work starts."
          />
        ) : null}
        <FormDatePicker control={form.control} name="scheduledFor" label="Scheduled for" hint="Leave empty to plan it for now." />
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

/** Plans one-off work on the machine or one of its parts. Without a date the API uses now. */
export function PlanMaintenanceDialog({ open, onOpenChange, ...props }: PlanMaintenanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Plan one-off maintenance" description={`Create a maintenance for ${props.machineName} outside its plan.`}>
        {/* Mounted only while open so the form always starts from the maintenance as it is now. */}
        {open ? <PlanMaintenanceForm {...props} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export interface EventActionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  event: MaintenanceEvent;
}

/** The two fields shared by starting an existing event and starting a task directly. */
function StartFields({ form, isPart }: { form: ReturnType<typeof useStartForm>; isPart: boolean }) {
  const subject = isPart ? 'part' : 'machine';
  return (
    <>
      <FormCheckbox
        control={form.control}
        name="putUnderMaintenance"
        label={`Put ${subject} under maintenance`}
        description={
          isPart
            ? 'Opens a log that moves this part to Under maintenance. The machine’s status is then recalculated from its parts.'
            : 'Opens a log that moves the machine to Under maintenance, the same way technicians do it by hand.'
        }
      />
      <FormTextarea control={form.control} name="notes" label="Notes" maxLength={2000} rows={3} />
    </>
  );
}

function useStartForm() {
  return useForm<StartMaintenanceFormValues>({
    resolver: zodResolver(startMaintenanceFormSchema),
    defaultValues: { notes: '', putUnderMaintenance: true },
    mode: 'onTouched',
  });
}

function StartMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const start = useStartMaintenance();
  const form = useStartForm();

  const onSubmit = (values: StartMaintenanceFormValues) =>
    start.mutate(
      { id: event.id, body: toStartEventRequest(values) },
      {
        onSuccess: () => {
          notify.success('Maintenance started', `Work on ${describeEventTarget(event)} is now in progress.`);
          onDone();
        },
        onError: (error) => applyServerFieldErrors(error, form.setError, ['notes']),
      },
    );

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {start.error ? <Alert tone="critical">{getErrorMessage(start.error)}</Alert> : null}
        <StartFields form={form} isPart={event.machinePartId !== null} />
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

/** Starts a planned maintenance and, unless told otherwise, takes its part or machine out of service. */
export function StartMaintenanceDialog({ open, onOpenChange, event }: EventActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Start maintenance" description={`Begin the planned maintenance of ${describeEventTarget(event)}.`}>
        {open ? <StartMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Shown when the task already has an open event: finds it so the user can go straight to it. */
function OpenEventLink({ scheduleId }: { scheduleId: number }) {
  const open = useOpenMaintenanceEvents({ maintenanceScheduleId: scheduleId });
  const event = open.events[0];
  if (!event) return null;
  return (
    <Link href={ROUTES.maintenanceEvent(event.id)} className="mt-1 block font-medium underline">
      Open the {event.status === MaintenanceEventStatus.IN_PROGRESS ? 'maintenance in progress' : 'planned maintenance'}
    </Link>
  );
}

export interface StartTaskMaintenanceDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  schedule: MaintenanceSchedule;
  machineName: string;
}

function StartTaskMaintenanceForm({ schedule, machineName, onDone }: Omit<StartTaskMaintenanceDialogProps, 'open' | 'onOpenChange'> & { onDone(): void }) {
  const start = useStartTaskMaintenance();
  const form = useStartForm();
  const target = describeScheduleTarget(schedule, machineName);
  const alreadyOpen = isApiError(start.error) && start.error.hasCode(ErrorCode.MAINTENANCE_EVENT_ALREADY_OPEN);

  const onSubmit = (values: StartMaintenanceFormValues) =>
    start.mutate(
      { maintenanceScheduleId: schedule.id, body: toStartEventRequest(values) },
      {
        onSuccess: () => {
          notify.success('Maintenance started', `Work on ${target} is now in progress.`);
          onDone();
        },
        onError: (error) => applyServerFieldErrors(error, form.setError, ['notes']),
      },
    );

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {start.error ? (
          <Alert tone="critical">
            {getErrorMessage(start.error)}
            {alreadyOpen ? <OpenEventLink scheduleId={schedule.id} /> : null}
          </Alert>
        ) : null}
        {schedule.description ? (
          <div className="rounded-md border border-line bg-sunken px-3 py-2.5 text-[13px] whitespace-pre-wrap text-ink">
            {schedule.description}
          </div>
        ) : null}
        <StartFields form={form} isPart={schedule.machinePartId !== null} />
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

/**
 * Starts the maintenance of one task right away: plans an event for the task (by its id only),
 * then starts it. The next due date moves when the work is completed.
 */
export function StartTaskMaintenanceDialog({ open, onOpenChange, schedule, machineName }: StartTaskMaintenanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Start maintenance" description={`Begin the maintenance of ${describeScheduleTarget(schedule, machineName)}.`}>
        {open ? <StartTaskMaintenanceForm schedule={schedule} machineName={machineName} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CompleteMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const complete = useCompleteMaintenance();
  const form = useForm<CompleteMaintenanceFormInput, unknown, CompleteMaintenanceFormValues>({
    resolver: zodResolver(createCompleteMaintenanceSchema({ event })),
    defaultValues: completeMaintenanceDefaults(new Date(), event),
    mode: 'onTouched',
  });
  const isPart = event.machinePartId !== null;

  const onSubmit = (values: CompleteMaintenanceFormValues) =>
    complete.mutate(
      { id: event.id, body: toCompleteEventRequest(values) },
      {
        onSuccess: ({ data }) => {
          notify.success(
            'Maintenance completed',
            `${describeEventTarget(event)} was completed on ${formatDateTime(data.completedAt)}.${
              data.maintenanceScheduleId ? ' The next due date has been recalculated.' : ''
            }`,
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
          name="releaseOnComplete"
          label="Return it to active when completed"
          description={
            isPart
              ? 'Closes the log opened at the start and returns the part to Active; the machine’s status is recalculated.'
              : 'Closes the log opened at the start and returns the machine to Active.'
          }
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
 * Completing a maintenance starts the task's next cycle from the time entered here. The form is
 * mounted only while the dialog is open, so the default completion time is never earlier than a
 * start that happened after the page was first rendered.
 */
export function CompleteMaintenanceDialog({ open, onOpenChange, event }: EventActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Complete maintenance"
        description={
          event.maintenanceScheduleId
            ? `Record the work done on ${describeEventTarget(event)}. The task's next maintenance is scheduled from this moment.`
            : `Record the work done on ${describeEventTarget(event)}.`
        }
      >
        {open ? <CompleteMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelMaintenanceForm({ event, onDone }: { event: MaintenanceEvent; onDone(): void }) {
  const cancel = useCancelMaintenance();
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
          notify.success('Maintenance cancelled', `The planned maintenance of ${describeEventTarget(event)} was called off.`);
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cancel maintenance" description={`Call off the planned maintenance of ${describeEventTarget(event)}.`}>
        {open ? <CancelMaintenanceForm event={event} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
