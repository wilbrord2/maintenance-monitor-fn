'use client';

import { useId } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { fieldAriaProps, FormField, toControlValue } from './form-field';
import { type ControlledFieldProps } from './form-input';

export type FormDatePickerProps<TValues extends FieldValues, TOutput extends FieldValues> = ControlledFieldProps<
  TValues,
  TOutput
> & {
  /** `datetime` edits local date and time; `date` edits a calendar day (YYYY-MM-DD). */
  mode?: 'date' | 'datetime';
  min?: string;
  max?: string;
  disabled?: boolean;
};

/**
 * Native date/time picker: accessible, localised by the platform and touch friendly.
 * Values are kept as input strings; schemas convert them to ISO-8601 for the API.
 */
export function FormDatePicker<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  hint,
  required,
  labelAside,
  className,
  mode = 'datetime',
  min,
  max,
  disabled,
}: FormDatePickerProps<TValues, TOutput>) {
  const {
    field: { ref: inputRef, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
    fieldState,
  } = useController({ control, name });
  const id = useId();
  const error = fieldState.error?.message;

  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} labelAside={labelAside} className={className}>
      <Input
        id={id}
        type={mode === 'date' ? 'date' : 'datetime-local'}
        {...fieldAriaProps(id, { hint, error, required })}
        min={min}
        max={max}
        ref={inputRef}
        name={fieldName}
        value={toControlValue(value)}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled || fieldDisabled}
        className="tabular-nums"
      />
    </FormField>
  );
}
