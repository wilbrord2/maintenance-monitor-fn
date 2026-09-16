import { NotFoundState } from '@/components/feedback/not-found-state';

export default function DashboardNotFound() {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <NotFoundState title="Page not found" description="This page doesn't exist. Use the navigation to find what you need." />
    </div>
  );
}
