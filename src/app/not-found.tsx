import { type Metadata } from 'next';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { BrandMark } from '@/components/layout/brand-mark';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <BrandMark />
      <div className="w-full max-w-md rounded-lg border border-line bg-panel">
        <NotFoundState
          title="Page not found"
          description="The address may be mistyped, or the page has moved."
        />
      </div>
    </main>
  );
}
