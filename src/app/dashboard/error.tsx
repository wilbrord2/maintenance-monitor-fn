'use client';

import { useEffect } from 'react';
import { AppErrorBoundaryView } from '@/components/feedback/app-error-boundary-view';

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <AppErrorBoundaryView onRetry={retry} digest={error.digest} />;
}
