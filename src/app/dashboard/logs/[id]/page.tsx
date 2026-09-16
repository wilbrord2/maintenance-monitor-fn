import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LogDetailView } from '@/features/machine-logs/components/log-detail-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Maintenance log' };

export default async function LogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const logId = parseIdParam((await params).id);
  if (!logId) notFound();
  return <LogDetailView logId={logId} />;
}
