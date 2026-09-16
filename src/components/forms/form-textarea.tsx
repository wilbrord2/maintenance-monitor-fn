'use client';

import { type ComponentProps, useId } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import { fieldAriaProps, FormField, toControlValue } from './form-field';
import { type ControlledFieldProps } from './form-input';

export type FormTextareaProps<TValues extends FieldValues, TOutput extends FieldValues> = ControlledFieldProps<
  TValues,
  TOutput
> &
  Omit<ComponentProps<'textarea'>, 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'id' | 'className' | 'required'>;

export function FormTextarea<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  hint,
  required,
  className,
  maxLength,
  disabled,
  ...textareaProps
}: FormTextareaProps<TValues, TOutput>) {
  const {
    field: { ref: textareaRef, name: fieldName, value: rawValue, onChange, onBlur, disabled: fieldDisabled },
    fieldState,
  } = useController({ control, name });
  const id = useId();
  const error = fieldState.error?.message;
  const value = toControlValue(rawValue);
  const nearLimit = maxLength !== undefined && value.length > maxLength * 0.85;

  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      labelAside={
        maxLength !== undefined && nearLimit ? (
          <span className={cn('text-[11px] tabular-nums', value.length > maxLength ? 'text-critical-ink' : 'text-muted')}>
            {formatNumber(value.length)}/{formatNumber(maxLength)}
          </span>
        ) : null
      }
    >
      <Textarea
        id={id}
        {...textareaProps}
        {...fieldAriaProps(id, { hint, error, required })}
        ref={textareaRef}
        name={fieldName}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled || fieldDisabled}
      />
    </FormField>
  );
}
