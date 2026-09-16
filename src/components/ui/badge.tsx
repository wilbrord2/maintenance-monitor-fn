import { type LucideIcon } from 'lucide-react';
import { type ComponentProps } from 'react';
import { TONE_CLASSES, type Tone } from '@/constants/tones';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: Tone;
  variant?: 'soft' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
}

const SIZE_CLASSES = {
  sm: 'h-5 gap-1 px-1.5 text-[11px]',
  md: 'h-6 gap-1.5 px-2 text-xs',
  lg: 'h-8 gap-2 px-3 text-sm',
} as const;

const ICON_CLASSES = { sm: 'size-3', md: 'size-3.5', lg: 'size-4' } as const;

export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', icon: Icon, className, children, ...props }: BadgeProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-md border font-semibold whitespace-nowrap',
        SIZE_CLASSES[size],
        variant === 'soft' ? toneClasses.badge : toneClasses.outline,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className={cn(ICON_CLASSES[size], 'shrink-0')} aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
