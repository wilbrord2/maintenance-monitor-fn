import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MaintenanceEventDetailView } from '@/features/maintenance/components/maintenance-event-detail-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Maintenance details' };

export default async function MaintenanceEventPage({ params }: { params: Promise<{ id: string }> }) {
  const eventId = parseIdParam((await params).id);
  if (!eventId) notFound();
  return <MaintenanceEventDetailView eventId={eventId} />;
}
