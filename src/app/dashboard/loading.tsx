import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading page">
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="mb-6 h-7 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72" />
    </LoadingRegion>
  );
}
