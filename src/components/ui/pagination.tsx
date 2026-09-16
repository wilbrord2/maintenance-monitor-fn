'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import { type PaginationMeta } from '@/types/api';
import { Button } from './button';
import { Select } from './select';

type PageItem = number | 'gap-start' | 'gap-end';

/** First, last and the pages around the current one, with gaps in between. */
export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) items.push(page < current ? 'gap-start' : 'gap-end');
    items.push(page);
  });
  return items;
}

/** "21–40" for page 2 of 20 per page. */
export function getRangeLabel(meta: PaginationMeta): { start: number; end: number } {
  if (meta.totalItems === 0) return { start: 0, end: 0 };
  const start = (meta.page - 1) * meta.limit + 1;
  return { start, end: Math.min(meta.page * meta.limit, meta.totalItems) };
}

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange(page: number): void;
  onPageSizeChange?(size: number): void;
  pageSizeOptions?: readonly number[];
  /** Plural noun for the range text, e.g. "machines". */
  itemLabel?: string;
  className?: string;
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = 'results',
  className,
}: PaginationProps) {
  const sizeId = useId();
  const totalPages = Math.max(meta.totalPages, 1);
  const { start, end } = getRangeLabel(meta);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-muted" aria-live="polite">
        Showing{' '}
        <span className="font-semibold text-ink tabular-nums">
          {formatNumber(start)}–{formatNumber(end)}
        </span>{' '}
        of <span className="font-semibold text-ink tabular-nums">{formatNumber(meta.totalItems)}</span> {itemLabel}
      </p>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="text-xs text-muted">
              Rows
            </label>
            <Select
              id={sizeId}
              value={String(meta.limit)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
              className="h-8 w-[4.5rem] text-[13px]"
            />
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
            aria-label="Previous page"
          >
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <ol className="hidden items-center gap-1 md:flex">
            {getPageItems(meta.page, totalPages).map((item) =>
              typeof item === 'number' ? (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => onPageChange(item)}
                    aria-current={item === meta.page ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                    className={cn(
                      'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold tabular-nums',
                      item === meta.page ? 'bg-primary text-primary-ink' : 'text-ink-secondary hover:bg-hover',
                    )}
                  >
                    {item}
                  </button>
                </li>
              ) : (
                <li key={item} aria-hidden className="px-1 text-xs text-muted">
                  …
                </li>
              ),
            )}
          </ol>
          <span className="px-2 text-xs text-muted tabular-nums md:hidden">
            Page {meta.page} of {totalPages}
          </span>

          <Button
            variant="secondary"
            size="sm"
            disabled={meta.page >= totalPages}
            onClick={() => onPageChange(meta.page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
