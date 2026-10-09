import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  wrapperClassName?: string;
}

/**
 * A native checkbox with its label and optional description. The whole block is the label, so
 * the hit target is comfortable on touch screens without extra markup.
 */
export function Checkbox({ label, description, className, wrapperClassName, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-panel p-3 transition-colors',
        'hover:border-line-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-sunken',
        wrapperClassName,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm border-line accent-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <span className="min-w-0 text-[13px]">
        <span className="block font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
