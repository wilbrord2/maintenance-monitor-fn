'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { notify } from '@/lib/notify';
import { formatDateTime } from '@/lib/utils/date';
import { type MachineLog } from '@/types/machine-log';
import { useDeleteMachineLog } from '../api/mutations';

export interface DeleteLogDialogProps {
  log: MachineLog;
  open: boolean;
  onOpenChange(open: boolean): void;
  onDeleted?(): void;
}

/** Administrator-only destructive action, always confirmed. */
export function DeleteLogDialog({ log, open, onOpenChange, onDeleted }: DeleteLogDialogProps) {
  const remove = useDeleteMachineLog();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete maintenance log?"
      description="This action may affect the machine's historical activity. Are you sure you want to continue?"
      confirmLabel="Delete log"
      tone="danger"
      loading={remove.isPending}
      onConfirm={() =>
        remove.mutate(log, {
          onSuccess: () => {
            notify.success('Log deleted', `The log for ${log.machine.name} was removed.`);
            onOpenChange(false);
            onDeleted?.();
          },
          onError: (error) => notify.error(error, "Couldn't delete the log"),
        })
      }
    >
      <div className="rounded-md border border-line bg-sunken px-3 py-2.5 text-[13px]">
        <p className="font-semibold text-ink">
          {log.machine.name} <span className="font-mono text-xs font-normal text-muted">{log.machine.serialNumber}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-ink-secondary">{log.faultDescription}</p>
        <p className="mt-1 text-xs text-muted">
          Started {formatDateTime(log.startedAt)} · {log.technician.fullName}
        </p>
      </div>
      <p className="mt-3 text-xs text-muted">
        If this is the machine&apos;s most recent log, the machine returns to{' '}
        <span className="font-semibold text-ink">{MACHINE_STATE_CONFIG[log.entryStatus].label}</span>, the state it was in
        before this event.
      </p>
    </ConfirmDialog>
  );
}
