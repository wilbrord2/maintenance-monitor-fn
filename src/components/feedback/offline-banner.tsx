'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-xs font-semibold text-warning-ink">
      <WifiOff className="size-3.5" aria-hidden />
      You&apos;re offline. Data may be out of date and changes can&apos;t be saved until the connection returns.
    </div>
  );
}
