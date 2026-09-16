import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';
import { TONE_CLASSES, type Tone } from '@/constants/tones';
import { cn } from '@/lib/utils/cn';

const TONE_ICONS: Record<Tone, LucideIcon> = {
  positive: CircleCheck,
  warning: TriangleAlert,
  critical: CircleAlert,
  info: Info,
  neutral: Info,
};

export interface AlertProps extends Omit<ComponentProps<'div'>, 'title'> {
  tone?: Tone;
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}

/** Inline message. Errors and warnings are announced to assistive technology. */
export function Alert({ tone = 'info', title, icon, action, className, children, ...props }: AlertProps) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <div
      role={tone === 'critical' || tone === 'warning' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed',
        TONE_CLASSES[tone].badge,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-48">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? 'mt-0.5' : null)}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
