'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { type Control, useController, useForm, useWatch } from 'react-hook-form';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ErrorCode } from '@/constants/error-codes';
import { MAINTENANCE_FREQUENCY_OPTIONS } from '@/constants/maintenance';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { queryKeys } from '@/constants/query-keys';
import { useMachineParts } from '@/features/machine-parts/api/queries';
import { getErrorMessage } from '@/lib/api/error-messages';
import { toApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/utils/date';
import {
  createMaintenanceScheduleFormSchema,
  hasScheduleChanges,
  MAINTENANCE_SCHEDULE_FORM_FIELDS,
  MAX_TASK_NAME_LENGTH,
  type MaintenanceScheduleFormInput,
  type MaintenanceScheduleFormValues,
  type MaintenanceTaskTarget,
  maintenanceScheduleToFormInput,
  scheduleServerFieldMap,
  toCreateScheduleRequest,
  toUpdateScheduleRequest,
} from '@/lib/validation/maintenance';
import { type MaintenanceSchedule } from '@/types/maintenance';
import { useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule } from '../api/mutations';

const FREQUENCY_OPTIONS = [...MAINTENANCE_FREQUENCY_OPTIONS, { value: 'custom', label: 'Custom (number of days)' }];

const TARGET_OPTIONS: { value: MaintenanceTaskTarget; label: string }[] = [
  { value: 'machine', label: 'Whole machine' },
  { value: 'part', label: 'Part' },
];

type ScheduleFormControl = Control<MaintenanceScheduleFormInput, unknown, MaintenanceScheduleFormValues>;

function AppliesToField({ control }: { control: ScheduleFormControl }) {
  const { field } = useController({ control, name: 'appliesTo' });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-secondary">Applies to</span>
      <SegmentedControl<MaintenanceTaskTarget>
        label="Applies to"
        options={TARGET_OPTIONS}
        value={field.value}
        onChange={field.onChange}
        className="self-start"
      />
    </div>
  );
}

/** The part of an existing task is fixed; this says so instead of offering a control. */
function FixedTarget({ schedule }: { schedule: MaintenanceSchedule }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-secondary">Applies to</span>
      <p className="text-[13px] text-ink">
        {schedule.machinePart ? (
          <>
            Part: {schedule.machinePart.name} <span className="font-mono text-xs text-muted">{schedule.machinePart.partCode}</span>
          </>
        ) : (
          'Whole machine'
        )}
      </p>
      <p className="text-xs text-muted">
        A task&apos;s part can&apos;t be changed. To move it, create a new task and deactivate this one.
      </p>
    </div>
  );
}

