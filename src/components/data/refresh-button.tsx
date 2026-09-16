'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function RefreshButton({ onRefresh, refreshing, label = 'Refresh' }: { onRefresh(): void; refreshing: boolean; label?: string }) {
  return (
    <Button variant="secondary" onClick={onRefresh} disabled={refreshing} aria-label={label} title={label}>
      <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
