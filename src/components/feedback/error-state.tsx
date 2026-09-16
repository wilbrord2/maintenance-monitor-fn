'use client';

import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage, getErrorTitle } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import { ForbiddenState } from './forbidden-state';
import { NotFoundState } from './not-found-state';

export interface ErrorStateProps {
  error: unknown;
  onRetry?(): void;
  isRetrying?: boolean;
  title?: string;
  compact?: boolean;
  className?: string;
}

/** Explains a failed load, offers recovery, and shows a reference id for support. */
export function ErrorState({ error, onRetry, isRetrying = false, title, compact = false, className }: ErrorStateProps) {
  if (isApiError(error) && error.status === 403) return <ForbiddenState compact={compact} className={className} />;
  if (isApiError(error) && error.status === 404) {
    return <NotFoundState compact={compact} className={className} description={getErrorMessage(error)} />;
  }

  const Icon = isApiError(error) && error.isNetworkError ? WifiOff : CircleAlert;
  const requestId = isApiError(error) ? error.requestId : null;

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}
    >
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg border border-critical-line bg-critical-soft text-critical-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{title ?? getErrorTitle(error)}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{getErrorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} loading={isRetrying} className="mt-4">
          Try again
        </Button>
      ) : null}
      {requestId ? <p className="mt-3 font-mono text-[11px] text-muted">Reference: {requestId}</p> : null}
    </div>
  );
}
