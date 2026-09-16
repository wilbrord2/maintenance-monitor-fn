'use client';

import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/constants/routes';
import { signOut } from '@/lib/auth/session-manager';
import { useSession } from '@/lib/auth/session-store';
import { notify } from '@/lib/notify';
import { ROLE_LABELS } from '@/lib/permissions/permissions';
import { getInitials } from '@/lib/utils/format';

export function UserMenu() {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const handleSignOut = () => {
    setSigningOut(true);
    void signOut()
      .then(() => notify.info('Signed out'))
      .finally(() => setSigningOut(false));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.fullName}`}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md px-1 hover:bg-hover md:px-1.5"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-steel text-[11px] font-semibold text-white" aria-hidden>
            {getInitials(user.fullName)}
          </span>
          <span className="hidden text-left md:block">
            <span className="block max-w-36 truncate text-[13px] leading-tight font-semibold text-ink">{user.fullName}</span>
            <span className="block text-[11px] leading-tight text-muted">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-muted md:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-[13px] font-semibold text-ink">{user.fullName}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={UserRound} onSelect={() => router.push(ROUTES.profile)}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem icon={KeyRound} onSelect={() => router.push(ROUTES.changePassword)}>
          Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={LogOut} tone="danger" disabled={signingOut} onSelect={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
