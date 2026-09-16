'use client';

import { Ellipsis, Eye, KeyRound, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/constants/routes';
import { useSession } from '@/lib/auth/session-store';
import { Role } from '@/types/auth';
import { type User } from '@/types/user';
import { type TechnicianDialog } from './technician-manage-dialogs';

export interface TechnicianActionsMenuProps {
  user: User;
  onAction(dialog: Exclude<TechnicianDialog, null>): void;
  showView?: boolean;
  triggerVariant?: 'ghost' | 'secondary';
}

/** Account actions. Administrators can't deactivate or delete their own account. */
export function TechnicianActionsMenu({ user, onAction, showView = true, triggerVariant = 'ghost' }: TechnicianActionsMenuProps) {
  const router = useRouter();
  const isSelf = useSession((state) => state.user?.id === user.id);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant={triggerVariant} size={triggerVariant === 'ghost' ? 'icon-sm' : 'icon'} aria-label={`Actions for ${user.fullName}`}>
          <Ellipsis className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {showView ? (
          <DropdownMenuItem icon={Eye} onSelect={() => router.push(ROUTES.technician(user.id))}>
            View details
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem icon={Pencil} onSelect={() => onAction('edit')}>
          Edit details
        </DropdownMenuItem>
        {user.role === Role.TECHNICIAN && user.isActive ? (
          <DropdownMenuItem icon={KeyRound} onSelect={() => onAction('reissue')}>
            Send new temporary password
          </DropdownMenuItem>
        ) : null}
        {isSelf ? null : (
          <>
            {user.isActive ? (
              <DropdownMenuItem icon={PowerOff} onSelect={() => onAction('deactivate')}>
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem icon={Power} onSelect={() => onAction('activate')}>
                Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => onAction('delete')}>
              Delete account
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
