'use client';

import { type ReactNode } from 'react';
import { type Control } from 'react-hook-form';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type SelectOption } from '@/components/ui/select';
import { LOG_STATUS_CONFIG } from '@/constants/log-status';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { getAllowedResultingStates, requiresOpenLog } from '@/lib/machine-state/transitions';
import { type MachineLogFormInput, type MachineLogFormValues } from '@/lib/validation/machine-log';
import { type MachineState, type StateTransitionRules } from '@/types/machine';
import { LOG_STATUSES, LogStatus } from '@/types/machine-log';

export type LogFormControl = Control<MachineLogFormInput, unknown, MachineLogFormValues>;

export function resultingStateOptions(rules: StateTransitionRules, entry: MachineState | null): SelectOption[] {
  if (!entry) return [];
  return getAllowedResultingStates(rules, entry).map((state) => ({
    value: state,
    label: state === entry ? `${MACHINE_STATE_CONFIG[state].label} (no change)` : MACHINE_STATE_CONFIG[state].label,
  }));
}

export function logStatusOptions(closedDisabled: boolean): SelectOption[] {
  return LOG_STATUSES.map((status) => ({
    value: status,
    label: `${LOG_STATUS_CONFIG[status].label} — ${LOG_STATUS_CONFIG[status].description.toLowerCase()}`,
    disabled: status === LogStatus.CLOSED && closedDisabled,
  }));
}

/** Whether the log must stay open given the resulting state (only for a machine's most recent log). */
export function mustStayOpen(rules: StateTransitionRules, resulting: MachineState | null, isLatestLog: boolean): boolean {
  return Boolean(resulting && isLatestLog && requiresOpenLog(rules, resulting));
}

export function FaultSection({ control }: { control: LogFormControl }) {
  return (
    <Card>
      <CardHeader title="Fault and cause" description="What was observed and why it happened" />
      <CardContent className="flex flex-col gap-4">
        <FormTextarea
          control={control}
          name="faultDescription"
          label="Fault description"
          placeholder="e.g. Hydraulic pressure drop on main cylinder"
          required
          maxLength={2000}
          rows={3}
        />
        <FormTextarea control={control} name="causeDescription" label="Cause" placeholder="e.g. Worn seal" maxLength={2000} rows={2} />
      </CardContent>
    </Card>
  );
}

export interface StateSectionProps {
  control: LogFormControl;
  entry: MachineState | null;
  entryLabel: string;
  entryHint?: ReactNode;
  resultingOptions: SelectOption[];
  resultingDisabled: boolean;
  resultingHint: ReactNode;
  closedDisabled: boolean;
  logStatusHint?: ReactNode;
  children?: ReactNode;
}

export function StateSection({
  control,
  entry,
  entryLabel,
  entryHint,
  resultingOptions,
  resultingDisabled,
  resultingHint,
  closedDisabled,
  logStatusHint,
  children,
}: StateSectionProps) {
  return (
    <Card>
      <CardHeader title="State change" description="The resulting state becomes the machine's status when the log is saved" />
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-semibold text-ink-secondary">{entryLabel}</p>
            <div className="flex h-9 items-center rounded-md border border-line bg-sunken px-3">
              {entry ? <MachineStateBadge state={entry} size="sm" /> : <span className="text-[13px] text-muted">Choose a machine first</span>}
            </div>
            {entryHint ? <p className="text-xs text-muted">{entryHint}</p> : null}
          </div>
          <FormSelect
            control={control}
            name="resultingState"
            label="Resulting state"
            required
            placeholder={resultingDisabled && resultingOptions.length === 0 ? 'Choose a machine first' : 'Choose the resulting state'}
            options={resultingOptions}
            disabled={resultingDisabled}
            hint={resultingHint}
          />
        </div>
        <FormSelect
          control={control}
          name="logStatus"
          label="Log status"
          required
          options={logStatusOptions(closedDisabled)}
          hint={logStatusHint}
        />
        {children}
      </CardContent>
    </Card>
  );
}

export function WorkSection({ control }: { control: LogFormControl }) {
  return (
    <Card>
      <CardHeader title="Work and follow-up" description="What was done, and what should happen next" />
      <CardContent className="flex flex-col gap-4">
        <FormTextarea
          control={control}
          name="remedyAction"
          label="Remedy / action taken"
          placeholder="e.g. Isolated the cylinder and replaced the seal kit"
          maxLength={2000}
          rows={3}
        />
        <FormTextarea
          control={control}
          name="nextMaintenancePlan"
          label="Next maintenance plan"
          placeholder="e.g. Re-check pressure in 2 weeks"
          maxLength={1000}
          rows={2}
        />
      </CardContent>
    </Card>
  );
}

export function TimingSection({ control, closed, downtimeHint }: { control: LogFormControl; closed: boolean; downtimeHint: ReactNode }) {
  return (
    <Card>
      <CardHeader title="Timing" description="Times are in your local time zone" />
      <CardContent className="grid gap-4 md:grid-cols-2">
        <FormDatePicker control={control} name="startedAt" label="Started at" required />
        {closed ? (
          <FormDatePicker control={control} name="endedAt" label="Ended at" required hint="Required to close the log." />
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-ink-secondary">Ended at</p>
            <p className="flex h-9 items-center rounded-md border border-dashed border-line px-3 text-[13px] text-muted">Ongoing — set when closing</p>
          </div>
        )}
        <FormInput
          control={control}
          name="downtimeHours"
          label="Downtime (hours)"
          type="text"
          inputMode="decimal"
          placeholder="Automatic"
          hint={downtimeHint}
          className="md:col-span-2 md:max-w-xs"
        />
      </CardContent>
    </Card>
  );
}
