import { type ReactNode, Suspense } from 'react';
import { PageLoader } from '@/components/feedback/page-loader';
import { AppShell } from '@/components/layout/app-shell';
import { RequireSession } from '@/features/auth/components/require-session';
import { RealtimeProvider } from '@/providers/realtime-provider';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireSession>
        <RealtimeProvider>
          <AppShell>{children}</AppShell>
        </RealtimeProvider>
      </RequireSession>
    </Suspense>
  );
}
