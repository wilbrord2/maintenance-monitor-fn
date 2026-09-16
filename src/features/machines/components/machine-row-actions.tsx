'use client';

import { ClipboardPlus, Ellipsis, Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { buildCreateLogUrl, ROUTES } from '@/constants/routes';
import { Permission } from '@/lib/permissions/permissions';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';
import { type Machine } from '@/types/machine';
import { type MachineDialog, MachineManageDialogs } from './machine-manage-dialogs';

/** Per-machine actions. Status is never changed here: it changes by recording activity. */
export function MachineRowActions({ machine, className }: { machine: Machine; className?: string }) {
  const router = useRouter();
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<MachineDialog>(null);
  const canManage = can(Permission.MANAGE_MACHINES);

  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      {can(Permission.CREATE_LOGS) && machine.isActive ? (
        <Tooltip content="Record activity">
          <Link
            href={buildCreateLogUrl(machine.id)}
            aria-label={`Record activity for ${machine.name}`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ClipboardPlus className="size-4" aria-hidden />
          </Link>
        </Tooltip>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${machine.name}`}>
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={Eye} onSelect={() => router.push(ROUTES.machine(machine.id))}>
            View details
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuItem icon={Pencil} onSelect={() => setDialog('edit')}>
                Edit machine
              </DropdownMenuItem>
              {machine.isActive ? (
                <DropdownMenuItem icon={PowerOff} onSelect={() => setDialog('deactivate')}>
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem icon={Power} onSelect={() => setDialog('activate')}>
                  Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => setDialog('delete')}>
                Delete machine
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage ? <MachineManageDialogs machine={machine} dialog={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