function ScheduleForm({
  machineId,
  machineName,
  schedule,
  defaultPartId,
  onDone,
}: {
  machineId: number;
  machineName: string;
  schedule?: MaintenanceSchedule | null;
  defaultPartId?: number;
  onDone(): void;
}) {
  const isEdit = Boolean(schedule);
  const queryClient = useQueryClient();
  const create = useCreateMaintenanceSchedule(machineId);
  const update = useUpdateMaintenanceSchedule();
  const mutation = isEdit ? update : create;

  // Tasks can only be added to parts in use; the API refuses the others.
  const partsQuery = useMachineParts(
    machineId,
    { page: 1, limit: MAX_PAGE_SIZE, isActive: true, sortBy: 'name', sortOrder: 'asc' },
    { enabled: !isEdit },
  );
  const parts = partsQuery.data?.items ?? [];
  const defaultPart = parts.find((part) => part.id === defaultPartId);

  const initial = maintenanceScheduleToFormInput(schedule, { machinePartId: defaultPartId, partName: defaultPart?.name });
  const form = useForm<MaintenanceScheduleFormInput, unknown, MaintenanceScheduleFormValues>({
    resolver: zodResolver(createMaintenanceScheduleFormSchema({ isEdit })),
    defaultValues: initial,
    mode: 'onTouched',
  });

  const [appliesTo, machinePartId, frequency] = useWatch({ control: form.control, name: ['appliesTo', 'machinePartId', 'frequency'] });

  // A part task is named after its part unless renamed: follow the part while the name is untouched.
  const partName = (id: string) => parts.find((part) => String(part.id) === id)?.name ?? '';
  const previousPartId = useRef(machinePartId);
  useEffect(() => {
    if (isEdit) return;
    const previousName = partName(previousPartId.current);
    previousPartId.current = machinePartId;
    const current = form.getValues('taskName').trim();
    if (appliesTo === 'machine') {
      if (current && current === previousName) form.setValue('taskName', '');
      return;
    }
    const nextName = partName(machinePartId);
    if (nextName && (!current || current === previousName)) form.setValue('taskName', nextName, { shouldValidate: form.formState.isSubmitted });
    // `parts` arriving later also fills the name for a preselected part.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliesTo, machinePartId, parts.length, isEdit]);

  const handleError = (error: unknown, values: MaintenanceScheduleFormValues) => {
    const apiError = toApiError(error);
    if (apiError.hasCode(ErrorCode.MAINTENANCE_SCHEDULE_EXISTS)) {
      form.setError('taskName', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    if (apiError.hasCode(ErrorCode.MACHINE_PART_NOT_FOUND) || apiError.hasCode(ErrorCode.MACHINE_PART_INACTIVE)) {
      // The part list is out of date: reload it so the dropdown only offers parts that can be chosen.
      void queryClient.invalidateQueries({ queryKey: queryKeys.machineParts.lists(machineId) });
      form.setError('machinePartId', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    applyServerFieldErrors(error, form.setError, MAINTENANCE_SCHEDULE_FORM_FIELDS, scheduleServerFieldMap(values.frequency));
  };

  // Errors that landed on a field are shown there, not repeated above the form.
  const fieldLevelError =
    mutation.error &&
    [ErrorCode.MAINTENANCE_SCHEDULE_EXISTS, ErrorCode.MACHINE_PART_NOT_FOUND, ErrorCode.MACHINE_PART_INACTIVE].some((code) =>
      toApiError(mutation.error).hasCode(code),
    );

  const onSubmit = (values: MaintenanceScheduleFormValues) => {
    if (schedule) {
      const body = toUpdateScheduleRequest(values, initial);
      if (!hasScheduleChanges(body)) {
        onDone();
        return;
      }
      update.mutate(
        { id: schedule.id, body },
        {
          onSuccess: ({ data }) => {
            notify.success(
              data.isActive ? 'Task updated' : 'Task saved as inactive',
              data.isActive ? `${data.taskName} is next due on ${formatDate(data.nextMaintenanceAt)}.` : `${data.taskName} no longer produces reminders.`,
            );
            onDone();
          },
          onError: (error) => handleError(error, values),
        },
      );
    } else {
      create.mutate(toCreateScheduleRequest(values), {
        onSuccess: ({ data }) => {
          notify.success('Maintenance task added', `${data.taskName} on ${machineName} is next due on ${formatDate(data.nextMaintenanceAt)}.`);
          onDone();
        },
        onError: (error) => handleError(error, values),
      });
    }
  };

  const partOptions = parts.map((part) => ({ value: String(part.id), label: `${part.name} · ${part.partCode}` }));
  const isPartTask = appliesTo === 'part';

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="flex flex-col gap-4">
        {mutation.error && !fieldLevelError ? <Alert tone="critical">{getErrorMessage(mutation.error)}</Alert> : null}

        {schedule ? <FixedTarget schedule={schedule} /> : <AppliesToField control={form.control} />}

        {!isEdit && isPartTask ? (
          <FormSelect
            control={form.control}
            name="machinePartId"
            label="Part"
            required
            placeholder={
              partsQuery.isPending ? 'Loading parts…' : partOptions.length === 0 ? 'No parts in use on this machine' : 'Choose a part'
            }
            options={partOptions}
            disabled={partsQuery.isPending || partOptions.length === 0}
            hint="Only parts in use can be scheduled."
          />
        ) : null}

        <FormInput
          control={form.control}
          name="taskName"
          label="Task name"
          required={!isPartTask}
          maxLength={MAX_TASK_NAME_LENGTH}
          placeholder={isPartTask ? 'Defaults to the part name' : 'e.g. External cleaning'}
          hint={
            isPartTask
              ? 'Optional. Defaults to the part name. Must be unique for this part.'
              : 'Must be unique among this machine’s machine-wide tasks.'
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect control={form.control} name="frequency" label="Frequency" required options={FREQUENCY_OPTIONS} />
          {frequency === 'custom' ? (
            <FormInput
              control={form.control}
              name="intervalDays"
              label="Every (days)"
              placeholder="e.g. 14"
              inputMode="numeric"
              required
            />
          ) : null}
          <FormInput
            control={form.control}
            name="reminderDaysBefore"
            label="Remind this many days before"
            placeholder={isEdit ? undefined : 'Server default'}
            inputMode="numeric"
            hint={
              isEdit
                ? 'Leave as is to keep the current reminder.'
                : 'Optional. Leave empty for the default: up to 3 days before, none for daily tasks.'
            }
          />
        </div>

        <FormTextarea
          control={form.control}
          name="description"
          label="Instructions"
          maxLength={2000}
          rows={3}
          placeholder="What to inspect or clean, and how"
        />

        <FormDatePicker
          control={form.control}
          name="lastMaintenanceAt"
          label="Last done"
          hint="If known, the first due date is this date plus the interval."
        />
        <FormDatePicker
          control={form.control}
          name="nextMaintenanceAt"
          label={isEdit ? 'Next due date' : 'First due date'}
          hint={
            isEdit
              ? 'Leave empty to keep the due date the server has calculated.'
              : 'Optional. Overrides the date calculated from the last time it was done.'
          }
        />

        {isEdit ? (
          <FormCheckbox
            control={form.control}
            name="isActive"
            label="Task active"
            description="An inactive task stops producing reminders and is left off the dashboards, but keeps its history."
          />
        ) : null}

        <div className="rounded-md border border-line bg-sunken px-3 py-2.5 text-xs text-muted">
          Due dates are calculated by the server. After each completed maintenance the next one is scheduled from the
          actual completion time, not from the date it was planned for.
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={isEdit && !form.formState.isDirty}>
          {isEdit ? 'Save task' : 'Add task'}
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
  /** Edit this task; omit to add a new one. */
  schedule?: MaintenanceSchedule | null;
  /** For a new task: start it as a task of this part. */
  defaultPartId?: number;
}

/** ADMIN only. Adds a part task or a machine-wide task, or edits one. */
export function ScheduleFormDialog({ open, onOpenChange, machineId, machineName, schedule, defaultPartId }: ScheduleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={schedule ? 'Edit maintenance task' : 'Add maintenance task'}
        description={
          schedule
            ? `Change ${schedule.taskName} on ${machineName}.`
            : `Inspect one of ${machineName}'s parts, or maintain the whole machine, on a recurring cycle.`
        }
      >
        {open ? (
          <ScheduleForm
            machineId={machineId}
            machineName={machineName}
            schedule={schedule}
            defaultPartId={defaultPartId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
