import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { type MachineState } from '@/types/machine';
import { MachineStateBadge } from './machine-state-badge';

export interface StateTransitionProps {
  from: MachineState;
  to: MachineState;
  size?: 'sm' | 'md';
  className?: string;
}

/** Entry state → resulting state. A same-state entry shows a single badge. */
export function StateTransition({ from, to, size = 'sm', className }: StateTransitionProps) {
  if (from === to) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
        <MachineStateBadge state={to} size={size} />
        <span className="text-[11px] text-muted">No change</span>
      </span>
    );
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <MachineStateBadge state={from} size={size} />
      <ArrowRight className="size-3 shrink-0 text-muted" aria-label="to" />
      <MachineStateBadge state={to} size={size} />
    </span>
  );
}
