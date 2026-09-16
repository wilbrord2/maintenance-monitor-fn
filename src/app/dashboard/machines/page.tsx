import { type Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { MachinesView } from '@/features/machines/components/machines-view';

export const metadata: Metadata = { title: 'Machines' };

export default function MachinesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <MachinesView />
    </Suspense>
  );
}
