import { BrandMark } from '@/components/layout/brand-mark';
import { Spinner } from '@/components/ui/spinner';

/** Full-screen placeholder while the session is being restored. */
export function PageLoader({ label = 'Loading Maintenance Monitor' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper px-4">
      <BrandMark />
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner label={label} />
        <span aria-hidden>{label}…</span>
      </div>
    </div>
  );
}
