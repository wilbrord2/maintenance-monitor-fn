'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ComponentProps, createContext, type ReactNode, use } from 'react';
import { cn } from '@/lib/utils/cn';

const DialogOpenContext = createContext(false);

export interface DialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  children: ReactNode;
}

/** Controlled, accessible dialog (focus trap, Escape, scroll lock) with animated entry and exit. */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogOpenContext value={open}>{children}</DialogOpenContext>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZE_CLASSES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

export interface DialogContentProps
  extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title' | 'asChild' | 'forceMount'> {
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  /** `alertdialog` for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
  hideCloseButton?: boolean;
}

export function DialogContent({
  title,
  description,
  size = 'md',
  role = 'dialog',
  hideCloseButton = false,
  className,
  children,
  ...props
}: DialogContentProps) {
  const open = use(DialogOpenContext);
  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          </DialogPrimitive.Overlay>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <DialogPrimitive.Content
              asChild
              forceMount
              role={role}
              aria-describedby={description ? undefined : undefined}
              {...props}
            >
              <motion.div
                className={cn(
                  'pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-line bg-panel shadow-overlay sm:rounded-lg',
                  SIZE_CLASSES[size],
                  className,
                )}
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">
                        {description}
                      </DialogPrimitive.Description>
                    ) : null}
                  </div>
                  {hideCloseButton ? null : (
                    <DialogPrimitive.Close
                      className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="size-4" aria-hidden />
                    </DialogPrimitive.Close>
                  )}
                </div>
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line bg-sunken px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-3',
        className,
      )}
      {...props}
    />
  );
}
