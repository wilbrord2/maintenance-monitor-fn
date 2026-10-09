'use client';

import { FormSelect } from '@/components/forms/form-select';
import { type MachinePart } from '@/types/machine-part';
import { type LogFormControl } from './machine-log-form-sections';

export const WHOLE_MACHINE_LABEL = 'Whole machine';

/**
 * Subject of a new log: the whole machine (empty value, no `machinePartId`) or one of its active
 * parts. Only rendered for machines that have active parts.
 */
export function PartPicker({ control, parts, disabled }: { control: LogFormControl; parts: readonly MachinePart[]; disabled?: boolean }) {
  const options = parts.map((part) => ({
    value: String(part.id),
    label: `${part.partCode} – ${part.name}${part.isCritical ? ' (critical)' : ''}`,
  }));

  return (
    <FormSelect
      control={control}
      name="machinePartId"
      label="Part"
      placeholder={WHOLE_MACHINE_LABEL}
      placeholderSelectable
      options={options}
      disabled={disabled}
      hint="Log a fault of a specific part against that part. Use “Whole machine” for system-wide events such as planned maintenance."
    />
  );
}
