'use client';

import { type ReactNode, useId } from 'react';
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';
import { Input, type InputProps } from '@/components/ui/input';
import { fieldAriaProps, FormField, toControlValue } from './form-field';

export interface ControlledFieldProps<TValues extends FieldValues, TOutput extends FieldValues> {
  control: Control<TValues, unknown, TOutput>;
  name: FieldPath<TValues>;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  labelAside?: ReactNode;
  className?: string;
}

export type FormInputProps<TValues extends FieldValues, TOutput extends FieldValues> = ControlledFieldProps<
  TValues,
  TOutput
> &
  Omit<InputProps, 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'id' | 'className' | 'required'>;

export function FormInput<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  hint,
  required,
  labelAside,
  className,
  disabled,
  ...inputProps
}: FormInputProps<TValues, TOutput>) {
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
        {...inputProps}
        {...fieldAriaProps(id, { hint, error, required })}
        ref={inputRef}
        name={fieldName}
        value={toControlValue(value)}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled || fieldDisabled}
      />
    </FormField>
  );
}
