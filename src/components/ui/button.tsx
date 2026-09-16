import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover',
  secondary: 'border border-line bg-panel text-ink hover:border-line-strong hover:bg-sunken',
  ghost: 'text-ink-secondary hover:bg-hover hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  'danger-ghost': 'text-critical-ink hover:bg-critical-soft',
  link: 'h-auto px-0 text-info-ink underline-offset-4 hover:underline',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-[13px]',
  lg: 'h-10 px-4 text-sm',
  icon: 'size-9',
  'icon-sm': 'size-8',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Button classes, also used to style links as buttons. */
export function buttonVariants({ variant = 'primary', size = 'md', className }: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold',
    'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className,
  );
}

export interface ButtonProps extends ComponentProps<'button'>, Omit<ButtonStyleOptions, 'className'> {
  /** Shows a spinner, disables the button and marks it busy. */
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant,
  size,
  loading = false,
  icon: Icon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconClass = size === 'sm' ? 'size-3.5' : 'size-4';
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className={cn(iconClass, 'animate-spin')} aria-hidden />
      ) : Icon ? (
        <Icon className={iconClass} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
