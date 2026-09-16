import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditMachineLogView } from '@/features/machine-logs/components/edit-machine-log-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Edit log' };

export default async function EditLogPage({ params }: { params: Promise<{ id: string }> }) {
  const logId = parseIdParam((await params).id);
  if (!logId) notFound();
  return <EditMachineLogView logId={logId} />;
}
