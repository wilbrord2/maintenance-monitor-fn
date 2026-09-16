import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('min-w-0 rounded-lg border border-line bg-panel shadow-xs', className)} {...props} />;
}

export interface CardHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Heading level for the title; defaults to h2. */
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, description, actions, as: Heading = 'h2', className, ...props }: CardHeaderProps) {
  return (
    <header
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3', className)}
      {...props}
    >
      <div className="min-w-0">
        <Heading className="text-sm font-semibold text-ink">{title}</Heading>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'footer'>) {
  return (
    <footer
      className={cn('flex items-center justify-between gap-3 border-t border-line bg-sunken px-4 py-2.5 text-xs text-muted', className)}
      {...props}
    />
  );
}
