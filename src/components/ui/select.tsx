import { ChevronDown } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';
import { fieldControlClasses } from './input';

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'children'> {
  options: readonly SelectOption[];
  /** Adds an empty first option (e.g. "All statuses"). */
  placeholder?: string;
  /** Whether the placeholder option may be selected (filters) or is a disabled prompt (forms). */
  placeholderSelectable?: boolean;
  wrapperClassName?: string;
}

/**
 * Native select: fully keyboard and screen-reader accessible, and uses the platform picker on
 * phones and tablets.
 */
export function Select({
  options,
  placeholder,
  placeholderSelectable = true,
  className,
  wrapperClassName,
  ...props
}: SelectProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select className={cn(fieldControlClasses, 'h-9 appearance-none truncate pr-8 pl-3', className)} {...props}>
        {placeholder !== undefined ? (
          <option value="" disabled={!placeholderSelectable}>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}
