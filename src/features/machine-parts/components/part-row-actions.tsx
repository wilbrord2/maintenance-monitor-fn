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
import { type MachinePart } from '@/types/machine-part';
import { type PartDialog, PartManageDialogs } from './part-manage-dialogs';

export interface PartRowActionsProps {
  part: MachinePart;
  machineName: string;
  /** Hide the link to the part page when the actions are already on it. */
  hideDetailLink?: boolean;
  /** Hide the quick record button when the page already has one. */
  hideRecordButton?: boolean;
  onDeleted?(): void;
  className?: string;
}

/** Per-part actions. A part's status changes only by recording a log against it, never by editing it. */
export function PartRowActions({
  part,
  machineName,
  hideDetailLink,
  hideRecordButton,
  onDeleted,
  className,
}: PartRowActionsProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [dialog, setDialog] = useState<PartDialog>(null);
  const canManage = can(Permission.MANAGE_PARTS);
  const canRecord = can(Permission.CREATE_LOGS) && part.isActive && !hideRecordButton;

  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      {canRecord ? (
        <Tooltip content="Record activity">
          <Link
            href={buildCreateLogUrl(part.machineId, part.id)}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            aria-label={`Record activity for ${part.name}`}
          >
            <ClipboardPlus className="size-4" aria-hidden />
          </Link>
        </Tooltip>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${part.name}`}>
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {hideDetailLink ? null : (
            <DropdownMenuItem
              icon={Eye}
              onSelect={() => router.push(ROUTES.machinePart(part.machineId, part.id))}
            >
              View part and history
            </DropdownMenuItem>
          )}
          {canManage ? (
            <>
              <DropdownMenuItem icon={Pencil} onSelect={() => setDialog('edit')}>
                Edit part
              </DropdownMenuItem>
              {part.isActive ? (
                <DropdownMenuItem icon={PowerOff} onSelect={() => setDialog('deactivate')}>
                  Take out of use
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem icon={Power} onSelect={() => setDialog('activate')}>
                  Put back in use
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => setDialog('delete')}>
                Remove part
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PartManageDialogs
        part={part}
        machineName={machineName}
        dialog={dialog}
        onClose={() => setDialog(null)}
        onDeleted={onDeleted}
      />
    </div>
  );
}
