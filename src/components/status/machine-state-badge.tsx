'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { type MachineState } from '@/types/machine';

export interface MachineStateBadgeProps extends Pick<BadgeProps, 'size' | 'className'> {
  state: MachineState;
}

/** Machine state with icon and text (never colour alone); cross-fades when the state changes. */
export function MachineStateBadge({ state, size = 'md', className }: MachineStateBadgeProps) {
  const config = MACHINE_STATE_CONFIG[state];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
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
