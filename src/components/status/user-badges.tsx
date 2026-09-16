import { CircleCheck, KeyRound, Lock, PowerOff, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/permissions/permissions';
import { Role } from '@/types/auth';
import { type User } from '@/types/user';

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge size="sm" variant="outline" tone={role === Role.ADMIN ? 'info' : 'neutral'} icon={role === Role.ADMIN ? ShieldCheck : Wrench}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** Account state: active or deactivated, plus lock and pending first sign-in when relevant. */
export function UserStatusBadges({ user }: { user: Pick<User, 'isActive' | 'isLocked' | 'mustChangePassword'> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {user.isActive ? (
        <Badge size="sm" tone="positive" icon={CircleCheck}>
          Active
        </Badge>
      ) : (
        <Badge size="sm" tone="neutral" icon={PowerOff}>
          Deactivated
        </Badge>
      )}
      {user.isLocked ? (
        <Badge size="sm" tone="critical" icon={Lock}>
          Locked
        </Badge>
      ) : null}
      {user.mustChangePassword ? (
        <Badge size="sm" tone="warning" variant="outline" icon={KeyRound}>
          Awaiting first sign-in
        </Badge>
      ) : null}
    </span>
  );
}
