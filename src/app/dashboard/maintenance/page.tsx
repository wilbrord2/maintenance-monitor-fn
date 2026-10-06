import { type Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { MaintenanceView } from '@/features/maintenance/components/maintenance-view';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <MaintenanceView />
    </Suspense>
  );
}
