import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';

export interface NotFoundStateProps {
  title?: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
  className?: string;
}

export function NotFoundState({
  title = 'Not found',
  description = "The page or record you're looking for doesn't exist or has been removed.",
  backHref = ROUTES.dashboard,
  backLabel = 'Go to dashboard',
  compact = false,
  className,
}: NotFoundStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg border border-line bg-sunken text-muted">
        <FileQuestion className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>
      {compact ? null : (
        <Link href={backHref} className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'mt-4' })}>
          {backLabel}
        </Link>
      )}
    </div>
  );
}
