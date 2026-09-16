'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';

export interface AppErrorBoundaryViewProps {
  onRetry(): void;
  /** Next.js digest of the server error; safe to show and useful for support. */
  digest?: string;
  className?: string;
}

/** Shown when a component throws unexpectedly. Never reveals the stack trace. */
export function AppErrorBoundaryView({ onRetry, digest, className }: AppErrorBoundaryViewProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-20 text-center', className)}>
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-lg border border-critical-line bg-critical-soft text-critical-ink">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-ink">Something went wrong.</h1>
      <p className="mt-1 max-w-sm text-[13px] text-muted">Try refreshing the page. If the problem continues, contact your administrator.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
        <Link href={ROUTES.dashboard} className={buttonVariants({ variant: 'secondary' })}>
          Go to dashboard
        </Link>
      </div>
      {digest ? <p className="mt-4 font-mono text-[11px] text-muted">Reference: {digest}</p> : null}
    </div>
  );
}
