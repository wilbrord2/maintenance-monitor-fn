'use client';

import { type FormEvent, useState } from 'react';
import { FilterField } from '@/components/data/filter-field';
import { FormError } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { addDays, toIsoDateString } from '@/lib/utils/date';
import { type Timeframe, TIMEFRAME_OPTIONS, type TimeframePreset, validateCustomRange } from '../lib/timeframe';

export interface TimeframeFilterProps {
  timeframe: Timeframe;
  today: string;
  label: string;
  onPreset(preset: Exclude<TimeframePreset, 'custom'>): void;
  onCustomRange(from: string, to: string): void;
}

/** One filter row that scopes every analytics section on the page. */
export function TimeframeFilter({ timeframe, today, label, onPreset, onCustomRange }: TimeframeFilterProps) {
  const [customOpen, setCustomOpen] = useState(timeframe.preset === 'custom');
  const [from, setFrom] = useState(() => timeframe.from ?? toIsoDateString(addDays(new Date(), -29)));
  const [to, setTo] = useState(() => timeframe.to ?? today);
  const draftError = validateCustomRange(from, to, today);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!draftError) onCustomRange(from, to);
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-panel p-3 sm:p-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-secondary" aria-hidden>
          Timeframe
        </span>
        <SegmentedControl<TimeframePreset>
          label="Timeframe"
          options={TIMEFRAME_OPTIONS}
          value={customOpen ? 'custom' : timeframe.preset}
          onChange={(value) => {
            if (value === 'custom') {
              setCustomOpen(true);
            } else {
              setCustomOpen(false);
              onPreset(value);
            }
          }}
          className="max-w-full overflow-x-auto"
        />
      </div>

      {customOpen ? (
        <form onSubmit={apply} noValidate className="flex flex-wrap items-end gap-2">
          <FilterField label="From" className="w-40">
            {(id) => <Input id={id} type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} />}
          </FilterField>
          <FilterField label="To" className="w-40">
            {(id) => <Input id={id} type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} />}
          </FilterField>
          <Button type="submit" disabled={Boolean(draftError)}>
            Apply
          </Button>
          {draftError ? <FormError className="basis-full">{draftError}</FormError> : null}
        </form>
      ) : null}

      <p className="text-xs text-muted lg:ml-auto" aria-live="polite">
        Showing <span className="font-semibold text-ink">{label}</span>
      </p>
    </div>
  );
}
