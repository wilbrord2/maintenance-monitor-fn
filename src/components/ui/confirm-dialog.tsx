'use client';

import { type ReactNode, useRef } from 'react';
import { Button } from './button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` styles the confirm button as destructive. */
  tone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm(): void;
  /** Extra context such as consequences or the affected record. */
  children?: ReactNode;
}

/**
 * Confirmation for destructive or important actions. Focus starts on Cancel so a stray
 * Enter key or double click never confirms by accident.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent
        role="alertdialog"
        size="sm"
        title={title}
        description={description}
        hideCloseButton
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        {children ? <DialogBody>{children}</DialogBody> : null}
        <DialogFooter>
          <Button ref={cancelRef} variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
