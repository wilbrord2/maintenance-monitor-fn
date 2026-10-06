import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartDetailView } from '@/features/machine-parts/components/part-detail-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Machine part' };

export default async function MachinePartPage({ params }: { params: Promise<{ id: string; partId: string }> }) {
  const { id, partId } = await params;
  const machineId = parseIdParam(id);
  const part = parseIdParam(partId);
  if (!machineId || !part) notFound();
  return <PartDetailView machineId={machineId} partId={part} />;
}
