'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowRight, Bell, BellRing } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { LiveIndicator } from '@/components/status/live-indicator';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { MaintenanceStateBadge } from '@/components/status/maintenance-badges';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { OperationalImpactBadge, PartStatusBadge } from '@/components/status/part-status-badge';
import { Button } from '@/components/ui/button';
import {
  describeDaysUntilDue,
  describeMaintenanceReminder,
  describeMaintenanceTarget,
  MAINTENANCE_COMPLETED_ICON,
} from '@/constants/maintenance';
import { ROUTES } from '@/constants/routes';
import { formatDate, formatRelativeTime, toIsoString } from '@/lib/utils/date';
import { type RealtimeNotification, useRealtimeStore } from '@/stores/realtime-store';
import { type MachineStatusTrigger } from '@/types/realtime';

const TRIGGER_LABELS: Record<MachineStatusTrigger['type'], string> = {
  MACHINE_PART: 'part change',
  MACHINE_LOG: 'machine log',
  MAINTENANCE_EVENT: 'maintenance',
};

interface NotificationContent {
  title: string;
  href: string;
  body: ReactNode;
  caption: string;
}

/** Each kind of live event, phrased from the payload the API sent. */
function describe(notification: RealtimeNotification, actor: string): NotificationContent {
  switch (notification.kind) {
    case 'machine-status': {
      const { event } = notification;
      return {
        title: event.machineName,
        href: ROUTES.machine(event.machineId),
        body: (
          <>
            <MachineStateBadge state={event.previousStatus} size="sm" />
            <ArrowRight className="size-3 text-muted" aria-label="changed to" />
            <MachineStateBadge state={event.newStatus} size="sm" />
          </>
        ),
        caption: `${actor} · ${event.reason || TRIGGER_LABELS[event.trigger.type]}`,
      };
    }
    case 'operational-status': {
      const { event } = notification;
      return {
        title: event.machineName,
        href: ROUTES.machine(event.machineId),
        body: (
          <>
            <OperationalStatusBadge status={event.previousStatus} size="sm" />
            <ArrowRight className="size-3 text-muted" aria-label="changed to" />
            <OperationalStatusBadge status={event.newStatus} size="sm" />
          </>
        ),
        caption: event.reason,
      };
    }
    case 'part': {
      const { event } = notification;
      return {
        title: `${event.partName} (${event.partCode})`,
        href: ROUTES.machinePart(event.machineId, event.partId),
        body: (
          <>
            <PartStatusBadge status={event.previousStatus} size="sm" />
            <ArrowRight className="size-3 text-muted" aria-label="changed to" />
            <PartStatusBadge status={event.newStatus} size="sm" />
            <OperationalImpactBadge impact={event.operationalImpact} size="sm" />
          </>
        ),
        caption: `${actor} · part condition`,
      };
    }
    case 'maintenance-reminder': {
      const { event } = notification;
      return {
        title: describeMaintenanceReminder(event),
        href:
          event.machinePartId !== null
            ? ROUTES.machinePart(event.machineId, event.machinePartId)
            : `${ROUTES.machine(event.machineId)}#maintenance`,
        body: <MaintenanceStateBadge state={event.state} size="sm" />,
        caption: `Due ${formatDate(event.nextMaintenanceAt)} (${describeDaysUntilDue(event.daysUntilDue).toLowerCase()})`,
      };
    }
    case 'maintenance-completed': {
      const { event } = notification;
      const Icon = MAINTENANCE_COMPLETED_ICON;
      return {
        title: describeMaintenanceTarget(event),
        href: ROUTES.maintenanceEvent(event.eventId),
        body: (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-positive-ink">
            <Icon className="size-3.5" aria-hidden />
            Maintenance completed
          </span>
        ),
        caption: event.nextMaintenanceAt
          ? `${actor} · next due ${formatDate(event.nextMaintenanceAt)}`
          : `${actor} · one-off maintenance`,
      };
    }
  }
}

/** Recent live changes received since signing in: machines, parts and preventive maintenance. */
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
          aria-label={unreadCount > 0 ? `Live updates, ${unreadCount} new` : 'Live updates'}
        >
          <Bell className="size-4.5" aria-hidden />
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
            <p className="text-sm font-semibold text-ink">Live updates</p>
            <LiveIndicator />
          </div>
          {notifications.length === 0 ? (
            <EmptyState
              compact
              icon={BellRing}
              title="Nothing new yet"
              description="Machine and part changes, and maintenance reminders, appear here as they happen."
            />
          ) : (
            <ul className="max-h-[min(24rem,60dvh)] divide-y divide-line-soft overflow-y-auto">
              {notifications.map((notification) => {
                const actor =
                  notification.kind === 'maintenance-reminder'
                    ? 'Scheduled'
                    : notification.ownChange
                      ? 'By you'
                      : `By ${'updatedBy' in notification.event ? notification.event.updatedBy.name : (notification.event.performedBy?.name ?? 'someone else')}`;
                const content = describe(notification, actor);
                return (
                  <li key={notification.id}>
                    <Link
                      href={content.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-hover focus-visible:-outline-offset-2"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[13px] font-semibold text-ink">{content.title}</p>
                        <time className="shrink-0 text-[11px] text-muted" dateTime={toIsoString(notification.timestamp)}>
                          {formatRelativeTime(notification.timestamp)}
                        </time>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{content.body}</div>
                      <p className="mt-1 text-xs text-muted">{content.caption}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
