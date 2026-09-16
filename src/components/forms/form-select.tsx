'use client';

import { useId } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { Select, type SelectProps } from '@/components/ui/select';
import { fieldAriaProps, FormField, toControlValue } from './form-field';
import { type ControlledFieldProps } from './form-input';

export type FormSelectProps<TValues extends FieldValues, TOutput extends FieldValues> = ControlledFieldProps<
  TValues,
  TOutput
> &
  Omit<SelectProps, 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'id' | 'className' | 'required'>;

export function FormSelect<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  hint,
  required,
  labelAside,
  className,
  disabled,
  placeholderSelectable = false,
  ...selectProps
}: FormSelectProps<TValues, TOutput>) {
  const {
    field: { ref: selectRef, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
    fieldState,
  } = useController({ control, name });
  const id = useId();
  const error = fieldState.error?.message;

  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} labelAside={labelAside} className={className}>
      <Select
        id={id}
        {...selectProps}
        {...fieldAriaProps(id, { hint, error, required })}
        placeholderSelectable={placeholderSelectable}
        ref={selectRef}
        name={fieldName}
        value={toControlValue(value)}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled || fieldDisabled}
      />
    </FormField>
  );
}
