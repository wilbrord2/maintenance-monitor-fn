import { type LucideIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Shared look of text inputs, selects and textareas. 16px text on phones prevents iOS zoom. */
export const fieldControlClasses = cn(
  'w-full rounded-md border border-line bg-panel text-base text-ink sm:text-[13px]',
  'placeholder:text-muted transition-colors duration-150 hover:border-line-strong',
  'focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted',
  'aria-invalid:border-critical aria-invalid:focus-visible:outline-critical',
);

export interface InputProps extends ComponentProps<'input'> {
  icon?: LucideIcon;
  /** Content rendered inside the right edge, e.g. a clear or reveal button. */
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export function Input({ icon: Icon, trailing, className, wrapperClassName, ...props }: InputProps) {
  if (!Icon && !trailing) {
    return <input className={cn(fieldControlClasses, 'h-9 px-3', className)} {...props} />;
  }
  return (
    <div className={cn('relative', wrapperClassName)}>
      {Icon ? (
        <Icon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      ) : null}
      <input
        className={cn(fieldControlClasses, 'h-9 px-3', Icon && 'pl-8', trailing && 'pr-9', className)}
        {...props}
      />
      {trailing ? <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div> : null}
    </div>
  );
}
