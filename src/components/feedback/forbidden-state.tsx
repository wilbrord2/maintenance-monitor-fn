import { ShieldX } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';

export function ForbiddenState({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg border border-warning-line bg-warning-soft text-warning-ink">
        <ShieldX className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">Access denied</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        You don&apos;t have permission to view this page. If you think you should, contact an administrator.
      </p>
      {compact ? null : (
        <Link href={ROUTES.dashboard} className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'mt-4' })}>
          Go to dashboard
        </Link>
      )}
    </div>
  );
}
