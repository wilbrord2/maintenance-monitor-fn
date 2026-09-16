'use client';

import { Ellipsis, Eye, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/constants/routes';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { type MachineLog } from '@/types/machine-log';
import { DeleteLogDialog } from './delete-log-dialog';

export function LogRowActions({ log, className }: { log: MachineLog; className?: string }) {
  const router = useRouter();
  const { can } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = can(Permission.DELETE_LOGS);

  return (
    <div className={className}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for log ${log.id} on ${log.machine.name}`}>
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={Eye} onSelect={() => router.push(ROUTES.log(log.id))}>
            View log
          </DropdownMenuItem>
          {can(Permission.UPDATE_LOGS) ? (
            <DropdownMenuItem icon={Pencil} onSelect={() => router.push(ROUTES.editLog(log.id))}>
              Edit log
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => setDeleteOpen(true)}>
                Delete log
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete ? <DeleteLogDialog log={log} open={deleteOpen} onOpenChange={setDeleteOpen} /> : null}
    </div>
  );
}
