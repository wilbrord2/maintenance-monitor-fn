'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  side?: 'left' | 'right';
  title: ReactNode;
  description?: ReactNode;
  /** Visually hide the title (it stays available to screen readers). */
  hideHeader?: boolean;
  className?: string;
  children: ReactNode;
}

/** Side drawer built on the accessible dialog primitive. */
export function Sheet({ open, onOpenChange, side = 'right', title, description, hideHeader = false, className, children }: SheetProps) {
  const offset = side === 'left' ? '-100%' : '100%';
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  'fixed inset-y-0 z-50 flex w-[min(100vw,26rem)] flex-col bg-panel shadow-overlay',
                  side === 'left' ? 'left-0 border-r border-line' : 'right-0 border-l border-line',
                  className,
                )}
                initial={{ x: offset }}
                animate={{ x: 0 }}
                exit={{ x: offset }}
                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              >
                <div
                  className={cn(
                    'flex items-start justify-between gap-4 border-b border-line px-5 py-4',
                    hideHeader && 'sr-only',
                  )}
                >
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">
                        {description}
                      </DialogPrimitive.Description>
                    ) : null}
                  </div>
                  <DialogPrimitive.Close
                    className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="size-4" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
