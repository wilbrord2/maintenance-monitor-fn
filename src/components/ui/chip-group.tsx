'use client';

import { type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';

export interface ChipOption<TValue extends string> {
  value: TValue;
  label: string;
  count?: number;
  /** Colour swatch shown beside the label (always paired with text). */
  swatch?: string;
}

export interface ChipGroupProps<TValue extends string> {
  options: readonly ChipOption<TValue>[];
  value: TValue;
  onChange(value: TValue): void;
  label: string;
  className?: string;
}

/** Quick single-choice filter chips with radio semantics; scrolls horizontally on narrow screens. */
export function ChipGroup<TValue extends string>({ options, value, onChange, label, className }: ChipGroupProps<TValue>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5', className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors',
              checked ? 'border-ink bg-ink text-white' : 'border-line bg-panel text-ink-secondary hover:border-line-strong hover:text-ink',
            )}
          >
            {option.swatch ? <span className="size-2 rounded-[2px]" style={{ backgroundColor: option.swatch }} aria-hidden /> : null}
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('tabular-nums', checked ? 'text-white/75' : 'text-muted')}>{formatNumber(option.count)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
