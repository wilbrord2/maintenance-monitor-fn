import { type Metadata } from 'next';
import { Suspense } from 'react';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { AnalyticsView } from '@/features/analytics/components/analytics-view';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<ChartSkeleton height={320} />}>
      <AnalyticsView />
    </Suspense>
  );
}
