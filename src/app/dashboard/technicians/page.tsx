import { type Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TechniciansView } from '@/features/technicians/components/technicians-view';

export const metadata: Metadata = { title: 'Technicians' };

export default function TechniciansPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <TechniciansView />
    </Suspense>
  );
}
