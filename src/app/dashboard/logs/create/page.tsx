import { type Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateMachineLogView } from '@/features/machine-logs/components/create-machine-log-view';

export const metadata: Metadata = { title: 'Record activity' };

export default function CreateLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CreateMachineLogView />
    </Suspense>
  );
}
