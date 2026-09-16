'use client';

import { type LucideIcon } from 'lucide-react';
import { type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
  icon?: LucideIcon;
  /** Show only the icon; the label remains available to screen readers. */
  iconOnly?: boolean;
}

export interface SegmentedControlProps<TValue extends string> {
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onChange(value: TValue): void;
  label: string;
  className?: string;
}

/** Single-choice toggle group with radio semantics and arrow-key navigation. */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<TValue>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md border border-line bg-sunken p-0.5', className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.iconOnly ? option.label : undefined}
            title={option.iconOnly ? option.label : undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-semibold whitespace-nowrap transition-colors',
              checked ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
            )}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {option.iconOnly ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}
