import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MachineDetailView } from '@/features/machines/components/machine-detail-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Machine details' };

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const machineId = parseIdParam((await params).id);
  if (!machineId) notFound();
  return <MachineDetailView machineId={machineId} />;
}
