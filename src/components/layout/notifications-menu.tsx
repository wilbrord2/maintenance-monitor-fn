'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowRight, Bell, BellRing } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { formatRelativeTime, toIsoString } from '@/lib/utils/date';
import { useRealtimeStore } from '@/stores/realtime-store';
import { type MachineStatusChangeSource } from '@/types/realtime';

const SOURCE_LABELS: Record<MachineStatusChangeSource, string> = {
  MACHINE_LOG_CREATED: 'New log',
  MACHINE_LOG_UPDATED: 'Log updated',
  MACHINE_LOG_DELETED: 'Log deleted',
};

/** Recent live status changes received since signing in. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const notifications = useRealtimeStore((state) => state.notifications);
  const unreadCount = useRealtimeStore((state) => state.unreadCount);
  const markAllRead = useRealtimeStore((state) => state.markAllRead);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markAllRead();
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Status changes, ${unreadCount} new` : 'Status changes'}
        >
          <Bell className="size-[18px]" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(92vw,22rem)] rounded-lg border border-line bg-panel shadow-overlay data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Status changes</p>
            <LiveIndicator />
          </div>
          {notifications.length === 0 ? (
            <EmptyState compact icon={BellRing} title="No status changes yet" description="Machine status changes appear here as they happen." />
          ) : (
            <ul className="max-h-[min(24rem,60dvh)] divide-y divide-line-soft overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={ROUTES.machine(notification.machineId)}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-hover focus-visible:outline-offset-[-2px]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[13px] font-semibold text-ink">{notification.machineName}</p>
                      <time className="shrink-0 text-[11px] text-muted" dateTime={toIsoString(notification.timestamp)}>
                        {formatRelativeTime(notification.timestamp)}
                      </time>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <MachineStateBadge state={notification.previousStatus} size="sm" />
                      <ArrowRight className="size-3 text-muted" aria-label="changed to" />
                      <MachineStateBadge state={notification.newStatus} size="sm" />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {notification.ownChange ? 'By you' : `By ${notification.updatedBy.name}`} · {SOURCE_LABELS[notification.source]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
