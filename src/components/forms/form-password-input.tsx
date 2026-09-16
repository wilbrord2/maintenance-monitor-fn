'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { fieldAriaProps, FormField, toControlValue } from './form-field';
import { type ControlledFieldProps } from './form-input';

export type FormPasswordInputProps<TValues extends FieldValues, TOutput extends FieldValues> = ControlledFieldProps<
  TValues,
  TOutput
> & {
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
};

export function FormPasswordInput<TValues extends FieldValues, TOutput extends FieldValues = TValues>({
  control,
  name,
  label,
  hint,
  required,
  labelAside,
  className,
  autoComplete,
  autoFocus,
}: FormPasswordInputProps<TValues, TOutput>) {
  const {
    field: { ref: inputRef, name: fieldName, value, onChange, onBlur, disabled: fieldDisabled },
    fieldState,
  } = useController({ control, name });
  const [visible, setVisible] = useState(false);
  const id = useId();
  const error = fieldState.error?.message;

  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} labelAside={labelAside} className={className}>
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="none"
        maxLength={128}
        {...fieldAriaProps(id, { hint, error, required })}
        ref={inputRef}
        name={fieldName}
        value={toControlValue(value)}
        onChange={onChange}
        onBlur={onBlur}
        disabled={fieldDisabled}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            aria-controls={id}
            className="inline-flex size-7 items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-ink"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        }
      />
    </FormField>
  );
}
