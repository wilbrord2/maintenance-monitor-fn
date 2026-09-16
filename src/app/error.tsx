'use client';

import { useEffect } from 'react';
import { AppErrorBoundaryView } from '@/components/feedback/app-error-boundary-view';

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <AppErrorBoundaryView onRetry={retry} digest={error.digest} />
    </main>
  );
}
