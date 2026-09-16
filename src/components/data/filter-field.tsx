'use client';

import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils/cn';

/** Visible label for a filter control; passes the generated id to the control. */
export function FilterField({ label, className, children }: { label: string; className?: string; children(id: string): ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
