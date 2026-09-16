import { type Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { AuditLogsView } from '@/features/audit/components/audit-logs-view';

export const metadata: Metadata = { title: 'Audit logs' };

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <AuditLogsView />
    </Suspense>
  );
}
