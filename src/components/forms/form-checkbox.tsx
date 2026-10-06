'use client';

import { useId, type ReactNode } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { FormError } from './form-field';
import { type ControlledFieldProps } from './form-input';

export type FormCheckboxProps<TValues extends FieldValues, TOutput extends FieldValues> = Omit<
  ControlledFieldProps<TValues, TOutput>,
  'hint' | 'labelAside' | 'required'
> & {
  description?: ReactNode;
  disabled?: boolean;
};

/** A boolean field. The label is the control's accessible name, so no separate label is rendered. */
export function FormCheckbox<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: FormCheckboxProps<TValues, TOutput>) {
  const {
    field: { ref: inputRef, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
    fieldState,
  } = useController({ control, name });
  const id = useId();
  const error = fieldState.error?.message;

  return (
    <div className={className}>
      <Checkbox
        id={id}
        label={label}
        description={description}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        ref={inputRef}
        name={fieldName}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        onBlur={onBlur}
        disabled={disabled || fieldDisabled}
      />
      {error ? (
        <FormError id={`${id}-error`} className="mt-1.5">
          {error}
        </FormError>
      ) : null}
    </div>
  );
}
