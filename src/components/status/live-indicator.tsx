'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type RealtimeConnectionStatus } from '@/types/realtime';

const STATUS_DISPLAY: Record<RealtimeConnectionStatus, { label: string; dot: string; description: string }> = {
  connected: {
    label: 'Live',
    dot: 'bg-positive animate-live-pulse',
    description: 'Connected. Machine status changes appear as they happen.',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-warning',
    description: 'Connecting to live status updates…',
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-warning',
    description: 'Live updates are paused while the connection is restored. Data will refresh when it returns.',
  },
  offline: {
    label: 'Not live',
    dot: 'bg-neutral',
    description: 'Live updates are unavailable. Use Refresh to see the latest status.',
  },
  idle: {
    label: 'Not live',
    dot: 'bg-neutral',
    description: 'Live updates are not connected.',
  },
};

export function LiveIndicator({ className }: { className?: string }) {
  const status = useRealtimeStore((state) => state.connectionStatus);
  const display = STATUS_DISPLAY[status];
  return (
    <Tooltip content={display.description}>
      <span
        role="status"
        tabIndex={0}
        className={cn(
          'inline-flex h-7 shrink-0 items-center gap-2 rounded-md border border-line bg-panel px-2 text-xs font-semibold text-ink-secondary',
          className,
        )}
      >
        <span className={cn('size-2 rounded-full', display.dot)} aria-hidden />
        {display.label}
      </span>
    </Tooltip>
  );
}
