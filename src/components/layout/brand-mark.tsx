import { cn } from '@/lib/utils/cn';

export interface BrandMarkProps {
  /** Light text for dark backgrounds. */
  inverted?: boolean;
  /** Hide the wordmark (collapsed sidebar). */
  iconOnly?: boolean;
  className?: string;
}

export function BrandMark({ inverted = false, iconOnly = false, className }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden>
        <rect width="28" height="28" rx="4" fill={inverted ? '#ffffff' : '#1b2430'} />
        <path d="M7 19.5a7 7 0 0 1 14 0" fill="none" stroke={inverted ? '#1b2430' : '#ffffff'} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M14 19.5 18.2 12.8" stroke="#e2a33d" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="14" cy="19.5" r="1.9" fill="#e2a33d" />
      </svg>
      {iconOnly ? (
        <span className="sr-only">Maintenance Monitor</span>
      ) : (
        <span className={cn('text-[15px] leading-none font-semibold tracking-tight', inverted ? 'text-white' : 'text-ink')}>
          Maintenance Monitor
        </span>
      )}
    </span>
  );
}
