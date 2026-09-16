import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TONE_CLASSES, type Tone } from '@/constants/tones';
import { cn } from '@/lib/utils/cn';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Adds a tone accent; omit for neutral metrics. */
  tone?: Tone;
  caption?: ReactNode;
  href?: string;
  loading?: boolean;
  /** Draws attention (e.g. machines in downtime). */
  emphasized?: boolean;
  className?: string;
}

/** A single headline number. Values use proportional figures, as recommended for standalone numbers. */
export function StatTile({ label, value, icon: Icon, tone, caption, href, loading = false, emphasized = false, className }: StatTileProps) {
  const toneClasses = tone ? TONE_CLASSES[tone] : null;
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon ? <Icon className={cn('size-4 shrink-0', toneClasses ? toneClasses.text : 'text-muted')} aria-hidden /> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-14" />
      ) : (
        <p className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight text-ink">{value}</p>
      )}
      {caption ? <p className="mt-2 truncate text-xs text-muted">{caption}</p> : null}
    </>
  );

  const classes = cn(
    'block min-w-0 rounded-lg border border-line bg-panel px-4 py-3.5 shadow-xs',
    toneClasses && `border-l-[3px] ${toneClasses.accent}`,
    emphasized && toneClasses && toneClasses.surface,
    href && 'transition-colors hover:border-line-strong hover:bg-sunken',
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
