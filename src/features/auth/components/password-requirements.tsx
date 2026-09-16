import { Circle, CircleCheck } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/validation/primitives';
import { cn } from '@/lib/utils/cn';

/** Live checklist of the password policy. */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul aria-label="Password requirements" className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const Icon = met ? CircleCheck : Circle;
        return (
          <li key={rule.id} className={cn('flex items-center gap-1.5 text-xs', met ? 'text-positive-ink' : 'text-muted')}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' — met' : ' — not met'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
