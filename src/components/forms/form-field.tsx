import { CircleAlert } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Content aligned with the label, e.g. "Forgot password?" or a character count. */
  labelAside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label, control, hint and error, wired together for assistive technology. */
export function FormField({ id, label, hint, error, required = false, labelAside, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-baseline gap-0.5">
          <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">
            {label}
          </label>
          {/* Outside the label so the field's accessible name is exactly the label; aria-required conveys it. */}
          {required ? (
            <span className="text-xs font-semibold text-critical-ink" aria-hidden>
              *
            </span>
          ) : null}
        </span>
        {labelAside}
      </div>
      {children}
      {error ? (
        <FormError id={`${id}-error`}>{error}</FormError>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} aria-live="polite" className={cn('flex items-start gap-1 text-xs font-medium text-critical-ink', className)}>
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** ARIA attributes linking a control to its hint and error message. */
export function fieldAriaProps(id: string, options: { hint?: ReactNode; error?: string; required?: boolean }) {
  const describedBy = options.error ? `${id}-error` : options.hint ? `${id}-hint` : undefined;
  return {
    'aria-invalid': options.error ? true : undefined,
    'aria-describedby': describedBy,
    'aria-required': options.required || undefined,
  } as const;
}

export function toControlValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
