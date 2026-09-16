import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TechnicianDetailView } from '@/features/technicians/components/technician-detail-view';
import { parseIdParam } from '@/lib/utils/url-params';

export const metadata: Metadata = { title: 'Account details' };

export default async function TechnicianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = parseIdParam((await params).id);
  if (!userId) notFound();
  return <TechnicianDetailView userId={userId} />;
}
