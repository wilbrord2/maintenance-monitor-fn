'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { MACHINE_OPERATIONAL_STATUS_CONFIG } from '@/constants/machine-operational-status';
import { TONE_CLASSES } from '@/constants/tones';
import { cn } from '@/lib/utils/cn';
import { type MachineOperationalStatus } from '@/types/machine';

export interface OperationalStatusBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  status: MachineOperationalStatus;
}

/**
 * The machine's operational status, exactly as the API resolved it. Icon and text always carry
 * the meaning, so the status never depends on colour alone.
 */
export function OperationalStatusBadge({ status, size = 'md', className }: OperationalStatusBadgeProps) {
  const config = MACHINE_OPERATIONAL_STATUS_CONFIG[status];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        className="inline-flex max-w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.16 }}
      >
        <Badge tone={config.tone} icon={config.icon} size={size} className={className} title={config.description}>
          {config.label}
        </Badge>
      </motion.span>
    </AnimatePresence>
  );
}

export interface OperationalStatusHeadlineProps {
  status: MachineOperationalStatus;
  /** The API's explanation of the status, shown underneath when available. */
  reason?: string | null;
  className?: string;
}

/** The prominent status block at the top of a machine page. */
export function OperationalStatusHeadline({ status, reason, className }: OperationalStatusHeadlineProps) {
  const config = MACHINE_OPERATIONAL_STATUS_CONFIG[status];
  const tone = TONE_CLASSES[config.tone];
  const Icon = config.icon;
  return (
    <div
      className={cn('flex items-start gap-3 rounded-lg border border-line border-l-4 p-3', tone.accent, tone.surface, className)}
    >
      <Icon className={cn('mt-0.5 size-6 shrink-0', tone.text)} aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Machine status</p>
        <p className="text-lg leading-tight font-semibold text-ink">{config.label}</p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">{reason || config.description}</p>
      </div>
    </div>
  );
}
